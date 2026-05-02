import { db, pool } from "../db";
import { tasks, activities, episodePreopAssessments, preopReminderLog } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export async function resolvePreopNotifyList(
  episode: any,
  tenantId: number,
): Promise<Array<{ crmUserId: number; name: string; email: string | null; phone: string | null }>> {
  const userIds = new Set<number>();
  const users: Array<{ crmUserId: number; name: string; email: string | null; phone: string | null }> = [];

  const addUser = async (userId: number | null) => {
    if (!userId || userIds.has(userId)) return;
    const row = await pool.query(
      `SELECT cu.id, cu.name, cu.email, cu.phone FROM crm_users cu WHERE cu.id = $1 AND cu.tenant_id = $2 AND cu.is_active = TRUE`,
      [userId, tenantId]
    );
    if (row.rows[0]) {
      userIds.add(userId);
      users.push({ crmUserId: userId, name: row.rows[0].name, email: row.rows[0].email, phone: row.rows[0].phone });
    }
  };

  if (episode.preopAssignedUserId) await addUser(episode.preopAssignedUserId);
  if (episode.assignedCrmUserId) await addUser(episode.assignedCrmUserId);

  if (episode.leadId) {
    const leadRow = await pool.query(
      `SELECT assigned_crm_user_id FROM leads WHERE id = $1 AND tenant_id = $2`,
      [episode.leadId, tenantId]
    );
    if (leadRow.rows[0]?.assigned_crm_user_id) await addUser(leadRow.rows[0].assigned_crm_user_id);
  }

  if (users.length === 0) {
    const adminRow = await pool.query(
      `SELECT cu.id, cu.name, cu.email, cu.phone FROM crm_users cu
       JOIN system_roles sr ON cu.system_role_id = sr.id
       WHERE cu.tenant_id = $1 AND sr.code IN ('ADMIN', 'MANAGER') AND cu.is_active = TRUE
       ORDER BY CASE sr.code WHEN 'ADMIN' THEN 1 WHEN 'MANAGER' THEN 2 END LIMIT 1`,
      [tenantId]
    );
    if (adminRow.rows[0]) {
      users.push({ crmUserId: adminRow.rows[0].id, name: adminRow.rows[0].name, email: adminRow.rows[0].email, phone: adminRow.rows[0].phone });
    }
  }

  return users;
}

export async function triggerPreopEntryAutomation(
  episodeId: number,
  tenantId: number,
  episode: any,
  triggeredBy: string,
  triggeredByCrmUserId: number | null,
): Promise<void> {
  const patientName = episode.leadName || episode.patientName || `Episode #${episodeId}`;
  const surgeryDateStr = episode.surgeryDate
    ? new Date(episode.surgeryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "TBD";

  const notifyUsers = await resolvePreopNotifyList(episode, tenantId);

  for (const user of notifyUsers) {
    try {
      await db.insert(tasks).values({
        tenantId,
        leadId: episode.leadId,
        title: `Pre-op Readiness Check — ${patientName}`,
        description: `Complete the pre-operative assessment checklist for ${patientName} before surgery on ${surgeryDateStr}. Mark all items and set overall readiness status.`,
        priority: "High",
        dueDate: episode.surgeryDate ? new Date(new Date(episode.surgeryDate).getTime() - 24 * 60 * 60 * 1000) : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        assignedCrmUserId: user.crmUserId,
        status: "Pending",
        createdBy: "system",
      } as any);
    } catch (err: any) {
      console.error(`[preop] Error creating task for user ${user.crmUserId}:`, err.message);
    }

    try {
      await pool.query(
        `INSERT INTO in_app_notifications (tenant_id, crm_user_id, type, title, body, entity_type, entity_id, link, is_read, created_at)
         VALUES ($1, $2, 'preop_entry', $3, $4, 'episode', $5, $6, FALSE, NOW())`,
        [
          tenantId,
          user.crmUserId,
          `Pre-op Assessment Required — ${patientName}`,
          `Patient ${patientName} has entered the Pre-op Assessment stage. Surgery: ${surgeryDateStr}. Complete the readiness checklist.`,
          episodeId,
          `/episodes/${episodeId}`,
        ]
      );
    } catch {}
  }

  const doctorNotifyUsers: Array<{ name: string; email: string }> = [];
  if (episode.doctorId) {
    const docRow = await pool.query(
      `SELECT d.name, d.email, cu.id as crm_user_id, cu.name as crm_name, cu.email as crm_email
       FROM doctors d
       LEFT JOIN crm_users cu ON cu.id = d.crm_user_id AND cu.tenant_id = d.tenant_id
       WHERE d.id = $1 AND d.tenant_id = $2`,
      [episode.doctorId, tenantId]
    );
    if (docRow.rows[0]) {
      const doc = docRow.rows[0];
      if (doc.crm_user_id) {
        try {
          await pool.query(
            `INSERT INTO in_app_notifications (tenant_id, crm_user_id, type, title, body, entity_type, entity_id, link, is_read, created_at)
             VALUES ($1, $2, 'preop_entry', $3, $4, 'episode', $5, $6, FALSE, NOW())
             ON CONFLICT DO NOTHING`,
            [
              tenantId,
              doc.crm_user_id,
              `Pre-op Assessment — ${patientName}`,
              `Your patient ${patientName} is in Pre-op Assessment. Surgery: ${surgeryDateStr}.`,
              episodeId,
              `/episodes/${episodeId}`,
            ]
          );
        } catch {}
      }
    }
  }

  await db.insert(activities).values({
    tenantId,
    leadId: episode.leadId,
    type: "status_change",
    description: `Episode entered Pre-op Assessment stage. ${notifyUsers.length} team member(s) notified. Surgery: ${surgeryDateStr}.`,
    createdBy: triggeredBy,
    metadata: { preopEntry: true, notifiedUsers: notifyUsers.map(u => u.crmUserId) },
  } as any);
}

export async function getOrCreatePreopAssessment(episodeId: number, tenantId: number): Promise<any> {
  const existing = await pool.query(
    `SELECT * FROM episode_preop_assessments WHERE episode_id = $1 AND tenant_id = $2 ORDER BY id DESC LIMIT 1`,
    [episodeId, tenantId]
  );
  if (existing.rows[0]) return existing.rows[0];
  return null;
}

export async function escalateOverduePreopCases(tenantId: number): Promise<number> {
  let escalated = 0;
  try {
    const overdue = await pool.query(
      `SELECT e.id, e.preop_entered_at, e.surgery_date, e.preop_clearance_given,
              COALESCE(l.name, CONCAT(p.first_name, ' ', p.last_name)) as patient_name
       FROM episodes e
       LEFT JOIN leads l ON e.lead_id = l.id
       LEFT JOIN patients p ON e.patient_id = p.id
       WHERE e.tenant_id = $1
         AND e.status = 'Pre-op Assessment'
         AND e.preop_clearance_given = FALSE
         AND e.preop_entered_at < NOW() - INTERVAL '48 hours'
         AND NOT EXISTS (
           SELECT 1 FROM tasks t
           WHERE t.lead_id = e.lead_id AND t.tenant_id = $1
             AND t.title LIKE 'ESCALATION: Pre-op Assessment Overdue%'
             AND t.status = 'Pending'
         )`,
      [tenantId]
    );

    for (const ep of overdue.rows) {
      try {
        const managerRow = await pool.query(
          `SELECT cu.id FROM crm_users cu
           JOIN system_roles sr ON cu.system_role_id = sr.id
           WHERE cu.tenant_id = $1 AND sr.code IN ('MANAGER', 'ADMIN') AND cu.is_active = TRUE
           ORDER BY CASE sr.code WHEN 'MANAGER' THEN 1 WHEN 'ADMIN' THEN 2 END LIMIT 1`,
          [tenantId]
        );
        const managerId = managerRow.rows[0]?.id || null;

        await pool.query(
          `INSERT INTO tasks (tenant_id, lead_id, title, description, priority, due_date, assigned_crm_user_id, status, created_by)
           VALUES ($1, $2, $3, $4, 'Urgent', NOW() + INTERVAL '4 hours', $5, 'Pending', 'system-scheduler')`,
          [
            tenantId,
            ep.lead_id,
            `ESCALATION: Pre-op Assessment Overdue — ${ep.patient_name}`,
            `Pre-op assessment for ${ep.patient_name} (Episode #${ep.id}) has been pending for 48+ hours without clearance. ${ep.surgery_date ? `Surgery is on ${new Date(ep.surgery_date).toLocaleDateString("en-IN")}. ` : ""}Immediate review required.`,
            managerId,
          ]
        );

        if (managerId) {
          await pool.query(
            `INSERT INTO in_app_notifications (tenant_id, crm_user_id, type, title, body, entity_type, entity_id, link, is_read, created_at)
             VALUES ($1, $2, 'preop_escalation', $3, $4, 'episode', $5, $6, FALSE, NOW())`,
            [
              tenantId,
              managerId,
              `Pre-op Assessment Overdue — ${ep.patient_name}`,
              `The pre-op assessment for ${ep.patient_name} has been pending 48+ hours. Clearance not yet given. Immediate action required.`,
              ep.id,
              `/episodes/${ep.id}`,
            ]
          );
        }

        escalated++;
      } catch (err: any) {
        console.error(`[preop-escalation] Error escalating episode ${ep.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error(`[preop-escalation] Error for tenant ${tenantId}:`, err.message);
  }
  return escalated;
}
