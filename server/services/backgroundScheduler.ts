import { pool } from "../db";
import { processDormantLeadsAndStaleAppointments } from "./nurtureEngine";
import { checkDormantLeads } from "./temperatureEngine";

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

    if (count > 0) {
      console.log(`[scheduler] Auto-marked ${count} past appointments as No Show for ${leadNoShowCounts.size} leads in tenant ${tenantId}`);
    }
  } catch (err: any) {
    console.error(`[scheduler] Error in autoMarkNoShows for tenant ${tenantId}:`, err.message);
  }
  return count;
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
      } catch (err: any) {
        console.error(`[scheduler] Error processing tenant ${tenant.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[scheduler] Fatal error in scheduled tasks:", err.message);
  }
}
