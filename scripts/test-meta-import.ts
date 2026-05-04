/**
 * Integration smoke test: validate Meta sheet import fixes end-to-end
 *
 * Uses the real processSheetRows() production function from googleSheetsSync.ts
 * and exercises the real database. Creates an isolated test tenant, runs the
 * import twice (initial + re-import), asserts DB state, then cleans up.
 *
 * The fixture at scripts/fixtures/meta-incident-sheet.csv mirrors the structure
 * of the original incident sheet (9 rows: 8 real leads + 1 test row) with
 * PII-sanitised phone numbers.
 *
 * Run: npx tsx scripts/test-meta-import.ts
 *
 * Validates:
 *   1. 9-row sheet → 8 leads created, 1 test row skipped
 *   2. Names come from full_name column, NOT ad_name
 *   3. Phone numbers are valid E.164 (no p: prefix, no double +91)
 *   4. Notes = "Platform: fb | Ad: ... | Form: ... | Adset: ... | PIN: ..."
 *   5. Tags include both campaign_name and adset_name as separate values
 *   6. Re-import of the same sheet with "skip" strategy creates 0 new leads
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../server/db";
import { leads, tenants } from "../shared/schema";
import { eq } from "drizzle-orm";
import { processSheetRows } from "../server/services/googleSheetsSync";

// ─── Load fixture CSV from disk ───────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, "fixtures", "meta-incident-sheet.csv");

function parseCsvFixture(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const parse = (line: string): string[] => {
    const fields: string[] = [];
    let inQuote = false, current = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQuote)       { inQuote = true; }
      else if (ch === '"' && inQuote)   { if (line[i + 1] === '"') { current += '"'; i++; } else inQuote = false; }
      else if (ch === "," && !inQuote)  { fields.push(current); current = ""; }
      else                               { current += ch; }
    }
    fields.push(current);
    return fields;
  };
  const [headerLine, ...dataLines] = lines;
  return { headers: parse(headerLine), rows: dataLines.map(parse) };
}

const { headers: HEADERS, rows: ROWS } = parseCsvFixture(readFileSync(FIXTURE_PATH, "utf-8"));

// Column mapping as an admin would configure (intentionally maps name → ad_name
// to prove resolveLeadName overrides it with the full_name column)
const COLUMN_MAPPING: Record<string, string> = {
  name:  "ad_name",
  phone: "phone_number",
  email: "email",
};

// ─── Test harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}${detail ? `\n       → ${detail}` : ""}`);
    failed++;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

let testTenantId = 0;

async function main() {
  console.log("\n=== Meta Sheet Import Integration Smoke Test ===");
  console.log(`Fixture: ${FIXTURE_PATH}`);
  console.log(`Sheet:   ${HEADERS.length} columns, ${ROWS.length} data rows\n`);

  // ── 1. Create an isolated test tenant ──────────────────────────────────────
  const subdomain = `smoke-test-${Date.now()}`;
  const [testTenant] = await db.insert(tenants).values({
    name: "Smoke Test Hospital",
    subdomain,
  }).returning();
  testTenantId = testTenant.id;
  console.log(`Test tenant created: id=${testTenantId} subdomain=${subdomain}\n`);

  // ── 2. First import ────────────────────────────────────────────────────────
  console.log("[ First import — 9-row sheet (8 real + 1 test) ]");
  const run1 = await processSheetRows(HEADERS, ROWS, {
    columnMapping: COLUMN_MAPPING,
    dedupStrategy: "skip",
    leadStatus: "Raw Lead Captured",
    tenantId: testTenantId,
  });

  assert(`leadsCreated = 8`,           run1.leadsCreated === 8, `got ${run1.leadsCreated}`);
  assert(`leadsSkipped = 1 (test row)`,run1.leadsSkipped === 1, `got ${run1.leadsSkipped}`);
  assert(`leadsUpdated = 0`,            run1.leadsUpdated === 0, `got ${run1.leadsUpdated}`);

  // ── 3. Verify DB state after first import ──────────────────────────────────
  const createdLeads = await db.select().from(leads).where(eq(leads.tenantId, testTenantId));

  console.log("\n[ DB state — 8 leads persisted ]");
  assert(
    `Exactly 8 leads in DB for test tenant`,
    createdLeads.length === 8,
    `found ${createdLeads.length}`,
  );

  // Names — must come from full_name, not ad_name
  console.log("\n[ Name resolution — full_name overrides ad_name mapping ]");
  const expectedNames = [
    "Rajesh Kumar", "Priya Sharma", "Amit Patel", "Sunita Verma",
    "Mohan Das",    "Kavitha Nair", "Arjun Singh", "Deepa Menon",
  ];
  for (const expectedName of expectedNames) {
    const match = createdLeads.find(l => l.name === expectedName);
    assert(
      `Lead "${expectedName}" exists in DB`,
      !!match,
      `not found; DB names = [${createdLeads.map(l => l.name).join(", ")}]`,
    );
    assert(
      `Lead "${expectedName}" name is NOT the ad_name value`,
      match?.name !== "Summer Campaign Ad" && match?.name !== "Winter Campaign Ad",
      `name="${match?.name}"`,
    );
  }

  // Phone — E.164, no p: prefix, no double +91
  console.log("\n[ Phone normalisation — E.164 format in DB ]");
  const e164Re = /^\+91\d{10}$/;
  for (const lead of createdLeads) {
    const ph = lead.phoneE164 ?? "";
    assert(`"${lead.name}" phone matches E.164 (+91XXXXXXXXXX) — got "${ph}"`, e164Re.test(ph));
    assert(`"${lead.name}" phone has no p: prefix`,  !ph.includes("p:"),    `got "${ph}"`);
    assert(`"${lead.name}" phone has no double +91`, !ph.includes("+91+91"), `got "${ph}"`);
  }

  // Notes — "Platform: x | Ad: x | Form: x | Adset: x | PIN: x"
  console.log("\n[ Auto-notes format in DB ]");
  for (const lead of createdLeads) {
    const notes = lead.notes ?? "";
    assert(`"${lead.name}" notes contains "Platform:"`, notes.includes("Platform:"), `notes="${notes}"`);
    assert(`"${lead.name}" notes contains "Ad:"`,       notes.includes("Ad:"),       `notes="${notes}"`);
    assert(`"${lead.name}" notes contains "Form:"`,     notes.includes("Form:"),     `notes="${notes}"`);
    assert(`"${lead.name}" notes contains "PIN:"`,      notes.includes("PIN:"),      `notes="${notes}"`);
  }

  const rajesh = createdLeads.find(l => l.name === "Rajesh Kumar");
  assert(
    `Rajesh Kumar exact notes = "Platform: fb | Ad: Summer Campaign Ad | Form: Lead Form A | Adset: Mumbai Leads | PIN: 400001"`,
    rajesh?.notes === "Platform: fb | Ad: Summer Campaign Ad | Form: Lead Form A | Adset: Mumbai Leads | PIN: 400001",
    `got "${rajesh?.notes}"`,
  );

  // Tags — campaign_name and adset_name as separate comma-delimited values
  console.log("\n[ Auto-tags — campaign_name and adset_name as separate values in DB ]");
  const fbLeads = createdLeads.filter(l => (l.notes ?? "").includes("Platform: fb"));
  const igLeads = createdLeads.filter(l => (l.notes ?? "").includes("Platform: ig"));
  for (const lead of fbLeads) {
    const tags = (lead.tags ?? "").split(",").map(t => t.trim());
    assert(`"${lead.name}" tags include "Summer Campaign"`, tags.includes("Summer Campaign"), `tags=[${tags.join(",")}]`);
    assert(`"${lead.name}" tags include "Mumbai Leads"`,   tags.includes("Mumbai Leads"),   `tags=[${tags.join(",")}]`);
  }
  for (const lead of igLeads) {
    const tags = (lead.tags ?? "").split(",").map(t => t.trim());
    assert(`"${lead.name}" tags include "Winter Campaign"`, tags.includes("Winter Campaign"), `tags=[${tags.join(",")}]`);
    assert(`"${lead.name}" tags include "Delhi Leads"`,    tags.includes("Delhi Leads"),    `tags=[${tags.join(",")}]`);
  }

  // ── 4. Re-import the same fixture (idempotency) ────────────────────────────
  console.log("\n[ Re-import — same fixture imported again with \"skip\" dedup ]");
  const run2 = await processSheetRows(HEADERS, ROWS, {
    columnMapping: COLUMN_MAPPING,
    dedupStrategy: "skip",
    leadStatus: "Raw Lead Captured",
    tenantId: testTenantId,
  });

  assert(`Re-import: leadsCreated = 0`, run2.leadsCreated === 0, `got ${run2.leadsCreated}`);
  assert(`Re-import: leadsSkipped ≥ 8`, run2.leadsSkipped >= 8,  `got ${run2.leadsSkipped}`);

  const afterReimport = await db.select().from(leads).where(eq(leads.tenantId, testTenantId));
  assert(
    `Re-import: still exactly 8 leads in DB (no duplicates created)`,
    afterReimport.length === 8,
    `found ${afterReimport.length}`,
  );
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main()
  .catch(err => {
    console.error("\nFATAL:", err.message);
    failed++;
  })
  .finally(async () => {
    if (testTenantId) {
      try {
        await db.delete(leads).where(eq(leads.tenantId, testTenantId));
        await db.delete(tenants).where(eq(tenants.id, testTenantId));
        console.log(`\nCleanup: test tenant ${testTenantId} and its leads removed.`);
      } catch (err: any) {
        console.warn(`Cleanup warning: ${err.message}`);
      }
    }

    console.log(`\n${"─".repeat(50)}`);
    console.log(`Result: ${passed} passed, ${failed} failed`);
    if (failed === 0) {
      console.log("All checks passed — Meta import fixes verified against real DB.\n");
      process.exit(0);
    } else {
      console.error("Some checks FAILED — please review the output above.\n");
      process.exit(1);
    }
  });
