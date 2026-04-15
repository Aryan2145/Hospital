import { pool } from "../db";
import { processDormantLeadsAndStaleAppointments } from "./nurtureEngine";
import { checkDormantLeads } from "./temperatureEngine";
import { sendDiscountApprovalEmail } from "../email";
import { sendDiscountApprovalSMS } from "../sms";

let schedulerInterval: NodeJS.Timeout | null = null;

export function startBackgroundScheduler(): void {
  if (schedulerInterval) return;

  console.log("[scheduler] Background scheduler started — runs every 30 minutes");

  setTimeout(() => runScheduledTasks(), 60 * 1000);

  schedulerInterval = setInterval(() => {
    runScheduledTasks();
  }, 30 * 60 * 1000);
}

export function stopBackgroundScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[scheduler] Background scheduler stopped");
  }
}

async function autoMarkNoShows(tenantId: number): Promise<number> {
  let count = 0;
  try {
    const today = new Date().toISOString().split('T')[0];

    const staleAppts = await pool.query(
      `SELECT a.id, a.lead_id
       FROM appointments a
       WHERE a.tenant_id = $1
         AND a.status IN ('Scheduled', 'Confirmed')
         AND a.checked_in_at IS NULL
         AND a.appointment_date < $2
         AND a.appointment_date > $2::date - INTERVAL '30 days'`,
      [tenantId, today]
    );

    if (staleAppts.rows.length === 0) return 0;

    const leadNoShowCounts = new Map<number, number>();
    for (const appt of staleAppts.rows) {
      leadNoShowCounts.set(appt.lead_id, (leadNoShowCounts.get(appt.lead_id) || 0) + 1);
    }

    const apptIds = staleAppts.rows.map((r: any) => r.id);
    await pool.query(
      `UPDATE appointments SET status = 'No Show', modified_at = NOW(), modified_by = 'system-scheduler'
       WHERE id = ANY($1) AND tenant_id = $2`,
      [apptIds, tenantId]
    );
    count = apptIds.length;

    for (const [leadId, noShowIncrement] of leadNoShowCounts.entries()) {
      try {
        await pool.query(
          `UPDATE leads SET 
            no_show_count = COALESCE(no_show_count, 0) + $3,
            last_activity_at = NOW()
           WHERE id = $1 AND tenant_id = $2`,
          [leadId, tenantId, noShowIncrement]
        );

        const result = await pool.query(
          `SELECT no_show_count, status FROM leads WHERE id = $1 AND tenant_id = $2`,
          [leadId, tenantId]
        );
        const lead = result.rows[0];
        if (lead && lead.no_show_count >= 2 &&
            lead.status !== "Nurture" && lead.status !== "Closed Won" && lead.status !== "Closed Lost") {
          await pool.query(
            `UPDATE leads SET status = 'Nurture' WHERE id = $1 AND tenant_id = $2`,
            [leadId, tenantId]
          );
        }
      } catch {}
    }
  } catch (err: any) {
    console.error(`[scheduler] Error in autoMarkNoShows for tenant ${tenantId}:`, err.message);
  }
  return count;
}

async function escalateOverdueDiscounts(tenantId: number, tenantName: string): Promise<void> {
  try {
    // Get configurable SLA window (default 4 hours)
    const slaRow = await pool.query(
      `SELECT setting_value FROM tenant_settings WHERE tenant_id = $1 AND setting_key = 'discountApprovalSlaHours' LIMIT 1`,
      [tenantId]
    );
    const slaHours = slaRow.rows[0] ? parseInt(slaRow.rows[0].setting_value, 10) : 4;
    const effectiveSla = isNaN(slaHours) || slaHours < 1 ? 4 : slaHours;

    // Find overdue pending discounts (requested but not yet escalated, past SLA window)
    const overdue = await pool.query(
      `SELECT e.id, e.discount_percent, e.discount_amount, e.discount_notes, e.discount_requested_at,
              COALESCE(l.name, CONCAT(p.first_name, ' ', p.last_name)) AS patient_name
       FROM episodes e
       LEFT JOIN leads l ON e.lead_id = l.id
       LEFT JOIN patients p ON e.patient_id = p.id
       WHERE e.tenant_id = $1
         AND e.discount_status = 'Pending'
         AND e.discount_escalated_at IS NULL
         AND e.discount_requested_at IS NOT NULL
         AND e.discount_requested_at < NOW() - INTERVAL '1 hour' * $2`,
      [tenantId, effectiveSla]
    );

    if (overdue.rows.length === 0) return;

    // Get ADMIN users for this tenant with their contact info
    const admins = await pool.query(
      `SELECT cu.id, cu.name, cu.email, cu.phone
       FROM crm_users cu
       JOIN system_roles sr ON cu.system_role_id = sr.id
       WHERE cu.tenant_id = $1
         AND sr.code IN ('ADMIN', 'SYS_ADMIN')
         AND cu.is_active = TRUE`,
      [tenantId]
    );

    if (admins.rows.length === 0) {
      console.log(`[scheduler] Tenant ${tenantId}: no active admins for discount escalation`);
      return;
    }

    for (const ep of overdue.rows) {
      try {
        const patientName = ep.patient_name || `Episode #${ep.id}`;
        const discountPercent = ep.discount_percent || 0;
        const discountAmount = ep.discount_amount || 0;
        const adminIds: number[] = admins.rows.map((a: any) => a.id);

        // Insert in-app notifications for all admin users
        if (adminIds.length > 0) {
          await pool.query(
            `INSERT INTO in_app_notifications (tenant_id, crm_user_id, type, title, body, entity_type, entity_id, link, is_read, created_at)
             SELECT $1, unnest($2::int[]), 'discount_escalation', $3, $4, 'episode', $5, $6, FALSE, NOW()`,
            [
              tenantId,
              adminIds,
              "Discount Approval Overdue — Action Required",
              `A discount request of ${discountPercent}% (₹${discountAmount.toLocaleString("en-IN")}) for ${patientName} has been pending beyond the ${effectiveSla}-hour SLA. Immediate review required.`,
              ep.id,
              `/episodes/${ep.id}`,
            ]
          );
        }

        // Send email + SMS to each admin
        for (const admin of admins.rows) {
          if (admin.email) {
            sendDiscountApprovalEmail({
              to: admin.email,
              approverName: admin.name,
              requestedBy: "System Escalation",
              patientName,
              episodeId: ep.id,
              discountPercent,
              discountAmount,
              discountNotes: ep.discount_notes || "",
              hospitalName: tenantName,
            }).catch((e: any) => console.error("[scheduler] Escalation email error:", e.message));
          }
          if (admin.phone) {
            sendDiscountApprovalSMS({
              phone: admin.phone,
              approverName: admin.name || "Admin",
              requestedBy: "System Escalation",
              patientName,
              episodeId: ep.id,
              discountPercent,
              discountAmount,
              hospitalName: tenantName,
            }).catch((e: any) => console.error("[scheduler] Escalation SMS error:", e.message));
          }
        }

        // Mark episode as escalated (prevents re-escalation)
        await pool.query(
          `UPDATE episodes SET discount_escalated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
          [ep.id, tenantId]
        );

        // Write audit log
        await pool.query(
          `INSERT INTO audit_logs (tenant_id, entity_type, entity_id, action, new_values, changed_fields, performed_by, performed_at)
           VALUES ($1, 'discount_request', $2, 'discount_escalated', $3, 'discountEscalatedAt', 'system-scheduler', NOW())`,
          [
            tenantId,
            ep.id,
            JSON.stringify({ escalatedAt: new Date().toISOString(), slaHours: effectiveSla, adminCount: admins.rows.length }),
          ]
        );

        console.log(`[scheduler] Tenant ${tenantName}: escalated discount on Episode #${ep.id} (${patientName}, ${discountPercent}%) to ${admins.rows.length} admin(s)`);
      } catch (epErr: any) {
        console.error(`[scheduler] Error escalating discount for Episode ${ep.id}:`, epErr.message);
      }
    }
  } catch (err: any) {
    console.error(`[scheduler] Error in escalateOverdueDiscounts for tenant ${tenantId}:`, err.message);
  }
}

async function runScheduledTasks(): Promise<void> {
  try {
    const tenantsResult = await pool.query(
      `SELECT id, name FROM tenants WHERE subscription_status = 'Active'`
    );

    for (const tenant of tenantsResult.rows) {
      try {
        await checkDormantLeads(tenant.id, 5);

        await autoMarkNoShows(tenant.id);

        const result = await processDormantLeadsAndStaleAppointments(tenant.id);

        if (result.dormantTasksCreated > 0 || result.staleLeadsFlagged > 0 || result.overdueNurtureEscalated > 0) {
          console.log(
            `[scheduler] Tenant ${tenant.name}: ${result.dormantTasksCreated} dormant tasks, ` +
            `${result.staleLeadsFlagged} stale flagged, ${result.overdueNurtureEscalated} nurture escalated`
          );
        }

        await escalateOverdueDiscounts(tenant.id, tenant.name);
      } catch (err: any) {
        console.error(`[scheduler] Error processing tenant ${tenant.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[scheduler] Fatal error in scheduled tasks:", err.message);
  }
}
