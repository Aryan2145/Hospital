import { db } from "../db";
import { googleSheetsSyncConfigs, leadImportLogs } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { storage, toProperCase } from "../storage";

function normalizePhone(phone: string): string {
  let p = phone.replace(/\D/g, "");
  if (p.length === 10) p = "91" + p;
  if (!p.startsWith("+")) p = "+" + p;
  return p;
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
  const startRow = (config.lastSyncedRow ?? 1); // rows are 0-indexed in allRows; row 0 = header, row 1 = first data row
  // lastSyncedRow tracks how many data rows (not including header) we've processed
  const dataRows = allRows.slice(1 + startRow);

  if (dataRows.length === 0) {
    await db.update(googleSheetsSyncConfigs).set({
      lastSyncedAt: new Date(), lastSyncStatus: "success",
      lastSyncLeadsCreated: 0, lastSyncLeadsSkipped: 0,
      lastSyncMessage: "No new rows since last sync", modifiedAt: new Date(),
    }).where(eq(googleSheetsSyncConfigs.id, configId));
    return { leadsCreated: 0, leadsSkipped: 0, leadsUpdated: 0, newLastRow: config.lastSyncedRow ?? 1, message: "No new rows" };
  }

  const columnMapping = config.columnMapping as Record<string, string>;
  const dedupStrategy = config.duplicateStrategy || "skip";
  const leadStatus = config.defaultLeadStatus || "Raw Lead Captured";
  let leadsCreated = 0, leadsSkipped = 0, leadsUpdated = 0;

  for (const row of dataRows) {
    const mapped: Record<string, string> = {};
    for (const [crmField, sheetCol] of Object.entries(columnMapping)) {
      if (sheetCol) {
        const colIdx = headers.indexOf(sheetCol);
        if (colIdx >= 0 && row[colIdx]) mapped[crmField] = row[colIdx];
      }
    }

    const name = toProperCase((mapped.name || "").trim());
    let phone = (mapped.phoneE164 || mapped.phone || mapped.mobile || "").trim();
    const email = (mapped.email || "").trim();
    if (!phone) { leadsSkipped++; continue; }

    try {
      phone = normalizePhone(phone);
    } catch { leadsSkipped++; continue; }

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
          if (!existingLead.notes && mapped.notes) updates.notes = mapped.notes;
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
          if (mapped.notes) updates.notes = mapped.notes;
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
        tags: mapped.tags || config.defaultTags || undefined,
        utmSource: mapped.utmSource || "Google Sheets",
        utmMedium: mapped.utmMedium || undefined,
        utmCampaign: mapped.utmCampaign || undefined,
        utmTerm: mapped.utmTerm || undefined,
        utmContent: mapped.utmContent || undefined,
        notes: mapped.notes || undefined,
        priority: mapped.priority || "Normal",
        assignedCrmUserId: assignedUser?.id,
        assignedTo: assignedUser?.name,
      });
      leadsCreated++;
    } catch { leadsSkipped++; }
  }

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
    duplicateStrategy: dedupStrategy,
    status: "Completed",
    columnMapping: columnMapping,
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
