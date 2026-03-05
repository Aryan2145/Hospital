import { db, pool } from "../db";
import { leads, tasks, activities } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { computeAndUpdateTemperature } from "./temperatureEngine";

const NURTURE_SCHEDULE_DAYS = [1, 3, 7, 14, 30, 60];

export async function createNurtureTaskChain(
  leadId: number,
  tenantId: number,
  assignedCrmUserId: number | null,
  triggeredBy: string,
): Promise<number> {
  const existing = await pool.query(
    `SELECT id FROM tasks
     WHERE lead_id = $1 AND tenant_id = $2
     AND title LIKE 'Nurture Follow-up%'
     AND status = 'Pending'
     LIMIT 1`,
    [leadId, tenantId]
  );
  if (existing.rows.length > 0) return 0;

  const now = new Date();
  let created = 0;

  const firstDue = new Date(now.getTime() + NURTURE_SCHEDULE_DAYS[0] * 24 * 60 * 60 * 1000);
  await db.insert(tasks).values({
    tenantId,
    leadId,
    title: `Nurture Follow-up #1 — Re-engage patient`,
    description: `Automated nurture task. Reach out to the patient and check their current status. If interested, move lead back to "Contacted". If clearly not interested, mark as "Closed Lost" with reason.`,
    priority: "Normal",
    dueDate: firstDue,
    assignedCrmUserId,
    status: "Pending",
    createdBy: "system",
    notes: JSON.stringify({
      nurtureSequence: true,
      sequenceStep: 1,
      totalSteps: NURTURE_SCHEDULE_DAYS.length,
      scheduleDays: NURTURE_SCHEDULE_DAYS,
    }),
  });
  created++;

  await db.insert(activities).values({
    tenantId,
    leadId,
    type: "status_change",
    description: `Nurture sequence started — ${NURTURE_SCHEDULE_DAYS.length} automated follow-ups scheduled (Days ${NURTURE_SCHEDULE_DAYS.join(", ")})`,
    createdBy: triggeredBy,
    metadata: { nurtureSequence: true, scheduleDays: NURTURE_SCHEDULE_DAYS },
  });

  return created;
}

export async function processNurtureTaskCompletion(
  taskId: number,
  tenantId: number,
  outcome: string | null,
  completedBy: string,
): Promise<{ action: string; nextTaskCreated: boolean }> {
  const taskResult = await pool.query(
    `SELECT t.*, l.status as lead_status, l.name as lead_name, l.assigned_crm_user_id
     FROM tasks t
     JOIN leads l ON t.lead_id = l.id
     WHERE t.id = $1 AND t.tenant_id = $2`,
    [taskId, tenantId]
  );
  const task = taskResult.rows[0];
  if (!task) return { action: "not_found", nextTaskCreated: false };

  let meta: any = {};
  try { meta = typeof task.notes === "string" ? JSON.parse(task.notes) : (task.notes || {}); } catch {}
  if (!meta.nurtureSequence) return { action: "not_nurture", nextTaskCreated: false };

  if (task.lead_status !== "Nurture") {
    await cancelPendingNurtureTasks(task.lead_id, tenantId, taskId);
    return { action: "lead_no_longer_nurture", nextTaskCreated: false };
  }

  const currentStep = meta.sequenceStep || 1;
  const scheduleDays: number[] = meta.scheduleDays || NURTURE_SCHEDULE_DAYS;

  if (outcome === "interested" || outcome === "Interested") {
    await pool.query(
      `UPDATE leads SET status = 'Contacted', last_activity_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [task.lead_id, tenantId]
    );
    await cancelPendingNurtureTasks(task.lead_id, tenantId, taskId);
    await db.insert(activities).values({
      tenantId,
      leadId: task.lead_id,
      type: "status_change",
      description: `Patient showed interest during nurture follow-up #${currentStep}. Lead reactivated to "Contacted".`,
      oldStatus: "Nurture",
      newStatus: "Contacted",
      createdBy: completedBy,
    });
    return { action: "reactivated", nextTaskCreated: false };
  }

  if (outcome === "closed" || outcome === "Closed" || outcome === "not_needed" || outcome === "treatment_elsewhere") {
    await pool.query(
      `UPDATE leads SET status = 'Closed Lost', last_activity_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [task.lead_id, tenantId]
    );
    await cancelPendingNurtureTasks(task.lead_id, tenantId, taskId);
    await db.insert(activities).values({
      tenantId,
      leadId: task.lead_id,
      type: "status_change",
      description: `Patient confirmed no treatment needed or treated elsewhere. Nurture sequence ended at step #${currentStep}.`,
      oldStatus: "Nurture",
      newStatus: "Closed Lost",
      createdBy: completedBy,
    });
    return { action: "closed", nextTaskCreated: false };
  }

  const nextStep = currentStep + 1;
  if (nextStep > scheduleDays.length) {
    await escalateNurtureLead(task.lead_id, tenantId, completedBy);
    return { action: "sequence_complete_escalated", nextTaskCreated: false };
  }

  const nextDueDays = scheduleDays[nextStep - 1];
  const nextDue = new Date(Date.now() + nextDueDays * 24 * 60 * 60 * 1000);

  await db.insert(tasks).values({
    tenantId,
    leadId: task.lead_id,
    title: `Nurture Follow-up #${nextStep} — Re-engage patient`,
    description: `Automated nurture task (Step ${nextStep}/${scheduleDays.length}). Patient has not responded positively yet. Try a different approach — ${getFollowUpSuggestion(nextStep)}.`,
    priority: nextStep >= 4 ? "High" : "Normal",
    dueDate: nextDue,
    assignedCrmUserId: task.assigned_crm_user_id || null,
    status: "Pending",
    createdBy: "system",
    notes: JSON.stringify({
      nurtureSequence: true,
      sequenceStep: nextStep,
      totalSteps: scheduleDays.length,
      scheduleDays,
    }),
  });

  return { action: "next_task_created", nextTaskCreated: true };
}

function getFollowUpSuggestion(step: number): string {
  switch (step) {
    case 2: return "ask about their health concern and offer help";
    case 3: return "share relevant treatment information or patient testimonials";
    case 4: return "offer a free or discounted follow-up consultation";
    case 5: return "send a WhatsApp message with a doctor's video or health tip";
    case 6: return "final check-in before closing the lead";
    default: return "reach out and check patient's current status";
  }
}

async function cancelPendingNurtureTasks(leadId: number, tenantId: number, exceptTaskId: number): Promise<void> {
  await pool.query(
    `UPDATE tasks SET status = 'Cancelled'
     WHERE lead_id = $1 AND tenant_id = $2 AND id != $3
     AND title LIKE 'Nurture Follow-up%' AND status = 'Pending'`,
    [leadId, tenantId, exceptTaskId]
  );
}

async function escalateNurtureLead(leadId: number, tenantId: number, completedBy: string): Promise<void> {
  const supervisorResult = await pool.query(
    `SELECT cu.id, cu.name FROM crm_users cu
     JOIN system_roles sr ON cu.system_role_id = sr.id
     WHERE cu.tenant_id = $1 AND sr.code IN ('MANAGER', 'ADMIN') AND cu.is_active = true
     ORDER BY CASE sr.code WHEN 'MANAGER' THEN 1 WHEN 'ADMIN' THEN 2 END
     LIMIT 1`,
    [tenantId]
  );

  const supervisorId = supervisorResult.rows[0]?.id || null;

  await db.insert(tasks).values({
    tenantId,
    leadId,
    title: `ESCALATION: Nurture sequence exhausted — Final disposition needed`,
    description: `This lead completed all ${NURTURE_SCHEDULE_DAYS.length} nurture follow-ups without a positive response. A manager/admin decision is needed: either close the lead as "Closed Lost" or attempt one more personal outreach.`,
    priority: "High",
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    assignedCrmUserId: supervisorId,
    status: "Pending",
    createdBy: "system",
  });

  await db.insert(activities).values({
    tenantId,
    leadId,
    type: "status_change",
    description: `Nurture sequence exhausted after ${NURTURE_SCHEDULE_DAYS.length} follow-ups. Escalated to manager for final disposition.`,
    createdBy: completedBy,
    metadata: { nurtureEscalation: true },
  });
}

export async function processAutoNurtureOnNoShow(
  leadId: number,
  tenantId: number,
  noShowCount: number,
  userId: string,
): Promise<boolean> {
  if (noShowCount < 2) return false;

  const leadResult = await pool.query(
    `SELECT status, assigned_crm_user_id FROM leads WHERE id = $1 AND tenant_id = $2`,
    [leadId, tenantId]
  );
  const lead = leadResult.rows[0];
  if (!lead) return false;
  if (lead.status === "Nurture" || lead.status === "Closed Won" || lead.status === "Closed Lost") return false;

  await pool.query(
    `UPDATE leads SET status = 'Nurture', last_activity_at = NOW() WHERE id = $1 AND tenant_id = $2`,
    [leadId, tenantId]
  );

  await db.insert(activities).values({
    tenantId,
    leadId,
    type: "status_change",
    description: `Lead auto-moved to Nurture after ${noShowCount} no-shows. Automated follow-up sequence started.`,
    oldStatus: lead.status,
    newStatus: "Nurture",
    createdBy: "system",
  });

  await createNurtureTaskChain(leadId, tenantId, lead.assigned_crm_user_id, "system");

  return true;
}

export async function processDormantLeadsAndStaleAppointments(tenantId: number): Promise<{
  dormantTasksCreated: number;
  staleLeadsFlagged: number;
  overdueNurtureEscalated: number;
}> {
  let dormantTasksCreated = 0;
  let staleLeadsFlagged = 0;
  let overdueNurtureEscalated = 0;

  const dormantThreshold = new Date();
  dormantThreshold.setDate(dormantThreshold.getDate() - 5);

  const dormantLeads = await pool.query(
    `SELECT l.id, l.name, l.assigned_crm_user_id, l.status
     FROM leads l
     WHERE l.tenant_id = $1
     AND l.status NOT IN ('Closed Won', 'Closed Lost', 'Unqualified', 'Nurture', 'Consultation Done')
     AND (l.last_activity_at IS NULL OR l.last_activity_at < $2)
     AND (l.last_contact_at IS NULL OR l.last_contact_at < $2)
     AND NOT EXISTS (
       SELECT 1 FROM tasks t
       WHERE t.lead_id = l.id AND t.tenant_id = $1
       AND t.title LIKE '%Dormant%' AND t.status = 'Pending'
     )`,
    [tenantId, dormantThreshold]
  );

  for (const lead of dormantLeads.rows) {
    try {
      await db.insert(tasks).values({
        tenantId,
        leadId: lead.id,
        title: `Re-engage Dormant Lead — ${lead.name}`,
        description: `This lead has had no activity for 5+ days (Status: ${lead.status}). Please contact the patient to check their status and move them forward.`,
        priority: "Normal",
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        assignedCrmUserId: lead.assigned_crm_user_id,
        status: "Pending",
        createdBy: "system",
      });

      try {
        await computeAndUpdateTemperature(lead.id, tenantId, "Dormant", "system");
      } catch {}

      dormantTasksCreated++;
    } catch {}
  }

  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - 1);

  const staleAppointments = await pool.query(
    `SELECT l.id, l.name, l.assigned_crm_user_id, a.appointment_date, a.id as appt_id
     FROM leads l
     JOIN appointments a ON a.lead_id = l.id AND a.tenant_id = l.tenant_id
     WHERE l.tenant_id = $1
     AND l.status = 'Appointment Booked'
     AND a.appointment_date < $2
     AND a.status IN ('Scheduled', 'Confirmed')
     AND NOT EXISTS (
       SELECT 1 FROM tasks t
       WHERE t.lead_id = l.id AND t.tenant_id = $1
       AND t.title LIKE '%Missed Appointment%' AND t.status = 'Pending'
     )
     ORDER BY a.appointment_date DESC`,
    [tenantId, staleThreshold]
  );

  const processedLeads = new Set<number>();
  for (const row of staleAppointments.rows) {
    if (processedLeads.has(row.id)) continue;
    processedLeads.add(row.id);

    try {
      await db.insert(tasks).values({
        tenantId,
        leadId: row.id,
        title: `Missed Appointment Follow-up — ${row.name}`,
        description: `This lead's appointment was scheduled but no consultation was recorded. The appointment date has passed. Contact the patient to reschedule or update the status.`,
        priority: "High",
        dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
        assignedCrmUserId: row.assigned_crm_user_id,
        status: "Pending",
        createdBy: "system",
      });
      staleLeadsFlagged++;
    } catch {}
  }

  const overdueNurture = await pool.query(
    `SELECT t.id, t.lead_id, t.assigned_crm_user_id, t.notes, t.due_date
     FROM tasks t
     JOIN leads l ON t.lead_id = l.id
     WHERE t.tenant_id = $1
     AND t.title LIKE 'Nurture Follow-up%'
     AND t.status = 'Pending'
     AND t.due_date < NOW() - INTERVAL '48 hours'
     AND l.status = 'Nurture'
     AND NOT EXISTS (
       SELECT 1 FROM tasks esc
       WHERE esc.lead_id = t.lead_id AND esc.tenant_id = $1
       AND esc.title = 'ESCALATION: Overdue Nurture Task — Task #' || t.id::text
       AND esc.status = 'Pending'
     )`,
    [tenantId]
  );

  for (const task of overdueNurture.rows) {
    try {
      const supervisorResult = await pool.query(
        `SELECT cu.id FROM crm_users cu
         JOIN system_roles sr ON cu.system_role_id = sr.id
         WHERE cu.tenant_id = $1 AND sr.code IN ('MANAGER', 'ADMIN') AND cu.is_active = true
         ORDER BY CASE sr.code WHEN 'MANAGER' THEN 1 WHEN 'ADMIN' THEN 2 END
         LIMIT 1`,
        [tenantId]
      );
      const managerId = supervisorResult.rows[0]?.id;
      if (managerId && managerId !== task.assigned_crm_user_id) {
        await db.insert(tasks).values({
          tenantId,
          leadId: task.lead_id,
          title: `ESCALATION: Overdue Nurture Task — Task #${task.id}`,
          description: `A nurture follow-up task has been overdue for 48+ hours. The assigned agent has not actioned it. Please review and reassign or complete.`,
          priority: "Urgent",
          dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000),
          assignedCrmUserId: managerId,
          status: "Pending",
          createdBy: "system",
        });
        overdueNurtureEscalated++;
      }
    } catch {}
  }

  return { dormantTasksCreated, staleLeadsFlagged, overdueNurtureEscalated };
}
