import { pool } from "../db";
import { processDormantLeadsAndStaleAppointments } from "./nurtureEngine";
import { checkDormantLeads } from "./temperatureEngine";
import { sendDiscountApprovalEmail } from "../email";
import { sendDiscountApprovalSMS } from "../sms";
import { syncAllActiveGoogleSheetConfigs } from "./googleSheetsSync";
import { escalateOverduePreopCases } from "./preopAssessment";
import { getWatiConfigFromSettings, sendWatiTemplate, sendWatiSession, formatPhoneForWati } from "../wati";
import { getWhatsAppConfigFromSettings, sendWhatsAppText, formatPhoneForWhatsApp } from "../whatsapp";

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

async function sendAppointmentReminders(tenantId: number): Promise<number> {
  let sentCount = 0;
  try {
    const settingsRows = await pool.query(
      `SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = $1`,
      [tenantId]
    );
    const settings: { settingKey: string; settingValue: string | null }[] =
      settingsRows.rows.map((r: any) => ({ settingKey: r.setting_key, settingValue: r.setting_value }));

    const watiConfig = getWatiConfigFromSettings(settings);
    const metaConfig = getWhatsAppConfigFromSettings(settings);

    // WATI reminders only fire when a reminder template is configured.
    // Session messages require an active 24h chat window which most patients won't have,
    // so we never use session messages for automated reminders.
    const useWati = watiConfig.enabled && !!watiConfig.templateReminder;

    // Meta fallback: only if WATI not in use. Meta uses plain text (works if Meta token valid).
    const useMeta = !watiConfig.enabled && metaConfig.enabled;

    if (!useWati && !useMeta) return 0;

    const tenantRow = await pool.query(`SELECT name FROM tenants WHERE id = $1`, [tenantId]);
    const hospitalName = tenantRow.rows[0]?.name || "Hospital";

    // Find appointments that are:
    // - Scheduled or Confirmed status
    // - appointment_date is today (within next 24h window) or tomorrow
    // - reminder_sent_at IS NULL (not yet reminded)
    const now = new Date();
    const windowStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);   // 2 hours from now
    const windowEnd = new Date(now.getTime() + 26 * 60 * 60 * 1000);    // 26 hours from now

    const windowStartDate = windowStart.toISOString().split("T")[0];
    const windowEndDate = windowEnd.toISOString().split("T")[0];

    const appts = await pool.query(
      `SELECT a.id, a.lead_id, a.appointment_date, a.start_time, a.token_number,
              l.name AS lead_name, l.phone_e164,
              COALESCE(d.name, 'your doctor') AS doctor_name
       FROM appointments a
       JOIN leads l ON a.lead_id = l.id
       LEFT JOIN doctors d ON a.doctor_id = d.id
       WHERE a.tenant_id = $1
         AND a.status IN ('Scheduled', 'Confirmed')
         AND a.checked_in_at IS NULL
         AND a.reminder_sent_at IS NULL
         AND l.phone_e164 IS NOT NULL
         AND a.appointment_date::date BETWEEN $2::date AND $3::date`,
      [tenantId, windowStartDate, windowEndDate]
    );

    for (const appt of appts.rows) {
      try {
        const leadName = appt.lead_name || "Patient";
        const doctorName = appt.doctor_name;
        const apptDate = new Date(appt.appointment_date).toLocaleDateString("en-GB");
        const apptTime = appt.start_time || "";
        const token = appt.token_number ? `#${appt.token_number}` : "";

        const reminderMsg =
          `Hello ${leadName},\n\nThis is a reminder for your appointment tomorrow at ${hospitalName}.\n\nDoctor: Dr. ${doctorName}\nDate: ${apptDate}${apptTime ? `\nTime: ${apptTime}` : ""}${token ? `\nToken: ${token}` : ""}\n\nPlease arrive 15 minutes early. Reply STOP to opt out.\n\nThank you,\n${hospitalName}`;

        let sent = false;

        if (useWati) {
          const phone = formatPhoneForWati(appt.phone_e164);
          let result;
          if (watiConfig.templateReminder) {
            result = await sendWatiTemplate(watiConfig, {
              to: phone,
              templateName: watiConfig.templateReminder,
              broadcastName: `appt_reminder_${appt.id}`,
              parameters: [
                { name: "patient_name", value: leadName },
                { name: "doctor_name", value: `Dr. ${doctorName}` },
                { name: "appointment_date", value: apptDate },
                { name: "appointment_time", value: apptTime || "As scheduled" },
                { name: "hospital_name", value: hospitalName },
              ],
            });
          } else {
            result = await sendWatiSession(watiConfig, phone, reminderMsg);
          }
          sent = result.success;
          if (!result.success) {
            console.error(`[scheduler] WATI reminder failed for appt #${appt.id}:`, result.error);
          }
        } else if (useMeta) {
          const phone = formatPhoneForWhatsApp(appt.phone_e164);
          const result = await sendWhatsAppText(metaConfig, phone, reminderMsg);
          sent = result.success;
          if (!result.success) {
            console.error(`[scheduler] Meta WA reminder failed for appt #${appt.id}:`, result.error);
          }
        }

        // Always mark reminder_sent_at to prevent infinite retry spam on repeated failures.
        // Activity log is only written on actual success.
        await pool.query(
          `UPDATE appointments SET reminder_sent_at = NOW() WHERE id = $1 AND tenant_id = $2`,
          [appt.id, tenantId]
        );

        if (sent) {
          await pool.query(
            `INSERT INTO activities (lead_id, tenant_id, created_by, type, description, created_at, modified_at)
             VALUES ($1, $2, 'system', 'whatsapp', $3, NOW(), NOW())`,
            [
              appt.lead_id,
              tenantId,
              `Appointment reminder sent via WhatsApp to ${appt.phone_e164} (${apptDate}${apptTime ? " " + apptTime : ""})`,
            ]
          );
          sentCount++;
        }
      } catch (apptErr: any) {
        console.error(`[scheduler] Error sending reminder for appt #${appt.id}:`, apptErr.message);
      }
    }
  } catch (err: any) {
    console.error(`[scheduler] Error in sendAppointmentReminders for tenant ${tenantId}:`, err.message);
  }
  return sentCount;
}

let lastMetaLogPurgeDate: string | null = null;

async function purgeOldMetaWebhookLogs(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  if (lastMetaLogPurgeDate === today) return;

  try {
    const result = await pool.query(
      `DELETE FROM meta_lead_capture_logs WHERE created_at < NOW() - INTERVAL '30 days'`
    );
    const deleted = result.rowCount ?? 0;
    if (deleted > 0) {
      console.log(`[scheduler] Purged ${deleted} Meta webhook log(s) older than 30 days`);
    }
    lastMetaLogPurgeDate = today;
  } catch (err: any) {
    console.error("[scheduler] Error purging old Meta webhook logs:", err.message);
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

        const preopEscalated = await escalateOverduePreopCases(tenant.id);
        if (preopEscalated > 0) {
          console.log(`[scheduler] Tenant ${tenant.name}: ${preopEscalated} pre-op assessment(s) escalated`);
        }

        const remindersSent = await sendAppointmentReminders(tenant.id);
        if (remindersSent > 0) {
          console.log(`[scheduler] Tenant ${tenant.name}: ${remindersSent} appointment reminder(s) sent via WhatsApp`);
        }
      } catch (err: any) {
        console.error(`[scheduler] Error processing tenant ${tenant.id}:`, err.message);
      }
    }

    // Global daily cleanup — not tenant-specific
    await purgeOldMetaWebhookLogs();

    // Google Sheets auto-sync — all active configs across all tenants
    await syncAllActiveGoogleSheetConfigs();
  } catch (err: any) {
    console.error("[scheduler] Fatal error in scheduled tasks:", err.message);
  }
}
