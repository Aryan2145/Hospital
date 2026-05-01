import { db } from "../db";
import { googleSheetsSyncConfigs, leadImportLogs } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { decryptValue } from "../crypto";
import { storage, toProperCase } from "../storage";

function normalizePhone(phone: string): string {
  let p = phone.replace(/\D/g, "");
  if (p.length === 10) p = "91" + p;
  if (!p.startsWith("+")) p = "+" + p;
  return p;
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

  const apiKey = decryptValue(config.apiKeyEncrypted);
  const startRow = (config.lastSyncedRow ?? 1) + 1;
  const range = `'${config.sheetName}'!A${startRow}:Z`;
  const headerRange = `'${config.sheetName}'!1:1`;
  const apiBase = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values`;

  const [headerResp, dataResp] = await Promise.all([
    fetch(`${apiBase}/${encodeURIComponent(headerRange)}?key=${apiKey}`),
    fetch(`${apiBase}/${encodeURIComponent(range)}?key=${apiKey}`),
  ]);

  if (!headerResp.ok) throw new Error("Failed to read sheet headers — check API key and sheet permissions");
  const headerJson = await headerResp.json();
  const headers: string[] = headerJson.values?.[0] || [];
  if (headers.length === 0) throw new Error("No headers found in row 1 of the sheet");

  if (!dataResp.ok) {
    const errBody = await dataResp.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || "Failed to fetch sheet data");
  }
  const rawData = await dataResp.json();
  const dataRows: string[][] = rawData.values || [];

  if (dataRows.length === 0) {
    await db.update(googleSheetsSyncConfigs).set({
      lastSyncedAt: new Date(),
      lastSyncStatus: "success",
      lastSyncLeadsCreated: 0,
      lastSyncLeadsSkipped: 0,
      lastSyncMessage: "No new rows since last sync",
      modifiedAt: new Date(),
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
