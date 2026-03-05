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

async function runScheduledTasks(): Promise<void> {
  try {
    const tenantsResult = await pool.query(
      `SELECT id, name FROM tenants WHERE subscription_status = 'Active'`
    );

    for (const tenant of tenantsResult.rows) {
      try {
        await checkDormantLeads(tenant.id, 5);

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
