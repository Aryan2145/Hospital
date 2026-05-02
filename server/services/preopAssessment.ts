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
      `SELECT e.id, e.lead_id, e.preop_entered_at, e.surgery_date, e.preop_clearance_given,
              COALESCE(l.name, CONCAT(p.first_name, ' ', p.last_name)) as patient_name,
              EXTRACT(EPOCH FROM (NOW() - e.preop_entered_at))/3600 as hours_since_entry
       FROM episodes e
       LEFT JOIN leads l ON e.lead_id = l.id
       LEFT JOIN patients p ON e.patient_id = p.id
       WHERE e.tenant_id = $1
         AND e.status = 'Pre-op Assessment'
         AND e.preop_clearance_given = FALSE
         AND e.preop_entered_at < NOW() - INTERVAL '24 hours'`,
      [tenantId]
    );

    const now = new Date();

    for (const ep of overdue.rows) {
      try {
        const hoursSinceEntry = Number(ep.hours_since_entry) || 0;
        const hasSurgeryDateSoon = ep.surgery_date
          ? (new Date(ep.surgery_date).getTime() - now.getTime()) < 24 * 60 * 60 * 1000
          : false;

        let reminderType: string;
        let priority: string;
        let dueHours: number;
        if (hasSurgeryDateSoon) {
          reminderType = "urgent_surgery_imminent";
          priority = "Urgent";
          dueHours = 1;
        } else if (hoursSinceEntry >= 168) {
          reminderType = "7d_escalation";
          priority = "Urgent";
          dueHours = 2;
        } else if (hoursSinceEntry >= 96) {
          reminderType = "4d_escalation";
          priority = "Urgent";
          dueHours = 4;
        } else if (hoursSinceEntry >= 48) {
          reminderType = "48h_escalation";
          priority = "Urgent";
          dueHours = 4;
        } else {
          reminderType = "24h_reminder";
          priority = "High";
          dueHours = 12;
        }

        const alreadySent = await pool.query(
          `SELECT 1 FROM preop_reminder_log
           WHERE tenant_id = $1 AND episode_id = $2 AND reminder_type = $3
             AND sent_at > NOW() - INTERVAL '${reminderType === "24h_reminder" ? "20 hours" : "40 hours"}'
           LIMIT 1`,
          [tenantId, ep.id, reminderType]
        );
        if (alreadySent.rows.length > 0) continue;

        const managerRow = await pool.query(
          `SELECT cu.id FROM crm_users cu
           JOIN system_roles sr ON cu.system_role_id = sr.id
           WHERE cu.tenant_id = $1 AND sr.code IN ('MANAGER', 'ADMIN') AND cu.is_active = TRUE
           ORDER BY CASE sr.code WHEN 'MANAGER' THEN 1 WHEN 'ADMIN' THEN 2 END LIMIT 1`,
          [tenantId]
        );
        const managerId = managerRow.rows[0]?.id || null;

        const surgeryStr = ep.surgery_date
          ? `Surgery is ${hasSurgeryDateSoon ? "IMMINENT" : "scheduled"} for ${new Date(ep.surgery_date).toLocaleDateString("en-IN")}.`
          : "";

        const taskTitle = hasSurgeryDateSoon
          ? `URGENT: Pre-op — Surgery Imminent — ${ep.patient_name}`
          : `ESCALATION [${reminderType.replace(/_/g, " ").toUpperCase()}]: Pre-op Overdue — ${ep.patient_name}`;

        if (ep.lead_id) {
          await pool.query(
            `INSERT INTO tasks (tenant_id, lead_id, title, description, priority, due_date, assigned_crm_user_id, status, created_by)
             VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '${dueHours} hours', $6, 'Pending', 'system-scheduler')`,
            [
              tenantId, ep.lead_id, taskTitle,
              `Pre-op assessment for ${ep.patient_name} (Episode #${ep.id}) pending ${Math.round(hoursSinceEntry)}h without clearance. ${surgeryStr} Immediate action required.`,
              priority, managerId,
            ]
          );
        }

        if (managerId) {
          await pool.query(
            `INSERT INTO in_app_notifications (tenant_id, crm_user_id, type, title, body, entity_type, entity_id, link, is_read, created_at)
             VALUES ($1, $2, 'preop_escalation', $3, $4, 'episode', $5, $6, FALSE, NOW())`,
            [
              tenantId, managerId,
              `Pre-op Assessment Overdue (${reminderType.replace(/_/g," ")}) — ${ep.patient_name}`,
              `Pre-op pending ${Math.round(hoursSinceEntry)}h. ${surgeryStr} Clearance not given.`,
              ep.id, `/episodes/${ep.id}`,
            ]
          );
        }

        await pool.query(
          `INSERT INTO preop_reminder_log (tenant_id, episode_id, reminder_type, sent_to, sent_at, details)
           VALUES ($1, $2, $3, $4, NOW(), $5)`,
          [
            tenantId, ep.id, reminderType,
            managerId ? String(managerId) : "no-manager",
            JSON.stringify({ hoursSinceEntry: Math.round(hoursSinceEntry), hasSurgeryDateSoon, priority }),
          ]
        );

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
