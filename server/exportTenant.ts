/**
 * Tenant Data Export / Import
 *
 * Compliance: India DPDP Act 2023, IT Act 2000, CERT-In Guidelines
 * Encryption:  AES-256-GCM with PBKDF2-SHA256 (120,000 iterations)
 * Format:      .hcrmx (Hospital CRM Export — encrypted JSON)
 *
 * NEVER exports: password hashes, session tokens, SMTP credentials
 * PHI data:      EXCLUDED by default — must be explicitly opted-in
 */

import { pool, db } from "./db";
import { eq } from "drizzle-orm";
import { tenants, auditLogs } from "@shared/schema";
import crypto from "crypto";

// ─── Constants ───────────────────────────────────────────────────────────────

export const HCRMX_VERSION = "1.0";
export const HCRMX_FORMAT  = "HCRMX";

const KDF_ITERATIONS = 120_000;
const MIN_PASSPHRASE_LEN = 12;

/**
 * Operational / master data tables.
 * These contain NO patient PHI — safe to export with minimal restriction.
 */
const MASTER_TABLES: string[] = [
  "organisations",
  "branches",
  "system_roles",
  "administrative_departments",
  "treatment_departments",
  "designations",
  "employment_types",
  "countries",
  "states",
  "cities",
  "pin_codes",
  "areas",
  "lead_statuses",
  "activity_types",
  "task_categories",
  "next_action_types",
  "appointment_statuses",
  "appointment_types",
  "consultation_types",
  "consultation_outcomes",
  "consultation_outcome_remarks",
  "conversion_stages",
  "lost_reasons",
  "no_show_reasons",
  "call_statuses",
  "call_directions",
  "referral_statuses",
  "lead_creation_channels",
  "campaign_channels",
  "lead_source_categories",
  "lead_sources",
  "cost_heads",
  "room_types",
  "insurers",
  "tpas",
  "policy_types",
  "preauth_statuses",
  "rejection_reasons",
  "sla_rules",
  "reminder_policies",
  "data_retention_policies",
  "revenue_probability_config",
  "role_permissions",
  "lead_merge_roles",
  "clinical_notes_edit_roles",
  "calling_lines",
  "campaigns",
  "referral_config",
  "referral_reward_rules",
  "post_care_protocols",
  "post_care_protocol_steps",
  "lead_capture_rules",
  "custom_field_suggestions",
  "tags",
  "holidays",
  "tenant_settings",
  "tenant_domains",
];

/**
 * PHI tables — Sensitive Personal Data per DPDP Act 2023.
 * Only exported when user explicitly opts-in.
 */
const PHI_TABLES: string[] = [
  "leads",
  "patients",
  "contacts",
  "contact_persons",
  "lead_contact_persons",
  "patient_contact_links",
  "episodes",
  "episode_quote_items",
  "activities",
  "tasks",
  "appointments",
  "referrals",
  "referral_reward_logs",
  "handover_logs",
  "temperature_logs",
  "reschedule_history",
  "communication_preferences",
  "access_logs",
  "callyzer_webhook_logs",
];

export type ExportPurpose =
  | "BACKUP"
  | "MIGRATION"
  | "REGULATORY_AUDIT"
  | "DISASTER_RECOVERY"
  | "OTHER";

export interface ExportOptions {
  tenantId: number;
  includePhiData: boolean;
  purpose: ExportPurpose;
  purposeNote?: string;
  exportedBy: string;        // name or email of the SYS_ADMIN
  exportedByCrmUserId: number;
  passphrase: string;
  requestIp?: string;
}

// ─── Crypto helpers ───────────────────────────────────────────────────────────

export function encryptPayload(
  plaintext: string,
  passphrase: string
): { salt: string; iv: string; authTag: string; encrypted: string } {
  const salt = crypto.randomBytes(32);
  const iv   = crypto.randomBytes(16);
  const key  = crypto.pbkdf2Sync(passphrase, salt, KDF_ITERATIONS, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    salt:      salt.toString("base64"),
    iv:        iv.toString("base64"),
    authTag:   cipher.getAuthTag().toString("base64"),
    encrypted: enc.toString("base64"),
  };
}

export function decryptPayload(opts: {
  encrypted: string;
  salt: string;
  iv: string;
  authTag: string;
  passphrase: string;
  iterations?: number;
}): string {
  const itr = opts.iterations ?? KDF_ITERATIONS;
  const key = crypto.pbkdf2Sync(
    opts.passphrase,
    Buffer.from(opts.salt, "base64"),
    itr, 32, "sha256"
  );
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(opts.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(opts.authTag, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(opts.encrypted, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

// ─── Passphrase strength check ────────────────────────────────────────────────

export function validatePassphrase(passphrase: string): string | null {
  if (!passphrase || passphrase.length < MIN_PASSPHRASE_LEN)
    return `Passphrase must be at least ${MIN_PASSPHRASE_LEN} characters (CERT-In requirement).`;
  if (!/[A-Z]/.test(passphrase))
    return "Passphrase must include at least one uppercase letter.";
  if (!/[a-z]/.test(passphrase))
    return "Passphrase must include at least one lowercase letter.";
  if (!/[0-9]/.test(passphrase))
    return "Passphrase must include at least one number.";
  if (!/[^A-Za-z0-9]/.test(passphrase))
    return "Passphrase must include at least one special character (!@#$%^&* etc.).";
  return null;
}

// ─── Safe query helper ────────────────────────────────────────────────────────

async function safeQuery(sql: string, params: any[]): Promise<any[]> {
  try {
    const r = await pool.query(sql, params);
    return r.rows;
  } catch {
    return [];
  }
}

// ─── Main export builder ──────────────────────────────────────────────────────

export async function buildTenantExport(opts: ExportOptions): Promise<Buffer> {
  const { tenantId, includePhiData, purpose, purposeNote, exportedBy, exportedByCrmUserId, passphrase, requestIp } = opts;

  const err = validatePassphrase(passphrase);
  if (err) throw new Error(err);

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new Error("Tenant not found");

  const data: Record<string, any[]> = {};
  const counts: Record<string, number> = {};

  // 1. Master / operational data (always included)
  for (const tbl of MASTER_TABLES) {
    data[tbl] = await safeQuery(
      `SELECT * FROM ${tbl} WHERE tenant_id = $1 ORDER BY id`,
      [tenantId]
    );
    counts[tbl] = data[tbl].length;
  }

  // 2. CRM users — passwords, salts, and session tokens stripped
  data["crm_users"] = await safeQuery(
    `SELECT id, tenant_id, name, email, phone,
            system_role_id, status, is_active, designation_id, branch_id,
            reporting_to, access_scope_type, phi_access_level, display_order, created_at
     FROM crm_users WHERE tenant_id = $1 ORDER BY id`,
    [tenantId]
  );
  counts["crm_users"] = data["crm_users"].length;

  // 3. PHI data (only if explicitly requested)
  if (includePhiData) {
    for (const tbl of PHI_TABLES) {
      data[tbl] = await safeQuery(
        `SELECT * FROM ${tbl} WHERE tenant_id = $1 ORDER BY id`,
        [tenantId]
      );
      counts[tbl] = data[tbl].length;
    }
  }

  const exportedAt = new Date().toISOString();
  const payloadJson = JSON.stringify(data);
  const checksum = crypto.createHash("sha256").update(payloadJson).digest("hex");
  const enc = encryptPayload(payloadJson, passphrase);

  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

  const fileContent = {
    format:  HCRMX_FORMAT,
    version: HCRMX_VERSION,

    // ── Public metadata (not encrypted — visible without passphrase) ──────────
    meta: {
      platform:        "RGB Hospital CRM",
      exportedAt,
      exportedBy,
      tenantId,
      tenantName:      tenant.name,
      subdomain:       tenant.subdomain,
      includesPhiData: includePhiData,
      purpose,
      purposeNote:     purposeNote || null,
      totalRecords,
      tableCount:      Object.keys(counts).length,
      recordCounts:    counts,
    },

    // ── Compliance declaration ───────────────────────────────────────────────
    compliance: {
      frameworks: [
        "Digital Personal Data Protection Act, 2023 (DPDP Act) — India",
        "Information Technology Act, 2000 (IT Act) — India",
        "CERT-In Guidelines on Information Security",
        "MoHFW Digital Health Data Standards",
      ],
      phiClassification: includePhiData
        ? "SENSITIVE_PERSONAL_DATA — Restricted"
        : "NON_PHI — Operational Data Only",
      encryptionStandard:
        "AES-256-GCM · PBKDF2-SHA256 · 120,000 iterations · Random IV & Salt per export",
      dataResidency:   "India",
      auditTrailNote:
        "This export has been recorded in the system audit log with timestamp, exporter identity, purpose, and PHI scope.",
      handlingInstructions: includePhiData
        ? "Contains patient health data. Store securely. Share only on need-to-know basis. Destroy securely when no longer required. Breach must be reported within 72 hours per DPDP Act obligations."
        : "No patient PHI included. Standard data handling practices apply.",
    },

    // ── Encryption envelope ──────────────────────────────────────────────────
    encryption: {
      algorithm:  "AES-256-GCM",
      kdf:        "PBKDF2-SHA256",
      iterations: KDF_ITERATIONS,
      saltBytes:  32,
      ivBytes:    16,
      salt:       enc.salt,
      iv:         enc.iv,
      authTag:    enc.authTag,
    },

    payloadChecksum: checksum,
    payload: enc.encrypted,
  };

  // ── Audit log ───────────────────────────────────────────────────────────────
  await pool.query(
    `INSERT INTO audit_logs
       (tenant_id, entity_type, entity_id, action, old_values, new_values, changed_fields,
        performed_by, performed_by_crm_user_id)
     VALUES ($1, 'tenant', $2, 'DATA_EXPORT', NULL, $3, $4, $5, $6)`,
    [
      tenantId, String(tenantId),
      JSON.stringify({
        purpose, purposeNote: purposeNote || null,
        includesPhiData: includePhiData,
        totalRecords,
        tableCount: Object.keys(counts).length,
        requestIp: requestIp || "unknown",
        exportedAt,
      }),
      "DATA_EXPORT",
      exportedBy,
      exportedByCrmUserId,
    ]
  ).catch(() => {/* audit log failure must not block export */});

  return Buffer.from(JSON.stringify(fileContent, null, 2), "utf8");
}

// ─── Import: parse & decrypt ──────────────────────────────────────────────────

export interface ParsedExport {
  meta: Record<string, any>;
  compliance: Record<string, any>;
  data: Record<string, any[]>;
  counts: Record<string, number>;
  includesPhiData: boolean;
}

export function parseTenantExport(fileBuffer: Buffer, passphrase: string): ParsedExport {
  let file: any;
  try {
    file = JSON.parse(fileBuffer.toString("utf8"));
  } catch {
    throw new Error("Invalid file — not a valid JSON export.");
  }

  if (file.format !== HCRMX_FORMAT) {
    throw new Error("Not a valid HCRMX export file. Ensure you are uploading a file exported from this platform.");
  }
  if (!file.encryption || !file.payload) {
    throw new Error("Export file is missing encryption headers. The file may be corrupt.");
  }

  let payloadJson: string;
  try {
    payloadJson = decryptPayload({
      encrypted:  file.payload,
      salt:       file.encryption.salt,
      iv:         file.encryption.iv,
      authTag:    file.encryption.authTag,
      passphrase,
      iterations: file.encryption.iterations ?? KDF_ITERATIONS,
    });
  } catch {
    throw new Error("Incorrect passphrase or corrupted file. Decryption failed.");
  }

  // Integrity check
  const checksum = crypto.createHash("sha256").update(payloadJson).digest("hex");
  if (checksum !== file.payloadChecksum) {
    throw new Error("Integrity check failed — file checksum does not match. The export may have been tampered with.");
  }

  const data = JSON.parse(payloadJson) as Record<string, any[]>;
  const counts: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    counts[k] = Array.isArray(v) ? v.length : 0;
  }

  return {
    meta:           file.meta,
    compliance:     file.compliance,
    data,
    counts,
    includesPhiData: file.meta?.includesPhiData === true,
  };
}

// ─── Import: apply (master data only) ────────────────────────────────────────

/**
 * Imports master/operational data from a parsed export into the target tenant.
 * PHI data is NEVER imported here — that requires a deliberate separate process.
 * Strategy: DELETE existing records, then INSERT from export (preserving IDs).
 */
export async function applyMasterDataImport(
  parsed: ParsedExport,
  targetTenantId: number,
  importedByCrmUserId: number,
  importedBy: string,
  requestIp?: string
): Promise<Record<string, number>> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, targetTenantId));
  if (!tenant) throw new Error("Target tenant not found");

  const applied: Record<string, number> = {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const tbl of MASTER_TABLES) {
      const rows = parsed.data[tbl];
      if (!rows || rows.length === 0) {
        applied[tbl] = 0;
        continue;
      }

      // Delete existing rows for this tenant
      await client.query(`DELETE FROM ${tbl} WHERE tenant_id = $1`, [targetTenantId]);

      // Insert rows (replace source tenantId with target tenantId)
      let inserted = 0;
      for (const row of rows) {
        const r = { ...row, tenant_id: targetTenantId };
        const cols = Object.keys(r);
        const vals = Object.values(r);
        const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
        try {
          await client.query(
            `INSERT INTO ${tbl} (${cols.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            vals
          );
          inserted++;
        } catch {
          // Skip rows that fail (e.g. constraint issues)
        }
      }
      applied[tbl] = inserted;
    }

    // CRM users (no passwords)
    const userRows = parsed.data["crm_users"] ?? [];
    if (userRows.length > 0) {
      await client.query(`DELETE FROM crm_users WHERE tenant_id = $1`, [targetTenantId]);
      let uInserted = 0;
      for (const row of userRows) {
        const r = { ...row, tenant_id: targetTenantId, password_hash: null };
        const cols = Object.keys(r);
        const vals = Object.values(r);
        const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
        try {
          await client.query(
            `INSERT INTO crm_users (${cols.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            vals
          );
          uInserted++;
        } catch { /* skip */ }
      }
      applied["crm_users"] = uInserted;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Audit
  await pool.query(
    `INSERT INTO audit_logs
       (tenant_id, entity_type, entity_id, action, old_values, new_values, changed_fields,
        performed_by, performed_by_crm_user_id)
     VALUES ($1, 'tenant', $2, 'DATA_IMPORT', NULL, $3, $4, $5, $6)`,
    [
      targetTenantId, String(targetTenantId),
      JSON.stringify({ sourceExportMeta: parsed.meta, tablesApplied: Object.keys(applied), requestIp }),
      "DATA_IMPORT",
      importedBy,
      importedByCrmUserId,
    ]
  ).catch(() => {});

  return applied;
}
