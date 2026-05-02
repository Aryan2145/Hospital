import { db, pool } from "../db";
import { tasks, activities, episodePreopAssessments, preopReminderLog } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import nodemailer from "nodemailer";

function getGlobalTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return {
    transporter: nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } }),
    fromEmail: process.env.SMTP_FROM_EMAIL || user,
  };
}

export async function resolvePreopNotifyList(
  episode: any,
  tenantId: number,
): Promise<Array<{ crmUserId: number; name: string; email: string | null; phone: string | null; roleInCase: string }>> {
  // Accumulate roles per user to consolidate multi-role users into one entry
  const rolesByUserId = new Map<number, { name: string; email: string | null; phone: string | null; roles: string[] }>();

  const addUser = async (userId: number | null, roleInCase: string) => {
    if (!userId) return;
    if (rolesByUserId.has(userId)) {
      rolesByUserId.get(userId)!.roles.push(roleInCase);
      return;
    }
    const row = await pool.query(
      `SELECT cu.id, cu.name, cu.email, cu.phone FROM crm_users cu WHERE cu.id = $1 AND cu.tenant_id = $2 AND cu.is_active = TRUE`,
      [userId, tenantId]
    );
    if (row.rows[0]) {
      rolesByUserId.set(userId, { name: row.rows[0].name, email: row.rows[0].email, phone: row.rows[0].phone, roles: [roleInCase] });
    }
  };

  if (episode.preopAssignedUserId) await addUser(episode.preopAssignedUserId, "preop_staff");
  if (episode.assignedCrmUserId) await addUser(episode.assignedCrmUserId, "case_coordinator");

  if (episode.leadId) {
    const leadRow = await pool.query(
      `SELECT assigned_crm_user_id FROM leads WHERE id = $1 AND tenant_id = $2`,
      [episode.leadId, tenantId]
    );
    if (leadRow.rows[0]?.assigned_crm_user_id) await addUser(leadRow.rows[0].assigned_crm_user_id, "lead_coordinator");
  }

  // Doctor CRM user — check both doctorId and surgeryDoctorId
  const doctorIdsToCheck = new Set<number>();
  if (episode.doctorId) doctorIdsToCheck.add(episode.doctorId);
  if (episode.surgeryDoctorId) doctorIdsToCheck.add(episode.surgeryDoctorId);

  for (const doctorId of doctorIdsToCheck) {
    const docRow = await pool.query(
      `SELECT d.name as doctor_name, d.email as doctor_email, cu.id as crm_user_id, cu.name, cu.email, cu.phone
       FROM doctors d
       LEFT JOIN crm_users cu ON cu.id = d.crm_user_id AND cu.tenant_id = d.tenant_id
       WHERE d.id = $1 AND d.tenant_id = $2`,
      [doctorId, tenantId]
    );
    if (docRow.rows[0]) {
      const doc = docRow.rows[0];
      if (doc.crm_user_id) {
        await addUser(doc.crm_user_id, "doctor");
      }
      // If no CRM account, caller persists not-deliverable to preop_reminder_log + sends email
    }
  }

  // Fallback chain: if no one was resolved, pick ADMIN then MANAGER
  if (rolesByUserId.size === 0) {
    const adminRow = await pool.query(
      `SELECT cu.id, cu.name, cu.email, cu.phone FROM crm_users cu
       JOIN system_roles sr ON cu.system_role_id = sr.id
       WHERE cu.tenant_id = $1 AND sr.code IN ('ADMIN', 'MANAGER') AND cu.is_active = TRUE
       ORDER BY CASE sr.code WHEN 'ADMIN' THEN 1 WHEN 'MANAGER' THEN 2 END LIMIT 1`,
      [tenantId]
    );
    if (adminRow.rows[0]) {
      rolesByUserId.set(adminRow.rows[0].id, {
        name: adminRow.rows[0].name, email: adminRow.rows[0].email, phone: adminRow.rows[0].phone, roles: ["admin"],
      });
    }
  }

  return Array.from(rolesByUserId.entries()).map(([crmUserId, u]) => ({
    crmUserId,
    name: u.name,
    email: u.email,
    phone: u.phone,
    roleInCase: u.roles.join("+"),
  }));
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

  // Auto-create the structured assessment record on stage entry if it doesn't exist
  try {
    const existingAssessment = await pool.query(
      `SELECT id FROM episode_preop_assessments WHERE episode_id = $1 AND tenant_id = $2 LIMIT 1`,
      [episodeId, tenantId]
    );
    if (existingAssessment.rows.length === 0) {
      await pool.query(
        `INSERT INTO episode_preop_assessments
           (tenant_id, episode_id, readiness_status,
            blood_work_done, imaging_done, anesthesia_consult_done, consent_form_signed,
            npo_confirmed, allergies_reviewed, medications_reviewed, vitals_stable,
            submitted_by, submitted_by_crm_user_id)
         VALUES ($1, $2, 'Pending', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, $3, $4)`,
        [tenantId, episodeId, triggeredBy, triggeredByCrmUserId]
      );
    }
  } catch (err: any) {
    console.error("[preop] Error auto-creating assessment row:", err.message);
  }

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
          tenantId, user.crmUserId,
          `Pre-op Assessment Required — ${patientName}`,
          `Patient ${patientName} has entered the Pre-op Assessment stage. Surgery: ${surgeryDateStr}. Complete the readiness checklist.`,
          episodeId, `/episodes/${episodeId}`,
        ]
      );
    } catch {}

    // Write reminder_log per notified user
    try {
      await pool.query(
        `INSERT INTO preop_reminder_log (tenant_id, episode_id, reminder_type, sent_to, recipient_role, channel, trigger_source, sent_at, details)
         VALUES ($1, $2, 'preop_entry', $3, $4, 'in_app', 'stage_entry', NOW(), $5)`,
        [tenantId, episodeId, String(user.crmUserId), user.roleInCase, JSON.stringify({ patientName, surgeryDateStr })]
      );
    } catch {}
  }

  // Doctor notification — check both doctorId and surgeryDoctorId
  const doctorIds = new Set<number>();
  if (episode.doctorId) doctorIds.add(episode.doctorId);
  if (episode.surgeryDoctorId) doctorIds.add(episode.surgeryDoctorId);

  for (const doctorId of doctorIds) {
    try {
      const docRow = await pool.query(
        `SELECT d.id, d.name as doctor_name, d.email as doctor_email, cu.id as crm_user_id
         FROM doctors d
         LEFT JOIN crm_users cu ON cu.id = d.crm_user_id AND cu.tenant_id = d.tenant_id
         WHERE d.id = $1 AND d.tenant_id = $2`,
        [doctorId, tenantId]
      );
      if (docRow.rows[0]) {
        const doc = docRow.rows[0];
        if (doc.crm_user_id && !notifyUsers.find((u) => u.crmUserId === doc.crm_user_id)) {
          await pool.query(
            `INSERT INTO in_app_notifications (tenant_id, crm_user_id, type, title, body, entity_type, entity_id, link, is_read, created_at)
             VALUES ($1, $2, 'preop_entry', $3, $4, 'episode', $5, $6, FALSE, NOW())
             ON CONFLICT DO NOTHING`,
            [
              tenantId, doc.crm_user_id,
              `Pre-op Assessment — ${patientName}`,
              `Your patient ${patientName} is in Pre-op Assessment. Surgery: ${surgeryDateStr}.`,
              episodeId, `/episodes/${episodeId}`,
            ]
          );
          await pool.query(
            `INSERT INTO preop_reminder_log (tenant_id, episode_id, reminder_type, sent_to, recipient_role, channel, trigger_source, sent_at, details)
             VALUES ($1, $2, 'preop_entry', $3, 'doctor', 'in_app', 'stage_entry', NOW(), $4)`,
            [tenantId, episodeId, String(doc.crm_user_id), JSON.stringify({ patientName, surgeryDateStr })]
          );
        } else if (!doc.crm_user_id) {
          // No CRM account — send fallback email to doctor.email if available
          let emailSent = false;
          if (doc.doctor_email) {
            try {
              const gt = getGlobalTransporter();
              if (gt) {
                await gt.transporter.sendMail({
                  from: `"RGB Hospital CRM" <${gt.fromEmail}>`,
                  to: doc.doctor_email,
                  subject: `Pre-op Assessment Required — ${patientName}`,
                  text: `Your patient ${patientName} has entered the Pre-op Assessment stage. Surgery: ${surgeryDateStr}. Please review the pre-op checklist in the CRM.`,
                });
                emailSent = true;
              }
            } catch (emailErr: any) {
              console.error(`[preop-notify] Doctor email fallback failed for ${doc.doctor_name}:`, emailErr.message);
            }
          }
          // Log as not-deliverable (or email-sent) in preop_reminder_log
          await pool.query(
            `INSERT INTO preop_reminder_log (tenant_id, episode_id, reminder_type, sent_to, recipient_role, channel, trigger_source, sent_at, details)
             VALUES ($1, $2, 'preop_entry', $3, 'doctor', $4, 'stage_entry', NOW(), $5)`,
            [
              tenantId, episodeId,
              doc.doctor_name || `doctor_id:${doctorId}`,
              emailSent ? "email" : "not_deliverable",
              JSON.stringify({ reason: emailSent ? "email_fallback_sent" : "no_crm_account_no_email", doctorEmail: doc.doctor_email || null, patientName }),
            ]
          );
        }
      }
    } catch (err: any) {
      console.error(`[preop] Error notifying doctor ${doctorId}:`, err.message);
    }
  }

  await db.insert(activities).values({
    tenantId,
    leadId: episode.leadId,
    type: "status_change",
    description: `Episode entered Pre-op Assessment stage. ${notifyUsers.length} team member(s) notified. Surgery: ${surgeryDateStr}.`,
    createdBy: triggeredBy,
    metadata: { preopEntry: true, notifiedUsers: notifyUsers.map(u => ({ id: u.crmUserId, role: u.roleInCase })) },
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
    const now = new Date();

    // --- 0. Re-create missing tasks for Pending assessments ---
    try {
      const pendingNoTask = await pool.query(
        `SELECT e.id, e.lead_id, e.preop_assigned_user_id, e.assigned_crm_user_id, e.surgery_date,
                COALESCE(l.name, CONCAT(p.first_name, ' ', p.last_name)) as patient_name
         FROM episodes e
         LEFT JOIN leads l ON e.lead_id = l.id
         LEFT JOIN patients p ON e.patient_id = p.id
         WHERE e.tenant_id = $1
           AND e.status = 'Pre-op Assessment'
           AND e.preop_clearance_given = FALSE
           AND NOT EXISTS (
             SELECT 1 FROM tasks t
             WHERE t.tenant_id = $1
               AND t.lead_id = e.lead_id
               AND t.status IN ('Pending', 'In Progress')
               AND t.title LIKE '%Pre-op%'
               AND t.created_at > NOW() - INTERVAL '3 days'
           )`,
        [tenantId]
      );
      for (const ep of pendingNoTask.rows) {
        const recipientId = ep.preop_assigned_user_id || ep.assigned_crm_user_id;
        if (!ep.lead_id || !recipientId) continue;
        const surgeryStr = ep.surgery_date
          ? new Date(ep.surgery_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
          : "TBD";
        await pool.query(
          `INSERT INTO tasks (tenant_id, lead_id, title, description, priority, due_date, assigned_crm_user_id, status, created_by)
           VALUES ($1, $2, $3, $4, 'High', $5, $6, 'Pending', 'system-scheduler')`,
          [
            tenantId, ep.lead_id,
            `Pre-op Readiness Check — ${ep.patient_name}`,
            `Pre-op assessment still pending for ${ep.patient_name}. Surgery: ${surgeryStr}. Please complete the readiness checklist.`,
            ep.surgery_date ? new Date(new Date(ep.surgery_date).getTime() - 24 * 60 * 60 * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000),
            recipientId,
          ]
        );
      }
    } catch {}

    // --- 1. Main overdue escalation ladder (based on last-update time of assessment) ---
    const overdue = await pool.query(
      `SELECT e.id, e.lead_id, e.preop_entered_at, e.surgery_date, e.preop_clearance_given,
              e.preop_assigned_user_id,
              COALESCE(l.name, CONCAT(p.first_name, ' ', p.last_name)) as patient_name,
              EXTRACT(EPOCH FROM (NOW() - COALESCE(epa.modified_at, e.preop_entered_at)))/3600 as hours_without_update
       FROM episodes e
       LEFT JOIN leads l ON e.lead_id = l.id
       LEFT JOIN patients p ON e.patient_id = p.id
       LEFT JOIN LATERAL (
         SELECT modified_at FROM episode_preop_assessments
         WHERE episode_id = e.id AND tenant_id = e.tenant_id
         ORDER BY id DESC LIMIT 1
       ) epa ON TRUE
       WHERE e.tenant_id = $1
         AND e.status = 'Pre-op Assessment'
         AND e.preop_clearance_given = FALSE
         AND COALESCE(epa.modified_at, e.preop_entered_at) < NOW() - INTERVAL '48 hours'`,
      [tenantId]
    );

    for (const ep of overdue.rows) {
      try {
        const hoursSinceEntry = Number(ep.hours_without_update) || 0;
        const daysUntilSurgery = ep.surgery_date
          ? (new Date(ep.surgery_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          : null;
        const surgeryWithin3Days = daysUntilSurgery !== null && daysUntilSurgery <= 3;

        let reminderType: string;
        let priority: string;
        let dueHours: number;
        let targetRole: string;

        if (surgeryWithin3Days) {
          reminderType = "urgent_surgery_imminent";
          priority = "Urgent";
          dueHours = 2;
          targetRole = "admin";
        } else if (hoursSinceEntry >= 168) {
          reminderType = "7d_escalation";
          priority = "Urgent";
          dueHours = 4;
          targetRole = "admin";
        } else if (hoursSinceEntry >= 96) {
          reminderType = "4d_escalation";
          priority = "Urgent";
          dueHours = 6;
          targetRole = "manager";
        } else {
          reminderType = "2d_reminder";
          priority = "High";
          dueHours = 24;
          targetRole = "preop_staff";
        }

        const alreadySent = await pool.query(
          `SELECT 1 FROM preop_reminder_log
           WHERE tenant_id = $1 AND episode_id = $2 AND reminder_type = $3
             AND sent_at > NOW() - INTERVAL '40 hours'
           LIMIT 1`,
          [tenantId, ep.id, reminderType]
        );
        if (alreadySent.rows.length > 0) continue;

        // Pick recipient based on target role
        let recipientId: number | null = null;
        let recipientRole = targetRole;
        if (targetRole === "preop_staff" && ep.preop_assigned_user_id) {
          recipientId = ep.preop_assigned_user_id;
        } else {
          const roleFilter = targetRole === "admin" ? "'ADMIN'" : "'MANAGER','ADMIN'";
          const row = await pool.query(
            `SELECT cu.id FROM crm_users cu
             JOIN system_roles sr ON cu.system_role_id = sr.id
             WHERE cu.tenant_id = $1 AND sr.code IN (${roleFilter}) AND cu.is_active = TRUE
             ORDER BY CASE sr.code WHEN 'ADMIN' THEN 1 WHEN 'MANAGER' THEN 2 END LIMIT 1`,
            [tenantId]
          );
          recipientId = row.rows[0]?.id || null;
          recipientRole = targetRole === "admin" ? "admin" : "manager";
        }

        const surgeryStr = ep.surgery_date
          ? `Surgery ${surgeryWithin3Days ? `in ${Math.round(daysUntilSurgery! * 24)}h — URGENT` : `scheduled ${new Date(ep.surgery_date).toLocaleDateString("en-IN")}`}.`
          : "";
        const taskTitle = surgeryWithin3Days
          ? `🚨 URGENT: Pre-op Overdue — Surgery Imminent — ${ep.patient_name}`
          : `ESCALATION [${reminderType.replace(/_/g," ").toUpperCase()}]: Pre-op Overdue — ${ep.patient_name}`;

        if (ep.lead_id && recipientId) {
          await pool.query(
            `INSERT INTO tasks (tenant_id, lead_id, title, description, priority, due_date, assigned_crm_user_id, status, created_by)
             VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '${dueHours} hours', $6, 'Pending', 'system-scheduler')`,
            [
              tenantId, ep.lead_id, taskTitle,
              `Pre-op for ${ep.patient_name} (Episode #${ep.id}) pending ${Math.round(hoursSinceEntry)}h without clearance. ${surgeryStr} Action required.`,
              priority, recipientId,
            ]
          );
        }

        if (recipientId) {
          await pool.query(
            `INSERT INTO in_app_notifications (tenant_id, crm_user_id, type, title, body, entity_type, entity_id, link, is_read, created_at)
             VALUES ($1, $2, 'preop_escalation', $3, $4, 'episode', $5, $6, FALSE, NOW())`,
            [
              tenantId, recipientId,
              `Pre-op ${reminderType.replace(/_/g," ")} — ${ep.patient_name}`,
              `Pre-op pending ${Math.round(hoursSinceEntry)}h. ${surgeryStr} Clearance not given.`,
              ep.id, `/episodes/${ep.id}`,
            ]
          );
        }

        await pool.query(
          `INSERT INTO preop_reminder_log (tenant_id, episode_id, reminder_type, sent_to, recipient_role, channel, trigger_source, sent_at, details)
           VALUES ($1, $2, $3, $4, $5, 'in_app', 'scheduler', NOW(), $6)`,
          [
            tenantId, ep.id, reminderType,
            recipientId ? String(recipientId) : "no-recipient",
            recipientRole,
            JSON.stringify({ hoursSinceEntry: Math.round(hoursSinceEntry), daysUntilSurgery, priority, surgeryWithin3Days }),
          ]
        );

        escalated++;
      } catch (err: any) {
        console.error(`[preop-escalation] Error escalating episode ${ep.id}:`, err.message);
      }
    }

    // --- 2. Not-Ready revisit automation: create task when revisit_due_date has passed ---
    try {
      const revisitDue = await pool.query(
        `SELECT e.id, e.lead_id, e.preop_assigned_user_id,
                COALESCE(l.name, CONCAT(p.first_name, ' ', p.last_name)) as patient_name,
                epa.revisit_due_date
         FROM episodes e
         JOIN episode_preop_assessments epa ON epa.episode_id = e.id AND epa.tenant_id = e.tenant_id
         LEFT JOIN leads l ON e.lead_id = l.id
         LEFT JOIN patients p ON e.patient_id = p.id
         WHERE e.tenant_id = $1
           AND e.status = 'Pre-op Assessment'
           AND e.preop_clearance_given = FALSE
           AND epa.readiness_status = 'Not Ready'
           AND epa.revisit_due_date IS NOT NULL
           AND epa.revisit_due_date <= NOW()
           AND NOT EXISTS (
             SELECT 1 FROM preop_reminder_log prl
             WHERE prl.tenant_id = $1 AND prl.episode_id = e.id AND prl.reminder_type = 'revisit_due'
               AND prl.sent_at > epa.revisit_due_date
           )`,
        [tenantId]
      );

      for (const ep of revisitDue.rows) {
        try {
          const recipientId = ep.preop_assigned_user_id || null;
          if (ep.lead_id && recipientId) {
            await pool.query(
              `INSERT INTO tasks (tenant_id, lead_id, title, description, priority, due_date, assigned_crm_user_id, status, created_by)
               VALUES ($1, $2, $3, $4, 'High', NOW() + INTERVAL '12 hours', $5, 'Pending', 'system-scheduler')`,
              [
                tenantId, ep.lead_id,
                `Revisit Pre-op Assessment — ${ep.patient_name}`,
                `The advised revisit date for ${ep.patient_name}'s pre-op assessment (Episode #${ep.id}) has passed. Please re-evaluate readiness status.`,
                recipientId,
              ]
            );
          }
          await pool.query(
            `INSERT INTO preop_reminder_log (tenant_id, episode_id, reminder_type, sent_to, recipient_role, channel, trigger_source, sent_at, details)
             VALUES ($1, $2, 'revisit_due', $3, 'preop_staff', 'in_app', 'scheduler', NOW(), $4)`,
            [tenantId, ep.id, recipientId ? String(recipientId) : "none", JSON.stringify({ revisitDueDate: ep.revisit_due_date })]
          );
        } catch {}
      }
    } catch {}

  } catch (err: any) {
    console.error(`[preop-escalation] Error for tenant ${tenantId}:`, err.message);
  }
  return escalated;
}
