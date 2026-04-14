import { db, pool } from "../db";
import { leads, handoverLogs, activities } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface HandoverResult {
  fromTeam: string | null;
  toTeam: string;
  fromUserId: number | null;
  toUserId: number | null;
  handoverExecuted: boolean;
}

const STAGE_TEAM_MAP: Record<string, string> = {
  "Lead Created": "Telecalling",
  "Appointment Booked": "Front Office",
  "Checked In": "Doctor",
  "Consultation Done": "Doctor",
  "Estimate Shared": "Financial",
  "Insurance Applicable": "Insurance",
  "Surgery Scheduled": "OT / IP Desk",
  "Discharge": "Post Care",
  "Post Care Completed": "Referral",
};

async function findTeamUser(tenantId: number, team: string, branchId?: number | null, doctorId?: number | null): Promise<number | null> {
  if (team === "Doctor" && doctorId) {
    const result = await pool.query(
      `SELECT id FROM crm_users WHERE tenant_id = $1 AND status = 'Active'
       AND (employee_code LIKE '%DOC%' OR role_code = 'DOCTOR')
       LIMIT 1`,
      [tenantId]
    );
    return result.rows[0]?.id || null;
  }

  const roleMapping: Record<string, string[]> = {
    "Telecalling": ["PATIENT_COORDINATOR", "COUNSELLOR"],
    "Front Office": ["PATIENT_COORDINATOR", "MANAGER"],
    "Financial": ["COUNSELLOR", "MANAGER"],
    "Insurance": ["COUNSELLOR", "MANAGER"],
    "OT / IP Desk": ["MANAGER"],
    "Post Care": ["PATIENT_COORDINATOR", "COUNSELLOR"],
    "Referral": ["PATIENT_COORDINATOR", "COUNSELLOR"],
  };

  const roles = roleMapping[team] || ["PATIENT_COORDINATOR"];
  const rolePlaceholders = roles.map((_, i) => `$${i + 3}`).join(", ");

  let query = `
    SELECT cu.id FROM crm_users cu
    JOIN system_roles sr ON cu.system_role_id = sr.id
    WHERE cu.tenant_id = $1 AND cu.status = 'Active'
    AND sr.code IN (${rolePlaceholders})
  `;
  const params: any[] = [tenantId, branchId, ...roles];

  if (branchId) {
    query += ` AND cu.branch_id = $2`;
  }
  query += ` ORDER BY cu.id LIMIT 1`;

  const result = await pool.query(query, params);
  return result.rows[0]?.id || null;
}

export async function processAutoHandover(
  entityType: "Lead" | "Episode",
  entityId: number,
  triggerEvent: string,
  tenantId: number,
  changedBy: string,
  context?: { branchId?: number | null; doctorId?: number | null; appointmentId?: number | null },
): Promise<HandoverResult> {
  const toTeam = STAGE_TEAM_MAP[triggerEvent];
  if (!toTeam) {
    return { fromTeam: null, toTeam: "Unknown", fromUserId: null, toUserId: null, handoverExecuted: false };
  }

  let fromTeam: string | null = null;
  let fromUserId: number | null = null;

  if (entityType === "Lead") {
    const [lead] = await db.select().from(leads).where(
      and(eq(leads.id, entityId), eq(leads.tenantId, tenantId))
    );
    if (lead) {
      fromTeam = lead.ownerTeam || null;
      fromUserId = lead.primaryOwnerUserId || lead.assignedCrmUserId || null;
    }
  }

  const toUserId = await findTeamUser(tenantId, toTeam, context?.branchId, context?.doctorId);

  await db.insert(handoverLogs).values({
    tenantId,
    entityType,
    entityId,
    fromUserId,
    toUserId,
    fromTeam,
    toTeam,
    triggerEvent,
    notes: `Auto-handover triggered by: ${triggerEvent}`,
  });

  if (entityType === "Lead") {
    const updateData: any = {
      ownerTeam: toTeam,
      lastHandoverAt: new Date(),
      lastActivityAt: new Date(),
    };
    if (toUserId) {
      updateData.primaryOwnerUserId = toUserId;
    }

    await db.update(leads).set(updateData).where(
      and(eq(leads.id, entityId), eq(leads.tenantId, tenantId))
    );

    await db.insert(activities).values({
      tenantId,
      leadId: entityId,
      type: "auto_handover",
      description: `Auto-handover: ${fromTeam || "Unassigned"} → ${toTeam}${toUserId ? ` (User #${toUserId})` : ""}`,
      createdBy: changedBy,
      metadata: { fromTeam, toTeam, fromUserId, toUserId, triggerEvent },
    });
  }

  return { fromTeam, toTeam, fromUserId, toUserId, handoverExecuted: true };
}
