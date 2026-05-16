/**
 * RGB Demo Hospital – Modi Nagar Demo Tenant Seed
 *
 * Idempotent: safe to re-run. Detects the demo tenant by subdomain "rgb-demo",
 * wipes only its data, and rebuilds everything cleanly.
 * Never touches any other tenant.
 */

import { db, pool } from "./db";
import { eq, and, sql } from "drizzle-orm";
import {
  tenants, organisations, branches, systemRoles,
  appointmentTypes, callingLines, conversionStages, lostReasons, leadSources, leadSourceCategories,
  treatmentDepartments, doctors, opdTimings, countries, states, cities,
  crmUsers, leads, patients, activities, tasks, appointments, episodes,
  episodeQuoteItems, costHeads, roomTypes, insurers, tpas, policyTypes,
  preauthStatuses, rejectionReasons, tenantDiscountApprovers,
  rolePermissions, inAppNotifications, accessLogs, auditLogs,
  handoverLogs, rescheduleHistory, temperatureLogs, contactPersons,
  leadContactPersons, patientContactLinks, postCareProtocols, postCareProtocolSteps,
} from "@shared/schema";
import { provisionNewTenant } from "./tenantProvisioning";

import bcrypt from "bcryptjs";

// ─── Fixed identifier for the demo tenant ───────────────────────────────────
const DEMO_SUBDOMAIN = "rgb-demo";
const DEMO_PASSWORD = "HCRM@RGBTech";

// ─── Indian name pools ───────────────────────────────────────────────────────
const FIRST_NAMES_M = [
  "Arjun","Rahul","Amit","Suresh","Vikram","Rajesh","Naveen","Deepak","Sanjay","Arun",
  "Mahesh","Prakash","Vinod","Ramesh","Ganesh","Sunil","Vivek","Mukesh","Ashok","Rohit",
  "Ajay","Nitin","Ravi","Satish","Manish","Dinesh","Harish","Hitesh","Rupesh","Rakesh",
  "Pranav","Dhruv","Yash","Aman","Ankit","Gaurav","Sachin","Kartik","Varun","Siddharth",
  "Abhishek","Piyush","Tarun","Vinay","Sandeep","Kiran","Umesh","Girish","Lalit","Mohit",
];
const FIRST_NAMES_F = [
  "Priya","Sunita","Anita","Pooja","Rekha","Kavita","Meena","Sudha","Sushma","Usha",
  "Neha","Swati","Asha","Lata","Seema","Geeta","Poonam","Mamta","Rani","Nisha",
  "Deepa","Shweta","Divya","Ritu","Pallavi","Anjali","Komal","Sneha","Smita","Savita",
  "Aisha","Preeti","Archana","Varsha","Nidhi","Sonal","Shruti","Monika","Shilpa","Lalita",
  "Rashmi","Jyoti","Vandana","Reetika","Mansi","Isha","Tanvi","Rupal","Naina","Sapna",
];
const LAST_NAMES = [
  "Sharma","Verma","Singh","Kumar","Gupta","Patel","Agarwal","Joshi","Yadav","Tiwari",
  "Chauhan","Mishra","Shukla","Pandey","Srivastava","Saxena","Rastogi","Dubey","Bajpai","Trivedi",
  "Dwivedi","Chaturvedi","Pathak","Tripathi","Rai","Chaudhary","Thakur","Rawat","Negi","Bisht",
  "Garg","Bansal","Mittal","Goyal","Singhal","Maheshwari","Agrawal","Jain","Khandelwal","Bhatt",
  "Kulkarni","Deshpande","Patil","Pawar","Shinde","Jadhav","Kadam","Dalvi","Sonar","Gaikwad",
];

const DIAGNOSIS_POOL = [
  "Bilateral Cataracts – Grade III","Rhegmatogenous Retinal Detachment","High Myopia (-8D)",
  "Dry Eye Syndrome","Diabetic Macular Edema","Osteoarthritis – Right Knee","Disc Prolapse L4-L5",
  "Rotator Cuff Tear – Right Shoulder","Trigger Finger – Left Index","Carpal Tunnel Syndrome",
  "Psoriasis Vulgaris","Atopic Dermatitis – Moderate","Acne Rosacea","Alopecia Areata","Vitiligo",
  "Inguinal Hernia – Left","Gallstone Disease","Appendicitis – Chronic","Varicose Veins – Bilateral",
  "Thyroid Nodule – Multinodular Goitre",
];

const CONSULTATION_NOTE_POOL = [
  "Patient presents with gradual vision loss. Slit-lamp examination confirms dense posterior sub-capsular cataract. Surgery planned for next week.",
  "Referred by primary care for knee pain. X-ray shows joint space narrowing Grade 3. Recommending total knee replacement.",
  "Chronic lower back pain radiating to left leg. MRI confirms herniated disc at L4-L5. Conservative management initiated.",
  "Skin rash worsening over 2 months. Biopsy consistent with psoriasis. Starting methotrexate protocol.",
  "Abdominal ultrasound confirms gallstones. Elective laparoscopic cholecystectomy planned.",
  "Presenting with floaters and photopsia. Dilated fundus exam shows retinal tear. Laser photocoagulation done today.",
  "Post-operative follow-up. Wound healing well. Range of motion improving. Physiotherapy ongoing.",
  "Patient concerned about progressive hair loss. PRP therapy initiated. 4-session protocol discussed.",
  "Hernia reducible on examination. Surgery scheduled. Pre-op workup ordered.",
  "Shoulder pain for 3 months. MRI shows partial thickness rotator cuff tear. Steroid injection given.",
];

// ─── Utility functions ────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
function randomDateInRange(start: Date, end: Date): Date {
  const ms = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(ms);
}

// ─── Wipe all data belonging to one tenant, in FK-safe order ─────────────────
async function wipeTenantData(tenantId: number) {
  const tid = tenantId;
  // All tenant-scoped tables in FK-safe delete order
  const tbls = [
    // Transactional / log tables
    "support_ticket_comments",
    "support_tickets",
    "referral_reward_logs",
    "referrals",
    "referral_reward_rules",
    "referral_config",
    "event_registrations",
    "events",
    "resource_links",
    "post_care_protocol_steps",
    "post_care_protocols",
    "consultation_outcome_remarks",
    "consultation_outcomes",
    "system_error_logs",
    "in_app_notifications",
    "access_logs",
    "audit_logs",
    "temperature_logs",
    "handover_logs",
    "reschedule_history",
    "episode_quote_items",
    "appointments",
    "episodes",
    "activities",
    "tasks",
    "lead_contact_persons",
    "callyzer_webhook_logs",
    "lead_merge_audits",
    "communication_preferences",
    "leads",
    "patient_contact_links",
    "contacts",
    "patients",
    "contact_persons",
    "user_permission_overrides",
    "tenant_discount_approvers",
    "user_line_assignments",
    "callyzer_employees",
    "crm_users",
    "opd_timings",
    "doctor_leave_exceptions",
    "doctors",
    "calling_lines",
    "sla_rules",
    "reminder_policies",
    "data_retention_policies",
    "role_permissions",
    "lead_merge_roles",
    "clinical_notes_edit_roles",
    "revenue_probability_config",
    "custom_field_suggestions",
    "lead_import_logs",
    "bulk_import_logs",
    "lead_capture_rules",
    "platform_connectors",
    "campaigns",
    "tags",
    "holidays",
    "templates",
    "call_directions",
    "call_statuses",
    "referral_statuses",
    "appointment_statuses",
    "lead_statuses",
    "task_categories",
    "next_action_types",
    "activity_types",
    "campaign_channels",
    "no_show_reasons",
    "lost_reasons",
    "conversion_stages",
    "appointment_types",
    "consultation_types",
    "rejection_reasons",
    "preauth_statuses",
    "policy_types",
    "tpas",
    "insurers",
    "corporate_insurances",
    "lead_creation_channels",
    "referrers",
    "lead_sources",
    "lead_source_categories",
    "room_types",
    "cost_heads",
    "treatment_departments",
    "employment_types",
    "designations",
    "administrative_departments",
    "system_roles",
    "branch_serviceability",
    "areas",
    "pin_codes",
    "cities",
    "states",
    "countries",
    "branches",
    "organisations",
    "tenant_settings",
    "tenant_domains",
  ];

  // Tables that reference tenant-scoped tables but have no tenant_id themselves.
  // These need a subquery-based delete executed BEFORE the main loop.
  const subqueryDeletes: Array<{ tbl: string; sql: string }> = [
    {
      tbl: "support_ticket_comments",
      sql: `DELETE FROM support_ticket_comments WHERE ticket_id IN (SELECT id FROM support_tickets WHERE tenant_id = $1)`,
    },
  ];

  // Execute all deletes inside a single transaction with multi-pass retry.
  // FK violations are retried in subsequent passes — tables that block due to
  // child rows will succeed once their dependents are cleared in earlier passes.
  // This eliminates the need to maintain a manually correct delete order.
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query("BEGIN");

    // 1. Handle tables without tenant_id using custom subquery deletes (always first)
    for (const { tbl, sql } of subqueryDeletes) {
      const sp = `sp_pre_${tbl.replace(/[^a-z0-9]/g, '_')}`;
      await client.query(`SAVEPOINT ${sp}`);
      try {
        const res = await client.query(sql, [tid]);
        await client.query(`RELEASE SAVEPOINT ${sp}`);
        if (res.rowCount && res.rowCount > 0) {
          console.log(`[seedDemo] wipeTenantData: deleted ${res.rowCount} rows from ${tbl} (subquery)`);
        }
      } catch (err: unknown) {
        await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
        console.warn(`[seedDemo] wipeTenantData: skipped subquery for ${tbl}: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
      }
    }

    // 2. Multi-pass deletion: retry FK-blocked tables until no more progress
    let pending = [...tbls];
    const MAX_PASSES = 10;
    for (let pass = 1; pass <= MAX_PASSES && pending.length > 0; pass++) {
      const stillPending: string[] = [];
      for (const tbl of pending) {
        const sp = `sp_${tbl.replace(/[^a-z0-9]/g, '_')}_p${pass}`;
        await client.query(`SAVEPOINT ${sp}`);
        try {
          const res = await client.query(`DELETE FROM ${tbl} WHERE tenant_id = $1`, [tid]);
          await client.query(`RELEASE SAVEPOINT ${sp}`);
          if (res.rowCount && res.rowCount > 0) {
            console.log(`[seedDemo] wipeTenantData [pass ${pass}]: deleted ${res.rowCount} rows from ${tbl}`);
          }
        } catch (err: unknown) {
          await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("violates foreign key")) {
            // Defer to next pass — dependent rows may be cleared by then
            stillPending.push(tbl);
          } else if (msg.includes("tenant_id") || msg.includes("does not exist") ||
                     msg.includes("column") || msg.includes("relation")) {
            // Table doesn't have tenant_id or doesn't exist — skip permanently
            console.warn(`[seedDemo] wipeTenantData: skipped ${tbl} (${msg.split("\n")[0]})`);
          } else {
            await client.query("ROLLBACK");
            committed = true;
            console.error(`[seedDemo] wipeTenantData: ROLLBACK on failure in ${tbl}: ${msg}`);
            throw err;
          }
        }
      }
      if (stillPending.length === pending.length) {
        // No progress was made — circular FK or truly unresolvable
        console.error(`[seedDemo] wipeTenantData: could not delete after ${pass} passes: ${stillPending.join(", ")}`);
        await client.query("ROLLBACK");
        committed = true;
        throw new Error(`FK cycle or unresolvable dependency for tables: ${stillPending.join(", ")}`);
      }
      pending = stillPending;
    }

    await client.query("COMMIT");
    committed = true;
    console.log(`[seedDemo] wipeTenantData: clean wipe committed for tenant #${tid}`);
  } finally {
    if (!committed) {
      try { await client.query("ROLLBACK"); } catch (_) {}
    }
    client.release();
  }
}


// ─── Helper: get a record ID by code from a table ────────────────────────────
async function getIdByCode(tableName: string, code: string, tenantId: number): Promise<number | null> {
  const res = await pool.query(`SELECT id FROM ${tableName} WHERE code = $1 AND tenant_id = $2 LIMIT 1`, [code, tenantId]);
  return res.rows[0]?.id ?? null;
}

// ─── MAIN SEED FUNCTION ───────────────────────────────────────────────────────
export async function seedDemoTenant(): Promise<{ message: string; stats: Record<string, number> }> {
  console.log("[seedDemo] Starting RGB Demo Hospital seed...");
  const stats: Record<string, number> = {};

  // ── 1. Find or create demo tenant ──────────────────────────────────────────
  let demoTenant = (await db.select().from(tenants).where(eq(tenants.subdomain, DEMO_SUBDOMAIN)))[0];
  if (!demoTenant) {
    [demoTenant] = await db.insert(tenants).values({
      name: "RGB Demo Hospital – Modi Nagar",
      subdomain: DEMO_SUBDOMAIN,
      displayName: "RGB Demo Hospital",
      subscriptionStatus: "Active",
      contactPerson: "Demo Admin",
      contactEmail: "demo@rgbtech.in",
      contactPhone: "+914000400100",
      primaryColor: "#005b9f",
      secondaryColor: "#f0f7fc",
    }).returning();
    console.log(`[seedDemo] Created demo tenant #${demoTenant.id}`);
  } else {
    console.log(`[seedDemo] Found existing demo tenant #${demoTenant.id}, wiping data...`);
    await wipeTenantData(demoTenant.id);
  }
  const tid = demoTenant.id;
  stats["tenantId"] = tid;

  // ── 2. Provision all master data ───────────────────────────────────────────
  console.log("[seedDemo] Provisioning master data...");
  await provisionNewTenant(tid);

  // ── 2b. Demo-specific master data (layered on top of platform baseline) ────
  // All inserts use onConflictDoNothing() for idempotency. Real failures propagate.

  // Extra appointment types not in platform baseline
  for (const apt of [
    { code: "SURGERY", name: "Surgery / Procedure", displayOrder: 5 },
    { code: "CAMP", name: "Health Camp", displayOrder: 6 },
  ]) {
    await db.insert(appointmentTypes).values({ tenantId: tid, ...apt, status: "Active", approvalStatus: "Approved" }).onConflictDoNothing();
  }

  // Extra calling lines with demo phone numbers
  for (const cl of [
    { code: "TCL1", name: "Telecaller Line 1", phoneNumber: "+911204000002", displayOrder: 3 },
    { code: "TCL2", name: "Telecaller Line 2", phoneNumber: "+911204000003", displayOrder: 4 },
  ]) {
    await db.insert(callingLines).values({ tenantId: tid, ...cl, status: "Active", approvalStatus: "Approved" }).onConflictDoNothing();
  }

  // Treatment departments (medical specialties)
  for (const td of [
    { code: "OPHTHALMOLOGY", name: "Ophthalmology", displayOrder: 1 },
    { code: "ORTHOPEDICS", name: "Orthopedics", displayOrder: 2 },
    { code: "DERMATOLOGY", name: "Dermatology", displayOrder: 3 },
    { code: "GEN_SURGERY", name: "General Surgery", displayOrder: 4 },
  ]) {
    await db.insert(treatmentDepartments).values({ tenantId: tid, ...td, status: "Active", approvalStatus: "Approved" }).onConflictDoNothing();
  }

  // Extra lead source categories for demo (Telephony, Camp, Corporate channels)
  for (const lsc of [
    { code: "TELEPHONY", name: "Telephony / IVR", displayOrder: 10 },
    { code: "CAMP", name: "Health Camp", displayOrder: 11 },
    { code: "CORPORATE", name: "Corporate Tie-up", displayOrder: 12 },
  ]) {
    await db.insert(leadSourceCategories).values({ tenantId: tid, ...lsc, status: "Active", approvalStatus: "Approved" }).onConflictDoNothing();
  }

  // Lead sources under demo categories
  for (const ls of [
    { code: "CALLYZER_DEMO", name: "Callyzer IVR", displayOrder: 10 },
    { code: "CAMP_DEMO", name: "Camp Walk-in", displayOrder: 11 },
    { code: "CORP_DEMO", name: "Corporate Empanelment", displayOrder: 12 },
  ]) {
    await db.insert(leadSources).values({ tenantId: tid, ...ls, displayOrder: ls.displayOrder, status: "Active", approvalStatus: "Approved" }).onConflictDoNothing();
  }

  // Insurance providers
  for (const ins of [
    { code: "STAR_HEALTH", name: "Star Health Insurance", displayOrder: 1 },
    { code: "NIACL", name: "New India Assurance", displayOrder: 2 },
    { code: "ORIENTAL", name: "Oriental Insurance", displayOrder: 3 },
    { code: "UNITED_INDIA", name: "United India Insurance", displayOrder: 4 },
    { code: "ICICI_LOMBARD", name: "ICICI Lombard", displayOrder: 5 },
    { code: "BAJAJ_ALLIANZ", name: "Bajaj Allianz Health", displayOrder: 6 },
    { code: "HDFC_ERGO", name: "HDFC ERGO Health", displayOrder: 7 },
  ]) {
    await db.insert(insurers).values({ tenantId: tid, ...ins, status: "Active", approvalStatus: "Approved" }).onConflictDoNothing();
  }

  // TPAs
  for (const tpa of [
    { code: "MEDI_ASSIST", name: "Medi Assist India", displayOrder: 1 },
    { code: "VIPUL_MEDCORP", name: "Vipul Medcorp", displayOrder: 2 },
    { code: "HERITAGE_HEALTH", name: "Heritage Health", displayOrder: 3 },
  ]) {
    await db.insert(tpas).values({ tenantId: tid, ...tpa, status: "Active", approvalStatus: "Approved" }).onConflictDoNothing();
  }

  // Policy types
  for (const pt of [
    { code: "INDIVIDUAL", name: "Individual", displayOrder: 1 },
    { code: "FLOATER", name: "Family Floater", displayOrder: 2 },
    { code: "CORPORATE", name: "Corporate / Group", displayOrder: 3 },
    { code: "GOVT", name: "Government Scheme", displayOrder: 4 },
  ]) {
    await db.insert(policyTypes).values({ tenantId: tid, ...pt, status: "Active", approvalStatus: "Approved" }).onConflictDoNothing();
  }

  // Pre-auth statuses
  for (const ps of [
    { code: "PENDING", name: "Pending Submission", displayOrder: 1 },
    { code: "SUBMITTED", name: "Submitted", displayOrder: 2 },
    { code: "QUERY_RAISED", name: "Query Raised", displayOrder: 3 },
    { code: "APPROVED", name: "Approved", displayOrder: 4 },
    { code: "REJECTED", name: "Rejected", displayOrder: 5 },
  ]) {
    await db.insert(preauthStatuses).values({ tenantId: tid, ...ps, status: "Active", approvalStatus: "Approved" }).onConflictDoNothing();
  }

  // Rejection reasons
  for (const rr of [
    { code: "NOT_COVERED", name: "Procedure Not Covered", displayOrder: 1 },
    { code: "WAITING_PERIOD", name: "Waiting Period Applies", displayOrder: 2 },
    { code: "DOCS_INCOMPLETE", name: "Documents Incomplete", displayOrder: 3 },
    { code: "PRE_EXISTING", name: "Pre-Existing Condition", displayOrder: 4 },
  ]) {
    await db.insert(rejectionReasons).values({ tenantId: tid, ...rr, status: "Active", approvalStatus: "Approved" }).onConflictDoNothing();
  }

  // Role permissions (demo defaults)
  type PermTuple = [boolean, boolean, boolean, boolean];
  const DEFAULT_PERMS: Record<string, Record<string, PermTuple>> = {
    SYS_ADMIN:         { all: [true,true,true,true] },
    ADMIN:             { all: [true,true,true,true] },
    MANAGER:           { dashboard:[true,false,false,false], leads:[true,true,true,false], episodes:[true,true,true,false], appointments:[true,true,true,false], campaigns:[true,true,true,false], transactions:[true,false,false,false], quotation:[true,false,false,false], insurance:[true,false,false,false], reports:[true,false,false,false] },
    COUNSELLOR:        { dashboard:[true,false,false,false], leads:[true,true,true,false], episodes:[true,true,true,false], appointments:[true,true,true,false], transactions:[true,false,false,false], quotation:[true,true,true,false], insurance:[true,true,true,false], reports:[true,false,false,false] },
    PATIENT_COORDINATOR: { dashboard:[true,false,false,false], leads:[true,true,true,false], appointments:[true,true,true,false], reports:[true,false,false,false] },
    TELECALLER:        { dashboard:[true,false,false,false], leads:[true,true,true,false], appointments:[true,true,true,false] },
    RECEPTIONIST:      { dashboard:[true,false,false,false], leads:[true,true,false,false], appointments:[true,true,true,false] },
    BILLING:           { dashboard:[true,false,false,false], episodes:[true,false,false,false], transactions:[true,true,true,false], quotation:[true,true,true,false], reports:[true,false,false,false] },
    INSURANCE_DESK:    { dashboard:[true,false,false,false], episodes:[true,false,false,false], quotation:[true,false,false,false], insurance:[true,true,true,false] },
    DOCTOR:            { dashboard:[true,false,false,false], episodes:[true,false,true,false], appointments:[true,false,false,false], reports:[true,false,false,false] },
    MEDICAL_ASSISTANT: { dashboard:[true,false,false,false], episodes:[true,false,true,false], appointments:[true,false,false,false], reports:[true,false,false,false] },
    MIS_VIEWER:        { dashboard:[true,false,false,false], campaigns:[true,false,false,false], reports:[true,false,false,false] },
  };
  const MODULES = ["dashboard","leads","episodes","appointments","campaigns","transactions","team","masters","connectors","branding","settings","quotation","insurance","reports"];
  for (const [roleCode, perms] of Object.entries(DEFAULT_PERMS)) {
    for (const mod of MODULES) {
      const p: PermTuple = DEFAULT_PERMS[roleCode]["all"] ?? DEFAULT_PERMS[roleCode][mod] ?? [false, false, false, false];
      await db.insert(rolePermissions).values({ tenantId: tid, roleCode, module: mod, canView: p[0], canCreate: p[1], canEdit: p[2], canDelete: p[3] }).onConflictDoNothing();
    }
  }

  // ── 3. Create Country → State → 3 Cities ──────────────────────────────────
  let [country] = await db.insert(countries).values({ tenantId: tid, code: "IN", name: "India", status: "Active", displayOrder: 1, approvalStatus: "Approved" }).returning();
  let [state] = await db.insert(states).values({ tenantId: tid, countryId: country.id, code: "UP", name: "Uttar Pradesh", status: "Active", displayOrder: 1, approvalStatus: "Approved" }).returning();
  let [cityModi] = await db.insert(cities).values({ tenantId: tid, stateId: state.id, code: "MODI", name: "Modi Nagar", status: "Active", displayOrder: 1, approvalStatus: "Approved" }).returning();
  let [cityKushal] = await db.insert(cities).values({ tenantId: tid, stateId: state.id, code: "KUSHAL", name: "Kushal Nagar", status: "Active", displayOrder: 2, approvalStatus: "Approved" }).returning();
  let [cityPrashant] = await db.insert(cities).values({ tenantId: tid, stateId: state.id, code: "PRASHANT", name: "Prashant Nagar", status: "Active", displayOrder: 3, approvalStatus: "Approved" }).returning();

  // ── 4. Organisation and branches ──────────────────────────────────────────
  let [org] = await db.insert(organisations).values({ tenantId: tid, code: "RGB_MAIN", name: "RGB Demo Hospital Group", status: "Active", displayOrder: 1, approvalStatus: "Approved" }).returning();
  let [branchHub] = await db.insert(branches).values({ tenantId: tid, organisationId: org.id, code: "HUB_MODI", name: "Modi Nagar – Main Hub", cityId: cityModi.id, address: "12, Hospital Road, Modi Nagar, UP", phone: "+914000400100", status: "Active", displayOrder: 1, approvalStatus: "Approved" }).returning();
  let [branchSpoke1] = await db.insert(branches).values({ tenantId: tid, organisationId: org.id, code: "SPK_KUSHAL", name: "Kushal Nagar – Spoke", cityId: cityKushal.id, address: "5, Main Market, Kushal Nagar, UP", phone: "+914000400150", status: "Active", displayOrder: 2, approvalStatus: "Approved" }).returning();
  let [branchSpoke2] = await db.insert(branches).values({ tenantId: tid, organisationId: org.id, code: "SPK_PRASHANT", name: "Prashant Nagar – Spoke", cityId: cityPrashant.id, address: "8, Civil Lines, Prashant Nagar, UP", phone: "+914000400175", status: "Active", displayOrder: 3, approvalStatus: "Approved" }).returning();

  stats["branches"] = 3;
  console.log("[seedDemo] Branches created.");

  // ── 5. Fetch key lookup IDs ────────────────────────────────────────────────
  const roleIdMap: Record<string, number> = {};
  const rolesRows = await db.select({ id: systemRoles.id, code: systemRoles.code }).from(systemRoles).where(eq(systemRoles.tenantId, tid));
  for (const r of rolesRows) roleIdMap[r.code] = r.id;

  const deptIdMap: Record<string, number> = {};
  const treatmentDeptRows = await db.select({ id: treatmentDepartments.id, code: treatmentDepartments.code }).from(treatmentDepartments).where(eq(treatmentDepartments.tenantId, tid));
  for (const r of treatmentDeptRows) deptIdMap[r.code] = r.id;

  const costHeadRows = await db.select({ id: costHeads.id, code: costHeads.code }).from(costHeads).where(eq(costHeads.tenantId, tid));
  const costHeadIds = costHeadRows.map(r => r.id);

  const insurerRows = await db.select({ id: insurers.id }).from(insurers).where(eq(insurers.tenantId, tid));
  const tpaRows = await db.select({ id: tpas.id }).from(tpas).where(eq(tpas.tenantId, tid));
  const preauthStatusRows = await db.select({ id: preauthStatuses.id, code: preauthStatuses.code }).from(preauthStatuses).where(eq(preauthStatuses.tenantId, tid));
  const preauthStatusMap: Record<string, number> = {};
  for (const r of preauthStatusRows) preauthStatusMap[r.code] = r.id;

  const convStageRows = await db.select({ id: conversionStages.id, code: conversionStages.code }).from(conversionStages).where(eq(conversionStages.tenantId, tid));
  const convStageMap: Record<string, number> = {};
  for (const r of convStageRows) convStageMap[r.code] = r.id;

  const lostReasonRows = await db.select({ id: lostReasons.id }).from(lostReasons).where(eq(lostReasons.tenantId, tid));
  const leadSourceRows = await db.select({ id: leadSources.id }).from(leadSources).where(eq(leadSources.tenantId, tid));

  // ── 6. Create doctors ──────────────────────────────────────────────────────
  const doctorDefs = [
    { code: "DR_KAPOOR_V", name: "Dr. Vikas Kapoor", spec: "Ophthalmology", dept: "OPHTHALMOLOGY", branch: branchHub.id, qual: "MS (Ophthalmology), AIIMS" },
    { code: "DR_MEHTA_S", name: "Dr. Sunita Mehta", spec: "Ophthalmology", dept: "OPHTHALMOLOGY", branch: branchSpoke1.id, qual: "DNB (Ophthalmology)" },
    { code: "DR_SHARMA_R", name: "Dr. Rajiv Sharma", spec: "Orthopedics", dept: "ORTHOPEDICS", branch: branchHub.id, qual: "MS (Ortho), KGMU" },
    { code: "DR_VERMA_A", name: "Dr. Anjali Verma", spec: "Orthopedics", dept: "ORTHOPEDICS", branch: branchSpoke2.id, qual: "DNB (Ortho), Fellowship (Spine)" },
    { code: "DR_GUPTA_P", name: "Dr. Pradeep Gupta", spec: "Dermatology", dept: "DERMATOLOGY", branch: branchHub.id, qual: "MD (Dermatology)" },
    { code: "DR_JOSHI_K", name: "Dr. Kaveri Joshi", spec: "Dermatology", dept: "DERMATOLOGY", branch: branchSpoke1.id, qual: "MD (DVL)" },
    { code: "DR_SINGH_M", name: "Dr. Mandeep Singh", spec: "General Surgery", dept: "GEN_SURGERY", branch: branchHub.id, qual: "MS (Gen Surgery), MCh" },
    { code: "DR_YADAV_N", name: "Dr. Neelam Yadav", spec: "General Surgery", dept: "GEN_SURGERY", branch: branchSpoke2.id, qual: "MS (Gen Surgery)" },
  ];

  const doctorIds: number[] = [];
  const doctorBranchMap: Record<number, number> = {};
  for (const dd of doctorDefs) {
    const [doc] = await db.insert(doctors).values({
      tenantId: tid, code: dd.code, name: dd.name, qualification: dd.qual,
      specialization: dd.spec, branchId: dd.branch,
      treatmentDepartmentId: deptIdMap[dd.dept],
      status: "Active", approvalStatus: "Approved", displayOrder: 0,
    }).returning();
    doctorIds.push(doc.id);
    doctorBranchMap[doc.id] = dd.branch;

    // OPD timings Mon-Sat 9-5
    for (const day of ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]) {
      await db.insert(opdTimings).values({
        tenantId: tid, doctorId: doc.id, branchId: dd.branch,
        dayOfWeek: day, startTime: "09:00", endTime: "17:00",
        maxPatients: 30, slotDuration: 15,
        status: "Active", approvalStatus: "Approved", displayOrder: 0,
      });
    }
  }
  // Add cross-branch OPD timings for first 2 doctors (they cover 2 branches each)
  const crossBranchPairs = [
    { docId: doctorIds[0], secondaryBranch: branchSpoke1.id },
    { docId: doctorIds[2], secondaryBranch: branchSpoke2.id },
  ];
  for (const { docId, secondaryBranch } of crossBranchPairs) {
    if (docId && doctorBranchMap[docId] !== secondaryBranch) {
      for (const day of ["Tuesday","Thursday"]) {
        await db.insert(opdTimings).values({
          tenantId: tid, doctorId: docId, branchId: secondaryBranch,
          dayOfWeek: day, startTime: "10:00", endTime: "14:00",
          maxPatients: 15, slotDuration: 15,
          status: "Active", approvalStatus: "Approved", displayOrder: 0,
        });
      }
    }
  }

  stats["doctors"] = doctorIds.length;
  console.log("[seedDemo] Doctors created.");

  // ── 7. Create 30 CRM users ─────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  let mobileCounter = 4000400100;

  const userDefs: Array<{ roleCode: string; name: string; branch?: number; demo?: string }> = [
    { roleCode: "ADMIN", name: "Rajesh Admin Sharma", branch: branchHub.id },
    { roleCode: "ADMIN", name: "Priya Admin Gupta", branch: branchHub.id },
    { roleCode: "MANAGER", name: "Sanjay Manager Verma", branch: branchHub.id },
    { roleCode: "MANAGER", name: "Neha Manager Patel", branch: branchSpoke1.id },
    { roleCode: "COUNSELLOR", name: "Vikram Counsellor Singh", branch: branchHub.id },
    { roleCode: "COUNSELLOR", name: "Priyanka Counsellor Rao", branch: branchSpoke2.id },
    { roleCode: "PATIENT_COORDINATOR", name: "Amit PC Joshi", branch: branchHub.id },
    { roleCode: "PATIENT_COORDINATOR", name: "Deepa PC Mishra", branch: branchSpoke1.id },
    { roleCode: "TELECALLER", name: "Rahul TC Yadav", branch: branchHub.id },
    { roleCode: "TELECALLER", name: "Sunita TC Sharma", branch: branchHub.id },
    { roleCode: "RECEPTIONIST", name: "Anita Rec Gupta", branch: branchHub.id },
    { roleCode: "RECEPTIONIST", name: "Kavita Rec Singh", branch: branchSpoke2.id },
    // Doctors (8)
    { roleCode: "DOCTOR", name: "Dr. Vikas Kapoor", branch: branchHub.id },
    { roleCode: "DOCTOR", name: "Dr. Sunita Mehta", branch: branchSpoke1.id },
    { roleCode: "DOCTOR", name: "Dr. Rajiv Sharma", branch: branchHub.id },
    { roleCode: "DOCTOR", name: "Dr. Anjali Verma", branch: branchSpoke2.id },
    { roleCode: "DOCTOR", name: "Dr. Pradeep Gupta", branch: branchHub.id },
    { roleCode: "DOCTOR", name: "Dr. Kaveri Joshi", branch: branchSpoke1.id },
    { roleCode: "DOCTOR", name: "Dr. Mandeep Singh", branch: branchHub.id },
    { roleCode: "DOCTOR", name: "Dr. Neelam Yadav", branch: branchSpoke2.id },
    // Medical Assistants (8)
    { roleCode: "MEDICAL_ASSISTANT", name: "Sunita MA Kapoor", branch: branchHub.id },
    { roleCode: "MEDICAL_ASSISTANT", name: "Renu MA Mehta", branch: branchSpoke1.id },
    { roleCode: "MEDICAL_ASSISTANT", name: "Arun MA Sharma", branch: branchHub.id },
    { roleCode: "MEDICAL_ASSISTANT", name: "Pooja MA Verma", branch: branchSpoke2.id },
    { roleCode: "MEDICAL_ASSISTANT", name: "Rohit MA Gupta", branch: branchHub.id },
    { roleCode: "MEDICAL_ASSISTANT", name: "Meena MA Joshi", branch: branchSpoke1.id },
    { roleCode: "MEDICAL_ASSISTANT", name: "Ajay MA Singh", branch: branchHub.id },
    { roleCode: "MEDICAL_ASSISTANT", name: "Rekha MA Yadav", branch: branchSpoke2.id },
    { roleCode: "BILLING", name: "Suresh Billing Kumar", branch: branchHub.id },
    { roleCode: "INSURANCE_DESK", name: "Kavitha Insurance Nair", branch: branchHub.id },
  ];
  // Add MIS Viewer last
  userDefs.push({ roleCode: "MIS_VIEWER", name: "Ashok MIS Trivedi", branch: branchHub.id });

  const crmUserIds: number[] = [];
  const crmUserByRole: Record<string, number[]> = {};
  const telecallerUserIds: number[] = [];
  const managerUserIds: number[] = [];
  const adminUserIds: number[] = [];
  const counsellorUserIds: number[] = [];
  const pcUserIds: number[] = [];
  const receptionistUserIds: number[] = [];

  for (let idx = 0; idx < userDefs.length; idx++) {
    const ud = userDefs[idx];
    const phone = `+91${mobileCounter}`;
    const email = `user${idx + 1}@rgbdemo.in`;
    const code = `USR${String(idx + 1).padStart(3, "0")}`;
    const roleId = roleIdMap[ud.roleCode];
    const [user] = await db.insert(crmUsers).values({
      tenantId: tid, code, name: ud.name, email, phone, passwordHash,
      branchId: ud.branch,
      systemRoleId: roleId,
      isActive: true, status: "Active", approvalStatus: "Approved", displayOrder: idx + 1,
      accessScopeType: ["ADMIN","MANAGER"].includes(ud.roleCode) ? "All" : "Team",
      phiAccessLevel: ["ADMIN","MANAGER","DOCTOR","MEDICAL_ASSISTANT"].includes(ud.roleCode) ? "Full" : "Masked",
    }).returning();
    crmUserIds.push(user.id);
    if (!crmUserByRole[ud.roleCode]) crmUserByRole[ud.roleCode] = [];
    crmUserByRole[ud.roleCode].push(user.id);
    if (ud.roleCode === "TELECALLER") telecallerUserIds.push(user.id);
    if (ud.roleCode === "MANAGER") managerUserIds.push(user.id);
    if (ud.roleCode === "ADMIN") adminUserIds.push(user.id);
    if (ud.roleCode === "COUNSELLOR") counsellorUserIds.push(user.id);
    if (ud.roleCode === "PATIENT_COORDINATOR") pcUserIds.push(user.id);
    if (ud.roleCode === "RECEPTIONIST") receptionistUserIds.push(user.id);
    mobileCounter++;
  }
  stats["crmUsers"] = crmUserIds.length;
  console.log("[seedDemo] CRM users created.");

  // ── Set team hierarchy via reportingTo ──────────────────────────────────────
  console.log("[seedDemo] Setting team hierarchy...");
  const manager1 = managerUserIds[0];
  const manager2 = managerUserIds[1] || managerUserIds[0];

  // Telecallers + Counsellors report to manager1 (hub)
  for (const uid of [...telecallerUserIds, ...counsellorUserIds]) {
    await db.update(crmUsers).set({ reportingTo: manager1 }).where(eq(crmUsers.id, uid));
  }
  // Patient Coordinators + Receptionists report to manager2 (spoke manager)
  for (const uid of [...pcUserIds, ...receptionistUserIds]) {
    await db.update(crmUsers).set({ reportingTo: manager2 }).where(eq(crmUsers.id, uid));
  }
  // Medical Assistants report to their paired doctor's crmUser (MA[i] → Doctor[i])
  const doctorCrmUserIds = crmUserByRole["DOCTOR"] || [];
  const maCrmUserIds = crmUserByRole["MEDICAL_ASSISTANT"] || [];
  for (let i = 0; i < maCrmUserIds.length; i++) {
    const doctorCrmUserId = doctorCrmUserIds[i % doctorCrmUserIds.length];
    if (doctorCrmUserId) {
      await db.update(crmUsers).set({ reportingTo: doctorCrmUserId }).where(eq(crmUsers.id, maCrmUserIds[i]));
    }
  }
  // Managers report to admin1
  const admin1 = adminUserIds[0];
  if (admin1) {
    for (const uid of managerUserIds) {
      await db.update(crmUsers).set({ reportingTo: admin1 }).where(eq(crmUsers.id, uid));
    }
  }
  console.log("[seedDemo] Team hierarchy set.");

  // Register 2 managers and 2 admins as discount approvers
  for (const uid of [...managerUserIds.slice(0, 2), ...adminUserIds.slice(0, 2)]) {
    await db.insert(tenantDiscountApprovers).values({ tenantId: tid, crmUserId: uid }).onConflictDoNothing();
  }
  stats["discountApprovers"] = 4;

  // ── 8. Create patients and leads (≥ 1000) ──────────────────────────────────
  console.log("[seedDemo] Creating 1050 patients & leads...");
  const LEAD_COUNT = 1050;
  const branchAssignments = [branchHub.id, branchSpoke1.id, branchSpoke2.id];
  const cityAssignments = [cityModi.id, cityKushal.id, cityPrashant.id];

  // Lead status distribution across funnel
  const statusDistribution = [
    { status: "Raw Lead Captured", share: 0.20 },
    { status: "Contacted", share: 0.18 },
    { status: "Qualified", share: 0.15 },
    { status: "Appointment Booked", share: 0.12 },
    { status: "Reminder Running", share: 0.08 },
    { status: "Consultation Done", share: 0.10 },
    { status: "Closed Won", share: 0.08 },
    { status: "Closed Lost", share: 0.06 },
    { status: "Nurture", share: 0.03 },
  ];

  function getStatusForIndex(idx: number): string {
    let cumulative = 0;
    const fraction = (idx % LEAD_COUNT) / LEAD_COUNT;
    for (const s of statusDistribution) {
      cumulative += s.share;
      if (fraction < cumulative) return s.status;
    }
    return "Contacted";
  }

  const genders = ["Male","Female"];
  const leadIds: number[] = [];
  const patientIds: number[] = [];

  // Family group pairs: pairs of leads that share contact info (30 groups)
  const familyGroups: Array<{ phone: string; name: string; used: boolean }> = [];
  for (let fg = 0; fg < 30; fg++) {
    const lastName = pick(LAST_NAMES);
    const phone = `+91${String(5200000000 + fg * 1000 + randInt(1, 999))}`;
    familyGroups.push({ phone, name: lastName, used: false });
  }

  let phoneBase = 5100000000;

  // Named demo scenario tracking (deterministic — first eligible untagged lead per status)
  const highValueLeadIds: number[] = [];
  const dropOffLeadIds: number[] = [];
  const activeFollowUpLeadIds: number[] = [];
  const insuranceHeavyLeadIds: number[] = [];
  const discountEscalationLeadIds: number[] = [];
  const taggedScenarioIds = new Set<number>();

  for (let i = 0; i < LEAD_COUNT; i++) {
    const gender = pick(genders);
    const firstName = gender === "Male" ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
    const lastName = pick(LAST_NAMES);
    const fullName = `${firstName} ${lastName}`;
    const branchIdx = i % 3;
    const branchId = branchAssignments[branchIdx];
    const cityId = cityAssignments[branchIdx];
    const doctorId = pick(doctorIds.filter(id => doctorBranchMap[id] === branchId || Math.random() > 0.7));
    const status = getStatusForIndex(i);

    // Some leads belong to family groups
    let phone: string;
    const fgIdx = i % 40; // every 40th check for family group
    if (fgIdx < familyGroups.length && !familyGroups[fgIdx].used && Math.random() > 0.5) {
      phone = familyGroups[fgIdx].phone;
      familyGroups[fgIdx].used = true;
    } else {
      phone = `+91${phoneBase + i}`;
    }

    // createdAt spread over last 3–6 months
    const daysBack = randInt(10, 180);
    const createdAt = daysAgo(daysBack);

    const [patient] = await db.insert(patients).values({
      tenantId: tid,
      uhid: `PAT${String(i + 1).padStart(5, "0")}`,
      firstName,
      lastName,
      gender,
      dateOfBirth: new Date(1980 + randInt(-20, 20), randInt(0, 11), randInt(1, 28)),
      primaryPhone: phone,
      cityId,
      status: "Active",
    }).returning();
    patientIds.push(patient.id);

    const nextActionDate = Math.random() > 0.5
      ? (Math.random() > 0.5 ? daysAgo(randInt(1, 10)) : daysFromNow(randInt(1, 14)))
      : new Date();

    const assignedCrmUserId = pick([...telecallerUserIds, ...(crmUserByRole["COUNSELLOR"] || [])]);
    const leadSourceId = pick(leadSourceRows).id;

    const [lead] = await db.insert(leads).values({
      tenantId: tid,
      name: fullName,
      phoneE164: phone,
      mobileNormalized: phone.replace(/\D/g, "").slice(-10),
      patientId: patient.id,
      branchId,
      doctorId,
      treatmentDepartmentId: pick(Object.values(deptIdMap)),
      leadSourceId,
      status,
      gender,
      cityId,
      assignedCrmUserId,
      leadTemperature: pick(["Hot","Warm","Cold"]),
      nextActionDate,
      notes: Math.random() > 0.7 ? `Patient from ${["Modi Nagar","Hapur","Meerut","Ghaziabad"][randInt(0,3)]}. Interested in ${pick(["cataract surgery","knee replacement","skin treatment","hernia repair"])}.` : null,
      createdAt,
      updatedAt: createdAt,
    }).returning();
    leadIds.push(lead.id);

    // Tag named demo scenarios
    // Deterministic scenario assignment — first eligible untagged lead of the required status
    // Totals: 4+3+3+2+2 = 14 named scenarios (>= 14 required)
    if (highValueLeadIds.length < 4 && status === "Consultation Done" && !taggedScenarioIds.has(lead.id)) {
      highValueLeadIds.push(lead.id);
      taggedScenarioIds.add(lead.id);
    } else if (dropOffLeadIds.length < 3 && status === "Closed Lost" && !taggedScenarioIds.has(lead.id)) {
      dropOffLeadIds.push(lead.id);
      taggedScenarioIds.add(lead.id);
    } else if (activeFollowUpLeadIds.length < 3 && status === "Reminder Running" && !taggedScenarioIds.has(lead.id)) {
      activeFollowUpLeadIds.push(lead.id);
      taggedScenarioIds.add(lead.id);
    } else if (insuranceHeavyLeadIds.length < 2 && status === "Consultation Done" && !taggedScenarioIds.has(lead.id)) {
      insuranceHeavyLeadIds.push(lead.id);
      taggedScenarioIds.add(lead.id);
    } else if (discountEscalationLeadIds.length < 2 && status === "Consultation Done" && !taggedScenarioIds.has(lead.id)) {
      discountEscalationLeadIds.push(lead.id);
      taggedScenarioIds.add(lead.id);
    }
  }
  stats["patients"] = patientIds.length;
  stats["leads"] = leadIds.length;
  console.log(`[seedDemo] Created ${leadIds.length} leads and ${patientIds.length} patients.`);

  // ── Family contact groups (shared contactPerson linked to 2 patients each) ──
  console.log("[seedDemo] Creating family contact person groups...");
  const familyPatientPairs = pickN(patientIds, Math.min(60, patientIds.length));
  const familyRelationships = ["Spouse","Parent","Sibling","Child","Guardian"];
  let familyGroupsCreated = 0;
  for (let fg = 0; fg < 30; fg++) {
    const pat1 = familyPatientPairs[fg * 2];
    const pat2 = familyPatientPairs[fg * 2 + 1];
    if (!pat1 || !pat2) break;
    const contactName = `${pick(FIRST_NAMES_F)} ${pick(LAST_NAMES)}`;
    const contactPhone = `+91${String(5300000000 + fg * 9999)}`;
    try {
      const [cp] = await db.insert(contactPersons).values({
        tenantId: tid,
        name: contactName,
        phoneE164: contactPhone,
        relationship: pick(familyRelationships),
        status: "Active",
      }).returning();
      for (const patId of [pat1, pat2]) {
        await db.insert(patientContactLinks).values({
          tenantId: tid,
          patientId: patId,
          contactPersonId: cp.id,
          relationship: pick(familyRelationships),
          isPrimary: patId === pat1,
          status: "Active",
        });
      }
      familyGroupsCreated++;
    } catch (_) {}
  }
  stats["familyContactGroups"] = familyGroupsCreated;

  // ── 9. Call activities (2–5 per lead) ──────────────────────────────────────
  console.log("[seedDemo] Creating call activities...");
  const callOutcomes = ["Missed","Connected – Interested","Connected – Not Interested","No Answer","Callback Requested","Appointment Booked"];
  let totalActivities = 0;

  for (const leadId of leadIds) {
    const numActivities = randInt(2, 5);
    for (let a = 0; a < numActivities; a++) {
      const daysBack = randInt(1, 150);
      const outcome = pick(callOutcomes);
      await db.insert(activities).values({
        tenantId: tid,
        leadId,
        type: "Call",
        description: `Call attempt #${a + 1}: ${outcome}`,
        outcome,
        callDirection: pick(["Outgoing","Incoming","Missed"]),
        callDurationSeconds: outcome.startsWith("Connected") ? randInt(60, 600) : 0,
        callStatus: outcome.startsWith("Connected") ? "Connected" : "Not Answered",
        createdBy: `system-seed`,
        createdAt: daysAgo(daysBack),
      });
      totalActivities++;
    }
  }
  stats["activities"] = totalActivities;

  // ── Lead reassignment handover logs ───────────────────────────────────────
  console.log("[seedDemo] Creating handover logs...");
  const handoverSample = pickN(leadIds, Math.min(50, leadIds.length));
  const handoverTriggers = ["Manual reassignment","User unavailable","Territory rebalancing","Escalation","New joiner onboarding"];
  const allFrontlineUsers = [...telecallerUserIds, ...counsellorUserIds, ...pcUserIds];
  let handoverCount = 0;
  for (const leadId of handoverSample) {
    if (allFrontlineUsers.length < 2) break;
    const fromUser = pick(allFrontlineUsers);
    const toUser = pick(allFrontlineUsers.filter(id => id !== fromUser));
    if (!toUser) continue;
    try {
      await db.insert(handoverLogs).values({
        tenantId: tid,
        entityType: "Lead",
        entityId: leadId,
        fromUserId: fromUser,
        toUserId: toUser,
        triggerEvent: pick(handoverTriggers),
        notes: `Lead reassigned: ${pick(["Patient requested different coordinator","User on leave","Performance review","Coverage during leave"])}`,
        createdAt: daysAgo(randInt(1, 90)),
      });
      handoverCount++;
    } catch (_) {}
  }
  stats["handoverLogs"] = handoverCount;

  // ── 10. Follow-up tasks (today, overdue, future) ───────────────────────────
  console.log("[seedDemo] Creating follow-up tasks...");
  let totalTasks = 0;
  const taskSample = pickN(leadIds, Math.min(600, leadIds.length));
  for (let idx = 0; idx < taskSample.length; idx++) {
    const leadId = taskSample[idx];
    let dueDate: Date;
    if (idx % 3 === 0) dueDate = new Date(); // today
    else if (idx % 3 === 1) dueDate = daysAgo(randInt(1, 14)); // overdue
    else dueDate = daysFromNow(randInt(1, 21)); // future

    const assignedCrmUserId = pick([...telecallerUserIds, ...(crmUserByRole["COUNSELLOR"] || [])]);
    await db.insert(tasks).values({
      tenantId: tid,
      leadId,
      title: pick(["Follow-up call","Send treatment brochure","Book appointment","Confirm appointment","Discuss insurance","Share estimate","Post-consult check"]),
      priority: pick(["High","Normal","Low"]),
      dueDate,
      assignedCrmUserId,
      status: dueDate < new Date() ? "Pending" : "Pending",
      createdBy: "system-seed",
    });
    totalTasks++;
  }
  stats["tasks"] = totalTasks;

  // ── 11. Appointments ───────────────────────────────────────────────────────
  console.log("[seedDemo] Creating appointments...");
  let totalAppts = 0;
  const apptIdsByLead: Record<number, number> = {};
  const allBranches = [branchHub.id, branchSpoke1.id, branchSpoke2.id];

  // ── 11a. Historical appointments (realism) — past 90 days ──────────────
  const histStatuses = ["Completed","Completed","Completed","No Show","Rescheduled","Cancelled"];
  const histLeads = leadIds.filter((_, i) => i % 3 === 0); // ~350 leads
  for (const leadId of histLeads) {
    const leadRow = (await db.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.tenantId, tid)))).at(0);
    if (!leadRow) continue;
    const doctorId = leadRow.doctorId || pick(doctorIds);
    const branchId = leadRow.branchId || branchHub.id;
    const apptStatus = pick(histStatuses);
    const apptDate = daysAgo(randInt(1, 90));
    const [appt] = await db.insert(appointments).values({
      tenantId: tid,
      leadId,
      patientId: leadRow.patientId,
      doctorId,
      branchId,
      appointmentDate: apptDate,
      startTime: `${randInt(9, 16)}:${pick(["00","15","30","45"])}`,
      status: apptStatus,
      consultationNotes: apptStatus === "Completed" ? pick(CONSULTATION_NOTE_POOL) : null,
      consultationDoneAt: apptStatus === "Completed" ? apptDate : null,
      createdBy: "system-seed",
    }).returning();
    apptIdsByLead[leadId] = appt.id;
    totalAppts++;
    if (apptStatus === "Rescheduled" && Math.random() > 0.5) {
      await db.insert(rescheduleHistory).values({
        tenantId: tid,
        appointmentId: appt.id,
        oldDate: daysAgo(randInt(2, 15)),
        newDate: apptDate,
        reason: pick(["Patient unavailable","Doctor on leave","Emergency surgery scheduled"]),
        rescheduledBy: "system-seed",
        daysBetween: randInt(1, 14),
      });
    }
  }

  // ── 11b. Upcoming 10-day window — 300+ Scheduled appointments ──────────
  // Distribution: today ~40, days 1-3 ~32 each, days 4-7 ~25 each, days 8-10 ~18 each
  // Total target: 40 + 96 + 100 + 54 = 290 → with extras from named scenarios hits 300+
  const upcomingDayWeights: number[] = [40, 34, 32, 30, 26, 25, 24, 22, 20, 19, 18]; // index = offset from today
  const consultSlots = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","14:00","14:30","15:00","15:30","16:00","16:30"];

  // Build a pool of leads to schedule: skip those that already have a same-window upcoming appt
  // We pick from the entire lead pool to ensure variety (some leads get both a past + upcoming appt — realistic for follow-ups)
  const upcomingLeadPool = [...leadIds].sort(() => Math.random() - 0.5);
  let upcomingLeadIdx = 0;

  for (let dayOffset = 0; dayOffset <= 10; dayOffset++) {
    const count = upcomingDayWeights[dayOffset];
    const apptDate = daysFromNow(dayOffset);
    for (let slot = 0; slot < count; slot++) {
      const leadId = upcomingLeadPool[upcomingLeadIdx % upcomingLeadPool.length];
      upcomingLeadIdx++;
      const leadRow = (await db.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.tenantId, tid)))).at(0);
      if (!leadRow) continue;
      const branchId = pick(allBranches);
      const doctorId = pick(doctorIds.filter(id => doctorBranchMap[id] === branchId) || doctorIds);
      const [appt] = await db.insert(appointments).values({
        tenantId: tid,
        leadId,
        patientId: leadRow.patientId,
        doctorId: doctorId || pick(doctorIds),
        branchId,
        appointmentDate: apptDate,
        startTime: consultSlots[slot % consultSlots.length],
        status: "Scheduled",
        createdBy: "system-seed",
      }).returning();
      // Only set apptIdsByLead for today's appointments (useful for same-day episode creation demo)
      if (dayOffset === 0 && !apptIdsByLead[leadId]) {
        apptIdsByLead[leadId] = appt.id;
      }
      totalAppts++;
    }
  }

  // ── 11c. Named demo: spoke→hub surgery chain for high-value cases ───────
  for (const hLeadId of highValueLeadIds) {
    const lead = (await db.select().from(leads).where(eq(leads.id, hLeadId))).at(0);
    if (!lead) continue;
    const spokeApptDate = daysAgo(randInt(20, 60));
    const hubApptDate = daysAgo(randInt(5, 15));
    const surgDoctorId = doctorIds.find(id => doctorBranchMap[id] === branchHub.id) || pick(doctorIds);
    await db.insert(appointments).values({
      tenantId: tid, leadId: hLeadId, patientId: lead.patientId,
      doctorId: pick(doctorIds.filter(id => doctorBranchMap[id] !== branchHub.id) || doctorIds),
      branchId: branchSpoke1.id, appointmentDate: spokeApptDate,
      startTime: "10:00", status: "Completed",
      consultationNotes: "Initial consultation at spoke. Surgery recommended. Referred to hub.",
      createdBy: "system-seed",
    });
    await db.insert(appointments).values({
      tenantId: tid, leadId: hLeadId, patientId: lead.patientId,
      doctorId: surgDoctorId, branchId: branchHub.id,
      appointmentDate: hubApptDate, startTime: "08:00",
      status: "Completed",
      consultationNotes: "Surgery completed successfully. Patient discharged.",
      createdBy: "system-seed",
    });
    totalAppts += 2;
  }

  stats["appointments"] = totalAppts;
  console.log(`[seedDemo] Created ${totalAppts} appointments (${upcomingDayWeights.reduce((a,b)=>a+b,0)} upcoming in next 10 days).`);

  // ── 12. Episodes with quote items ─────────────────────────────────────────
  console.log("[seedDemo] Creating episodes and quote items...");
  const episodeLeadStatuses = new Set(["Consultation Done","Closed Won","Closed Lost","Appointment Booked"]);
  const episodeLeads = leadIds.filter((_, i) => {
    const frac = i / leadIds.length;
    return frac < 0.35; // ~35% of leads get episodes
  });

  let totalEpisodes = 0;
  let totalQuoteItems = 0;
  const episodeIdsByLead: Record<number, number> = {};

  for (const leadId of episodeLeads) {
    const lead = (await db.select().from(leads).where(eq(leads.id, leadId))).at(0);
    if (!lead) continue;
    const doctorId = lead.doctorId || pick(doctorIds);
    const branchId = lead.branchId || branchHub.id;
    const episodeStatus = pick(["Consultation Done","Estimate Shared","Under Negotiation","Patient Approved","Surgery / Procedure Done","Billed","Completed"]);
    const estimatedCost = randInt(25000, 350000);

    // Quotation lifecycle — 3 explicit states tracked via schema fields:
    //   Draft     → negotiationStatus "None",        estimateShared false
    //   Revised   → negotiationStatus "Negotiating", estimateShared true, revised amount ≠ original
    //   Finalized → negotiationStatus "Agreed",      estimateShared true, finalEstimatedAmount set
    const quoteLifecycle = pick(["Draft","Revised","Finalized"]);
    const isEstimateShared = quoteLifecycle !== "Draft";
    const negotiationStatusVal = quoteLifecycle === "Draft" ? "None" : quoteLifecycle === "Revised" ? "Negotiating" : "Agreed";
    // Revised quote is typically 5–10% lower (patient negotiation)
    const revisedCost = quoteLifecycle !== "Draft" ? Math.round(estimatedCost * (1 - randInt(5, 10) / 100)) : estimatedCost;
    const finalQuoteVal = quoteLifecycle === "Finalized" ? revisedCost : null;
    const finalEstimatedAmountVal = quoteLifecycle === "Finalized" ? revisedCost : null;

    const [ep] = await db.insert(episodes).values({
      tenantId: tid,
      leadId,
      patientId: lead.patientId,
      episodeName: `${pick(["Cataract Surgery","Knee Replacement","Skin Treatment","Hernia Repair","Retina Surgery","Hip Replacement","Laser Procedure","Cholecystectomy"])} – ${pick(LAST_NAMES)}`,
      doctorId,
      branchId,
      treatmentDepartmentId: lead.treatmentDepartmentId || pick(Object.values(deptIdMap)),
      episodeType: pick(["OPD","IPD","Day Care"]),
      visitType: "New",
      status: episodeStatus,
      estimatedCost,
      originalQuotedAmount: estimatedCost,
      estimateShared: isEstimateShared,
      estimateSharedAt: isEstimateShared ? daysAgo(randInt(1, 60)) : null,
      negotiationStatus: negotiationStatusVal,
      finalQuote: finalQuoteVal,
      finalEstimatedAmount: finalEstimatedAmountVal,
      diagnosis: pick(DIAGNOSIS_POOL),
      treatmentPlan: pick(["Medical management","Surgical intervention","Conservative physiotherapy","Laser therapy","Laparoscopic procedure"]),
      notes: pick(CONSULTATION_NOTE_POOL),
      conversionStageId: pick(Object.values(convStageMap)),
      discountStatus: "Draft",
      decisionStatus: pick(["Pending","Decided","Undecided"]),
      insuranceApplicable: Math.random() > 0.7,
      createdAt: daysAgo(randInt(5, 120)),
      startDate: daysAgo(randInt(5, 120)),
    }).returning();
    episodeIdsByLead[leadId] = ep.id;
    totalEpisodes++;

    // Quote items (2–5 per episode)
    const numItems = randInt(2, 5);
    const shuffledCostHeads = [...costHeadIds].sort(() => Math.random() - 0.5).slice(0, numItems);
    let totalQuote = 0;
    for (const chId of shuffledCostHeads) {
      const amt = randInt(2000, 80000);
      totalQuote += amt;
      await db.insert(episodeQuoteItems).values({
        tenantId: tid, episodeId: ep.id, costHeadId: chId,
        amount: amt, remarks: null, displayOrder: 0, createdBy: "system-seed",
      });
      totalQuoteItems++;
    }

    // Update episode with actual quote total
    await db.update(episodes).set({ initialQuote: totalQuote, finalQuote: Math.round(totalQuote * (1 - Math.random() * 0.15)) }).where(eq(episodes.id, ep.id));
  }
  stats["episodes"] = totalEpisodes;
  stats["quoteItems"] = totalQuoteItems;
  console.log(`[seedDemo] Created ${totalEpisodes} episodes and ${totalQuoteItems} quote items.`);

  // ── 12b. Ensure all named scenario leads have episodes ─────────────────────
  // Named scenario leads may fall beyond the 35% episode cutoff, so we
  // explicitly create episodes for any that are still missing one.
  const namedEpisodeLeads = [
    ...highValueLeadIds,
    ...insuranceHeavyLeadIds,
    ...discountEscalationLeadIds,
  ];
  for (const leadId of namedEpisodeLeads) {
    if (episodeIdsByLead[leadId]) continue; // already has one
    const lead = (await db.select().from(leads).where(eq(leads.id, leadId))).at(0);
    if (!lead) continue;
    const doctorId = lead.doctorId || pick(doctorIds);
    const branchId = lead.branchId || branchHub.id;
    const estimatedCost = randInt(80000, 350000);
    const [ep] = await db.insert(episodes).values({
      tenantId: tid,
      leadId,
      patientId: lead.patientId,
      episodeName: `${pick(["Cataract Surgery","Knee Replacement","Retina Surgery","Hip Replacement","Cholecystectomy"])} – ${pick(LAST_NAMES)}`,
      doctorId,
      branchId,
      treatmentDepartmentId: lead.treatmentDepartmentId || pick(Object.values(deptIdMap)),
      episodeType: pick(["OPD","IPD","Day Care"]),
      visitType: "New",
      status: "Consultation Done",
      estimatedCost,
      originalQuotedAmount: estimatedCost,
      estimateShared: true,
      estimateSharedAt: daysAgo(randInt(5, 30)),
      negotiationStatus: "Negotiating",
      diagnosis: pick(DIAGNOSIS_POOL),
      treatmentPlan: pick(["Surgical intervention","Laparoscopic procedure","Laser therapy"]),
      notes: pick(CONSULTATION_NOTE_POOL),
      conversionStageId: pick(Object.values(convStageMap)),
      discountStatus: "Draft",
      decisionStatus: "Pending",
      insuranceApplicable: false,
      createdAt: daysAgo(randInt(5, 60)),
      startDate: daysAgo(randInt(5, 60)),
    }).returning();
    episodeIdsByLead[leadId] = ep.id;
    totalEpisodes++;

    // 3-5 quote items per scenario episode
    const numItems = randInt(3, 5);
    const shuffledCostHeads = [...costHeadIds].sort(() => Math.random() - 0.5).slice(0, numItems);
    let totalQuoteForEp = 0;
    for (const chId of shuffledCostHeads) {
      const amt = randInt(5000, 90000);
      totalQuoteForEp += amt;
      await db.insert(episodeQuoteItems).values({
        tenantId: tid, episodeId: ep.id, costHeadId: chId,
        amount: amt, remarks: null, displayOrder: 0, createdBy: "system-seed",
      });
      totalQuoteItems++;
    }
    await db.update(episodes).set({ initialQuote: totalQuoteForEp, finalQuote: Math.round(totalQuoteForEp * 0.9) }).where(eq(episodes.id, ep.id));
  }
  stats["episodes"] = totalEpisodes;
  stats["quoteItems"] = totalQuoteItems;
  console.log(`[seedDemo] Ensured episodes for ${namedEpisodeLeads.length} named scenario leads. Total episodes: ${totalEpisodes}`);

  // Link appointments to their episodes (appointment.episodeId → episode.id)
  let linkedAppts = 0;
  for (const [leadIdStr, epId] of Object.entries(episodeIdsByLead)) {
    const leadIdNum = parseInt(leadIdStr);
    const apptId = apptIdsByLead[leadIdNum];
    if (apptId) {
      await db.update(appointments)
        .set({ episodeId: epId })
        .where(and(eq(appointments.id, apptId), eq(appointments.tenantId, tid)));
      linkedAppts++;
    }
  }
  stats["appointmentsLinkedToEpisodes"] = linkedAppts;
  console.log(`[seedDemo] Linked ${linkedAppts} appointments to their episodes.`);

  // ── 13. Discount scenarios ─────────────────────────────────────────────────
  console.log("[seedDemo] Creating discount scenarios...");
  // Get some episode IDs for discount scenarios
  const allEpisodeIds = Object.values(episodeIdsByLead);
  const discountReasons = ["Financial hardship","Senior citizen","Staff/Doctor referral","Repeat patient","Corporate tie-up","Insurance shortfall"];

  // Pending approval queue: ≥8 records
  const pendingDiscountEps = pickN(allEpisodeIds, Math.min(10, allEpisodeIds.length));
  for (const epId of pendingDiscountEps) {
    const pct = randInt(10, 40);
    const epRow = (await db.select({ estimatedCost: episodes.estimatedCost }).from(episodes).where(eq(episodes.id, epId))).at(0);
    const base = epRow?.estimatedCost || 100000;
    const amt = Math.round(base * pct / 100);
    await db.update(episodes).set({
      discountStatus: "Pending",
      discountApplied: true,
      discountType: "Percentage",
      discountPercent: pct,
      discountAmount: amt,
      discountValue: amt,
      discountNotes: pick(discountReasons),
      discountRequestedAt: daysAgo(randInt(1, 7)),
    }).where(eq(episodes.id, epId));
  }

  // Approved discounts
  const approvedDiscountEps = pickN(allEpisodeIds.filter(id => !pendingDiscountEps.includes(id)), Math.min(12, allEpisodeIds.length - pendingDiscountEps.length));
  for (const epId of approvedDiscountEps) {
    const pct = randInt(5, 25);
    const epRow = (await db.select({ estimatedCost: episodes.estimatedCost }).from(episodes).where(eq(episodes.id, epId))).at(0);
    const base = epRow?.estimatedCost || 100000;
    const amt = Math.round(base * pct / 100);
    await db.update(episodes).set({
      discountStatus: "Approved",
      discountApplied: true,
      discountType: "Percentage",
      discountPercent: pct,
      discountAmount: amt,
      discountValue: amt,
      discountNotes: pick(discountReasons),
      discountRequestedAt: daysAgo(randInt(7, 30)),
      discountApprovedAt: daysAgo(randInt(1, 6)),
      discountApprovedBy: "Manager",
      approvedDiscount: amt,
    }).where(eq(episodes.id, epId));
  }

  // Rejected discounts
  const rejectedDiscountEps = pickN(allEpisodeIds.filter(id => !pendingDiscountEps.includes(id) && !approvedDiscountEps.includes(id)), 5);
  for (const epId of rejectedDiscountEps) {
    await db.update(episodes).set({
      discountStatus: "Rejected",
      discountApplied: false,
      discountType: "Percentage",
      discountPercent: randInt(30, 60),
      discountNotes: "High discount exceeds hospital policy. Rejected.",
      discountRequestedAt: daysAgo(randInt(5, 20)),
      discountApprovedAt: daysAgo(randInt(1, 4)),
      discountApproverRemark: "Cannot approve discount above 25% without MD approval.",
    }).where(eq(episodes.id, epId));
  }

  // Named discount escalation cases
  for (const leadId of discountEscalationLeadIds) {
    const epId = episodeIdsByLead[leadId];
    if (!epId) continue;
    await db.update(episodes).set({
      discountStatus: "Pending",
      discountApplied: true,
      discountType: "Percentage",
      discountPercent: 45,
      discountNotes: "DEMO: Discount Escalation Case – Requires MD Approval",
      discountRequestedAt: daysAgo(3),
      discountEscalatedAt: daysAgo(1),
    }).where(eq(episodes.id, epId));
  }
  stats["discountPending"] = pendingDiscountEps.length;
  stats["discountApproved"] = approvedDiscountEps.length;

  // ── 14. Insurance pre-auth scenarios ─────────────────────────────────────
  console.log("[seedDemo] Creating insurance pre-auth scenarios...");
  const insuranceEps = pickN(allEpisodeIds, Math.min(25, allEpisodeIds.length));
  const insurerIdList = insurerRows.map(r => r.id);
  const tpaIdList = tpaRows.map(r => r.id);
  const preauthStatusCodes = ["PENDING","SUBMITTED","QUERY_RAISED","APPROVED","REJECTED"];

  for (let idx = 0; idx < insuranceEps.length; idx++) {
    const epId = insuranceEps[idx];
    const paStatusCode = preauthStatusCodes[idx % preauthStatusCodes.length];
    const paStatusId = preauthStatusMap[paStatusCode];
    const preauthAmt = randInt(50000, 300000);
    await db.update(episodes).set({
      insuranceApplicable: true,
      insurerId: pick(insurerIdList),
      tpaId: pick(tpaIdList),
      preauthStatusId: paStatusId,
      preauthSubmittedAt: paStatusCode !== "PENDING" ? daysAgo(randInt(5, 30)) : null,
      preauthApprovedAmount: paStatusCode === "APPROVED" ? preauthAmt : null,
      initialApprovalAmount: paStatusCode === "APPROVED" ? Math.round(preauthAmt * 0.9) : null,
    }).where(eq(episodes.id, epId));
  }

  // Named insurance-heavy cases
  for (const leadId of insuranceHeavyLeadIds) {
    const epId = episodeIdsByLead[leadId];
    if (!epId) continue;
    await db.update(episodes).set({
      insuranceApplicable: true,
      insurerId: insurerIdList[0],
      tpaId: tpaIdList[0],
      preauthStatusId: preauthStatusMap["APPROVED"],
      preauthSubmittedAt: daysAgo(20),
      preauthApprovedAmount: 250000,
      initialApprovalAmount: 220000,
      episodeName: (await db.select({ episodeName: episodes.episodeName }).from(episodes).where(eq(episodes.id, epId))).at(0)?.episodeName + " [DEMO: Insurance Heavy Case]",
    }).where(eq(episodes.id, epId));
  }
  stats["insuranceEpisodes"] = insuranceEps.length;

  // ── 15. Tag named demo scenarios ─────────────────────────────────────────
  for (const leadId of highValueLeadIds) {
    await db.update(leads).set({ tags: "DEMO:HighValueSurgical", notes: "DEMO SCENARIO: High-Value Surgical Case" }).where(eq(leads.id, leadId));
  }
  for (const leadId of dropOffLeadIds) {
    await db.update(leads).set({ tags: "DEMO:DropOff", notes: "DEMO SCENARIO: Drop-off / Lost Case" }).where(eq(leads.id, leadId));
  }
  for (const leadId of activeFollowUpLeadIds) {
    await db.update(leads).set({ tags: "DEMO:ActiveFollowUp", notes: "DEMO SCENARIO: Active Follow-up Chain" }).where(eq(leads.id, leadId));
  }
  for (const leadId of insuranceHeavyLeadIds) {
    await db.update(leads).set({ tags: "DEMO:InsuranceHeavy", notes: "DEMO SCENARIO: Insurance-Heavy Case" }).where(eq(leads.id, leadId));
  }
  for (const leadId of discountEscalationLeadIds) {
    await db.update(leads).set({ tags: "DEMO:DiscountEscalation", notes: "DEMO SCENARIO: Discount Escalation Case" }).where(eq(leads.id, leadId));
  }
  stats["demoScenarios"] = highValueLeadIds.length + dropOffLeadIds.length + activeFollowUpLeadIds.length + insuranceHeavyLeadIds.length + discountEscalationLeadIds.length;

  // ── 16. Post-seed assertions — fail fast if any requirement not met ─────────
  console.log("[seedDemo] Running post-seed assertions...");
  const assertionErrors: string[] = [];

  // Helper: count rows in a tenant-scoped table via raw SQL
  const tenantCount = async (table: string): Promise<number> => {
    const res = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE tenant_id = $1`, [tid]);
    return res.rows[0]?.n ?? 0;
  };

  // Core entity minimums
  const lcnt = await tenantCount("leads");
  if (lcnt < 1000) assertionErrors.push(`Leads < 1000 (actual: ${lcnt})`);

  const crmcnt = await tenantCount("crm_users");
  if (crmcnt < 20) assertionErrors.push(`CRM users < 20 (actual: ${crmcnt})`);

  const drcnt = await tenantCount("doctors");
  if (drcnt < 8) assertionErrors.push(`Doctors < 8 (actual: ${drcnt})`);

  const epcnt = await tenantCount("episodes");
  if (epcnt < 200) assertionErrors.push(`Episodes < 200 (actual: ${epcnt})`);

  const apptcnt = await tenantCount("appointments");
  if (apptcnt < 300) assertionErrors.push(`Appointments < 300 (actual: ${apptcnt})`);

  // Episode-appointment linkage
  if (stats["appointmentsLinkedToEpisodes"] < 50) {
    assertionErrors.push(`Appointment-episode links < 50 (actual: ${stats["appointmentsLinkedToEpisodes"]})`);
  }

  // Named scenarios — exact per-category counts
  if (highValueLeadIds.length < 4) assertionErrors.push(`highValueLeadIds < 4 (actual: ${highValueLeadIds.length})`);
  if (dropOffLeadIds.length < 3) assertionErrors.push(`dropOffLeadIds < 3 (actual: ${dropOffLeadIds.length})`);
  if (activeFollowUpLeadIds.length < 3) assertionErrors.push(`activeFollowUpLeadIds < 3 (actual: ${activeFollowUpLeadIds.length})`);
  if (insuranceHeavyLeadIds.length < 2) assertionErrors.push(`insuranceHeavyLeadIds < 2 (actual: ${insuranceHeavyLeadIds.length})`);
  if (discountEscalationLeadIds.length < 2) assertionErrors.push(`discountEscalationLeadIds < 2 (actual: ${discountEscalationLeadIds.length})`);
  if (stats["demoScenarios"] < 14) assertionErrors.push(`Total named scenarios < 14 (actual: ${stats["demoScenarios"]})`);

  // Named scenario leads must each have a linked episode (via episodes.lead_id)
  const episodeRequiringLeadIds = [...highValueLeadIds, ...insuranceHeavyLeadIds, ...discountEscalationLeadIds];
  if (episodeRequiringLeadIds.length > 0) {
    const episodeLinkRes = await pool.query<{ lead_id: number }>(
      `SELECT lead_id FROM episodes WHERE lead_id = ANY($1::int[])`,
      [episodeRequiringLeadIds]
    );
    const linkedLeadIds = new Set(episodeLinkRes.rows.map(r => r.lead_id));
    const missingEpisode = episodeRequiringLeadIds.filter(id => !linkedLeadIds.has(id));
    if (missingEpisode.length > 0) {
      assertionErrors.push(`Named scenario leads missing episode: [${missingEpisode.join(", ")}]`);
    }
  }

  // DEMO:InsuranceHeavy — episodes must have insurance_applicable=true and preauth_approved_amount set
  if (insuranceHeavyLeadIds.length > 0) {
    const insEpRes = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM episodes e
       WHERE e.lead_id = ANY($1::int[])
         AND (e.insurance_applicable IS NOT TRUE OR e.preauth_approved_amount IS NULL)`,
      [insuranceHeavyLeadIds]
    );
    const badInsurance = insEpRes.rows[0]?.n ?? 0;
    if (badInsurance > 0) {
      assertionErrors.push(`${badInsurance} DEMO:InsuranceHeavy episode(s) missing insurance_applicable=true or preauth_approved_amount`);
    }
  }

  // DEMO:DiscountEscalation — episodes must have discount_status='Pending'
  if (discountEscalationLeadIds.length > 0) {
    const discEpRes = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM episodes e
       WHERE e.lead_id = ANY($1::int[])
         AND e.discount_status IS DISTINCT FROM 'Pending'`,
      [discountEscalationLeadIds]
    );
    const badDiscount = discEpRes.rows[0]?.n ?? 0;
    if (badDiscount > 0) {
      assertionErrors.push(`${badDiscount} DEMO:DiscountEscalation episode(s) do not have discount_status='Pending'`);
    }
  }

  // DEMO:HighValueSurgical — episodes must have at least 3 episode_quote_items each
  if (highValueLeadIds.length > 0) {
    const hvQiRes = await pool.query<{ lead_id: number; item_count: number }>(
      `SELECT e.lead_id, count(eqi.id)::int AS item_count
       FROM episodes e
       LEFT JOIN episode_quote_items eqi ON eqi.episode_id = e.id AND eqi.tenant_id = $2
       WHERE e.lead_id = ANY($1::int[])
       GROUP BY e.lead_id`,
      [highValueLeadIds, tid]
    );
    const insufficientItems = hvQiRes.rows.filter(r => r.item_count < 3).map(r => `lead ${r.lead_id} (${r.item_count} items)`);
    if (insufficientItems.length > 0) {
      assertionErrors.push(`DEMO:HighValueSurgical episodes with < 3 quote items: ${insufficientItems.join(", ")}`);
    }
  }

  // Phone format: all patient primary phones must start with +915 (digit 5, 10-digit mobile)
  const [badPhoneRow] = await db.select({ n: sql<number>`count(*)::int` }).from(patients)
    .where(and(eq(patients.tenantId, tid), sql`primary_phone IS NOT NULL AND primary_phone NOT LIKE '+915%'`));
  if ((badPhoneRow?.n ?? 0) > 0) assertionErrors.push(`${badPhoneRow?.n} patient phones do not match +915% pattern`);

  // Dropdown/master completeness — all required lookup tables must have rows
  for (const tbl of ["appointment_statuses","call_statuses","call_directions","lost_reasons","no_show_reasons","lead_source_categories","conversion_stages","lead_sources","activity_types","next_action_types","task_categories"]) {
    const n = await tenantCount(tbl);
    if (n === 0) assertionErrors.push(`Master table '${tbl}' is empty — dropdowns will fail`);
  }

  // Discount approval queue — must have pending records
  const pendingDiscountCount = (await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM episodes WHERE tenant_id = $1 AND discount_status = 'Pending'`, [tid]
  )).rows[0]?.n ?? 0;
  if (pendingDiscountCount < 8) assertionErrors.push(`Pending discount queue < 8 (actual: ${pendingDiscountCount})`);

  if (assertionErrors.length > 0) {
    const msg = `[seedDemo] ASSERTION FAILURES:\n  ${assertionErrors.join("\n  ")}`;
    console.error(msg);
    throw new Error(msg);
  }
  console.log("[seedDemo] All post-seed assertions passed.");

  console.log("[seedDemo] Seed complete!");
  console.log("[seedDemo] Summary:", stats);

  return {
    message: "RGB Demo Hospital – Modi Nagar demo tenant seeded successfully",
    stats,
  };
}
