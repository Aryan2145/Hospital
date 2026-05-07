import { db, pool } from "../db";
import { leads, handoverLogs, activities } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface HandoverResult {
  fromTeam: string | null;
  toTeam: string;
  fromUserId: number | null;
  toUserId: number | null;
  handoverExecuted: boolean;
  assignmentMethod: string;
}

// Stage → canonical team label
const STAGE_TEAM_MAP: Record<string, string> = {
  "Lead Created":                  "Telecalling",
  "Appointment Booked":            "Front Office",
  "Checked In":                    "Doctor",
  "Consultation Done":             "Doctor",
  "Estimate Shared":               "Counsellor",
  "Insurance Applicable":          "Insurance",
  "Surgery Scheduled":             "OT / IP Coordinator",
  "Pre-op Assessment":             "Medical",
  "Surgery Done":                  "Doctor",
  "In Treatment":                  "Medical",
  "Discharge / Billing Clearance": "Billing",
  "Post Care":                     "Post Care Coordinator",
  "Follow Up":                     "Post Care Coordinator",
  "Referral Ready":                "Referral Coordinator",
};

// Team → primary role(s) to query, plus optional PATIENT_COORDINATOR fallback
const TEAM_ROLES: Record<string, { roles: string[]; patientCoordFallback?: boolean }> = {
  "Telecalling":          { roles: ["TELECALLER"] },
  "Front Office":         { roles: ["RECEPTIONIST"] },
  "Doctor":               { roles: ["DOCTOR"] },
  "Counsellor":           { roles: ["COUNSELLOR"] },
  "Insurance":            { roles: ["INSURANCE_DESK"] },
  "OT / IP Coordinator":  { roles: ["OT_IP_COORDINATOR"], patientCoordFallback: true },
  "Medical":              { roles: ["MEDICAL_ASSISTANT"] },
  "Billing":              { roles: ["BILLING"] },
  "Post Care Coordinator":{ roles: ["POST_CARE_COORDINATOR"], patientCoordFallback: true },
  "Referral Coordinator": { roles: ["REFERRAL_COORDINATOR"], patientCoordFallback: true },
};

const TERMINAL_LEAD_STATUSES = ["Closed Won", "Closed Lost", "Unqualified", "Discontinued", "Completed"];

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getLoggedInUserIds(tenantId: number): Promise<Set<number>> {
  const result = await pool.query(
    `SELECT DISTINCT (sess->>'crmUserId')::int AS crm_user_id
     FROM sessions
     WHERE expire > NOW()
       AND sess->>'crmUserId' IS NOT NULL
       AND (sess->>'tenantId')::int = $1`,
    [tenantId]
  );
  return new Set(result.rows.map((r: any) => Number(r.crm_user_id)).filter(Boolean));
}

async function getUsersInRoles(tenantId: number, roleCodes: string[], branchId?: number | null): Promise<{ id: number; name: string }[]> {
  const placeholders = roleCodes.map((_, i) => `$${i + 2}`).join(", ");
  let q = `
    SELECT cu.id, cu.name
    FROM crm_users cu
    JOIN system_roles sr ON cu.system_role_id = sr.id
    WHERE cu.tenant_id = $1
      AND cu.status = 'Active'
      AND cu.is_active = TRUE
      AND sr.code IN (${placeholders})
  `;
  const params: any[] = [tenantId, ...roleCodes];
  if (branchId) {
    params.push(branchId);
    q += ` AND cu.branch_id = $${params.length}`;
  }
  q += " ORDER BY cu.id";
  const result = await pool.query(q, params);
  return result.rows;
}

async function getLeadLoad(userId: number, tenantId: number): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) AS cnt FROM leads
     WHERE tenant_id = $1 AND primary_owner_user_id = $2
       AND status NOT IN (${TERMINAL_LEAD_STATUSES.map((_, i) => `$${i + 3}`).join(", ")})`,
    [tenantId, userId, ...TERMINAL_LEAD_STATUSES]
  );
  return Number(result.rows[0]?.cnt ?? 0);
}

async function getPreviousOwnerForTeam(leadId: number, toTeam: string): Promise<number | null> {
  const result = await pool.query(
    `SELECT to_user_id FROM handover_logs
     WHERE entity_id = $1 AND entity_type = 'Lead' AND to_team = $2 AND to_user_id IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [leadId, toTeam]
  );
  return result.rows[0]?.to_user_id ?? null;
}

async function pickLeastLoad(
  candidates: { id: number; name: string }[],
  tenantId: number,
  loggedInIds: Set<number>,
  preferUserId?: number | null,
): Promise<{ userId: number; method: string } | null> {
  if (candidates.length === 0) return null;

  const loggedIn = candidates.filter(u => loggedInIds.has(u.id));
  const pool2 = loggedIn.length > 0 ? loggedIn : candidates;

  // Prefer the previous owner if they're in the candidate pool
  if (preferUserId && pool2.some(u => u.id === preferUserId)) {
    return {
      userId: preferUserId,
      method: loggedIn.length > 0 ? "preferred-owner-logged-in" : "preferred-owner-fallback",
    };
  }

  // Least-load among the pool
  let best: { id: number; name: string } | null = null;
  let bestLoad = Infinity;
  for (const u of pool2) {
    const load = await getLeadLoad(u.id, tenantId);
    if (load < bestLoad) { bestLoad = load; best = u; }
  }
  if (!best) return null;
  return {
    userId: best.id,
    method: loggedIn.length > 0 ? "least-load-logged-in" : "least-load-any-active",
  };
}

async function notifyManagersAdmins(
  tenantId: number,
  leadId: number,
  triggerEvent: string,
  targetTeam: string,
): Promise<void> {
  try {
    // Find all MANAGER and ADMIN users for this tenant
    const mgrs = await pool.query(
      `SELECT cu.id, cu.email, cu.name FROM crm_users cu
       JOIN system_roles sr ON cu.system_role_id = sr.id
       WHERE cu.tenant_id = $1 AND cu.status = 'Active' AND cu.is_active = TRUE
         AND sr.code IN ('MANAGER', 'ADMIN')`,
      [tenantId]
    );

    const leadRow = await pool.query(
      `SELECT name FROM leads WHERE id = $1 AND tenant_id = $2`,
      [leadId, tenantId]
    );
    const leadName = leadRow.rows[0]?.name || `Lead #${leadId}`;
    const title = `Unassigned Lead Alert — ${triggerEvent}`;
    const body = `Lead "${leadName}" reached stage "${triggerEvent}" but no available ${targetTeam} user was found. Manual assignment required.`;

    for (const mgr of mgrs.rows) {
      await pool.query(
        `INSERT INTO in_app_notifications (tenant_id, crm_user_id, type, title, body, entity_type, entity_id, link, is_read, created_at)
         VALUES ($1, $2, 'unassigned_lead_alert', $3, $4, 'lead', $5, $6, FALSE, NOW())`,
        [tenantId, mgr.id, title, body, leadId, `/leads/${leadId}`]
      );
    }

    // Best-effort SMTP email to each manager/admin
    try {
      const smtpRows = await pool.query(
        `SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = $1
         AND setting_key IN ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from_email')`,
        [tenantId]
      );
      const cfg: Record<string, string> = {};
      smtpRows.rows.forEach((r: any) => { cfg[r.setting_key] = r.setting_value || ""; });
      const host = cfg.smtp_host || process.env.SMTP_HOST;
      const port = Number(cfg.smtp_port || process.env.SMTP_PORT || 587);
      const user = cfg.smtp_user || process.env.SMTP_USER;
      const pass = cfg.smtp_pass || process.env.SMTP_PASS;
      const from = cfg.smtp_from_email || process.env.SMTP_FROM_EMAIL;
      if (host && user && pass && from) {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.default.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
        for (const mgr of mgrs.rows) {
          if (!mgr.email) continue;
          await transporter.sendMail({
            from,
            to: mgr.email,
            subject: title,
            text: body + `\n\nView lead: /leads/${leadId}`,
          });
        }
      }
    } catch {}
  } catch (notifyErr: any) {
    console.error("[handover] Failed to send unassigned-lead notifications:", notifyErr.message);
  }
}

// ── Core user resolution ───────────────────────────────────────────────────────

async function findTeamUser(
  tenantId: number,
  team: string,
  options: {
    leadId?: number;
    branchId?: number | null;
    doctorId?: number | null;
    surgeryDoctorId?: number | null;
    preopAssignedUserId?: number | null;
  } = {}
): Promise<{ userId: number | null; method: string }> {
  const loggedInIds = await getLoggedInUserIds(tenantId);

  // ── Doctor stages: resolve specific doctor CRM account ──────────────────────
  if (team === "Doctor") {
    const docDbId = options.surgeryDoctorId || options.doctorId;
    if (docDbId) {
      const docRow = await pool.query(
        `SELECT crm_user_id FROM doctors WHERE id = $1 AND tenant_id = $2`,
        [docDbId, tenantId]
      );
      const specificDocCrmId: number | null = docRow.rows[0]?.crm_user_id ?? null;
      if (specificDocCrmId) {
        const active = await pool.query(
          `SELECT id FROM crm_users WHERE id = $1 AND tenant_id = $2 AND status = 'Active' AND is_active = TRUE`,
          [specificDocCrmId, tenantId]
        );
        if (active.rows.length > 0) {
          return { userId: specificDocCrmId, method: "specific-doctor" };
        }
      }
    }
    // Fallback: any logged-in DOCTOR, then any active DOCTOR
    const allDoctors = await getUsersInRoles(tenantId, ["DOCTOR"], options.branchId);
    const result = await pickLeastLoad(allDoctors, tenantId, loggedInIds);
    return result ?? { userId: null, method: "no-doctor-found" };
  }

  const teamConfig = TEAM_ROLES[team];
  if (!teamConfig) return { userId: null, method: "unknown-team" };

  // ── Pre-op: honour preopAssignedUserId if already set ────────────────────────
  if (team === "Medical" && options.preopAssignedUserId) {
    const active = await pool.query(
      `SELECT id FROM crm_users WHERE id = $1 AND tenant_id = $2 AND status = 'Active' AND is_active = TRUE`,
      [options.preopAssignedUserId, tenantId]
    );
    if (active.rows.length > 0) {
      return { userId: options.preopAssignedUserId, method: "preop-assigned-user" };
    }
  }

  // ── Attempt primary roles ────────────────────────────────────────────────────
  const primaryCandidates = await getUsersInRoles(tenantId, teamConfig.roles, options.branchId);
  if (primaryCandidates.length > 0) {
    const preferred = options.leadId ? await getPreviousOwnerForTeam(options.leadId, team) : null;
    const result = await pickLeastLoad(primaryCandidates, tenantId, loggedInIds, preferred);
    if (result) return result;
  }

  // ── PATIENT_COORDINATOR fallback (for OT_IP, POST_CARE, REFERRAL) ───────────
  if (teamConfig.patientCoordFallback) {
    const pcCandidates = await getUsersInRoles(tenantId, ["PATIENT_COORDINATOR"], options.branchId);
    if (pcCandidates.length > 0) {
      const preferred = options.leadId ? await getPreviousOwnerForTeam(options.leadId, team) : null;
      const result = await pickLeastLoad(pcCandidates, tenantId, loggedInIds, preferred);
      if (result) return { userId: result.userId, method: `pc-fallback-${result.method}` };
    }
  }

  return { userId: null, method: "no-user-found" };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function processAutoHandover(
  entityType: "Lead" | "Episode",
  entityId: number,
  triggerEvent: string,
  tenantId: number,
  changedBy: string,
  context?: {
    branchId?: number | null;
    doctorId?: number | null;
    surgeryDoctorId?: number | null;
    appointmentId?: number | null;
    preopAssignedUserId?: number | null;
    episodeId?: number | null;
  },
): Promise<HandoverResult> {
  const toTeam = STAGE_TEAM_MAP[triggerEvent];
  if (!toTeam) {
    return { fromTeam: null, toTeam: "Unknown", fromUserId: null, toUserId: null, handoverExecuted: false, assignmentMethod: "no-stage-match" };
  }

  let fromTeam: string | null = null;
  let fromUserId: number | null = null;
  let leadId: number = entityId;

  if (entityType === "Lead") {
    const [lead] = await db.select().from(leads).where(
      and(eq(leads.id, entityId), eq(leads.tenantId, tenantId))
    );
    if (lead) {
      fromTeam = lead.ownerTeam || null;
      fromUserId = lead.primaryOwnerUserId || lead.assignedCrmUserId || null;
    }
  } else {
    // For episode events, get the lead via episode
    const epRow = await pool.query(
      `SELECT lead_id FROM episodes WHERE id = $1 AND tenant_id = $2`,
      [entityId, tenantId]
    );
    leadId = epRow.rows[0]?.lead_id ?? entityId;
    const [lead] = await db.select().from(leads).where(
      and(eq(leads.id, leadId), eq(leads.tenantId, tenantId))
    );
    if (lead) {
      fromTeam = lead.ownerTeam || null;
      fromUserId = lead.primaryOwnerUserId || lead.assignedCrmUserId || null;
    }
  }

  const { userId: toUserId, method: assignmentMethod } = await findTeamUser(tenantId, toTeam, {
    leadId,
    branchId: context?.branchId,
    doctorId: context?.doctorId,
    surgeryDoctorId: context?.surgeryDoctorId,
    preopAssignedUserId: context?.preopAssignedUserId,
  });

  // Always write a handover log entry
  await pool.query(
    `INSERT INTO handover_logs (tenant_id, entity_type, entity_id, from_user_id, to_user_id, from_team, to_team, trigger_event, notes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [
      tenantId, entityType, entityId, fromUserId, toUserId,
      fromTeam, toTeam, triggerEvent,
      `Auto-handover [${assignmentMethod}]: ${triggerEvent}`,
    ]
  );

  // Update lead ownership
  if (toUserId) {
    const updateFields: any = { ownerTeam: toTeam, lastHandoverAt: new Date(), lastActivityAt: new Date(), primaryOwnerUserId: toUserId };
    await db.update(leads).set(updateFields).where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

    // For Pre-op Assessment: also sync preopAssignedUserId on the episode
    if (triggerEvent === "Pre-op Assessment" && context?.episodeId) {
      await pool.query(
        `UPDATE episodes SET preop_assigned_user_id = $1 WHERE id = $2 AND tenant_id = $3 AND (preop_assigned_user_id IS NULL)`,
        [toUserId, context.episodeId, tenantId]
      );
    }
  } else {
    // No user found: update team label without changing owner, then notify
    await db.update(leads).set({ ownerTeam: toTeam, lastHandoverAt: new Date(), lastActivityAt: new Date() }).where(
      and(eq(leads.id, leadId), eq(leads.tenantId, tenantId))
    );
    await notifyManagersAdmins(tenantId, leadId, triggerEvent, toTeam);
  }

  // Activity log entry
  try {
    await db.insert(activities).values({
      tenantId,
      leadId,
      type: "auto_handover",
      description: `Auto-handover [${assignmentMethod}]: ${fromTeam || "Unassigned"} → ${toTeam}${toUserId ? ` (User #${toUserId})` : " (no user found)"}`,
      createdBy: changedBy,
      metadata: { fromTeam, toTeam, fromUserId, toUserId, triggerEvent, assignmentMethod },
    } as any);
  } catch {}

  return { fromTeam, toTeam, fromUserId, toUserId, handoverExecuted: true, assignmentMethod };
}
