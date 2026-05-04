import { db } from "../db";
import { googleSheetsSyncConfigs, leadImportLogs } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { storage, toProperCase } from "../storage";

export function normalizePhone(phone: string): string {
  let p = phone.replace(/\D/g, "");
  if (p.length === 10) p = "91" + p;
  if (!p.startsWith("+")) p = "+" + p;
  return p;
}

export function stripMetaExportPrefix(val: string): string {
  return val.replace(/^(p:|z:|l:|as:|ag:|c:|f:)/i, "").trim();
}

export function isTestLeadSheetRow(headers: string[], row: string[]): boolean {
  const organicIdx = headers.findIndex(h =>
    ["is_organic", "is organic", "isorganic"].includes(h.toLowerCase().replace(/\s+/g, " ").trim())
  );
  if (organicIdx >= 0 && (row[organicIdx] || "").trim().toLowerCase() === "true") return true;
  const phoneIdx = headers.findIndex(h => /phone|mobile|contact/i.test(h));
  if (phoneIdx >= 0) {
    const phoneVal = (row[phoneIdx] || "").trim().toLowerCase();
    if (phoneVal.startsWith("p:<test") || phoneVal.startsWith("p:test")) return true;
  }
  for (const val of row) {
    if (/\btest\s*lead\b|\bdummy\s*data\b/i.test(val || "")) return true;
  }
  return false;
}

export function buildMetaAutoNotes(headers: string[], row: string[], explicitNotes?: string): string | undefined {
  if (explicitNotes) return explicitNotes;
  const find = (names: string[]) => {
    const idx = headers.findIndex(h => names.includes(h.toLowerCase().replace(/[\s_]/g, "")));
    return idx >= 0 && row[idx] ? stripMetaExportPrefix(row[idx].trim()) : "";
  };
  const platform = find(["platform"]);
  const adName = find(["adname"]);
  const formName = find(["formname"]);
  const adsetName = find(["adsetname"]);
  const postCode = find(["postcode", "pincode", "pin"]);
  const parts: string[] = [];
  if (platform) parts.push(`Platform: ${platform}`);
  if (adName) parts.push(`Ad: ${adName}`);
  if (formName) parts.push(`Form: ${formName}`);
  if (adsetName) parts.push(`Adset: ${adsetName}`);
  if (postCode) parts.push(`PIN: ${postCode}`);
  return parts.length > 0 ? parts.join(" | ") : undefined;
}

export function resolveLeadName(headers: string[], row: string[], mappedName: string): string {
  const fullNameIdx = headers.findIndex(h => h.toLowerCase().replace(/[\s_]/g, "") === "fullname");
  if (fullNameIdx >= 0 && row[fullNameIdx]) return row[fullNameIdx].trim();
  return mappedName;
}

export function buildMetaAutoTags(headers: string[], row: string[], explicitTags?: string, defaultTags?: string): string | undefined {
  const tagSet: string[] = [];
  if (explicitTags) {
    tagSet.push(...explicitTags.split(",").map(t => t.trim()).filter(Boolean));
  } else if (defaultTags) {
    tagSet.push(...defaultTags.split(",").map(t => t.trim()).filter(Boolean));
  }
  for (const colKey of ["campaignname", "adsetname"]) {
    const idx = headers.findIndex(h => h.toLowerCase().replace(/[\s_]/g, "") === colKey);
    if (idx >= 0 && row[idx]) {
      const val = stripMetaExportPrefix(row[idx].trim());
      if (val && !tagSet.includes(val)) tagSet.push(val);
    }
  }
  return tagSet.length > 0 ? tagSet.join(",") : undefined;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields: string[] = [];
    let inQuote = false, current = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQuote) { inQuote = true; }
      else if (ch === '"' && inQuote) {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuote = false;
      } else if (ch === "," && !inQuote) { fields.push(current); current = ""; }
      else { current += ch; }
    }
    fields.push(current);
    rows.push(fields);
  }
  return rows;
}

async function fetchSheetCsv(spreadsheetId: string, gid?: string | null): Promise<string[][]> {
  let url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
  if (gid) url += `&gid=${gid}`;
  const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (resp.status === 401 || resp.status === 403) {
    throw new Error("Access denied — sheet must be shared as \"Anyone with the link can view\"");
  }
  if (resp.status === 404) throw new Error("Sheet not found — check the URL");
  if (!resp.ok) throw new Error(`Failed to read sheet (HTTP ${resp.status})`);
  const text = await resp.text();
  if (text.includes("<!DOCTYPE html>") || text.includes("<HTML>")) {
    throw new Error("Sheet is not publicly accessible — change sharing to \"Anyone with the link can view\"");
  }
  return parseCsv(text);
}

// ─── Exported processing engine ──────────────────────────────────────────────

export interface ProcessSheetRowsOptions {
  columnMapping: Record<string, string>;
  dedupStrategy?: "skip" | "update_blank" | "overwrite";
  leadStatus?: string;
  defaultTags?: string;
  tenantId: number;
}

export interface ProcessSheetRowsResult {
  leadsCreated: number;
  leadsSkipped: number;
  leadsUpdated: number;
}

/**
 * Core import engine — processes a list of sheet rows against the DB.
 * Exported so it can be exercised directly in integration tests and scripts
 * without needing a live Google Sheets URL.
 */
export async function processSheetRows(
  headers: string[],
  dataRows: string[][],
  opts: ProcessSheetRowsOptions,
): Promise<ProcessSheetRowsResult> {
  const {
    columnMapping,
    dedupStrategy = "skip",
    leadStatus = "Raw Lead Captured",
    defaultTags,
    tenantId,
  } = opts;

  let leadsCreated = 0, leadsSkipped = 0, leadsUpdated = 0;

  for (const row of dataRows) {
    if (isTestLeadSheetRow(headers, row)) { leadsSkipped++; continue; }

    const mapped: Record<string, string> = {};
    for (const [crmField, sheetCol] of Object.entries(columnMapping)) {
      if (sheetCol) {
        const colIdx = headers.indexOf(sheetCol);
        if (colIdx >= 0 && row[colIdx]) mapped[crmField] = row[colIdx];
      }
    }

    const name = toProperCase(resolveLeadName(headers, row, (mapped.name || "").trim()));
    let phone = (mapped.phoneE164 || mapped.phone || mapped.mobile || "").trim();
    phone = stripMetaExportPrefix(phone);
    const email = (mapped.email || "").trim();
    if (!phone) { leadsSkipped++; continue; }

    try {
      phone = normalizePhone(phone);
    } catch { leadsSkipped++; continue; }

    const autoNotes = buildMetaAutoNotes(headers, row, mapped.notes || undefined);
    const autoTags = buildMetaAutoTags(headers, row, mapped.tags || undefined, defaultTags);

    try {
      const existingLead = await storage.findLeadByPhone(tenantId, phone);
      if (existingLead) {
        if (dedupStrategy === "skip") { leadsSkipped++; continue; }
        if (dedupStrategy === "update_blank") {
          const updates: Record<string, any> = {};
          if (!existingLead.email && email) updates.email = email;
          if (!existingLead.name && name) updates.name = name;
          if (!existingLead.utmSource && mapped.utmSource) updates.utmSource = mapped.utmSource;
          if (!existingLead.utmMedium && mapped.utmMedium) updates.utmMedium = mapped.utmMedium;
          if (!existingLead.utmCampaign && mapped.utmCampaign) updates.utmCampaign = mapped.utmCampaign;
          if (!existingLead.notes && autoNotes) updates.notes = autoNotes;
          if (!existingLead.tags && autoTags) updates.tags = autoTags;
          if (Object.keys(updates).length > 0) { await storage.updateLead(existingLead.id, updates); leadsUpdated++; }
          else leadsSkipped++;
          continue;
        }
        if (dedupStrategy === "overwrite") {
          const updates: Record<string, any> = {};
          if (name) updates.name = name;
          if (email) updates.email = email;
          if (mapped.utmSource) updates.utmSource = mapped.utmSource;
          if (mapped.utmMedium) updates.utmMedium = mapped.utmMedium;
          if (mapped.utmCampaign) updates.utmCampaign = mapped.utmCampaign;
          if (autoNotes) updates.notes = autoNotes;
          if (autoTags) updates.tags = autoTags;
          if (Object.keys(updates).length > 0) { await storage.updateLead(existingLead.id, updates); leadsUpdated++; }
          else leadsSkipped++;
          continue;
        }
      }

      const assignedUser = await storage.getNextAssignableCrmUser(tenantId);
      await storage.createLead({
        tenantId,
        name: name || "Unknown",
        phoneE164: phone,
        email: email || undefined,
        status: leadStatus,
        tags: autoTags || undefined,
        utmSource: mapped.utmSource || "Google Sheets",
        utmMedium: mapped.utmMedium || undefined,
        utmCampaign: mapped.utmCampaign || undefined,
        utmTerm: mapped.utmTerm || undefined,
        utmContent: mapped.utmContent || undefined,
        notes: autoNotes || undefined,
        priority: mapped.priority || "Normal",
        assignedCrmUserId: assignedUser?.id,
        assignedTo: assignedUser?.name,
      });
      leadsCreated++;
    } catch { leadsSkipped++; }
  }

  return { leadsCreated, leadsSkipped, leadsUpdated };
}

export async function runGoogleSheetsSync(
  configId: number,
  tenantId: number,
  triggeredBy: string = "scheduler"
): Promise<{ leadsCreated: number; leadsSkipped: number; leadsUpdated: number; newLastRow: number; message: string }> {
  const configRows = await db.select().from(googleSheetsSyncConfigs)
    .where(and(eq(googleSheetsSyncConfigs.id, configId), eq(googleSheetsSyncConfigs.tenantId, tenantId)));
  const config = configRows[0];
  if (!config) throw new Error("Sync config not found");

  const allRows = await fetchSheetCsv(config.spreadsheetId, config.sheetGid);
  if (allRows.length < 2) {
    await db.update(googleSheetsSyncConfigs).set({
      lastSyncedAt: new Date(), lastSyncStatus: "success",
      lastSyncLeadsCreated: 0, lastSyncLeadsSkipped: 0,
      lastSyncMessage: "No new rows since last sync", modifiedAt: new Date(),
    }).where(eq(googleSheetsSyncConfigs.id, configId));
    return { leadsCreated: 0, leadsSkipped: 0, leadsUpdated: 0, newLastRow: config.lastSyncedRow ?? 1, message: "No new rows" };
  }

  const headers: string[] = allRows[0];
  const startRow = (config.lastSyncedRow ?? 1);
  const dataRows = allRows.slice(1 + startRow);

  if (dataRows.length === 0) {
    await db.update(googleSheetsSyncConfigs).set({
      lastSyncedAt: new Date(), lastSyncStatus: "success",
      lastSyncLeadsCreated: 0, lastSyncLeadsSkipped: 0,
      lastSyncMessage: "No new rows since last sync", modifiedAt: new Date(),
    }).where(eq(googleSheetsSyncConfigs.id, configId));
    return { leadsCreated: 0, leadsSkipped: 0, leadsUpdated: 0, newLastRow: config.lastSyncedRow ?? 1, message: "No new rows" };
  }

  const validDedupStrategies = ["skip", "update_blank", "overwrite"] as const;
  type DedupStrategy = typeof validDedupStrategies[number];
  const resolvedDedup: DedupStrategy =
    validDedupStrategies.find(s => s === config.duplicateStrategy) ?? "skip";

  const { leadsCreated, leadsSkipped, leadsUpdated } = await processSheetRows(headers, dataRows, {
    columnMapping: config.columnMapping as Record<string, string>,
    dedupStrategy: resolvedDedup,
    leadStatus: config.defaultLeadStatus || "Raw Lead Captured",
    defaultTags: config.defaultTags || undefined,
    tenantId,
  });

  const newLastRow = (config.lastSyncedRow ?? 1) + dataRows.length;
  const message = `Pulled ${dataRows.length} rows: ${leadsCreated} new, ${leadsUpdated} updated, ${leadsSkipped} skipped`;

  await db.update(googleSheetsSyncConfigs).set({
    lastSyncedRow: newLastRow,
    lastSyncedAt: new Date(),
    lastSyncStatus: "success",
    lastSyncLeadsCreated: leadsCreated,
    lastSyncLeadsSkipped: leadsSkipped,
    lastSyncMessage: message,
    modifiedAt: new Date(),
  }).where(eq(googleSheetsSyncConfigs.id, configId));

  await db.insert(leadImportLogs).values({
    tenantId,
    fileName: `Auto-Sync: ${config.name}`,
    source: "google_sheets_auto_sync",
    totalRows: dataRows.length,
    successCount: leadsCreated,
    duplicateCount: leadsSkipped,
    updatedCount: leadsUpdated,
    failureCount: 0,
    duplicateStrategy: config.duplicateStrategy || "skip",
    status: "Completed",
    columnMapping: config.columnMapping,
    importedBy: triggeredBy,
    completedAt: new Date(),
  });

  return { leadsCreated, leadsSkipped, leadsUpdated, newLastRow, message };
}

export async function syncAllActiveGoogleSheetConfigs(): Promise<void> {
  try {
    const activeConfigs = await db.select({
      id: googleSheetsSyncConfigs.id,
      tenantId: googleSheetsSyncConfigs.tenantId,
      name: googleSheetsSyncConfigs.name,
    }).from(googleSheetsSyncConfigs)
      .where(eq(googleSheetsSyncConfigs.isActive, true));

    for (const config of activeConfigs) {
      try {
        const result = await runGoogleSheetsSync(config.id, config.tenantId, "scheduler");
        if (result.leadsCreated > 0 || result.leadsUpdated > 0) {
          console.log(`[scheduler] Google Sheets sync "${config.name}" (tenant ${config.tenantId}): ${result.message}`);
        }
      } catch (err: any) {
        console.error(`[scheduler] Google Sheets sync failed for "${config.name}" (id=${config.id}):`, err.message);
        await db.update(googleSheetsSyncConfigs).set({
          lastSyncedAt: new Date(),
          lastSyncStatus: "error",
          lastSyncMessage: err.message,
          modifiedAt: new Date(),
        }).where(eq(googleSheetsSyncConfigs.id, config.id));
      }
    }
  } catch (err: any) {
    console.error("[scheduler] Error in syncAllActiveGoogleSheetConfigs:", err.message);
  }
}
