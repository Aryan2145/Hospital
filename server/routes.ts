import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, MASTER_CATEGORIES } from "@shared/routes";
import { MASTER_TABLE_REGISTRY, bulkImportLogs, crmUsers, insertCrmUserSchema, insertPatientSchema, insertContactSchema, insertPatientContactLinkSchema, insertAppointmentSchema, insertEpisodeSchema, insertAuditLogSchema, insertCampaignSchema, insertPlatformConnectorSchema, leadImportLogs, leadCaptureRules, insertLeadCaptureRuleSchema, platformConnectors, customFieldSuggestions, insertCustomFieldSuggestionSchema, subscriptionPlans, tenantSubscriptions, subscriptionPayments, insertSubscriptionPlanSchema, insertTenantSubscriptionSchema, insertSubscriptionPaymentSchema, episodes, callyzerWebhookLogs, callyzerEmployees } from "@shared/schema";
import { toProperCase } from "./storage";
import crypto from "crypto";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { db, pool } from "./db";
import { tenants, leads, leadStatuses, activityTypes, nextActionTypes, taskCategories, callStatuses, callDirections, appointmentStatuses, referralStatuses, leadSourceCategories, leadSources, campaignChannels, appointmentTypes, conversionStages, lostReasons, noShowReasons, consultationTypes, countries, states, cities, designations, employmentTypes, systemRoles, organisations, doctors, opdTimings, branches, administrativeDepartments, treatmentDepartments, areas, pinCodes, callingLines, activities, tasks, appointments, patients, contacts, patientContactLinks, doctorLeaveExceptions } from "@shared/schema";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { desc, eq, and, sql, count, gte, lte, isNull, inArray } from "drizzle-orm";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function normalizePhoneNumber(phone: string): string {
  if (!phone || !phone.trim()) return "";
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 7) return "";
  if (digits.length === 12 && digits.startsWith("91")) return "+91" + digits.slice(2);
  if (digits.length === 10) return "+91" + digits;
  if (phone.startsWith("+")) return phone.replace(/[^+0-9]/g, "");
  return "+" + digits;
}

function getPhoneVariants(normalized: string): string[] {
  const variants: string[] = [];
  const digits = normalized.replace(/[^0-9]/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    const local = digits.slice(2);
    variants.push(local, "+91" + local, "91" + local, "0" + local);
  } else if (digits.length === 10) {
    variants.push("+91" + digits, "91" + digits, "0" + digits, digits);
  }
  return variants;
}

function formatCallDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function coerceDateFields(body: Record<string, any>, fields: string[]): Record<string, any> {
  const result = { ...body };
  for (const field of fields) {
    if (result[field] && typeof result[field] === "string") {
      result[field] = new Date(result[field]);
    }
  }
  return result;
}


async function seedDatabase() {
  try {
    const existingTenants = await db.select().from(tenants);
    if (existingTenants.length > 0) return;

    const [tenant] = await db.insert(tenants).values({
      name: "VIROC Super Speciality Orthopaedic Hospital",
      subdomain: "viroc",
      primaryColor: "#0f4c81",
    }).returning();

    const tid = tenant.id;

    // ── Location: India > Gujarat > Vadodara ──
    const [india] = await db.insert(countries).values({ tenantId: tid, code: "IN", name: "India", status: "Active", displayOrder: 1 }).returning();
    const [gujarat] = await db.insert(states).values({ tenantId: tid, countryId: india.id, code: "GJ", name: "Gujarat", status: "Active", displayOrder: 1 }).returning();
    const [vadodara] = await db.insert(cities).values({ tenantId: tid, stateId: gujarat.id, code: "VAD", name: "Vadodara", status: "Active", displayOrder: 1 }).returning();
    const [pin390018] = await db.insert(pinCodes).values({ tenantId: tid, cityId: vadodara.id, code: "390018", name: "390018 - Karelibaug", status: "Active", displayOrder: 1 }).returning();
    await db.insert(areas).values({ tenantId: tid, cityId: vadodara.id, pinCodeId: pin390018.id, code: "KRLBG", name: "Karelibaug", pinCode: "390018", status: "Active", displayOrder: 1 });

    // ── Organisation ──
    const [org] = await db.insert(organisations).values({ tenantId: tid, code: "VIROC", name: "VIROC Super Speciality Orthopaedic Hospital", status: "Active", displayOrder: 1 }).returning();
    const [mainBranch] = await db.insert(branches).values({ tenantId: tid, organisationId: org.id, code: "VIROC-HQ", name: "VIROC Karelibaug (Main)", address: "Society No. 5 B, Nivruti Colony, Opp. Lohana Lewa Samaj Wadi, Aryakanya Vidyalaya Road, Karelibaug, Vadodara - 390018", phone: "+916356300400", status: "Active", displayOrder: 1 }).returning();

    // Administrative Departments (office/staff departments)
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "MKT", name: "Marketing", status: "Active", displayOrder: 1 });
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "SALES", name: "Sales", status: "Active", displayOrder: 2 });
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "HR", name: "HR", status: "Active", displayOrder: 3 });
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "IT", name: "IT", status: "Active", displayOrder: 4 });
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "ACCT", name: "Accounts", status: "Active", displayOrder: 5 });
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "FO", name: "Front Office", status: "Active", displayOrder: 6 });

    // Designations
    await db.insert(designations).values({ tenantId: tid, code: "MD", name: "Managing Director", status: "Active", displayOrder: 1 });
    await db.insert(designations).values({ tenantId: tid, code: "DIR", name: "Director", status: "Active", displayOrder: 2 });
    await db.insert(designations).values({ tenantId: tid, code: "CONSLT", name: "Consultant Surgeon", status: "Active", displayOrder: 3 });
    await db.insert(designations).values({ tenantId: tid, code: "SR_CONSLT", name: "Senior Consultant", status: "Active", displayOrder: 4 });
    await db.insert(designations).values({ tenantId: tid, code: "CRM_MGR", name: "CRM Manager", status: "Active", displayOrder: 5 });
    await db.insert(designations).values({ tenantId: tid, code: "CRM_EXEC", name: "CRM Executive", status: "Active", displayOrder: 6 });
    await db.insert(designations).values({ tenantId: tid, code: "COUNSELLOR", name: "Patient Counsellor", status: "Active", displayOrder: 7 });

    // Employment Types
    await db.insert(employmentTypes).values({ tenantId: tid, code: "FT", name: "Full Time", status: "Active", displayOrder: 1 });
    await db.insert(employmentTypes).values({ tenantId: tid, code: "PT", name: "Part Time", status: "Active", displayOrder: 2 });
    await db.insert(employmentTypes).values({ tenantId: tid, code: "VISITING", name: "Visiting Consultant", status: "Active", displayOrder: 3 });

    // System Roles
    await db.insert(systemRoles).values({ tenantId: tid, code: "SYS_ADMIN", name: "System Admin", status: "Active", displayOrder: 0 });
    await db.insert(systemRoles).values({ tenantId: tid, code: "ADMIN", name: "Admin", status: "Active", displayOrder: 1 });
    await db.insert(systemRoles).values({ tenantId: tid, code: "MANAGER", name: "Manager", status: "Active", displayOrder: 2 });
    await db.insert(systemRoles).values({ tenantId: tid, code: "AGENT", name: "Agent", status: "Active", displayOrder: 3 });
    await db.insert(systemRoles).values({ tenantId: tid, code: "COUNSELLOR", name: "Counsellor", status: "Active", displayOrder: 4 });

    // Calling Lines
    await db.insert(callingLines).values({ tenantId: tid, code: "MAIN", name: "Main Reception (+91 6356300400)", status: "Active", displayOrder: 1 });
    await db.insert(callingLines).values({ tenantId: tid, code: "CRM", name: "CRM Outbound Line", status: "Active", displayOrder: 2 });
    await db.insert(callingLines).values({ tenantId: tid, code: "COUNSELLING", name: "Home Counselling Line", status: "Active", displayOrder: 3 });

    // ── Treatment Departments ──
    await db.insert(treatmentDepartments).values({ tenantId: tid, code: "JOINT_REPL", name: "Joint Replacement", status: "Active", displayOrder: 1 });
    await db.insert(treatmentDepartments).values({ tenantId: tid, code: "SPINE_SURG", name: "Spine Surgery", status: "Active", displayOrder: 2 });
    await db.insert(treatmentDepartments).values({ tenantId: tid, code: "SPORTS_INJ", name: "Sports Injury & Arthroscopy", status: "Active", displayOrder: 3 });
    await db.insert(treatmentDepartments).values({ tenantId: tid, code: "TRAUMA", name: "Fracture & Trauma", status: "Active", displayOrder: 4 });
    await db.insert(treatmentDepartments).values({ tenantId: tid, code: "PAIN_MGMT", name: "Pain Management", status: "Active", displayOrder: 5 });
    await db.insert(treatmentDepartments).values({ tenantId: tid, code: "FOOT_ANKLE", name: "Foot & Ankle Surgery", status: "Active", displayOrder: 6 });

    // Consultation Types (services offered)
    for (const ct of [
      { code: "ROBOTIC_NKR", name: "Robotic Natural Knee Replacement", displayOrder: 1 },
      { code: "TKR", name: "Total Knee Replacement", displayOrder: 2 },
      { code: "THR", name: "Total Hip Replacement", displayOrder: 3 },
      { code: "REV_JOINT", name: "Revision Joint Replacement", displayOrder: 4 },
      { code: "ARTHROSCOPY", name: "Arthroscopic Surgery for Sports Injuries", displayOrder: 5 },
      { code: "ENDO_SPINE", name: "Endoscopic Spine Surgery", displayOrder: 6 },
      { code: "MIS_FRACTURE", name: "Minimal Invasive Fracture Surgery", displayOrder: 7 },
      { code: "PAIN_CLINIC", name: "Advanced Pain Clinic", displayOrder: 8 },
      { code: "BACK_SCHOOL", name: "Back School", displayOrder: 9 },
      { code: "FOOT_ANKLE", name: "Foot & Ankle Surgery", displayOrder: 10 },
      { code: "ICU_CARE", name: "ICU & Critical Care", displayOrder: 11 },
    ]) {
      await db.insert(consultationTypes).values({ tenantId: tid, ...ct, status: "Active" });
    }

    // ── Doctors (Real VIROC team from viroc.in) ──
    const [docVrajesh] = await db.insert(doctors).values({
      tenantId: tid, code: "DOC001", name: "Dr. Vrajesh Shah",
      qualification: "MBBS, MS - Orthopaedics",
      specialization: "Joint Replacement Surgery, Robotic Natural Knee Replacement",
      phone: "+916356300400", email: "dr.vrajesh@viroc.in", status: "Active", displayOrder: 1,
    }).returning();
    const [docRajiv] = await db.insert(doctors).values({
      tenantId: tid, code: "DOC002", name: "Dr. Rajiv Paradkar",
      qualification: "MBBS, D.Orth, MS - Orthopaedics",
      specialization: "Joint Replacement, Hip & Spine Surgery",
      phone: "+916356300400", email: "dr.rajiv@viroc.in", status: "Active", displayOrder: 2,
    }).returning();
    const [docPratik] = await db.insert(doctors).values({
      tenantId: tid, code: "DOC003", name: "Dr. Pratik Patel",
      qualification: "MBBS, D.Orth, MS, DNB, FNB Spine, MRCS, FISS, FMISS",
      specialization: "Minimally Invasive & Endoscopic Spine Surgery",
      phone: "+916356300400", email: "dr.pratik@viroc.in", status: "Active", displayOrder: 3,
    }).returning();
    const [docDarshan] = await db.insert(doctors).values({
      tenantId: tid, code: "DOC004", name: "Dr. Darshan Suthar",
      qualification: "MBBS, MS - Orthopaedics",
      specialization: "Arthroscopy & Trauma Surgery",
      phone: "+916356300400", email: "dr.darshan@viroc.in", status: "Active", displayOrder: 4,
    }).returning();
    const [docTanmay] = await db.insert(doctors).values({
      tenantId: tid, code: "DOC005", name: "Dr. Tanmay Jaysingani",
      qualification: "MBBS, MS - Orthopaedics, Fellowship (Arthroscopy, Robotic Knee)",
      specialization: "Arthroscopy & Robotic Knee Replacement",
      phone: "+916356300400", email: "dr.tanmay@viroc.in", status: "Active", displayOrder: 5,
    }).returning();
    const [docVihal] = await db.insert(doctors).values({
      tenantId: tid, code: "DOC006", name: "Dr. Vihal Patel",
      qualification: "MBBS, MS - Orthopaedics",
      specialization: "Ankle & Foot Surgery",
      phone: "+916356300400", email: "dr.vihal@viroc.in", status: "Active", displayOrder: 6,
    }).returning();
    const [docMihir] = await db.insert(doctors).values({
      tenantId: tid, code: "DOC007", name: "Dr. Mihir Shah",
      qualification: "MBBS, MD",
      specialization: "Physician & Critical Care",
      phone: "+916356300400", email: "dr.mihir@viroc.in", status: "Active", displayOrder: 7,
    }).returning();

    // ── OPD Timings (Mon-Sat, 9 AM - 7 PM visiting hours) ──
    const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    // Dr. Vrajesh Shah - Managing Director - Mon-Sat morning & evening
    for (const day of weekdays) {
      await db.insert(opdTimings).values({ tenantId: tid, doctorId: docVrajesh.id, dayOfWeek: day, startTime: "09:00", endTime: "12:00", maxPatients: 15, status: "Active", displayOrder: 0 });
      await db.insert(opdTimings).values({ tenantId: tid, doctorId: docVrajesh.id, dayOfWeek: day, startTime: "16:00", endTime: "19:00", maxPatients: 12, status: "Active", displayOrder: 0 });
    }
    // Dr. Rajiv Paradkar - Director - Mon-Sat morning
    for (const day of weekdays) {
      await db.insert(opdTimings).values({ tenantId: tid, doctorId: docRajiv.id, dayOfWeek: day, startTime: "10:00", endTime: "13:00", maxPatients: 15, status: "Active", displayOrder: 0 });
    }
    // Dr. Pratik Patel - Spine - Mon/Wed/Fri/Sat
    for (const day of ["Monday", "Wednesday", "Friday", "Saturday"]) {
      await db.insert(opdTimings).values({ tenantId: tid, doctorId: docPratik.id, dayOfWeek: day, startTime: "10:00", endTime: "13:00", maxPatients: 10, status: "Active", displayOrder: 0 });
    }
    // Dr. Darshan Suthar - Arthroscopy/Trauma - Mon-Sat
    for (const day of weekdays) {
      await db.insert(opdTimings).values({ tenantId: tid, doctorId: docDarshan.id, dayOfWeek: day, startTime: "09:00", endTime: "12:00", maxPatients: 12, status: "Active", displayOrder: 0 });
      await db.insert(opdTimings).values({ tenantId: tid, doctorId: docDarshan.id, dayOfWeek: day, startTime: "14:00", endTime: "17:00", maxPatients: 10, status: "Active", displayOrder: 0 });
    }
    // Dr. Tanmay Jaysingani - Mon-Fri
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]) {
      await db.insert(opdTimings).values({ tenantId: tid, doctorId: docTanmay.id, dayOfWeek: day, startTime: "09:00", endTime: "12:00", maxPatients: 10, status: "Active", displayOrder: 0 });
    }
    // Dr. Vihal Patel - Foot/Ankle - Tue/Thu/Sat
    for (const day of ["Tuesday", "Thursday", "Saturday"]) {
      await db.insert(opdTimings).values({ tenantId: tid, doctorId: docVihal.id, dayOfWeek: day, startTime: "10:00", endTime: "13:00", maxPatients: 8, status: "Active", displayOrder: 0 });
    }

    // ── CRM Users (representative team) ──
    const [adminRoleRec] = await db.select().from(systemRoles).where(and(eq(systemRoles.code, "ADMIN"), eq(systemRoles.tenantId, tid)));
    const [mgrRoleRec] = await db.select().from(systemRoles).where(and(eq(systemRoles.code, "MANAGER"), eq(systemRoles.tenantId, tid)));
    const [agentRoleRec] = await db.select().from(systemRoles).where(and(eq(systemRoles.code, "AGENT"), eq(systemRoles.tenantId, tid)));
    const [counsellorRoleRec] = await db.select().from(systemRoles).where(and(eq(systemRoles.code, "COUNSELLOR"), eq(systemRoles.tenantId, tid)));

    const [crmHead] = await db.insert(crmUsers).values({
      tenantId: tid, code: "CRM001", name: "Nisha Patel", email: "nisha.patel@viroc.in",
      phone: "+916356300401", systemRoleId: adminRoleRec.id, accessScopeType: "All", phiAccessLevel: "Full", status: "Active", isActive: true, displayOrder: 1,
    }).returning();
    const [crmMgr1] = await db.insert(crmUsers).values({
      tenantId: tid, code: "CRM002", name: "Kiran Desai", email: "kiran.desai@viroc.in",
      phone: "+916356300402", systemRoleId: mgrRoleRec.id, reportingTo: crmHead.id, accessScopeType: "Branch", phiAccessLevel: "Masked", status: "Active", isActive: true, displayOrder: 2,
    }).returning();
    const [crmMgr2] = await db.insert(crmUsers).values({
      tenantId: tid, code: "CRM003", name: "Amit Joshi", email: "amit.joshi@viroc.in",
      phone: "+916356300403", systemRoleId: mgrRoleRec.id, reportingTo: crmHead.id, accessScopeType: "Branch", phiAccessLevel: "Masked", status: "Active", isActive: true, displayOrder: 3,
    }).returning();
    await db.insert(crmUsers).values({
      tenantId: tid, code: "CRM004", name: "Priya Sharma", email: "priya.sharma@viroc.in",
      phone: "+916356300404", systemRoleId: counsellorRoleRec.id, reportingTo: crmMgr1.id, accessScopeType: "Self", phiAccessLevel: "None", status: "Active", isActive: true, displayOrder: 4,
    });
    await db.insert(crmUsers).values({
      tenantId: tid, code: "CRM005", name: "Rahul Mehta", email: "rahul.mehta@viroc.in",
      phone: "+916356300405", systemRoleId: agentRoleRec.id, reportingTo: crmMgr1.id, accessScopeType: "Self", phiAccessLevel: "None", status: "Active", isActive: true, displayOrder: 5,
    });
    await db.insert(crmUsers).values({
      tenantId: tid, code: "CRM006", name: "Meera Trivedi", email: "meera.trivedi@viroc.in",
      phone: "+916356300406", systemRoleId: counsellorRoleRec.id, reportingTo: crmMgr2.id, accessScopeType: "Self", phiAccessLevel: "None", status: "Active", isActive: true, displayOrder: 6,
    });
    await db.insert(crmUsers).values({
      tenantId: tid, code: "CRM007", name: "Jayesh Parmar", email: "jayesh.parmar@viroc.in",
      phone: "+916356300407", systemRoleId: agentRoleRec.id, reportingTo: crmMgr2.id, accessScopeType: "Self", phiAccessLevel: "None", status: "Active", isActive: true, displayOrder: 7,
    });

    // ── Lead Statuses ──
    const leadStatusData = [
      { code: "RAW", name: "Raw Lead Captured", sequence: 1, isTerminal: false, requiresNextTask: true },
      { code: "QUAL", name: "Qualified", sequence: 2, isTerminal: false, requiresNextTask: true },
      { code: "CONT", name: "Contacted", sequence: 3, isTerminal: false, requiresNextTask: true },
      { code: "APPT", name: "Appointment Booked", sequence: 4, isTerminal: false, requiresNextTask: true },
      { code: "REM", name: "Reminder Running", sequence: 5, isTerminal: false, requiresNextTask: false },
      { code: "CONS", name: "Consultation Done", sequence: 6, isTerminal: false, requiresNextTask: true },
      { code: "WON", name: "Closed Won", sequence: 7, isTerminal: true, isBusinessAchieved: true, requiresNextTask: false },
      { code: "LOST", name: "Closed Lost", sequence: 8, isTerminal: true, requiresNextTask: false },
      { code: "UNQUAL", name: "Unqualified", sequence: 9, isTerminal: true, requiresNextTask: false },
      { code: "NURT", name: "Nurture", sequence: 10, isTerminal: false, allowNurtureOption: true, requiresNextTask: true },
    ];
    for (const s of leadStatusData) {
      await db.insert(leadStatuses).values({ tenantId: tid, ...s, status: "Active", displayOrder: s.sequence });
    }

    // ── Activity Types ──
    for (const a of [
      { code: "CALL", name: "Phone Call" },
      { code: "NOTE", name: "Note" },
      { code: "EMAIL", name: "Email" },
      { code: "WHATSAPP", name: "WhatsApp" },
      { code: "STAGE_CHANGE", name: "Stage Change" },
      { code: "MEETING", name: "Meeting" },
      { code: "HOME_COUNSELLING", name: "Home Counselling Visit" },
      { code: "SURGERY_DISCUSSION", name: "Surgery Discussion" },
    ]) {
      await db.insert(activityTypes).values({ tenantId: tid, ...a, status: "Active", displayOrder: 0 });
    }

    // ── Next Action Types ──
    for (const n of [
      { code: "CALLBACK", name: "Call Back" },
      { code: "SEND_INFO", name: "Send Information" },
      { code: "SCHEDULE_APPT", name: "Schedule Appointment" },
      { code: "FOLLOW_UP", name: "Follow Up" },
      { code: "HOME_VISIT", name: "Schedule Home Counselling" },
      { code: "SURGERY_DATE", name: "Confirm Surgery Date" },
    ]) {
      await db.insert(nextActionTypes).values({ tenantId: tid, ...n, status: "Active", displayOrder: 0 });
    }

    // ── Task Categories ──
    for (const t of [
      { code: "SLA", name: "SLA Task" },
      { code: "FOLLOW_UP", name: "Follow Up" },
      { code: "REMINDER", name: "Appointment Reminder" },
      { code: "PRE_OP", name: "Pre-Operative Preparation" },
      { code: "POST_OP", name: "Post-Operative Follow Up" },
      { code: "INSURANCE", name: "Insurance Processing" },
    ]) {
      await db.insert(taskCategories).values({ tenantId: tid, ...t, status: "Active", displayOrder: 0 });
    }

    // ── Call Statuses & Directions ──
    for (const c of [
      { code: "ANSWERED", name: "Answered" },
      { code: "NO_ANSWER", name: "No Answer" },
      { code: "BUSY", name: "Busy" },
      { code: "VOICEMAIL", name: "Voicemail" },
      { code: "SWITCHED_OFF", name: "Switched Off" },
    ]) {
      await db.insert(callStatuses).values({ tenantId: tid, ...c, status: "Active", displayOrder: 0 });
    }
    for (const d of [
      { code: "INBOUND", name: "Inbound" },
      { code: "OUTBOUND", name: "Outbound" },
    ]) {
      await db.insert(callDirections).values({ tenantId: tid, ...d, status: "Active", displayOrder: 0 });
    }

    // ── Appointment Statuses ──
    for (const a of [
      { code: "SCHEDULED", name: "Scheduled" },
      { code: "CONFIRMED", name: "Confirmed" },
      { code: "CHECKED_IN", name: "Checked In" },
      { code: "COMPLETED", name: "Completed" },
      { code: "NO_SHOW", name: "No Show" },
      { code: "CANCELLED", name: "Cancelled" },
      { code: "RESCHEDULED", name: "Rescheduled" },
    ]) {
      await db.insert(appointmentStatuses).values({ tenantId: tid, ...a, status: "Active", displayOrder: 0 });
    }

    // ── Referral Statuses ──
    for (const r of [
      { code: "PENDING", name: "Pending" },
      { code: "ACCEPTED", name: "Accepted" },
      { code: "COMPLETED", name: "Completed" },
    ]) {
      await db.insert(referralStatuses).values({ tenantId: tid, ...r, status: "Active", displayOrder: 0 });
    }

    // ── Lead Source Categories & Sources ──
    for (const lsc of [
      { code: "DIGITAL", name: "Digital Marketing" },
      { code: "OFFLINE", name: "Offline / Walk-in" },
      { code: "REFERRAL", name: "Doctor Referral" },
      { code: "CAMP", name: "Health Camp / Event" },
    ]) {
      await db.insert(leadSourceCategories).values({ tenantId: tid, ...lsc, status: "Active", displayOrder: 0 });
    }
    for (const [i, ls] of [
      { code: "FACEBOOK", name: "Facebook" },
      { code: "INSTAGRAM", name: "Instagram" },
      { code: "GOOGLE", name: "Google Ads" },
      { code: "YOUTUBE", name: "YouTube" },
      { code: "WEBSITE", name: "viroc.in Website Form" },
      { code: "WALKIN", name: "Walk-in / Direct Visit" },
      { code: "CAMP", name: "Health Camp" },
      { code: "TELEPHONY", name: "Telephony Inbound (+91 6356300400)" },
      { code: "JUSTDIAL", name: "JustDial" },
      { code: "PRACTO", name: "Practo" },
      { code: "DR_REFERRAL", name: "Doctor Referral" },
      { code: "PATIENT_REF", name: "Patient Referral (Word of Mouth)" },
      { code: "HOME_COUNSEL", name: "Home Counselling Request" },
      { code: "WHATSAPP", name: "WhatsApp" },
      { code: "PHONE", name: "Phone Inquiry" },
      { code: "GOOGLE_FORMS", name: "Google Forms" },
      { code: "CALLYZER", name: "Callyzer" },
      { code: "EMAIL_CAMP", name: "Email Campaign" },
      { code: "REFERRAL", name: "Referral (General)" },
      { code: "OTHER", name: "Other" },
    ].entries()) {
      await db.insert(leadSources).values({ tenantId: tid, ...ls, status: "Active", displayOrder: i + 1 });
    }

    // ── Campaign Channels ──
    for (const cc of [
      { code: "FACEBOOK", name: "Facebook" },
      { code: "INSTAGRAM", name: "Instagram" },
      { code: "GOOGLE_SEARCH", name: "Google Search" },
      { code: "GOOGLE_DISPLAY", name: "Google Display" },
      { code: "YOUTUBE", name: "YouTube" },
      { code: "LINKEDIN", name: "LinkedIn" },
    ]) {
      await db.insert(campaignChannels).values({ tenantId: tid, ...cc, status: "Active", displayOrder: 0 });
    }

    // ── Appointment Types ──
    for (const at of [
      { code: "FIRST_VISIT", name: "First Consultation" },
      { code: "FOLLOW_UP", name: "Follow Up Visit" },
      { code: "PRE_OP", name: "Pre-Operative Assessment" },
      { code: "POST_OP", name: "Post-Operative Review" },
      { code: "PHYSIO", name: "Physiotherapy Session" },
      { code: "PHYSIO_HOME", name: "Physiotherapy (Home Visit)" },
      { code: "STITCH_REMOVAL", name: "Stitch Removal" },
      { code: "DRESSING", name: "Dressing Change" },
      { code: "WOUND_CARE", name: "Wound Care" },
      { code: "CAST_REMOVAL", name: "Cast / Splint Removal" },
      { code: "REHAB", name: "Rehabilitation Session" },
      { code: "INJECTION", name: "Injection / Infusion" },
      { code: "INVESTIGATION", name: "Investigation / Lab Test" },
      { code: "SECOND_OPINION", name: "Second Opinion" },
      { code: "HOME_COUNSEL", name: "Home Counselling" },
      { code: "TELE_CONSULT", name: "Tele-Consultation" },
    ]) {
      await db.insert(appointmentTypes).values({ tenantId: tid, ...at, status: "Active", displayOrder: 0 });
    }

    // ── Conversion Stages ──
    for (const cs of [
      { code: "ENQUIRY", name: "Enquiry", sequence: 1 },
      { code: "CONSULTATION", name: "Consultation Booked", sequence: 2 },
      { code: "SURGERY_PLANNED", name: "Surgery Planned", sequence: 3 },
      { code: "INSURANCE_APPROVED", name: "Insurance Approved", sequence: 4 },
      { code: "ADMITTED", name: "Admitted", sequence: 5 },
      { code: "CONVERTED", name: "Converted (Surgery Done)", sequence: 6, isTerminal: true, isBusinessAchieved: true },
    ]) {
      await db.insert(conversionStages).values({ tenantId: tid, ...cs, status: "Active", displayOrder: cs.sequence });
    }

    // ── Lost Reasons ──
    for (const lr of [
      { code: "PRICE", name: "Price / Cost Concern" },
      { code: "TRUST", name: "Trust / Confidence Issue" },
      { code: "COMPETITOR", name: "Chose Another Hospital" },
      { code: "NOT_READY", name: "Not Ready for Surgery" },
      { code: "DISTANCE", name: "Distance / Location Issue" },
      { code: "INSURANCE", name: "Insurance Not Accepted" },
      { code: "SECOND_OPINION", name: "Went for Second Opinion" },
      { code: "IMPROVED", name: "Condition Improved (No Surgery Needed)" },
    ]) {
      await db.insert(lostReasons).values({ tenantId: tid, ...lr, status: "Active", displayOrder: 0 });
    }

    // ── No Show Reasons ──
    for (const ns of [
      { code: "FORGOT", name: "Forgot Appointment" },
      { code: "EMERGENCY", name: "Emergency / Illness" },
      { code: "TRAVEL", name: "Travel / Transport Issue" },
      { code: "WORK", name: "Work Commitment" },
      { code: "RESCHEDULED", name: "Wants to Reschedule" },
    ]) {
      await db.insert(noShowReasons).values({ tenantId: tid, ...ns, status: "Active", displayOrder: 0 });
    }

    // ── Sample Leads (realistic orthopaedic enquiries) ──
    await storage.createLead({ tenantId: tid, name: "Ramesh Patel", phoneE164: "+919876543210", email: "ramesh.patel@gmail.com", status: "Raw Lead Captured" });
    await storage.createLead({ tenantId: tid, name: "Jyoti Sharma", phoneE164: "+919876543211", email: "jyoti.sharma@gmail.com", status: "Qualified" });
    await storage.createLead({ tenantId: tid, name: "Bhavesh Solanki", phoneE164: "+919876543212", status: "Contacted" });
    await storage.createLead({ tenantId: tid, name: "Hansaben Desai", phoneE164: "+919876543213", email: "hansa.desai@yahoo.com", status: "Appointment Booked" });
    const leadVijay = await storage.createLead({ tenantId: tid, name: "Vijay Chauhan", phoneE164: "+919876543214", status: "Consultation Done" });
    await storage.createLead({ tenantId: tid, name: "Niraben Modi", phoneE164: "+919876543215", email: "nira.modi@gmail.com", status: "Raw Lead Captured" });
    await storage.createLead({ tenantId: tid, name: "Suresh Thakor", phoneE164: "+919876543216", status: "Qualified" });
    await storage.createLead({ tenantId: tid, name: "Kalpanaben Joshi", phoneE164: "+919876543217", email: "kalpana.j@hotmail.com", status: "Contacted" });
    const leadPrakash = await storage.createLead({ tenantId: tid, name: "Prakash Pandya", phoneE164: "+919876543218", status: "Appointment Booked" });
    await storage.createLead({ tenantId: tid, name: "Geeta Rathod", phoneE164: "+919876543219", email: "geeta.rathod@gmail.com", status: "Nurture" });
    await storage.createLead({ tenantId: tid, name: "Mahesh Vaghela", phoneE164: "+919876543220", status: "Raw Lead Captured" });
    const leadSangita = await storage.createLead({ tenantId: tid, name: "Sangitaben Parikh", phoneE164: "+919876543221", email: "sangita.p@gmail.com", status: "Consultation Done" });

    // ── Patients (converted from Consultation Done leads) ──
    const patVijay = await storage.createPatient({ tenantId: tid, firstName: "Vijay", lastName: "Chauhan", primaryPhone: "+919876543214", gender: "Male", bloodGroup: "B+", uhid: "UHID-00001", status: "Active" });
    await storage.updateLead(leadVijay.id, { patientId: patVijay.id });

    const patSangita = await storage.createPatient({ tenantId: tid, firstName: "Sangitaben", lastName: "Parikh", primaryPhone: "+919876543221", email: "sangita.p@gmail.com", gender: "Female", bloodGroup: "A+", uhid: "UHID-00002", status: "Active" });
    await storage.updateLead(leadSangita.id, { patientId: patSangita.id });

    const patPrakash = await storage.createPatient({ tenantId: tid, firstName: "Prakash", lastName: "Pandya", primaryPhone: "+919876543218", gender: "Male", bloodGroup: "O+", uhid: "UHID-00003", status: "Active" });
    await storage.updateLead(leadPrakash.id, { patientId: patPrakash.id });

    console.log("Database seeded successfully with VIROC Hospital data from viroc.in");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

async function ensurePatientsForConvertedLeads() {
  try {
    const allTenantRows = await db.select({ id: tenants.id }).from(tenants);
    for (const t of allTenantRows) {
      const tid = t.id;
      const leadsWithoutPatient = await db.select().from(leads)
        .where(and(eq(leads.tenantId, tid), isNull(leads.patientId), eq(leads.status, "Consultation Done")));

      for (const lead of leadsWithoutPatient) {
        const nameParts = lead.name.split(" ");
        const fn = nameParts[0] || "Patient";
        const ln = nameParts.slice(1).join(" ") || "";

        const [patient] = await db.insert(patients).values({
          tenantId: tid,
          firstName: fn,
          lastName: ln,
          primaryPhone: lead.phoneE164,
          email: lead.email,
          uhid: `UHID-AUTO-${lead.id}`,
          status: "Active",
        }).returning();

        await db.update(leads).set({ patientId: patient.id }).where(eq(leads.id, lead.id));
      }
      if (leadsWithoutPatient.length > 0) {
        console.log(`Auto-created ${leadsWithoutPatient.length} patient(s) for tenant ${tid} from Consultation Done leads`);
      }
    }
  } catch (error) {
    console.error("Error in ensurePatientsForConvertedLeads:", error);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await setupAuth(app);
  registerAuthRoutes(app);

  const [defaultTenant] = await db.select().from(tenants).limit(1);
  const defaultTid = defaultTenant?.id || 1;

  app.use("/api", (req, _res, next) => {
    (req as any)._tenantId = (req.session as any)?.tenantId || defaultTid;
    next();
  });

  app.use("/api", async (req: any, res, next) => {
    const path = req.path;
    if (path === "/me" || path.startsWith("/auth") || path.startsWith("/admin") || path === "/login" || path === "/callback" || path === "/logout") {
      return next();
    }
    try {
      const sessionTid = req.session?.tenantId || defaultTid;
      const [tenantRow] = await db.select().from(tenants).where(eq(tenants.id, sessionTid));
      if (tenantRow?.subscriptionStatus === "Suspended") {
        const crmUserId = req.session?.crmUserId;
        if (crmUserId) {
          const allCrmUsers = await storage.getCrmUsers(sessionTid);
          const crmUser = allCrmUsers.find((u: any) => u.id === crmUserId);
          if (crmUser?.systemRoleId) {
            const allRoles = await storage.getMasterRecords("systemRoles", sessionTid);
            const role = allRoles.find((r: any) => r.id === crmUser.systemRoleId);
            if (role && (role as any).code === "SYS_ADMIN") {
              return next();
            }
          }
        }
        return res.status(403).json({ message: "Service temporarily suspended. Please contact your administrator." });
      }
      next();
    } catch (err) {
      next();
    }
  });

  function getTid(req: any): number {
    return req._tenantId || defaultTid;
  }
  const tid = defaultTid;

  // --- /api/me: Get current user's CRM profile with role ---
  app.get("/api/me", isAuthenticated, async (req, res) => {
    try {
      const session = req.session as any;
      const crmUserId = session.crmUserId;
      if (!crmUserId) return res.status(401).json({ message: "Unauthorized" });

      const sessionTid = (req.session as any).tenantId || tid;
      const allCrmUsers = await storage.getCrmUsers(sessionTid);
      const crmUser = allCrmUsers.find(u => u.id === crmUserId);

      if (!crmUser) {
        return res.status(401).json({ message: "User not found" });
      }

      let roleName = null;
      let roleCode = null;
      if (crmUser.systemRoleId) {
        const allRoles = await storage.getMasterRecords("systemRoles", sessionTid);
        const role = allRoles.find(r => r.id === crmUser!.systemRoleId);
        if (role) {
          roleName = role.name;
          roleCode = (role as any).code;
        }
      }

      const { passwordHash: _, ...safeCrmUser } = crmUser as any;

      const [tenantRow] = await db.select().from(tenants).where(eq(tenants.id, sessionTid));
      const tenantSubscriptionStatus = tenantRow?.subscriptionStatus || "Active";

      res.json({
        status: "active",
        tenantSubscriptionStatus,
        crmUser: {
          ...safeCrmUser,
          roleName,
          roleCode,
        },
      });
    } catch (error) {
      console.error("Error in /api/me:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // --- Admin: Set password for CRM user ---
  app.post("/api/crm-users/:id/set-password", isAuthenticated, async (req: any, res) => {
    try {
      const reqTid = req.session?.tenantId || tid;
      const sessionCrmUserId = req.session?.crmUserId;
      const allCrmUsers = await storage.getCrmUsers(reqTid);
      const currentCrmUser = allCrmUsers.find((u: any) => u.id === sessionCrmUserId);
      if (!currentCrmUser) return res.status(403).json({ message: "Not a CRM user" });

      let isAdmin = false;
      if (currentCrmUser.systemRoleId) {
        const allRoles = await storage.getMasterRecords("systemRoles", reqTid);
        const r = allRoles.find(r => r.id === currentCrmUser.systemRoleId);
        if (r && ((r as any).code === "ADMIN" || (r as any).code === "SYS_ADMIN")) isAdmin = true;
      }
      if (!isAdmin) return res.status(403).json({ message: "Only admins can set passwords" });

      const { password } = req.body;
      if (!password || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const { hashPassword } = await import("./replit_integrations/auth/replitAuth");
      const passwordHash = await hashPassword(password);
      const updated = await storage.updateCrmUser(Number(req.params.id), reqTid, { passwordHash });
      res.json({ success: true, userId: updated.id });
    } catch (error) {
      console.error("Error setting password:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // --- Tenant ---
  app.get(api.tenants.get.path, isAuthenticated, async (req, res) => {
    const sessionTenantId = (req.session as any)?.tenantId;
    if (sessionTenantId) {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, sessionTenantId));
      if (tenant) return res.json(tenant);
    }
    const allTenants = await db.select().from(tenants);
    if (allTenants.length > 0) {
      res.json(allTenants[0]);
    } else {
      res.status(404).json({ message: "No tenant found" });
    }
  });

  app.patch("/api/tenants/branding", isAuthenticated, async (req, res) => {
    try {
      const sessionTenantId = (req.session as any)?.tenantId;
      if (!sessionTenantId) return res.status(401).json({ message: "Unauthorized" });

      const sessionCrmUserId = (req.session as any)?.crmUserId;
      const allCrmUsers = await storage.getCrmUsers(sessionTenantId);
      const crmUser = allCrmUsers.find((u: any) => u.id === sessionCrmUserId);
      if (!crmUser) return res.status(403).json({ message: "Forbidden" });

      const allRoles = await storage.getMasterRecords("systemRoles", sessionTenantId);
      const userRole = allRoles.find((r: any) => r.id === crmUser.systemRoleId);
      if (!userRole || userRole.code !== "SYS_ADMIN") {
        return res.status(403).json({ message: "Only System Admin can update branding" });
      }

      const brandingSchema = z.object({
        displayName: z.string().min(1).max(200).optional(),
        primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      });
      const parsed = brandingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid branding data", errors: parsed.error.errors });
      }
      const { displayName, primaryColor, secondaryColor } = parsed.data;
      const updateData: any = {};
      if (displayName !== undefined) updateData.displayName = displayName;
      if (primaryColor !== undefined) updateData.primaryColor = primaryColor;
      if (secondaryColor !== undefined) updateData.secondaryColor = secondaryColor;

      const [updated] = await db.update(tenants).set(updateData).where(eq(tenants.id, sessionTenantId)).returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating branding:", error);
      res.status(500).json({ message: "Failed to update branding" });
    }
  });

  app.post("/api/tenants/branding/logo", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      const sessionTenantId = (req.session as any)?.tenantId;
      if (!sessionTenantId) return res.status(401).json({ message: "Unauthorized" });

      const sessionCrmUserId = (req.session as any)?.crmUserId;
      const allCrmUsers = await storage.getCrmUsers(sessionTenantId);
      const crmUser = allCrmUsers.find((u: any) => u.id === sessionCrmUserId);
      if (!crmUser) return res.status(403).json({ message: "Forbidden" });

      const allRoles = await storage.getMasterRecords("systemRoles", sessionTenantId);
      const userRole = allRoles.find((r: any) => r.id === crmUser.systemRoleId);
      if (!userRole || userRole.code !== "SYS_ADMIN") {
        return res.status(403).json({ message: "Only System Admin can update branding" });
      }

      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const ext = req.file.originalname.split('.').pop()?.toLowerCase() || 'png';
      const allowedExts = ['png', 'jpg', 'jpeg', 'svg', 'ico', 'webp'];
      if (!allowedExts.includes(ext)) {
        return res.status(400).json({ message: "Invalid file type. Allowed: PNG, JPG, SVG, ICO, WEBP" });
      }

      const base64Data = req.file.buffer.toString("base64");
      const mimeType = req.file.mimetype;
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      const field = req.query.type === "favicon" ? "faviconUrl" : "logoUrl";
      const [updated] = await db.update(tenants).set({ [field]: dataUrl }).where(eq(tenants.id, sessionTenantId)).returning();
      res.json(updated);
    } catch (error) {
      console.error("Error uploading branding image:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // --- Tenant Management (System Admin only) ---
  app.get("/api/tenants/all", isAuthenticated, async (req, res) => {
    try {
      const allTenantsList = await db.select().from(tenants).orderBy(tenants.id);
      res.json(allTenantsList);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tenants", isAuthenticated, async (req, res) => {
    try {
      const tenantSchema = z.object({
        name: z.string().min(1),
        subdomain: z.string().min(1),
        displayName: z.string().optional(),
        primaryColor: z.string().optional(),
        secondaryColor: z.string().optional(),
      });
      const parsed = tenantSchema.parse(req.body);
      const [newTenant] = await db.insert(tenants).values({
        name: toProperCase(parsed.name),
        subdomain: parsed.subdomain.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        displayName: parsed.displayName || parsed.name,
        primaryColor: parsed.primaryColor || "#005b9f",
        secondaryColor: parsed.secondaryColor || "#f0f7fc",
      }).returning();

      const existingRoles = await storage.getMasterRecords("systemRoles", newTenant.id);
      if (existingRoles.length === 0) {
        const defaultRoles = [
          { code: "SYS_ADMIN", name: "System Admin" },
          { code: "ADMIN", name: "CRM Admin" },
          { code: "MANAGER", name: "Manager" },
          { code: "AGENT", name: "Agent" },
          { code: "COUNSELLOR", name: "Counsellor" },
        ];
        for (const role of defaultRoles) {
          await storage.createMasterRecord("systemRoles", {
            tenantId: newTenant.id,
            code: role.code,
            name: role.name,
            status: "Active",
            displayOrder: 0,
            approvalStatus: "Approved",
          });
        }
      }

      res.status(201).json(newTenant);
    } catch (err: any) {
      if (err.message?.includes("duplicate key")) {
        return res.status(400).json({ message: "A hospital with this subdomain already exists" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  // --- Master Data Approval (CRM Admin+) ---
  app.get("/api/masters-pending", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const tableName = req.query.tableName as string | undefined;
      const tables = tableName ? [tableName] : Object.keys(MASTER_TABLE_REGISTRY);
      const pendingItems: any[] = [];

      for (const tbl of tables) {
        const pgTbl = MASTER_TABLE_REGISTRY[tbl];
        if (!pgTbl) continue;
        try {
          const result = await pool.query(
            `SELECT *, '${tbl}' as table_name FROM "${pgTbl}" WHERE tenant_id = $1 AND approval_status = 'Pending' ORDER BY created_at DESC`,
            [tid]
          );
          for (const row of result.rows) {
            pendingItems.push({
              id: row.id,
              tableName: tbl,
              code: row.code,
              name: row.name,
              status: row.status,
              approvalStatus: row.approval_status,
              createdAt: row.created_at,
              createdBy: row.created_by,
            });
          }
        } catch (_) { /* skip tables without approval_status */ }
      }

      res.json(pendingItems);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/masters/:tableName/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const tableName = req.params.tableName as string;
      const id = Number(req.params.id);
      const pgTbl = MASTER_TABLE_REGISTRY[tableName];
      if (!pgTbl) return res.status(400).json({ message: "Unknown table" });

      await pool.query(
        `UPDATE "${pgTbl}" SET approval_status = 'Approved', modified_at = NOW() WHERE id = $1 AND tenant_id = $2`,
        [id, tid]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/masters/:tableName/:id/reject", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const tableName = req.params.tableName as string;
      const id = Number(req.params.id);
      const pgTbl = MASTER_TABLE_REGISTRY[tableName];
      if (!pgTbl) return res.status(400).json({ message: "Unknown table" });

      await pool.query(
        `UPDATE "${pgTbl}" SET approval_status = 'Rejected', modified_at = NOW() WHERE id = $1 AND tenant_id = $2`,
        [id, tid]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- Inline Master Creation (creates with Pending status) ---
  app.post("/api/masters/:tableName/quick-add", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const tableName = req.params.tableName as string;
      const pgTbl = MASTER_TABLE_REGISTRY[tableName];
      if (!pgTbl) return res.status(400).json({ message: "Unknown table" });

      const name = toProperCase(req.body.name || "");
      if (!name) return res.status(400).json({ message: "Name is required" });

      const code = name.toUpperCase().replace(/\s+/g, "_").substring(0, 50);

      const record = await storage.createMasterRecord(tableName, {
        tenantId: tid,
        code,
        name,
        status: "Active",
        displayOrder: 0,
        approvalStatus: "Pending",
      });
      res.status(201).json(record);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // --- Leads (with access scope filtering) ---
  app.get(api.leads.list.path, isAuthenticated, async (req: any, res) => {
    const reqTid = req.session?.tenantId || tid;
    const allLeads = await storage.getLeads(reqTid);
    const sessionCrmUserId = req.session?.crmUserId;
    const allCrmUsers = await storage.getCrmUsers(reqTid);
    const crmUser = sessionCrmUserId ? allCrmUsers.find((u: any) => u.id === sessionCrmUserId) || null : null;

    let filtered = allLeads;

    if (crmUser && crmUser.accessScopeType === "Self") {
      filtered = filtered.filter(l => l.assignedCrmUserId === crmUser.id);
    } else if (crmUser && crmUser.accessScopeType === "Branch" && crmUser.branchId) {
      filtered = filtered.filter(l => l.branchId === crmUser.branchId);
    }

    const search = (req.query.search as string || "").trim().toLowerCase();
    if (search) {
      filtered = filtered.filter(l =>
        (l.name && l.name.toLowerCase().includes(search)) ||
        (l.phoneE164 && l.phoneE164.toLowerCase().includes(search)) ||
        (l.email && l.email.toLowerCase().includes(search)) ||
        (l.hmsPatientId && l.hmsPatientId.toLowerCase().includes(search)) ||
        (l.notes && l.notes.toLowerCase().includes(search))
      );
    }

    const status = req.query.status as string;
    if (status) {
      filtered = filtered.filter(l => l.status === status);
    }

    res.json(filtered);
  });

  app.get("/api/leads/dormant", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const daysThreshold = Number(req.query.days) || 5;
      const allLeads = await storage.getLeads(tid);
      const now = new Date();
      const terminalStatuses = ["Closed Won", "Closed Lost", "Unqualified"];

      const sessionCrmUserId = req.session?.crmUserId;
      const allCrmUsers = await storage.getCrmUsers(tid);
      const crmUser = sessionCrmUserId ? allCrmUsers.find((u: any) => u.id === sessionCrmUserId) || null : null;

      let scopedLeads = allLeads;
      if (crmUser && crmUser.accessScopeType === "Self") {
        scopedLeads = scopedLeads.filter(l => l.assignedCrmUserId === crmUser.id);
      } else if (crmUser && crmUser.accessScopeType === "Branch" && crmUser.branchId) {
        scopedLeads = scopedLeads.filter(l => l.branchId === crmUser.branchId);
      }

      const dormantLeads = scopedLeads.filter(lead => {
        if (terminalStatuses.includes(lead.status)) return false;
        const lastActivity = lead.lastContactAt || lead.createdAt;
        if (!lastActivity) return true;
        const daysSince = (now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince > daysThreshold;
      });
      
      res.json(dormantLeads.sort((a, b) => {
        const aDate = a.lastContactAt || a.createdAt;
        const bDate = b.lastContactAt || b.createdAt;
        return new Date(aDate || 0).getTime() - new Date(bDate || 0).getTime();
      }));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch dormant leads" });
    }
  });

  app.get("/api/tasks/today", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const allTasks = await storage.getTasks(tid);
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const sessionCrmUserId = req.session?.crmUserId;
      const assignedToFilter = req.query.assignedCrmUserId ? Number(req.query.assignedCrmUserId) : sessionCrmUserId;
      
      const relevantTasks = allTasks.filter(task => {
        if (task.status === "Completed") return false;
        if (!task.dueDate) return false;
        const due = new Date(task.dueDate);
        const isOverdue = due < todayStart;
        const isDueToday = due >= todayStart && due < todayEnd;
        if (!isOverdue && !isDueToday) return false;
        if (assignedToFilter && task.assignedCrmUserId !== assignedToFilter) return false;
        return true;
      });
      
      const overdue = relevantTasks.filter(t => new Date(t.dueDate!) < todayStart);
      const dueToday = relevantTasks.filter(t => {
        const due = new Date(t.dueDate!);
        return due >= todayStart && due < todayEnd;
      });
      
      res.json({ overdue, dueToday, total: relevantTasks.length });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch today's tasks" });
    }
  });

  app.get("/api/leads/:id/handover-history", isAuthenticated, async (req, res) => {
    try {
      const allActivities = await storage.getActivities(Number(req.params.id));
      const handoverActivities = allActivities.filter(a => 
        a.type === "handover" || a.type === "assignment" || a.type === "handover_accepted" || a.type === "handover_rejected"
      );
      res.json(handoverActivities);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch handover history" });
    }
  });

  // --- Bulk Lead Import (CSV) --- (MUST be before /api/leads/:id to avoid route collision)
  const LEAD_CSV_FIELDS = [
    { key: "name", label: "Name", required: true },
    { key: "phoneE164", label: "Phone Number", required: true },
    { key: "email", label: "Email" },
    { key: "notes", label: "Notes" },
    { key: "tags", label: "Tags" },
    { key: "utmSource", label: "UTM Source" },
    { key: "utmMedium", label: "UTM Medium" },
    { key: "utmCampaign", label: "UTM Campaign" },
    { key: "utmTerm", label: "UTM Term" },
    { key: "utmContent", label: "UTM Content" },
    { key: "priority", label: "Priority" },
    { key: "city", label: "City" },
    { key: "leadSource", label: "Lead Source" },
    { key: "callSummary", label: "Call Summary" },
    { key: "companyName", label: "Company Name" },
    { key: "alternatePhone", label: "Alternate Phone" },
    { key: "address", label: "Address" },
    { key: "revenueGenerated", label: "Revenue Generated" },
  ];

  app.get("/api/leads/import-fields", isAuthenticated, (_req, res) => {
    res.json(LEAD_CSV_FIELDS);
  });

  app.get("/api/leads/import-template", isAuthenticated, (_req, res) => {
    const csvData = stringify([
      { name: "John Doe", phoneE164: "+919876543210", email: "john@example.com", notes: "Sample lead", tags: "facebook,walk-in", priority: "Normal" },
    ], { header: true, columns: LEAD_CSV_FIELDS.map(f => f.key) });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="lead_import_template.csv"');
    res.send(csvData);
  });

  app.get("/api/leads/import-logs", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const logs = await db.select().from(leadImportLogs)
        .where(eq(leadImportLogs.tenantId, tid))
        .orderBy(desc(leadImportLogs.startedAt))
        .limit(50);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get(api.leads.get.path, isAuthenticated, async (req, res) => {
    const lead = await storage.getLead(Number(req.params.id));
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json(lead);
  });

  app.post(api.leads.create.path, isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const input = api.leads.create.input.parse({ ...req.body, tenantId: tid });
      const lead = await storage.createLead(input);
      res.status(201).json(lead);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.patch(api.leads.update.path, isAuthenticated, async (req, res) => {
    try {
      const body = coerceDateFields(req.body, ["nextActionDate"]);
      const input = api.leads.update.input.parse(body);
      const leadId = Number(req.params.id);

      let lead = await storage.updateLead(leadId, input);

      if (input.status === "Consultation Done" && !lead.patientId) {
        try {
          const tid = await getDefaultTenantId(req);
          const nameParts = lead.name.split(" ");
          const fn = nameParts[0] || "Patient";
          const ln = nameParts.slice(1).join(" ") || "";
          const [patient] = await db.insert(patients).values({
            tenantId: tid,
            firstName: fn,
            lastName: ln,
            primaryPhone: lead.phoneE164,
            email: lead.email,
            uhid: `UHID-AUTO-${lead.id}`,
            status: "Active",
          }).returning();
          lead = await storage.updateLead(leadId, { patientId: patient.id });
        } catch (patErr: any) {
          console.error("Auto-create patient failed:", patErr.message);
        }
      }

      res.json(lead);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.post("/api/leads/bulk-update-source", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const { tag, leadSourceCode } = req.body;
      if (!tag || !leadSourceCode) return res.status(400).json({ message: "tag and leadSourceCode required" });
      
      const [source] = await db.select().from(leadSources).where(and(eq(leadSources.tenantId, tid), eq(leadSources.code, leadSourceCode)));
      if (!source) return res.status(404).json({ message: `Lead source '${leadSourceCode}' not found` });
      
      const result = await db.execute(sql`UPDATE leads SET lead_source_id = ${source.id} WHERE tenant_id = ${tid} AND tags LIKE ${'%' + tag + '%'} AND lead_source_id IS NULL`);
      
      res.json({ updated: result.rowCount, leadSourceId: source.id, leadSourceName: source.name });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/lead-sources/sync", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const requiredSources = [
        { code: "FACEBOOK", name: "Facebook", displayOrder: 1 },
        { code: "INSTAGRAM", name: "Instagram", displayOrder: 2 },
        { code: "GOOGLE", name: "Google Ads", displayOrder: 3 },
        { code: "YOUTUBE", name: "YouTube", displayOrder: 4 },
        { code: "WEBSITE", name: "viroc.in Website Form", displayOrder: 5 },
        { code: "WALKIN", name: "Walk-in / Direct Visit", displayOrder: 6 },
        { code: "CAMP", name: "Health Camp", displayOrder: 7 },
        { code: "TELEPHONY", name: "Telephony Inbound (+91 6356300400)", displayOrder: 8 },
        { code: "JUSTDIAL", name: "JustDial", displayOrder: 9 },
        { code: "PRACTO", name: "Practo", displayOrder: 10 },
        { code: "DR_REFERRAL", name: "Doctor Referral", displayOrder: 11 },
        { code: "PATIENT_REF", name: "Patient Referral (Word of Mouth)", displayOrder: 12 },
        { code: "HOME_COUNSEL", name: "Home Counselling Request", displayOrder: 13 },
        { code: "WHATSAPP", name: "WhatsApp", displayOrder: 14 },
        { code: "PHONE", name: "Phone Inquiry", displayOrder: 15 },
        { code: "GOOGLE_FORMS", name: "Google Forms", displayOrder: 16 },
        { code: "CALLYZER", name: "Callyzer", displayOrder: 17 },
        { code: "EMAIL_CAMP", name: "Email Campaign", displayOrder: 18 },
        { code: "REFERRAL", name: "Referral (General)", displayOrder: 19 },
        { code: "OTHER", name: "Other", displayOrder: 20 },
      ];
      const existing = await db.select().from(leadSources).where(eq(leadSources.tenantId, tid));
      const existingCodes = new Set(existing.map(s => s.code));
      
      const metaEntry = existing.find(s => s.code === "META");
      if (metaEntry) {
        await db.update(leadSources).set({ code: "FACEBOOK", name: "Facebook", displayOrder: 1 }).where(eq(leadSources.id, metaEntry.id));
        existingCodes.delete("META");
        existingCodes.add("FACEBOOK");
      }
      
      let added = 0;
      for (const s of requiredSources) {
        if (!existingCodes.has(s.code)) {
          await db.insert(leadSources).values({ tenantId: tid, ...s, status: "Active", approvalStatus: "Approved" });
          added++;
        }
      }
      
      const final = await db.select().from(leadSources).where(eq(leadSources.tenantId, tid));
      res.json({ message: `Synced lead sources. Added ${added} new entries.`, total: final.length, sources: final.sort((a: any, b: any) => a.displayOrder - b.displayOrder).map((s: any) => ({ id: s.id, code: s.code, name: s.name })) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- Tasks ---
  app.get(api.tasks.list.path, isAuthenticated, async (req, res) => {
    const tid = await getDefaultTenantId(req);
    const leadId = req.query.leadId ? Number(req.query.leadId) : undefined;
    const allTasks = await storage.getTasks(tid, leadId);
    res.json(allTasks);
  });

  app.post(api.tasks.create.path, isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const userId = String((req as any).session?.crmUserId || "system");
      const body = coerceDateFields(req.body, ["dueDate"]);
      const input = api.tasks.create.input.parse({
        ...body,
        tenantId: tid,
        createdBy: userId,
      });
      const task = await storage.createTask(input);
      res.status(201).json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch(api.tasks.update.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.tasks.update.input.parse(req.body);
      const task = await storage.updateTask(Number(req.params.id), input);
      res.json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // --- Activities ---
  app.get(api.activities.list.path, isAuthenticated, async (req, res) => {
    const allActivities = await storage.getActivities(Number(req.params.leadId));
    res.json(allActivities);
  });

  app.post(api.activities.create.path, isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const userId = String((req as any).session?.crmUserId || "system");
      const body = coerceDateFields(req.body, ["nextActionDate"]);
      const input = api.activities.create.input.parse({
        ...body,
        tenantId: tid,
        createdBy: userId,
      });
      const activity = await storage.createActivity(input);
      res.status(201).json(activity);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // --- Zod schemas for Phase 4B validation ---
  const handoverActionSchema = z.object({
    action: z.enum(["accept", "reject"]),
    rejectionReason: z.string().optional(),
  });

  const assignLeadSchema = z.object({
    assignToCrmUserId: z.number().int().positive(),
    handoverReason: z.string().optional(),
  });

  const leadIntakeSchema = z.object({
    name: z.string().min(1, "name is required"),
    phoneE164: z.string().min(1, "phoneE164 is required"),
    email: z.string().email().optional().or(z.literal("")),
    branchId: z.number().int().positive().optional(),
    departmentId: z.number().int().positive().optional(),
    leadSourceId: z.number().int().positive().optional(),
    leadSourceCategoryId: z.number().int().positive().optional(),
    utmSource: z.string().optional(),
    utmMedium: z.string().optional(),
    utmCampaign: z.string().optional(),
    utmTerm: z.string().optional(),
    utmContent: z.string().optional(),
    notes: z.string().optional(),
  });

  // --- Lead Handover ---
  app.patch("/api/leads/:id/handover", isAuthenticated, async (req, res) => {
    try {
      const parsed = handoverActionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const { action, rejectionReason } = parsed.data;
      const leadId = Number(req.params.id);
      const tid = await getDefaultTenantId(req);

      const lead = await storage.getLead(leadId);
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      if (lead.tenantId !== tid) return res.status(403).json({ message: "Access denied" });
      if (lead.handoverStatus !== "Pending") {
        return res.status(400).json({ message: "Lead does not have a pending handover" });
      }

      const userId = String((req as any).session?.crmUserId || "system");

      if (action === "accept") {
        const updated = await storage.updateLead(leadId, {
          handoverStatus: "Accepted",
          handoverAcceptedAt: new Date(),
          assignedCrmUserId: lead.handoverToUserId,
        });
        await storage.createActivity({
          leadId, tenantId: tid, createdBy: userId,
          type: "status_change",
          description: `Handover accepted`,
          oldStatus: "Pending Handover",
          newStatus: "Handover Accepted",
        });
        return res.json(updated);
      } else if (action === "reject") {
        const updated = await storage.updateLead(leadId, {
          handoverStatus: "Rejected",
          handoverRejectedAt: new Date(),
          handoverRejectionReason: rejectionReason || null,
          assignedCrmUserId: lead.handoverFromUserId,
        });
        await storage.createActivity({
          leadId, tenantId: tid, createdBy: userId,
          type: "status_change",
          description: `Handover rejected${rejectionReason ? `: ${rejectionReason}` : ""}`,
          oldStatus: "Pending Handover",
          newStatus: "Handover Rejected",
        });
        return res.json(updated);
      } else {
        return res.status(400).json({ message: "Invalid action. Use 'accept' or 'reject'" });
      }
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // --- Lead Assignment / Transfer ---
  app.post("/api/leads/:id/assign", isAuthenticated, async (req, res) => {
    try {
      const parsed = assignLeadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const { assignToCrmUserId } = parsed.data;
      const leadId = Number(req.params.id);
      const tid = await getDefaultTenantId(req);

      const lead = await storage.getLead(leadId);
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      if (lead.tenantId !== tid) return res.status(403).json({ message: "Access denied" });

      const userId = String((req as any).session?.crmUserId || "system");

      const targetUser = await storage.getCrmUser(assignToCrmUserId, tid);
      if (!targetUser) return res.status(400).json({ message: "Target CRM user not found" });

      const now = new Date();
      const slaDeadline = new Date(now.getTime() + 30 * 60 * 1000);

      const updated = await storage.updateLead(leadId, {
        handoverFromUserId: lead.assignedCrmUserId,
        handoverToUserId: assignToCrmUserId,
        handoverStatus: "Pending",
        handoverAt: now,
        handoverAcceptedAt: null,
        handoverRejectedAt: null,
        handoverRejectionReason: null,
        handoverReason: req.body.handoverReason || null,
        slaDeadline,
      });

      const reasonText = req.body.handoverReason ? ` (Reason: ${req.body.handoverReason})` : "";
      await storage.createActivity({
        leadId, tenantId: tid, createdBy: userId,
        type: "assignment",
        description: `Lead assigned/transferred to ${targetUser.name}${reasonText}`,
      });

      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // --- Lead Intake (External Sources) ---
  app.post("/api/leads/intake", isAuthenticated, async (req, res) => {
    try {
      const parsed = leadIntakeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const body = parsed.data;
      const tid = await getDefaultTenantId(req);
      const userId = String((req as any).session?.crmUserId || "system");

      let existingLead = await storage.findLeadByPhone(tid, body.phoneE164);
      if (!existingLead && body.email) {
        existingLead = await storage.findLeadByEmail(tid, body.email);
      }

      if (existingLead) {
        const updates: Record<string, any> = {};
        if (body.utmSource) updates.utmSource = body.utmSource;
        if (body.utmMedium) updates.utmMedium = body.utmMedium;
        if (body.utmCampaign) updates.utmCampaign = body.utmCampaign;
        if (body.utmTerm) updates.utmTerm = body.utmTerm;
        if (body.utmContent) updates.utmContent = body.utmContent;
        if (body.leadSourceId) updates.leadSourceId = body.leadSourceId;
        if (body.leadSourceCategoryId) updates.leadSourceCategoryId = body.leadSourceCategoryId;
        if (body.notes) updates.notes = (existingLead.notes ? existingLead.notes + "\n" : "") + body.notes;

        if (Object.keys(updates).length > 0) {
          const updated = await storage.updateLead(existingLead.id, updates);
          await storage.createActivity({
            leadId: existingLead.id, tenantId: tid, createdBy: userId,
            type: "note",
            description: `Duplicate lead intake detected. Updated UTM/source fields.`,
          });
          return res.status(200).json({ lead: updated, deduped: true });
        }
        return res.status(200).json({ lead: existingLead, deduped: true });
      }

      const assignedUser = await storage.getNextAssignableCrmUser(tid, body.branchId, body.departmentId);

      const newLead = await storage.createLead({
        tenantId: tid,
        name: body.name,
        phoneE164: body.phoneE164,
        email: body.email,
        status: "Raw Lead Captured",
        branchId: body.branchId,
        leadSourceId: body.leadSourceId,
        leadSourceCategoryId: body.leadSourceCategoryId,
        utmSource: body.utmSource,
        utmMedium: body.utmMedium,
        utmCampaign: body.utmCampaign,
        utmTerm: body.utmTerm,
        utmContent: body.utmContent,
        notes: body.notes,
        assignedCrmUserId: assignedUser?.id,
      });

      await storage.createActivity({
        leadId: newLead.id, tenantId: tid, createdBy: userId,
        type: "note",
        description: `Lead created via intake${assignedUser ? ` and auto-assigned to ${assignedUser.name}` : ""}`,
      });

      return res.status(201).json({ lead: newLead, deduped: false, assignedTo: assignedUser?.name });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  function normalizePhone(phone: string): string {
    let cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
    if (cleaned.startsWith("00")) cleaned = "+" + cleaned.slice(2);
    if (!cleaned.startsWith("+")) {
      if (cleaned.length === 10) cleaned = "+91" + cleaned;
      else if (cleaned.startsWith("91") && cleaned.length === 12) cleaned = "+" + cleaned;
      else cleaned = "+91" + cleaned;
    }
    return cleaned;
  }

  app.post("/api/leads/import", isAuthenticated, upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const tid = await getDefaultTenantId(req);
    const userId = String((req as any).session?.crmUserId || "system");
    const duplicateStrategy = (req.body?.duplicateStrategy || "skip") as string;
    const columnMapping = req.body?.columnMapping ? JSON.parse(req.body.columnMapping) : null;
    const defaultLeadStatus = req.body?.defaultLeadStatus || "Raw Lead Captured";
    const defaultTags = req.body?.defaultTags || "";

    try {
      const csvContent = req.file.buffer.toString("utf-8");
      const rows = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true, bom: true }) as Record<string, string>[];

      let successCount = 0;
      let failureCount = 0;
      let duplicateCount = 0;
      let updatedCount = 0;
      const errors: { row: number; message: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const mapped: Record<string, string> = {};

        if (columnMapping && typeof columnMapping === "object") {
          for (const [crmField, csvCol] of Object.entries(columnMapping)) {
            if (csvCol && typeof csvCol === "string" && row[csvCol] !== undefined) {
              mapped[crmField] = row[csvCol];
            }
          }
        } else {
          Object.assign(mapped, row);
        }

        const name = toProperCase((mapped.name || "").trim());
        let phone = (mapped.phoneE164 || mapped.phone || mapped.phoneNumber || mapped.mobile || "").trim();
        const email = (mapped.email || "").trim();

        if (!name && !phone) {
          failureCount++;
          errors.push({ row: i + 2, message: "Missing required field: name or phone" });
          continue;
        }

        if (!phone) {
          failureCount++;
          errors.push({ row: i + 2, message: "Missing required field: phone number" });
          continue;
        }

        phone = normalizePhone(phone);

        const existingLead = await storage.findLeadByPhone(tid, phone);

        if (existingLead) {
          if (duplicateStrategy === "skip") {
            duplicateCount++;
            continue;
          } else if (duplicateStrategy === "update_blank") {
            const updates: Record<string, any> = {};
            if (!existingLead.email && email) updates.email = email;
            if (!existingLead.name && name) updates.name = name;
            if (!existingLead.utmSource && mapped.utmSource) updates.utmSource = mapped.utmSource;
            if (!existingLead.utmMedium && mapped.utmMedium) updates.utmMedium = mapped.utmMedium;
            if (!existingLead.utmCampaign && mapped.utmCampaign) updates.utmCampaign = mapped.utmCampaign;
            if (!existingLead.notes && mapped.notes) updates.notes = mapped.notes;
            if (!existingLead.tags && (mapped.tags || defaultTags)) updates.tags = mapped.tags || defaultTags;
            if (Object.keys(updates).length > 0) {
              await storage.updateLead(existingLead.id, updates);
              updatedCount++;
            } else {
              duplicateCount++;
            }
            continue;
          } else if (duplicateStrategy === "overwrite") {
            const updates: Record<string, any> = {};
            if (name) updates.name = name;
            if (email) updates.email = email;
            if (mapped.utmSource) updates.utmSource = mapped.utmSource;
            if (mapped.utmMedium) updates.utmMedium = mapped.utmMedium;
            if (mapped.utmCampaign) updates.utmCampaign = mapped.utmCampaign;
            if (mapped.notes) updates.notes = mapped.notes;
            if (mapped.tags || defaultTags) updates.tags = mapped.tags || defaultTags;
            if (mapped.priority) updates.priority = mapped.priority;
            if (Object.keys(updates).length > 0) {
              await storage.updateLead(existingLead.id, updates);
              updatedCount++;
            } else {
              duplicateCount++;
            }
            continue;
          }
        }

        try {
          const assignedUser = await storage.getNextAssignableCrmUser(tid);
          const newLead = await storage.createLead({
            tenantId: tid,
            name: name || "Unknown",
            phoneE164: phone,
            email: email || undefined,
            status: defaultLeadStatus,
            tags: mapped.tags || defaultTags || undefined,
            utmSource: mapped.utmSource || undefined,
            utmMedium: mapped.utmMedium || undefined,
            utmCampaign: mapped.utmCampaign || undefined,
            utmTerm: mapped.utmTerm || undefined,
            utmContent: mapped.utmContent || undefined,
            notes: mapped.notes || mapped.callSummary || undefined,
            priority: mapped.priority || "Normal",
            assignedCrmUserId: assignedUser?.id,
            assignedTo: assignedUser?.name,
          });

          await storage.createActivity({
            leadId: newLead.id, tenantId: tid, createdBy: userId,
            type: "note",
            description: `Lead imported via CSV${assignedUser ? ` and auto-assigned to ${assignedUser.name}` : ""}`,
          });

          successCount++;
        } catch (err: any) {
          failureCount++;
          errors.push({ row: i + 2, message: err.message });
        }
      }

      const [importLog] = await db.insert(leadImportLogs).values({
        tenantId: tid,
        fileName: req.file.originalname,
        source: "csv",
        totalRows: rows.length,
        successCount,
        duplicateCount,
        updatedCount,
        failureCount,
        duplicateStrategy,
        status: failureCount === 0 ? "Completed" : "Completed with Issues",
        errorDetails: errors.length > 0 ? errors : null,
        columnMapping: columnMapping || null,
        importedBy: userId,
        completedAt: new Date(),
      }).returning();

      res.json({
        importLogId: importLog.id,
        totalRows: rows.length,
        successCount,
        duplicateCount,
        updatedCount,
        failureCount,
        errors: errors.slice(0, 50),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- Google Sheets Lead Extraction ---
  app.post("/api/google-sheets/headers", isAuthenticated, async (req, res) => {
    try {
      const { sheetUrl, apiKey } = req.body;
      if (!sheetUrl) return res.status(400).json({ message: "Sheet URL is required" });
      if (!apiKey) return res.status(400).json({ message: "Google API Key is required" });

      const spreadsheetId = extractSpreadsheetId(sheetUrl);
      if (!spreadsheetId) return res.status(400).json({ message: "Invalid Google Sheets URL. Please provide a valid URL like: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit" });

      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}&fields=properties.title,sheets.properties`;
      const metaResp = await fetch(metaUrl);
      if (!metaResp.ok) {
        const errData = await metaResp.json().catch(() => ({}));
        if (metaResp.status === 403) {
          return res.status(400).json({ message: "Access denied. Make sure the sheet is shared as 'Anyone with the link can view' and the API key is valid." });
        }
        if (metaResp.status === 404) {
          return res.status(400).json({ message: "Sheet not found. Please check the URL." });
        }
        return res.status(400).json({ message: errData?.error?.message || "Failed to access the sheet" });
      }
      const metaData = await metaResp.json();
      const sheetTitle = metaData?.properties?.title || "Unknown Sheet";
      const sheetsList = (metaData?.sheets || []).map((s: any) => ({
        title: s.properties?.title || "Sheet1",
        sheetId: s.properties?.sheetId,
      }));
      const sheets = sheetsList.map((s: any) => s.title);

      const gidMatch = sheetUrl.match(/[#&]gid=(\d+)/);
      let targetSheet = sheets[0] || "Sheet1";
      if (gidMatch) {
        const gid = Number(gidMatch[1]);
        const matched = sheetsList.find((s: any) => s.sheetId === gid);
        if (matched) targetSheet = matched.title;
      }

      const range = `'${targetSheet}'!1:1`;
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        return res.status(400).json({ message: "Failed to read headers from the sheet." });
      }

      const data = await response.json();
      const headers = data.values?.[0] || [];
      if (headers.length === 0) {
        return res.status(400).json({ message: "No headers found in the first row of the sheet." });
      }

      res.json({ headers, sheetTitle, sheets, spreadsheetId, selectedSheet: targetSheet });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/google-sheets/preview", isAuthenticated, async (req, res) => {
    try {
      const { spreadsheetId, apiKey, sheetName } = req.body;
      if (!spreadsheetId || !apiKey) return res.status(400).json({ message: "Missing required parameters" });

      const range = sheetName ? `'${sheetName}'!A1:Z10` : "Sheet1!A1:Z10";
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
      const response = await fetch(apiUrl);

      if (!response.ok) return res.status(400).json({ message: "Failed to preview sheet data" });

      const data = await response.json();
      const rows = data.values || [];
      res.json({ rows, totalPreview: rows.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/google-sheets/import", isAuthenticated, async (req, res) => {
    try {
      const { spreadsheetId, apiKey, sheetName, columnMapping, duplicateStrategy, defaultLeadStatus, defaultTags } = req.body;
      if (!spreadsheetId || !apiKey) return res.status(400).json({ message: "Missing required parameters" });
      if (!columnMapping || Object.keys(columnMapping).length === 0) return res.status(400).json({ message: "Column mapping is required" });

      const tid = await getDefaultTenantId(req);
      const userId = String((req as any).session?.crmUserId || "system");
      const dedupStrategy = duplicateStrategy || "skip";
      const leadStatus = defaultLeadStatus || "Raw Lead Captured";

      const range = sheetName ? `'${sheetName}'` : "Sheet1";
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
      const response = await fetch(apiUrl);

      if (!response.ok) return res.status(400).json({ message: "Failed to fetch sheet data" });

      const data = await response.json();
      const allRows = data.values || [];
      if (allRows.length < 2) return res.status(400).json({ message: "Sheet has no data rows (only headers or empty)" });

      const headers = allRows[0] as string[];
      const dataRows = allRows.slice(1);

      let successCount = 0;
      let failureCount = 0;
      let duplicateCount = 0;
      let updatedCount = 0;
      const errors: { row: number; message: string }[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const mapped: Record<string, string> = {};

        for (const [crmField, sheetCol] of Object.entries(columnMapping)) {
          if (sheetCol && typeof sheetCol === "string") {
            const colIndex = headers.indexOf(sheetCol);
            if (colIndex >= 0 && row[colIndex]) {
              mapped[crmField] = row[colIndex];
            }
          }
        }

        const name = toProperCase((mapped.name || "").trim());
        let phone = (mapped.phoneE164 || mapped.phone || mapped.phoneNumber || mapped.mobile || "").trim();
        const email = (mapped.email || "").trim();

        if (!name && !phone) {
          failureCount++;
          errors.push({ row: i + 2, message: "Missing required field: name or phone" });
          continue;
        }

        if (!phone) {
          failureCount++;
          errors.push({ row: i + 2, message: "Missing required field: phone number" });
          continue;
        }

        phone = normalizePhone(phone);

        const existingLead = await storage.findLeadByPhone(tid, phone);

        if (existingLead) {
          if (dedupStrategy === "skip") {
            duplicateCount++;
            continue;
          } else if (dedupStrategy === "update_blank") {
            const updates: Record<string, any> = {};
            if (!existingLead.email && email) updates.email = email;
            if (!existingLead.name && name) updates.name = name;
            if (!existingLead.utmSource && mapped.utmSource) updates.utmSource = mapped.utmSource;
            if (!existingLead.utmMedium && mapped.utmMedium) updates.utmMedium = mapped.utmMedium;
            if (!existingLead.utmCampaign && mapped.utmCampaign) updates.utmCampaign = mapped.utmCampaign;
            if (!existingLead.notes && mapped.notes) updates.notes = mapped.notes;
            if (!existingLead.tags && (mapped.tags || defaultTags)) updates.tags = mapped.tags || defaultTags;
            if (Object.keys(updates).length > 0) {
              await storage.updateLead(existingLead.id, updates);
              updatedCount++;
            } else {
              duplicateCount++;
            }
            continue;
          } else if (dedupStrategy === "overwrite") {
            const updates: Record<string, any> = {};
            if (name) updates.name = name;
            if (email) updates.email = email;
            if (mapped.utmSource) updates.utmSource = mapped.utmSource;
            if (mapped.utmMedium) updates.utmMedium = mapped.utmMedium;
            if (mapped.utmCampaign) updates.utmCampaign = mapped.utmCampaign;
            if (mapped.notes) updates.notes = mapped.notes;
            if (mapped.tags || defaultTags) updates.tags = mapped.tags || defaultTags;
            if (mapped.priority) updates.priority = mapped.priority;
            if (Object.keys(updates).length > 0) {
              await storage.updateLead(existingLead.id, updates);
              updatedCount++;
            } else {
              duplicateCount++;
            }
            continue;
          }
        }

        try {
          const assignedUser = await storage.getNextAssignableCrmUser(tid);
          await storage.createLead({
            tenantId: tid,
            name: name || "Unknown",
            phoneE164: phone,
            email: email || undefined,
            status: leadStatus,
            tags: mapped.tags || defaultTags || undefined,
            utmSource: mapped.utmSource || "Google Sheets",
            utmMedium: mapped.utmMedium || undefined,
            utmCampaign: mapped.utmCampaign || undefined,
            utmTerm: mapped.utmTerm || undefined,
            utmContent: mapped.utmContent || undefined,
            notes: mapped.notes || mapped.callSummary || undefined,
            priority: mapped.priority || "Normal",
            assignedCrmUserId: assignedUser?.id,
            assignedTo: assignedUser?.name,
          });

          successCount++;
        } catch (err: any) {
          failureCount++;
          errors.push({ row: i + 2, message: err.message });
        }
      }

      const [importLog] = await db.insert(leadImportLogs).values({
        tenantId: tid,
        fileName: `Google Sheet: ${sheetName || "Sheet1"}`,
        source: "google_sheets",
        totalRows: dataRows.length,
        successCount,
        duplicateCount,
        updatedCount,
        failureCount,
        duplicateStrategy: dedupStrategy,
        status: failureCount === 0 ? "Completed" : "Completed with Issues",
        errorDetails: errors.length > 0 ? errors : null,
        columnMapping: columnMapping || null,
        importedBy: userId,
        completedAt: new Date(),
      }).returning();

      res.json({
        importLogId: importLog.id,
        totalRows: dataRows.length,
        successCount,
        duplicateCount,
        updatedCount,
        failureCount,
        errors: errors.slice(0, 50),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  function extractSpreadsheetId(url: string): string | null {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }


  // --- Lead Capture Rules CRUD ---
  app.get("/api/lead-capture-rules", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const rules = await db.select().from(leadCaptureRules)
        .where(eq(leadCaptureRules.tenantId, tid))
        .orderBy(desc(leadCaptureRules.createdAt));
      res.json(rules);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/lead-capture-rules", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const body = { ...req.body, tenantId: tid, webhookToken: crypto.randomBytes(32).toString("hex") };
      const parsed = insertLeadCaptureRuleSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const [rule] = await db.insert(leadCaptureRules).values(parsed.data).returning();
      res.status(201).json(rule);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/lead-capture-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const id = Number(req.params.id);
      const [rule] = await db.update(leadCaptureRules)
        .set({ ...req.body, modifiedAt: new Date() })
        .where(and(eq(leadCaptureRules.id, id), eq(leadCaptureRules.tenantId, tid)))
        .returning();
      if (!rule) return res.status(404).json({ message: "Rule not found" });
      res.json(rule);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/lead-capture-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const id = Number(req.params.id);
      await db.delete(leadCaptureRules)
        .where(and(eq(leadCaptureRules.id, id), eq(leadCaptureRules.tenantId, tid)));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // --- Webhook Endpoint for Lead Capture ---
  app.post("/api/webhook/lead-capture/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const [rule] = await db.select().from(leadCaptureRules)
        .where(and(eq(leadCaptureRules.webhookToken, token), eq(leadCaptureRules.isActive, true)));

      if (!rule) {
        return res.status(404).json({ message: "Invalid or inactive webhook" });
      }

      const tid = rule.tenantId;
      const fieldMapping = (rule.fieldMapping || {}) as Record<string, string>;
      const payload = req.body;

      const mapped: Record<string, string> = {};
      for (const [crmField, sourceField] of Object.entries(fieldMapping)) {
        if (sourceField && payload[sourceField] !== undefined) {
          mapped[crmField] = String(payload[sourceField]);
        }
      }

      if (payload.name && !mapped.name) mapped.name = payload.name;
      if (payload.phone && !mapped.phoneE164) mapped.phoneE164 = payload.phone;
      if (payload.phoneE164 && !mapped.phoneE164) mapped.phoneE164 = payload.phoneE164;
      if (payload.email && !mapped.email) mapped.email = payload.email;

      const name = toProperCase((mapped.name || mapped.firstName || "").trim() + (mapped.lastName ? " " + mapped.lastName.trim() : ""));
      let phone = (mapped.phoneE164 || "").trim();

      if (!phone) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      phone = normalizePhone(phone);

      const existingLead = await storage.findLeadByPhone(tid, phone);

      if (existingLead) {
        const dupOption = rule.duplicateLeadOption || "skip";
        if (dupOption === "skip") {
          return res.json({ status: "duplicate_skipped", leadId: existingLead.id });
        } else if (dupOption === "update_blank") {
          const updates: Record<string, any> = {};
          if (!existingLead.email && mapped.email) updates.email = mapped.email;
          if (!existingLead.name && name) updates.name = name;
          if (!existingLead.utmSource && mapped.utmSource) updates.utmSource = mapped.utmSource;
          if (!existingLead.notes && mapped.notes) updates.notes = mapped.notes;
          if (Object.keys(updates).length > 0) {
            await storage.updateLead(existingLead.id, updates);
          }
          return res.json({ status: "duplicate_updated", leadId: existingLead.id });
        }
      }

      let assignedUser = null;
      const strategy = rule.assignmentStrategy || "round_robin";
      if (strategy === "round_robin") {
        assignedUser = await storage.getNextAssignableCrmUser(tid);
      } else if (strategy === "specific" && rule.assignToEmployeeIds) {
        const empIds = rule.assignToEmployeeIds as number[];
        if (empIds.length > 0) {
          const randomIdx = Math.floor(Math.random() * empIds.length);
          const users = await storage.getCrmUsers(tid);
          assignedUser = users.find(u => u.id === empIds[randomIdx]) || null;
        }
      }

      const newLead = await storage.createLead({
        tenantId: tid,
        name: name || "Unknown",
        phoneE164: phone,
        email: mapped.email || undefined,
        status: rule.defaultLeadStatus || "Raw Lead Captured",
        tags: mapped.tags || rule.defaultTags || undefined,
        utmSource: mapped.utmSource || undefined,
        utmMedium: mapped.utmMedium || undefined,
        utmCampaign: mapped.utmCampaign || undefined,
        notes: mapped.notes || mapped.callSummary || undefined,
        priority: mapped.priority || "Normal",
        assignedCrmUserId: assignedUser?.id,
        assignedTo: assignedUser?.name,
      });

      await storage.createActivity({
        leadId: newLead.id, tenantId: tid, createdBy: "webhook",
        type: "note",
        description: `Lead captured via ${rule.sourceType}${rule.name ? ` (${rule.name})` : ""}${assignedUser ? ` and auto-assigned to ${assignedUser.name}` : ""}`,
      });

      res.status(201).json({ status: "created", leadId: newLead.id });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- Callyzer Webhook (PUSH — Real-time Call Data) ---
  app.post("/api/webhook/callyzer/:connectorId", async (req, res) => {
    try {
      const connectorId = Number(req.params.connectorId);

      const [connector] = await db.select().from(platformConnectors)
        .where(and(
          eq(platformConnectors.id, connectorId),
          eq(platformConnectors.platform, "callyzer"),
          eq(platformConnectors.status, "connected")
        ));

      if (!connector) {
        return res.status(404).json({ message: "Callyzer connector not found or inactive" });
      }

      const creds = (connector.credentials || {}) as Record<string, any>;
      const incomingSecret = (
        req.headers["x-callyzer-secret"] ||
        req.headers["x-webhook-secret"] ||
        req.headers["x-api-key"] ||
        req.headers["authorization"]?.toString().replace(/^Bearer\s+/i, "") ||
        req.query.secret ||
        req.query.key ||
        req.query.token
      ) as string | undefined;

      const validSecrets = [creds.webhookSecret, creds.apiKey].filter(Boolean);
      if (validSecrets.length > 0 && (!incomingSecret || !validSecrets.includes(incomingSecret))) {
        console.log(`Callyzer webhook auth failed for connector ${connectorId}. Expected one of [${validSecrets.map(s => s?.substring(0, 8) + '...').join(', ')}], got: ${incomingSecret ? incomingSecret.substring(0, 8) + '...' : 'none'}. Headers: ${Object.keys(req.headers).filter(h => h.startsWith('x-')).join(', ')}`);
        return res.status(401).json({ message: "Invalid webhook secret" });
      }

      const tid = connector.tenantId;
      const payload = req.body;

      const flatCallEntries: Array<{ call: any; empNumber: string; empName: string }> = [];

      const rawEntries = Array.isArray(payload) ? payload : [payload];

      for (const entry of rawEntries) {
        if (entry.call_logs && Array.isArray(entry.call_logs)) {
          const empNumber = entry.emp_number || entry.empNumber || entry.emp_phone || "";
          const empName = entry.emp_name || entry.empName || "";
          for (const call of entry.call_logs) {
            flatCallEntries.push({ call, empNumber, empName });
          }
        } else if (entry.calls && Array.isArray(entry.calls)) {
          const empNumber = entry.emp_number || entry.empNumber || entry.emp_phone || "";
          const empName = entry.emp_name || entry.empName || "";
          for (const call of entry.calls) {
            flatCallEntries.push({ call, empNumber, empName });
          }
        } else {
          flatCallEntries.push({
            call: entry,
            empNumber: entry.emp_number || entry.employeeNumber || entry.employee_phone || "",
            empName: entry.emp_name || "",
          });
        }
      }

      const allCrmUsers = await storage.getCrmUsers(tid);

      const empCache = new Map<string, any>();
      const uniqueEmployees = new Map<string, { empNumber: string; empName: string; empCode: string; empCountryCode: string; empTags: any }>();
      for (const entry of rawEntries) {
        if (entry.emp_number) {
          uniqueEmployees.set(entry.emp_number, {
            empNumber: entry.emp_number,
            empName: entry.emp_name || "",
            empCode: entry.emp_code || "",
            empCountryCode: entry.emp_country_code || "91",
            empTags: entry.emp_tags || null,
          });
        }
      }

      for (const [empNum, emp] of uniqueEmployees) {
        const [existing] = await db.select().from(callyzerEmployees)
          .where(and(
            eq(callyzerEmployees.tenantId, tid),
            eq(callyzerEmployees.connectorId, connector.id),
            eq(callyzerEmployees.empNumber, empNum)
          )).limit(1);

        if (existing) {
          await db.update(callyzerEmployees)
            .set({
              empName: emp.empName || existing.empName,
              empCode: emp.empCode || existing.empCode,
              empCountryCode: emp.empCountryCode,
              empTags: emp.empTags || existing.empTags,
              modifiedAt: new Date(),
            })
            .where(eq(callyzerEmployees.id, existing.id));
          empCache.set(empNum, existing);
        } else {
          const [newEmp] = await db.insert(callyzerEmployees).values({
            tenantId: tid,
            connectorId: connector.id,
            empCode: emp.empCode || null,
            empName: emp.empName || "Unknown",
            empNumber: empNum,
            empCountryCode: emp.empCountryCode,
            empTags: emp.empTags,
          }).returning();
          empCache.set(empNum, newEmp);
        }
      }

      const results: any[] = [];

      for (const { call, empNumber, empName } of flatCallEntries) {
        const rawClientNumber = call.client_number || call.clientNumber || call.phone || call.mobile || "";
        const clientCountryCode = call.client_country_code || call.clientCountryCode || "91";
        let clientNumber = normalizePhoneNumber(rawClientNumber);
        if (clientNumber && !clientNumber.startsWith("+")) {
          clientNumber = `+${clientCountryCode}${clientNumber.replace(/^0+/, "")}`;
        }

        const callType = call.call_type || call.callType || call.type || "unknown";
        const duration = parseInt(call.duration || call.call_duration || call.callDuration || "0", 10);
        const notes = call.note || call.notes || call.remarks || call.description || "";
        const recordingUrl = call.call_recording_url || call.recording_url || call.recordingUrl || call.recording || "";
        const callDate = call.call_date || "";
        const callTime = call.call_time || call.callTime || call.timestamp || "";
        const callTimestamp = callDate && callTime ? `${callDate}T${callTime}` : new Date().toISOString();
        const callyzerCallId = call.id || null;

        if (callyzerCallId) {
          const [existingLog] = await db.select({ id: callyzerWebhookLogs.id }).from(callyzerWebhookLogs)
            .where(and(
              eq(callyzerWebhookLogs.tenantId, tid),
              sql`${callyzerWebhookLogs.rawPayload}->>'id' = ${callyzerCallId}`
            )).limit(1);
          if (existingLog) {
            results.push({ logId: existingLog.id, status: "duplicate", leadId: null, crmUserId: null });
            continue;
          }
        }

        const logEntry: any = {
          tenantId: tid,
          connectorId: connector.id,
          rawPayload: { ...call, _empNumber: empNumber, _empName: empName },
          clientNumber,
          employeeNumber: empNumber,
          callType,
          callDuration: duration,
          processingStatus: "processing",
        };

        let matchedLead = null;
        if (clientNumber) {
          matchedLead = await storage.findLeadByPhone(tid, clientNumber);
          if (!matchedLead) {
            const altFormats = getPhoneVariants(clientNumber);
            for (const alt of altFormats) {
              matchedLead = await storage.findLeadByPhone(tid, alt);
              if (matchedLead) break;
            }
          }
        }

        let matchedCrmUser = null;
        const callyzerEmp = empNumber ? empCache.get(empNumber) : null;

        if (callyzerEmp?.mappedCrmUserId) {
          matchedCrmUser = allCrmUsers.find(u => u.id === callyzerEmp.mappedCrmUserId);
        }
        if (!matchedCrmUser && empNumber) {
          const normalizedEmp = normalizePhoneNumber(empNumber);
          matchedCrmUser = allCrmUsers.find(u =>
            u.isActive && u.phone && normalizePhoneNumber(u.phone) === normalizedEmp
          );
        }

        logEntry.matchedLeadId = matchedLead?.id || null;
        logEntry.matchedCrmUserId = matchedCrmUser?.id || null;
        logEntry.matchedCallyzerEmployeeId = callyzerEmp?.id || null;

        if (callyzerEmp) {
          const callDir = callType.toLowerCase();
          const incr = {
            totalCalls: sql`${callyzerEmployees.totalCalls} + 1`,
            totalDurationSeconds: sql`${callyzerEmployees.totalDurationSeconds} + ${duration}`,
            lastCallAt: new Date(),
            modifiedAt: new Date(),
          } as any;
          if (callDir.includes("incoming")) incr.totalIncoming = sql`${callyzerEmployees.totalIncoming} + 1`;
          else if (callDir.includes("outgoing")) incr.totalOutgoing = sql`${callyzerEmployees.totalOutgoing} + 1`;
          if (callDir.includes("missed")) incr.totalMissed = sql`${callyzerEmployees.totalMissed} + 1`;
          await db.update(callyzerEmployees).set(incr).where(eq(callyzerEmployees.id, callyzerEmp.id));
        }

        if (matchedLead) {
          const callDirection = callType.toLowerCase().includes("incoming") ? "Incoming" :
            callType.toLowerCase().includes("outgoing") ? "Outgoing" :
            callType.toLowerCase().includes("missed") ? "Missed" : callType;

          const callStatus = callType.toLowerCase().includes("missed") ? "Missed" :
            duration > 0 ? "Connected" : "Not Connected";

          const descParts = [
            `${callDirection} call`,
            matchedCrmUser ? `by ${matchedCrmUser.name}` : (empName ? `by ${empName}` : ""),
            duration > 0 ? `(${formatCallDuration(duration)})` : "",
            callStatus === "Missed" ? "— Missed" : "",
          ].filter(Boolean).join(" ");

          const activity = await storage.createActivity({
            tenantId: tid,
            leadId: matchedLead.id,
            type: "call",
            description: descParts,
            outcome: callStatus,
            callDirection,
            callDurationSeconds: duration,
            callStatus,
            createdBy: matchedCrmUser?.name || empName || "callyzer-webhook",
            metadata: {
              source: "callyzer",
              callyzerCallId,
              recordingUrl,
              notes,
              empNumber,
              empName,
              clientName: call.client_name || "",
              callTimestamp,
              connectorId: connector.id,
            },
          });

          logEntry.activityId = activity.id;
          logEntry.processingStatus = "matched";
        } else if (clientNumber) {
          const hasRealName = call.client_name && call.client_name.trim() !== "" && call.client_name.trim().toLowerCase() !== "unknown";

          if (hasRealName) {
            const clientName = call.client_name.trim();

            let callyzerLeadSourceId = null;
            let [callyzerSource] = await db.select().from(leadSources)
              .where(and(
                eq(leadSources.tenantId, tid),
                sql`LOWER(${leadSources.name}) = 'callyzer'`
              )).limit(1);
            if (!callyzerSource) {
              const maxOrder = await db.select({ max: sql<number>`COALESCE(MAX(display_order), 0)` }).from(leadSources).where(eq(leadSources.tenantId, tid));
              [callyzerSource] = await db.insert(leadSources).values({
                tenantId: tid,
                code: "CALLYZER",
                name: "Callyzer",
                status: "Active",
                approvalStatus: "Approved",
                displayOrder: (maxOrder[0]?.max || 0) + 1,
              }).returning();
            }
            callyzerLeadSourceId = callyzerSource.id;

            const newLead = await storage.createLead({
              tenantId: tid,
              name: clientName,
              phoneE164: clientNumber,
              status: "Raw Lead Captured",
              leadSourceId: callyzerLeadSourceId,
              assignedCrmUserId: matchedCrmUser?.id || null,
              tags: "Callyzer",
              notes: notes || null,
            });

            matchedLead = newLead;
            logEntry.matchedLeadId = newLead.id;

            const callDirection = callType.toLowerCase().includes("incoming") ? "Incoming" :
              callType.toLowerCase().includes("outgoing") ? "Outgoing" :
              callType.toLowerCase().includes("missed") ? "Missed" : callType;
            const callStatus = callType.toLowerCase().includes("missed") ? "Missed" :
              duration > 0 ? "Connected" : "Not Connected";

            const descParts = [
              `${callDirection} call`,
              matchedCrmUser ? `by ${matchedCrmUser.name}` : (empName ? `by ${empName}` : ""),
              duration > 0 ? `(${formatCallDuration(duration)})` : "",
              callStatus === "Missed" ? "— Missed" : "",
            ].filter(Boolean).join(" ");

            const activity = await storage.createActivity({
              tenantId: tid,
              leadId: newLead.id,
              type: "call",
              description: descParts,
              outcome: callStatus,
              callDirection,
              callDurationSeconds: duration,
              callStatus,
              createdBy: matchedCrmUser?.name || empName || "callyzer-webhook",
              metadata: {
                source: "callyzer",
                callyzerCallId,
                recordingUrl,
                notes,
                empNumber,
                empName,
                clientName: call.client_name || "",
                callTimestamp,
                connectorId: connector.id,
                autoCreated: true,
              },
            });

            logEntry.activityId = activity.id;
            logEntry.processingStatus = "auto_created";
          } else {
            logEntry.processingStatus = "unmatched";
          }
        } else {
          logEntry.processingStatus = "skipped";
          logEntry.errorMessage = "No client phone number in payload";
        }

        const [savedLog] = await db.insert(callyzerWebhookLogs).values(logEntry).returning();
        results.push({
          logId: savedLog.id,
          status: logEntry.processingStatus,
          leadId: matchedLead?.id || null,
          crmUserId: matchedCrmUser?.id || null,
        });
      }

      await db.update(platformConnectors)
        .set({ lastSyncAt: new Date(), syncStatus: "synced" })
        .where(eq(platformConnectors.id, connector.id));

      res.status(200).json({
        status: "ok",
        processed: results.length,
        results,
      });
    } catch (err: any) {
      console.error("Callyzer webhook error:", err);
      res.status(500).json({ message: "Webhook processing error" });
    }
  });

  // --- Callyzer Webhook Logs (for admin view) ---
  app.get("/api/callyzer-webhook-logs", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const { from, to, callType, status, employeeNumber, limit: limitParam } = req.query as Record<string, string>;
      const conditions: any[] = [eq(callyzerWebhookLogs.tenantId, tid)];
      if (from) conditions.push(gte(callyzerWebhookLogs.createdAt, new Date(from)));
      if (to) conditions.push(lte(callyzerWebhookLogs.createdAt, new Date(to + "T23:59:59")));
      if (callType) conditions.push(eq(callyzerWebhookLogs.callType, callType));
      if (status) conditions.push(eq(callyzerWebhookLogs.processingStatus, status));
      if (employeeNumber) conditions.push(eq(callyzerWebhookLogs.employeeNumber, employeeNumber));

      const logs = await db.select().from(callyzerWebhookLogs)
        .where(and(...conditions))
        .orderBy(desc(callyzerWebhookLogs.createdAt))
        .limit(parseInt(limitParam || "500"));

      const crmUserIds = Array.from(new Set(logs.filter(l => l.matchedCrmUserId).map(l => l.matchedCrmUserId!)));
      const leadIds = Array.from(new Set(logs.filter(l => l.matchedLeadId).map(l => l.matchedLeadId!)));
      const allCrmUsers = await storage.getCrmUsers(tid);
      const crmUserMap: Record<number, string> = {};
      allCrmUsers.forEach(u => { crmUserMap[u.id] = u.name || "Unknown"; });

      const leadMap: Record<number, string> = {};
      if (leadIds.length > 0) {
        const allLeads = await db.select({ id: leads.id, name: leads.name }).from(leads).where(and(eq(leads.tenantId, tid), inArray(leads.id, leadIds)));
        allLeads.forEach(l => { leadMap[l.id] = l.name || "Unknown"; });
      }

      const enrichedLogs = logs.map(l => ({
        ...l,
        crmUserName: l.matchedCrmUserId ? (crmUserMap[l.matchedCrmUserId] || null) : null,
        leadName: l.matchedLeadId ? (leadMap[l.matchedLeadId] || null) : null,
      }));

      const totalCalls = logs.length;
      const incomingCalls = logs.filter(l => l.callType?.toLowerCase().includes("incoming")).length;
      const outgoingCalls = logs.filter(l => l.callType?.toLowerCase().includes("outgoing")).length;
      const missedCalls = logs.filter(l => l.callType?.toLowerCase().includes("missed")).length;
      const matchedCalls = logs.filter(l => l.processingStatus === "matched").length;
      const autoCreatedCalls = logs.filter(l => l.processingStatus === "auto_created").length;
      const unmatchedCalls = logs.filter(l => l.processingStatus === "unmatched").length;
      const totalDuration = logs.reduce((sum, l) => sum + (l.callDuration || 0), 0);
      const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

      const employeeStats: Record<string, { name: string; total: number; incoming: number; outgoing: number; missed: number; totalDuration: number; matched: number }> = {};
      logs.forEach(l => {
        const emp = l.employeeNumber || "Unknown";
        if (!employeeStats[emp]) {
          employeeStats[emp] = { name: l.matchedCrmUserId ? (crmUserMap[l.matchedCrmUserId] || emp) : emp, total: 0, incoming: 0, outgoing: 0, missed: 0, totalDuration: 0, matched: 0 };
        }
        employeeStats[emp].total++;
        if (l.callType?.toLowerCase().includes("incoming")) employeeStats[emp].incoming++;
        if (l.callType?.toLowerCase().includes("outgoing")) employeeStats[emp].outgoing++;
        if (l.callType?.toLowerCase().includes("missed")) employeeStats[emp].missed++;
        employeeStats[emp].totalDuration += (l.callDuration || 0);
        if (l.processingStatus === "matched") employeeStats[emp].matched++;
      });

      res.json({
        logs: enrichedLogs,
        summary: { totalCalls, incomingCalls, outgoingCalls, missedCalls, matchedCalls, autoCreatedCalls, unmatchedCalls, totalDuration, avgDuration },
        employeeStats: Object.values(employeeStats).sort((a, b) => b.total - a.total),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- Callyzer Employees CRUD ---
  app.get("/api/callyzer-employees", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const connectorIdParam = req.query.connectorId ? Number(req.query.connectorId) : undefined;
      const conditions = [eq(callyzerEmployees.tenantId, tid)];
      if (connectorIdParam) conditions.push(eq(callyzerEmployees.connectorId, connectorIdParam));
      const employees = await db.select().from(callyzerEmployees)
        .where(and(...conditions))
        .orderBy(desc(callyzerEmployees.totalCalls));

      const allCrmUsers = await storage.getCrmUsers(tid);
      const crmUserMap: Record<number, { id: number; name: string; phone: string | null }> = {};
      allCrmUsers.forEach(u => { crmUserMap[u.id] = { id: u.id, name: u.name, phone: u.phone }; });

      const enriched = employees.map(e => ({
        ...e,
        mappedCrmUser: e.mappedCrmUserId ? (crmUserMap[e.mappedCrmUserId] || null) : null,
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/callyzer-employees/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const tid = await getDefaultTenantId(req);
      if (!(await requireAdminRole(req, res, tid))) return;
      const empId = Number(req.params.id);

      const patchSchema = z.object({
        mappedCrmUserId: z.number().nullable().optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const { mappedCrmUserId, isActive } = parsed.data;

      const [existing] = await db.select().from(callyzerEmployees)
        .where(and(eq(callyzerEmployees.id, empId), eq(callyzerEmployees.tenantId, tid)));

      if (!existing) return res.status(404).json({ message: "Callyzer employee not found" });

      if (mappedCrmUserId) {
        const crmUser = await storage.getCrmUser(mappedCrmUserId, tid);
        if (!crmUser) return res.status(400).json({ message: "CRM user not found" });
      }

      const updates: any = { modifiedAt: new Date() };
      if (mappedCrmUserId !== undefined) updates.mappedCrmUserId = mappedCrmUserId;
      if (isActive !== undefined) updates.isActive = isActive;

      const [updated] = await db.update(callyzerEmployees)
        .set(updates)
        .where(eq(callyzerEmployees.id, empId))
        .returning();

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- Generate Callyzer Webhook Secret ---
  app.post("/api/connectors/:id/generate-webhook-secret", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
      const tid = await getDefaultTenantId(req);
      const c = await storage.getPlatformConnector(Number(req.params.id), tid);
      if (!c) return res.status(404).json({ message: "Connector not found" });
      if (c.platform !== "callyzer") return res.status(400).json({ message: "Not a Callyzer connector" });

      const webhookSecret = crypto.randomBytes(24).toString("hex");
      const creds = (c.credentials || {}) as Record<string, any>;
      await storage.updatePlatformConnector(c.id, tid, {
        credentials: { ...creds, webhookSecret },
      });

      res.json({ webhookSecret });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- CRM Users list (for assignment dropdown) ---
  app.get("/api/crm-users/active", isAuthenticated, async (req, res) => {
    const tid = await getDefaultTenantId(req);
    const users = await storage.getCrmUsers(tid);
    res.json(users.filter(u => u.isActive && u.code !== "SUPERADMIN"));
  });

  // Helper: get the default tenant ID
  async function getDefaultTenantId(req?: any): Promise<number> {
    if (req?.session?.tenantId) return req.session.tenantId;
    const [t] = await db.select({ id: tenants.id }).from(tenants).limit(1);
    return t?.id ?? 1;
  }

  // --- Generic Master CRUD ---
  app.get(api.masters.categories.path, isAuthenticated, async (_req, res) => {
    res.json(MASTER_CATEGORIES);
  });

  app.get(api.masters.list.path, isAuthenticated, async (req, res) => {
    const tableName = req.params.tableName as string;
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }
    try {
      const tid = await getDefaultTenantId(req);
      const records = await storage.getMasterRecords(tableName, tid);
      res.json(records);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // --- CSV Export (Download) --- must be before /:tableName/:id to avoid conflict
  app.get("/api/masters/:tableName/export", isAuthenticated, async (req, res) => {
    const tableName = req.params.tableName as string;
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }
    try {
      const tid = await getDefaultTenantId(req);
      const records = await storage.getMasterRecords(tableName, tid);
      const csvData = stringify(records.map(r => ({
        code: r.code,
        name: r.name,
        status: r.status,
        displayOrder: r.displayOrder ?? 0,
      })), { header: true, columns: ["code", "name", "status", "displayOrder"] });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${tableName}_export.csv"`);
      res.send(csvData);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/masters/:tableName/template", isAuthenticated, async (req, res) => {
    const tableName = req.params.tableName as string;
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }
    const csvData = stringify([
      { code: "SAMPLE_CODE", name: "Sample Name", status: "Active", displayOrder: 1 },
    ], { header: true, columns: ["code", "name", "status", "displayOrder"] });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${tableName}_template.csv"`);
    res.send(csvData);
  });

  app.get("/api/masters/:tableName/import-logs", isAuthenticated, async (req, res) => {
    const tableName = req.params.tableName as string;
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }
    try {
      const tid = await getDefaultTenantId(req);
      const logs = await db.select().from(bulkImportLogs)
        .where(and(eq(bulkImportLogs.tableName, tableName), eq(bulkImportLogs.tenantId, tid)))
        .orderBy(desc(bulkImportLogs.startedAt))
        .limit(20);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/masters/:tableName/import", isAuthenticated, upload.single("file"), async (req, res) => {
    const tableName = req.params.tableName as string;
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const tenantId = await getDefaultTenantId(req);
    const fileName = req.file.originalname;

    try {
      const csvContent = req.file.buffer.toString("utf-8");
      const rows = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];

      const existingRecords = await storage.getMasterRecords(tableName, tenantId);
      const existingCodes = new Set(existingRecords.map(r => r.code?.toUpperCase()));

      let successCount = 0;
      let failureCount = 0;
      let duplicateCount = 0;
      const errors: { row: number; message: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const code = (row.code || "").trim();
        const name = (row.name || "").trim();
        const status = (row.status || "Active").trim();
        const displayOrder = parseInt(row.displayOrder || "0") || 0;

        if (!code || !name) {
          failureCount++;
          errors.push({ row: i + 2, message: "Missing required field: code or name" });
          continue;
        }

        if (existingCodes.has(code.toUpperCase())) {
          duplicateCount++;
          errors.push({ row: i + 2, message: `Duplicate code: ${code}` });
          continue;
        }

        try {
          await storage.createMasterRecord(tableName, {
            tenantId,
            code,
            name,
            status,
            displayOrder,
          });
          existingCodes.add(code.toUpperCase());
          successCount++;
        } catch (err: any) {
          failureCount++;
          errors.push({ row: i + 2, message: err.message });
        }
      }

      const [importLog] = await db.insert(bulkImportLogs).values({
        tenantId,
        tableName,
        fileName,
        totalRows: rows.length,
        successCount,
        failureCount,
        duplicateCount,
        status: failureCount === 0 && duplicateCount === 0 ? "Completed" : "Completed with Issues",
        errorDetails: errors.length > 0 ? errors : null,
        completedAt: new Date(),
      }).returning();

      res.json({
        importLogId: importLog.id,
        totalRows: rows.length,
        successCount,
        failureCount,
        duplicateCount,
        errors: errors.slice(0, 20),
      });
    } catch (err: any) {
      res.status(400).json({ message: `CSV parse error: ${err.message}` });
    }
  });

  app.get(api.masters.get.path, isAuthenticated, async (req, res) => {
    const tableName = req.params.tableName as string;
    const id = req.params.id as string;
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }
    const tid = await getDefaultTenantId(req);
    const record = await storage.getMasterRecord(tableName, Number(id), tid);
    if (!record) return res.status(404).json({ message: "Record not found" });
    res.json(record);
  });

  app.post(api.masters.create.path, isAuthenticated, async (req, res) => {
    const tableName = req.params.tableName as string;
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }
    try {
      const tid = await getDefaultTenantId(req);
      const body = coerceDateFields(req.body, ["leaveDate", "leaveEndDate", "holidayDate", "startDate", "endDate"]);
      const record = await storage.createMasterRecord(tableName, { ...body, tenantId: tid, approvalStatus: "Pending" });
      res.status(201).json(record);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch(api.masters.update.path, isAuthenticated, async (req, res) => {
    const tableName = req.params.tableName as string;
    const id = req.params.id as string;
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }
    try {
      const tid = await getDefaultTenantId(req);
      const body = coerceDateFields(req.body, ["leaveDate", "leaveEndDate", "holidayDate", "startDate", "endDate"]);
      const record = await storage.updateMasterRecord(tableName, Number(id), body, tid);
      res.json(record);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete(api.masters.delete.path, isAuthenticated, async (req, res) => {
    const tableName = req.params.tableName as string;
    const id = req.params.id as string;
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }
    try {
      const tid = await getDefaultTenantId(req);
      await storage.deleteMasterRecord(tableName, Number(id), tid);
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/masters/:tableName/:id/approve", isAuthenticated, async (req, res) => {
    const tableName = req.params.tableName as string;
    const id = Number(req.params.id);
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }
    try {
      const tid = await getDefaultTenantId(req);
      if (!(await requireAdminRole(req, res, tid))) return;
      const record = await storage.updateMasterRecord(tableName, id, { approvalStatus: "Approved" }, tid);
      res.json(record);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/masters/:tableName/:id/reject", isAuthenticated, async (req, res) => {
    const tableName = req.params.tableName as string;
    const id = Number(req.params.id);
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }
    try {
      const tid = await getDefaultTenantId(req);
      if (!(await requireAdminRole(req, res, tid))) return;
      const record = await storage.updateMasterRecord(tableName, id, { approvalStatus: "Rejected" }, tid);
      res.json(record);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/masters/pending-approvals", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const allPending: any[] = [];
      for (const [tableKey, pgTable] of Object.entries(MASTER_TABLE_REGISTRY)) {
        try {
          const result = await pool.query(
            `SELECT * FROM "${pgTable}" WHERE tenant_id = $1 AND approval_status = 'Pending' ORDER BY created_at DESC`,
            [tid]
          );
          result.rows.forEach((row: any) => {
            allPending.push({
              ...storage.mapRowToMaster(row),
              _tableName: tableKey,
              _tableLabel: tableKey.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase()),
            });
          });
        } catch {}
      }
      res.json(allPending);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // =============================================
  // CRM USER MANAGEMENT ROUTES
  // =============================================
  app.get("/api/crm-users", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const users = await storage.getCrmUsers(tid);
      res.json(users.filter(u => u.code !== "SUPERADMIN"));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/crm-users/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const user = await storage.getCrmUser(Number(req.params.id), tid);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  async function requireAdminRole(req: any, res: any, tenantId: number): Promise<boolean> {
    const sessionCrmUserId = req.session?.crmUserId;
    if (!sessionCrmUserId) { res.status(403).json({ message: "Not a CRM user" }); return false; }
    const allCrmUsers = await storage.getCrmUsers(tenantId);
    const currentUser = allCrmUsers.find((u: any) => u.id === sessionCrmUserId);
    if (!currentUser) { res.status(403).json({ message: "Not a CRM user" }); return false; }
    if (currentUser.systemRoleId) {
      const allRoles = await storage.getMasterRecords("systemRoles", tenantId);
      const role = allRoles.find(r => r.id === currentUser.systemRoleId);
      if (role && ((role as any).code === "SYS_ADMIN" || (role as any).code === "ADMIN")) return true;
    }
    res.status(403).json({ message: "Admin access required" });
    return false;
  }

  app.post("/api/crm-users", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      if (!(await requireAdminRole(req, res, tid))) return;
      const { password, confirmPassword, ...rest } = req.body;
      const body = coerceDateFields(rest, ["joiningDate", "resetTokenExpiry"]);

      if (!body.phone || !body.phone.trim()) {
        return res.status(400).json({ message: "Mobile number is required (used as login username)" });
      }
      const normalizedPhone = body.phone.trim().replace(/\s+/g, "");
      body.phone = normalizedPhone;

      const existingUsers = await storage.getCrmUsers(tid);
      const phoneDuplicate = existingUsers.find((u: any) => u.phone === normalizedPhone);
      if (phoneDuplicate) {
        return res.status(400).json({ message: "A user with this mobile number already exists" });
      }

      if (!password || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      if (confirmPassword && password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }

      const { hashPassword } = await import("./replit_integrations/auth/replitAuth");
      const passwordHash = await hashPassword(password);

      const lastUser = await pool.query(
        `SELECT code FROM crm_users WHERE tenant_id = $1 AND code LIKE 'USR_%' ORDER BY code DESC LIMIT 1`,
        [tid]
      );
      let userSeq = 1;
      if (lastUser.rows.length > 0) {
        const lastNum = parseInt(lastUser.rows[0].code.split("_").pop() || "0", 10);
        if (!isNaN(lastNum)) userSeq = lastNum + 1;
      }
      const userDigits = Math.max(3, String(userSeq).length);
      body.code = `USR_${String(userSeq).padStart(userDigits, "0")}`;

      const parsed = insertCrmUserSchema.parse({ ...body, tenantId: tid, passwordHash });
      const user = await storage.createCrmUser(parsed);
      const { passwordHash: _, ...safeUser } = user as any;
      res.status(201).json(safeUser);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/crm-users/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      if (!(await requireAdminRole(req, res, tid))) return;
      const body = coerceDateFields(req.body, ["joiningDate", "resetTokenExpiry"]);
      const parsed = insertCrmUserSchema.partial().parse(body);
      const user = await storage.updateCrmUser(Number(req.params.id), tid, parsed);
      res.json(user);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/crm-users/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      if (!(await requireAdminRole(req, res, tid))) return;
      const userId = Number(req.params.id);
      await db.update(leads).set({ assignedCrmUserId: null }).where(and(eq(leads.tenantId, tid), eq(leads.assignedCrmUserId, userId)));
      await db.update(leads).set({ handoverFromUserId: null }).where(and(eq(leads.tenantId, tid), eq(leads.handoverFromUserId, userId)));
      await db.update(leads).set({ handoverToUserId: null }).where(and(eq(leads.tenantId, tid), eq(leads.handoverToUserId, userId)));
      await db.update(episodes).set({ assignedCrmUserId: null }).where(and(eq(episodes.tenantId, tid), eq(episodes.assignedCrmUserId, userId)));
      await db.update(tasks).set({ assignedCrmUserId: null }).where(and(eq(tasks.tenantId, tid), eq(tasks.assignedCrmUserId, userId)));
      await db.update(callyzerWebhookLogs).set({ matchedCrmUserId: null }).where(and(eq(callyzerWebhookLogs.tenantId, tid), eq(callyzerWebhookLogs.matchedCrmUserId, userId)));
      await storage.deleteCrmUser(userId, tid);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/crm-users/:id/team", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const directReports = await storage.getCrmUserDirectReports(Number(req.params.id), tid);
      res.json(directReports);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // =============================================
  // PATIENT MANAGEMENT ROUTES
  // =============================================
  app.get("/api/patients", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const result = await storage.getPatients(tid);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/patients/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const patient = await storage.getPatient(Number(req.params.id), tid);
      if (!patient) return res.status(404).json({ message: "Patient not found" });
      res.json(patient);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/patients", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const body = coerceDateFields(req.body, ["dateOfBirth"]);
      const parsed = insertPatientSchema.parse({ ...body, tenantId: tid });
      const patient = await storage.createPatient(parsed);
      res.status(201).json(patient);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/patients/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const body = coerceDateFields(req.body, ["dateOfBirth"]);
      const parsed = insertPatientSchema.partial().parse(body);
      const patient = await storage.updatePatient(Number(req.params.id), tid, parsed);
      res.json(patient);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/patients/:id/contacts", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const result = await storage.getContactsForPatient(Number(req.params.id), tid);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/contacts", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const parsed = insertContactSchema.parse({ ...req.body, tenantId: tid });
      const contact = await storage.createContact(parsed);
      res.status(201).json(contact);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const parsed = insertContactSchema.partial().parse(req.body);
      const contact = await storage.updateContact(Number(req.params.id), tid, parsed);
      res.json(contact);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      await storage.deleteContact(Number(req.params.id), tid);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/patient-contact-links", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const parsed = insertPatientContactLinkSchema.parse({ ...req.body, tenantId: tid });
      const link = await storage.linkPatientContact(parsed);
      res.status(201).json(link);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/patient-contact-links/:patientId/:contactId", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      await storage.unlinkPatientContact(Number(req.params.patientId), Number(req.params.contactId), tid);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // =============================================
  // DOCTOR / AVAILABILITY ROUTES
  // =============================================
  app.get("/api/doctors-list", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const result = await storage.getDoctors(tid);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/doctors/:id/availability", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const doctorId = Number(req.params.id);
      const date = req.query.date as string;
      if (!date) return res.status(400).json({ message: "date query parameter required (YYYY-MM-DD)" });

      const dayOfWeek = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });

      const leaves = await storage.getDoctorLeaveExceptions(doctorId, tid, date);
      if (leaves.length > 0) {
        return res.json({ available: false, reason: "Doctor on leave", slots: [] });
      }

      const timings = await storage.getDoctorOpdTimings(doctorId, tid);
      const dayTimings = timings.filter((t: any) => t.dayOfWeek === dayOfWeek);
      if (dayTimings.length === 0) {
        return res.json({ available: false, reason: "No OPD on this day", slots: [] });
      }

      const existingAppts = await storage.getAppointmentsForDoctorOnDate(doctorId, tid, date);

      const slots: Array<{ startTime: string; endTime: string; maxPatients: number; booked: number; availableCount: number }> = [];
      for (const timing of dayTimings) {
        const booked = existingAppts.filter((a: any) => a.startTime === timing.startTime).length;
        const maxP = timing.maxPatients || 20;
        slots.push({
          startTime: timing.startTime,
          endTime: timing.endTime,
          maxPatients: maxP,
          booked,
          availableCount: Math.max(0, maxP - booked),
        });
      }

      res.json({ available: true, dayOfWeek, slots });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // =============================================
  // DOCTOR AVAILABILITY / LEAVE CALENDAR
  // =============================================
  app.get("/api/doctor-leaves", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const doctorId = req.query.doctorId ? Number(req.query.doctorId) : undefined;
      const results = await db
        .select({
          id: doctorLeaveExceptions.id,
          doctorId: doctorLeaveExceptions.doctorId,
          doctorName: doctors.name,
          leaveDate: doctorLeaveExceptions.leaveDate,
          leaveEndDate: doctorLeaveExceptions.leaveEndDate,
          reason: doctorLeaveExceptions.reason,
          status: doctorLeaveExceptions.status,
        })
        .from(doctorLeaveExceptions)
        .innerJoin(doctors, eq(doctorLeaveExceptions.doctorId, doctors.id))
        .where(
          doctorId
            ? and(eq(doctorLeaveExceptions.tenantId, tid), eq(doctorLeaveExceptions.doctorId, doctorId), eq(doctorLeaveExceptions.status, "Active"))
            : and(eq(doctorLeaveExceptions.tenantId, tid), eq(doctorLeaveExceptions.status, "Active"))
        )
        .orderBy(doctorLeaveExceptions.leaveDate);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // =============================================
  // APPOINTMENT ROUTES
  // =============================================
  app.get("/api/appointments", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const filters: Record<string, any> = {};
      if (req.query.leadId) filters.leadId = Number(req.query.leadId);
      if (req.query.patientId) filters.patientId = Number(req.query.patientId);
      if (req.query.doctorId) filters.doctorId = Number(req.query.doctorId);
      if (req.query.branchId) filters.branchId = Number(req.query.branchId);
      if (req.query.status) filters.status = req.query.status;
      if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom;
      if (req.query.dateTo) filters.dateTo = req.query.dateTo;
      const result = await storage.getAppointments(tid, filters);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/appointments-enriched", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const filters: Record<string, any> = {};
      if (req.query.leadId) filters.leadId = Number(req.query.leadId);
      if (req.query.patientId) filters.patientId = Number(req.query.patientId);
      if (req.query.doctorId) filters.doctorId = Number(req.query.doctorId);
      if (req.query.branchId) filters.branchId = Number(req.query.branchId);
      if (req.query.status) filters.status = req.query.status;
      if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom;
      if (req.query.dateTo) filters.dateTo = req.query.dateTo;
      const result = await storage.getAppointmentsEnriched(tid, filters);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/appointments/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const appt = await storage.getAppointment(Number(req.params.id), tid);
      if (!appt) return res.status(404).json({ message: "Appointment not found" });
      res.json(appt);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/appointments", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const userId = String((req as any).session?.crmUserId || "system");
      const body = coerceDateFields({ ...req.body, tenantId: tid, createdBy: userId, bookedBy: userId }, ["appointmentDate"]);
      const parsed = insertAppointmentSchema.parse(body);

      if (!parsed.branchId) {
        const allBranches = await db.select().from(branches)
          .where(and(eq(branches.tenantId, tid), eq(branches.status, "Active")))
          .limit(1);
        if (allBranches.length > 0) {
          (parsed as any).branchId = allBranches[0].id;
        }
      }

      const dateStr = new Date(parsed.appointmentDate).toISOString().split("T")[0];

      if (parsed.startTime) {
        const existingAppts = await storage.getAppointmentsForDoctorOnDate(parsed.doctorId, tid, dateStr);
        const conflict = existingAppts.find((a: any) => a.startTime === parsed.startTime && a.id !== undefined);
        const timings = await storage.getDoctorOpdTimings(parsed.doctorId, tid);
        const dayOfWeek = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
        const slotTiming = timings.find((t: any) => t.dayOfWeek === dayOfWeek && t.startTime === parsed.startTime);
        const maxP = slotTiming?.maxPatients || 20;
        const bookedCount = existingAppts.filter((a: any) => a.startTime === parsed.startTime).length;
        if (bookedCount >= maxP) {
          return res.status(409).json({ message: `Slot ${parsed.startTime} is fully booked (${bookedCount}/${maxP})` });
        }
      }

      const tokenNumber = await storage.getNextTokenNumber(parsed.doctorId, tid, dateStr);

      const appt = await storage.createAppointment({ ...parsed, tokenNumber });

      if (parsed.leadId) {
        const doctor = parsed.doctorId ? await db.select().from(doctors).where(and(eq(doctors.id, parsed.doctorId), eq(doctors.tenantId, tid))).then(r => r[0]) : null;
        const rawName = doctor?.name || "Doctor";
        const doctorName = rawName.replace(/^Dr\.?\s*/i, "");
        const dateStr2 = parsed.appointmentDate ? new Date(parsed.appointmentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
        const timeStr = parsed.startTime || "";

        await storage.updateLead(parsed.leadId, { status: "Appointment Booked" });

        await storage.createActivity({
          leadId: parsed.leadId, tenantId: tid, createdBy: userId,
          type: "appointment",
          description: `Appointment booked with Dr. ${doctorName} on ${dateStr2}${timeStr ? ` at ${timeStr}` : ""} - Token #${tokenNumber}`,
          newStatus: "Appointment Booked",
        });

        // Send WhatsApp confirmation (non-blocking)
        (async () => {
          try {
            const allSettings = await storage.getTenantSettings(tid);
            const { getWhatsAppConfigFromSettings, sendWhatsAppTemplate, sendWhatsAppText, formatPhoneForWhatsApp } = await import("./whatsapp");
            const waConfig = getWhatsAppConfigFromSettings(allSettings);
            if (!waConfig.enabled) return;

            const lead = await storage.getLead(parsed.leadId!);
            if (!lead?.phoneE164) return;

            const waPhone = formatPhoneForWhatsApp(lead.phoneE164);
            const confirmMsg = `Hello ${lead.name || ""},\n\nYour appointment has been confirmed at VIROC Hospital.\n\nDoctor: Dr. ${doctorName}\nDate: ${dateStr2}\nTime: ${timeStr}\nToken: #${tokenNumber}\n\nPlease arrive 15 minutes before your scheduled time.\n\nThank you,\nVIROC Hospital`;

            if (waConfig.templateName && waConfig.templateName !== "none") {
              await sendWhatsAppTemplate(waConfig, {
                to: waPhone,
                templateName: waConfig.templateName,
                components: [{
                  type: "body",
                  parameters: [
                    { type: "text", text: lead.name || "Patient" },
                    { type: "text", text: `Dr. ${doctorName}` },
                    { type: "text", text: dateStr2 },
                    { type: "text", text: timeStr },
                    { type: "text", text: String(tokenNumber) },
                  ],
                }],
              });
            } else {
              await sendWhatsAppText(waConfig, waPhone, confirmMsg);
            }

            await storage.createActivity({
              leadId: parsed.leadId!, tenantId: tid, createdBy: "system",
              type: "whatsapp",
              description: `WhatsApp appointment confirmation sent to ${lead.phoneE164}`,
            });
          } catch (waErr: any) {
            console.error("[WhatsApp] Failed to send appointment confirmation:", waErr.message);
          }
        })();
      }

      res.status(201).json(appt);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/appointments/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const parsed = insertAppointmentSchema.partial().parse(req.body);
      const appt = await storage.updateAppointment(Number(req.params.id), tid, parsed);
      res.json(appt);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/appointments/:id/consultation-done", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const userId = String((req as any).session?.crmUserId || "system");
      const apptId = Number(req.params.id);
      const { consultationNotes } = req.body as { consultationNotes?: string };

      const appt = await storage.getAppointment(apptId, tid);
      if (!appt) return res.status(404).json({ message: "Appointment not found" });

      const updated = await storage.updateAppointment(apptId, tid, {
        status: "Consultation Done",
        consultationNotes: consultationNotes || null,
        consultationDoneAt: new Date(),
        consultationDoneBy: userId,
      });

      if (appt.leadId) {
        const lead = await storage.getLead(appt.leadId);
        await storage.updateLead(appt.leadId, { status: "Consultation Done" });
        await storage.createActivity({
          leadId: appt.leadId, tenantId: tid, createdBy: userId,
          type: "status_change",
          description: `Consultation completed${consultationNotes ? `: ${consultationNotes}` : ""}`,
          oldStatus: "Appointment Booked",
          newStatus: "Consultation Done",
        });

        if (lead && !lead.patientId) {
          const nameParts = lead.name.split(" ");
          const fn = nameParts[0] || "Patient";
          const ln = nameParts.slice(1).join(" ") || "";
          const [patient] = await db.insert(patients).values({
            tenantId: tid,
            firstName: fn,
            lastName: ln,
            primaryPhone: lead.phoneE164,
            email: lead.email,
            uhid: `UHID-AUTO-${lead.id}`,
            status: "Active",
          }).returning();
          await storage.updateLead(appt.leadId, { patientId: patient.id });
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/appointments/:id/cancel", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const userId = String((req as any).session?.crmUserId || "system");
      const apptId = Number(req.params.id);
      const { cancelReason } = req.body as { cancelReason?: string };

      const appt = await storage.getAppointment(apptId, tid);
      if (!appt) return res.status(404).json({ message: "Appointment not found" });

      const updated = await storage.updateAppointment(apptId, tid, {
        status: "Cancelled",
        cancelReason: cancelReason || null,
      });

      if (appt.leadId) {
        await storage.createActivity({
          leadId: appt.leadId, tenantId: tid, createdBy: userId,
          type: "status_change",
          description: `Appointment cancelled${cancelReason ? `: ${cancelReason}` : ""}`,
        });
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/appointments/:id/reschedule", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const userId = String((req as any).session?.crmUserId || "system");
      const apptId = Number(req.params.id);
      const { appointmentDate, startTime, endTime } = req.body as { appointmentDate: string; startTime?: string; endTime?: string };

      if (!appointmentDate) return res.status(400).json({ message: "appointmentDate required" });

      const appt = await storage.getAppointment(apptId, tid);
      if (!appt) return res.status(404).json({ message: "Appointment not found" });

      const dateStr = new Date(appointmentDate).toISOString().split("T")[0];

      if (startTime) {
        const existingAppts = await storage.getAppointmentsForDoctorOnDate(appt.doctorId, tid, dateStr);
        const timings = await storage.getDoctorOpdTimings(appt.doctorId, tid);
        const dayOfWeek = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
        const slotTiming = timings.find((t: any) => t.dayOfWeek === dayOfWeek && t.startTime === startTime);
        const maxP = slotTiming?.maxPatients || 20;
        const bookedCount = existingAppts.filter((a: any) => a.startTime === startTime && a.id !== apptId).length;
        if (bookedCount >= maxP) {
          return res.status(409).json({ message: `Slot ${startTime} is fully booked` });
        }
      }

      const newToken = await storage.getNextTokenNumber(appt.doctorId, tid, dateStr);

      const updated = await storage.updateAppointment(apptId, tid, {
        appointmentDate: new Date(appointmentDate),
        startTime: startTime || appt.startTime,
        endTime: endTime || appt.endTime,
        tokenNumber: newToken,
        rescheduleCount: (appt.rescheduleCount || 0) + 1,
        status: "Rescheduled",
      });

      if (appt.leadId) {
        await storage.createActivity({
          leadId: appt.leadId, tenantId: tid, createdBy: userId,
          type: "appointment",
          description: `Appointment rescheduled to ${dateStr} - Token #${newToken}`,
        });
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/appointments/:id/no-show", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const userId = String((req as any).session?.crmUserId || "system");
      const apptId = Number(req.params.id);
      const { noShowReasonId } = req.body as { noShowReasonId?: number };

      const appt = await storage.getAppointment(apptId, tid);
      if (!appt) return res.status(404).json({ message: "Appointment not found" });

      const updated = await storage.updateAppointment(apptId, tid, {
        status: "No Show",
        noShowReasonId: noShowReasonId || null,
      });

      if (appt.leadId) {
        await storage.createActivity({
          leadId: appt.leadId, tenantId: tid, createdBy: userId,
          type: "status_change",
          description: `Patient did not show for appointment`,
        });
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // =============================================
  // CAMPAIGN ROUTES
  // =============================================
  app.get("/api/campaigns", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const result = await storage.getCampaigns(tid);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/campaigns/next-ad-number", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const { platform, objective, year, month } = req.query;
      const allCampaigns = await storage.getCampaigns(tid);
      const matching = allCampaigns.filter((c: any) =>
        c.platform === platform && c.objective === objective && c.year === year && c.month === month
      );
      const maxNum = matching.reduce((max: number, c: any) => {
        const m = c.adNumber?.match(/Ad(\d+)/);
        return m ? Math.max(max, parseInt(m[1])) : max;
      }, 0);
      res.json({ nextAdNumber: `Ad${maxNum + 1}` });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/campaigns/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const c = await storage.getCampaign(Number(req.params.id), tid);
      if (!c) return res.status(404).json({ message: "Campaign not found" });
      res.json(c);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/campaigns", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const body = coerceDateFields(req.body, ["startDate", "endDate"]);
      const parsed = insertCampaignSchema.parse({ ...body, tenantId: tid });
      const c = await storage.createCampaign(parsed);
      res.status(201).json(c);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/campaigns/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const body = coerceDateFields(req.body, ["startDate", "endDate"]);
      const parsed = insertCampaignSchema.partial().parse(body);
      const c = await storage.updateCampaign(Number(req.params.id), tid, parsed);
      res.json(c);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // =============================================
  // PLATFORM CONNECTOR ROUTES
  // =============================================
  async function requireAdminOrManager(req: any, res: any): Promise<boolean> {
    const crmUserId = req.session?.crmUserId;
    if (!crmUserId) { res.status(401).json({ message: "Unauthorized" }); return false; }
    const tid = await getDefaultTenantId(req);
    const allCrmUsers = await storage.getCrmUsers(tid);
    const crmUser = allCrmUsers.find((u: any) => u.id === crmUserId);
    if (!crmUser) { res.status(403).json({ message: "Not a CRM user" }); return false; }
    if (crmUser.systemRoleId) {
      const allRoles = await storage.getMasterRecords("systemRoles", tid);
      const role = allRoles.find(r => r.id === crmUser.systemRoleId);
      if (role && ((role as any).code === "SYS_ADMIN" || (role as any).code === "ADMIN" || (role as any).code === "MANAGER")) return true;
    }
    res.status(403).json({ message: "Admin or Manager access required" });
    return false;
  }

  async function requireSysAdmin(req: any, res: any): Promise<boolean> {
    const crmUserId = req.session?.crmUserId;
    if (!crmUserId) { res.status(401).json({ message: "Unauthorized" }); return false; }
    const tid = await getDefaultTenantId(req);
    const allCrmUsers = await storage.getCrmUsers(tid);
    const crmUser = allCrmUsers.find((u: any) => u.id === crmUserId);
    if (!crmUser) { res.status(403).json({ message: "Not a CRM user" }); return false; }
    if (crmUser.systemRoleId) {
      const allRoles = await storage.getMasterRecords("systemRoles", tid);
      const role = allRoles.find(r => r.id === crmUser.systemRoleId);
      if (role && (role as any).code === "SYS_ADMIN") return true;
    }
    res.status(403).json({ message: "System Admin access required" });
    return false;
  }

  app.get("/api/connectors", isAuthenticated, async (req: any, res: any) => {
    if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
    try {
      const tid = await getDefaultTenantId(req);
      const connectors = await storage.getPlatformConnectors(tid);
      res.json(connectors);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/connectors/:id", isAuthenticated, async (req: any, res: any) => {
    if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
    try {
      const tid = await getDefaultTenantId(req);
      const c = await storage.getPlatformConnector(Number(req.params.id), tid);
      if (!c) return res.status(404).json({ message: "Connector not found" });
      res.json(c);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/connectors", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
      const tid = await getDefaultTenantId(req);
      const parsed = insertPlatformConnectorSchema.parse({ ...req.body, tenantId: tid });
      const c = await storage.createPlatformConnector(parsed);
      res.json(c);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/connectors/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
      const tid = await getDefaultTenantId(req);
      const { tenantId: _, ...safeBody } = req.body;
      const parsed = insertPlatformConnectorSchema.partial().parse(safeBody);
      if (parsed.credentials) {
        const existing = await storage.getPlatformConnector(Number(req.params.id), tid);
        if (existing) {
          const existingCreds = (existing.credentials as Record<string, any>) || {};
          parsed.credentials = { ...existingCreds, ...parsed.credentials };
        }
      }
      const c = await storage.updatePlatformConnector(Number(req.params.id), tid, parsed);
      res.json(c);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/connectors/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
      const tid = await getDefaultTenantId(req);
      await storage.deletePlatformConnector(Number(req.params.id), tid);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/connectors/:id/test", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
      const tid = await getDefaultTenantId(req);
      const c = await storage.getPlatformConnector(Number(req.params.id), tid);
      if (!c) return res.status(404).json({ message: "Connector not found" });

      await storage.updatePlatformConnector(c.id, tid, { syncStatus: "testing" });

      if (c.platform === "meta") {
        try {
          const { testMetaConnection, fetchAccountInsights } = await import("./services/metaAds");
          const testResult = await testMetaConnection();
          if (testResult.success) {
            const insights = await fetchAccountInsights("last_30d");
            const metricsCache = insights ? {
              impressions: insights.impressions,
              clicks: insights.clicks,
              spend: insights.spend,
              ctr: insights.ctr,
              cpc: insights.cpc,
              conversions: insights.conversions,
              reach: insights.reach,
            } : null;
            await storage.updatePlatformConnector(c.id, tid, {
              status: "connected",
              syncStatus: "synced",
              lastSyncAt: new Date(),
              ...(metricsCache ? { metricsCache, metricsCachedAt: new Date() } : {}),
            });
            res.json({ message: `Connected to Meta Ads (${testResult.accountName})`, accountName: testResult.accountName });
          } else {
            await storage.updatePlatformConnector(c.id, tid, { status: "error", syncStatus: null });
            res.status(400).json({ message: `Meta connection failed: ${testResult.error}` });
          }
        } catch (e: any) {
          await storage.updatePlatformConnector(c.id, tid, { status: "error", syncStatus: null });
          res.status(400).json({ message: `Meta connection failed: ${e.message}` });
        }
      } else {
        await storage.updatePlatformConnector(c.id, tid, {
          status: "connected",
          syncStatus: "synced",
          lastSyncAt: new Date(),
        });
        res.json({ message: "Connection test initiated" });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/connectors/:id/sync", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
      const tid = await getDefaultTenantId(req);
      const c = await storage.getPlatformConnector(Number(req.params.id), tid);
      if (!c) return res.status(404).json({ message: "Connector not found" });
      if (c.status !== "connected") return res.status(400).json({ message: "Connector not connected" });

      await storage.updatePlatformConnector(c.id, tid, { syncStatus: "syncing" });

      if (c.platform === "meta") {
        try {
          const { fetchAccountInsights } = await import("./services/metaAds");
          const insights = await fetchAccountInsights("last_30d");
          const metricsCache = insights ? {
            impressions: insights.impressions,
            clicks: insights.clicks,
            spend: insights.spend,
            ctr: insights.ctr,
            cpc: insights.cpc,
            conversions: insights.conversions,
            reach: insights.reach,
          } : null;
          await storage.updatePlatformConnector(c.id, tid, {
            syncStatus: "synced",
            lastSyncAt: new Date(),
            ...(metricsCache ? { metricsCache, metricsCachedAt: new Date() } : {}),
          });
          res.json({ message: "Meta insights synced successfully", metrics: metricsCache });
        } catch (e: any) {
          await storage.updatePlatformConnector(c.id, tid, { syncStatus: "error" });
          res.status(400).json({ message: `Meta sync failed: ${e.message}` });
        }
      } else {
        await storage.updatePlatformConnector(c.id, tid, {
          syncStatus: "synced",
          lastSyncAt: new Date(),
        });
        res.json({ message: "Sync completed" });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/connectors/meta/insights", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
      const datePreset = (req.query.datePreset as string) || "last_30d";
      const { fetchAccountInsights } = await import("./services/metaAds");
      const insights = await fetchAccountInsights(datePreset);
      res.json(insights || {});
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/connectors/meta/campaigns", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
      const datePreset = (req.query.datePreset as string) || "last_30d";
      const { fetchCampaignInsights } = await import("./services/metaAds");
      const campaigns = await fetchCampaignInsights(datePreset);
      res.json(campaigns);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/connectors/meta/daily-insights", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
      const days = parseInt(req.query.days as string) || 7;
      const { fetchDailyInsights } = await import("./services/metaAds");
      const daily = await fetchDailyInsights(days);
      res.json(daily);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // =============================================
  // EPISODE ROUTES
  // =============================================
  app.get("/api/episodes", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const leadId = req.query.leadId ? Number(req.query.leadId) : undefined;
      const result = await storage.getEpisodes(tid, leadId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/episodes/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const ep = await storage.getEpisode(Number(req.params.id), tid);
      if (!ep) return res.status(404).json({ message: "Episode not found" });
      res.json(ep);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/episodes", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const body = coerceDateFields(req.body, ["startDate", "endDate", "nextActionDate", "slaDeadline"]);

      let lead = body.leadId ? await storage.getLead(body.leadId) : null;

      if (!lead && body.patientId) {
        const leadRows = await pool.query(
          "SELECT id FROM leads WHERE patient_id = $1 AND tenant_id = $2 ORDER BY id DESC LIMIT 1",
          [body.patientId, tid]
        );
        if (leadRows.rows.length > 0) {
          lead = await storage.getLead(leadRows.rows[0].id);
          body.leadId = leadRows.rows[0].id;
        }
      }

      if (!lead) return res.status(400).json({ message: "No lead found for this patient. The patient must be linked to a lead." });

      let patientName = lead.name;
      if (body.patientId) {
        const patientRows = await pool.query(
          "SELECT first_name, last_name FROM patients WHERE id = $1",
          [body.patientId]
        );
        if (patientRows.rows.length > 0) {
          const p = patientRows.rows[0];
          patientName = `${p.first_name || ""} ${p.last_name || ""}`.trim() || lead.name;
        }
      }

      let treatmentDeptName = "General";
      if (body.treatmentDepartmentId) {
        const deptRows = await pool.query("SELECT name FROM treatment_departments WHERE id = $1", [body.treatmentDepartmentId]);
        if (deptRows.rows.length > 0) treatmentDeptName = deptRows.rows[0].name;
      }

      const patientId = body.patientId || lead.patientId;
      const existingCount = patientId
        ? await storage.getEpisodeCountForPatient(patientId, treatmentDeptName)
        : await storage.getEpisodeCountForLead(lead.id, treatmentDeptName);
      const episodeName = existingCount > 0
        ? `${patientName}_${treatmentDeptName}_${existingCount + 1}`
        : `${patientName}_${treatmentDeptName}`;

      const parsed = insertEpisodeSchema.parse({
        ...body,
        tenantId: tid,
        episodeName,
        startDate: body.startDate || new Date(),
        assignedCrmUserId: body.assignedCrmUserId || lead.assignedCrmUserId,
        branchId: body.branchId || lead.branchId,
        priority: body.priority || lead.priority || "Normal",
      });
      const ep = await storage.createEpisode(parsed);

      const userName = (req as any).user?.firstName && (req as any).user?.lastName
        ? `${(req as any).user.firstName} ${(req as any).user.lastName}`
        : (req as any).user?.email || "System";
      await storage.createAuditLog({
        tenantId: tid,
        entityType: "episode",
        entityId: ep.id,
        action: "created",
        oldValues: null,
        newValues: { status: ep.status, episodeName: ep.episodeName, patientId: ep.patientId },
        changedFields: "status,episodeName",
        performedBy: userName,
      });

      res.status(201).json(ep);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/episodes/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const episodeId = Number(req.params.id);
      const oldEpisode = await storage.getEpisode(episodeId, tid);
      const body = coerceDateFields(req.body, ["startDate", "endDate", "nextActionDate", "slaDeadline"]);
      const terminalStatuses = ["Completed", "Discontinued"];
      if (body.status && terminalStatuses.includes(body.status) && !body.endDate) {
        body.endDate = new Date();
      }
      const parsed = insertEpisodeSchema.partial().parse(body);
      const ep = await storage.updateEpisode(episodeId, tid, parsed);

      if (oldEpisode && body.status && body.status !== oldEpisode.status) {
        const changedFields: string[] = ["status"];
        if (body.endDate) changedFields.push("endDate");
        const userName = (req as any).user?.firstName && (req as any).user?.lastName
          ? `${(req as any).user.firstName} ${(req as any).user.lastName}`
          : (req as any).user?.email || "System";
        await storage.createAuditLog({
          tenantId: tid,
          entityType: "episode",
          entityId: episodeId,
          action: "status_change",
          oldValues: { status: oldEpisode.status },
          newValues: { status: body.status },
          changedFields: changedFields.join(","),
          performedBy: userName,
        });
      }

      res.json(ep);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // =============================================
  // AUDIT LOG ROUTES
  // =============================================
  app.get("/api/audit-logs", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const entityType = req.query.entityType as string | undefined;
      const entityId = req.query.entityId ? Number(req.query.entityId) : undefined;
      const result = await storage.getAuditLogs(tid, entityType, entityId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/audit-logs", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const parsed = insertAuditLogSchema.parse({ ...req.body, tenantId: tid });
      const log = await storage.createAuditLog(parsed);
      res.status(201).json(log);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // =============================================
  // CUSTOM FIELD SUGGESTIONS (for "Other" options)
  // =============================================

  app.get("/api/field-suggestions", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const status = req.query.status as string | undefined;
      const fieldName = req.query.fieldName as string | undefined;
      let query = db.select().from(customFieldSuggestions).where(eq(customFieldSuggestions.tenantId, tid));
      if (status) {
        query = db.select().from(customFieldSuggestions).where(and(eq(customFieldSuggestions.tenantId, tid), eq(customFieldSuggestions.status, status)));
      }
      if (fieldName) {
        query = db.select().from(customFieldSuggestions).where(and(eq(customFieldSuggestions.tenantId, tid), eq(customFieldSuggestions.fieldName, fieldName)));
      }
      if (status && fieldName) {
        query = db.select().from(customFieldSuggestions).where(and(eq(customFieldSuggestions.tenantId, tid), eq(customFieldSuggestions.status, status), eq(customFieldSuggestions.fieldName, fieldName)));
      }
      const results = await query.orderBy(desc(customFieldSuggestions.createdAt));
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/field-suggestions", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const value = req.body.suggestedValue?.trim();
      if (!value) return res.status(400).json({ message: "Suggested value cannot be empty" });

      const existing = await db.select().from(customFieldSuggestions).where(
        and(
          eq(customFieldSuggestions.tenantId, tid),
          eq(customFieldSuggestions.fieldName, req.body.fieldName || ""),
          eq(customFieldSuggestions.suggestedValue, value),
          eq(customFieldSuggestions.status, "Pending")
        )
      );
      if (existing.length > 0) return res.status(200).json(existing[0]);

      const crmUserId = (req as any).session?.crmUserId;
      const suggestedBy = crmUserId ? String(crmUserId) : "unknown";
      const parsed = insertCustomFieldSuggestionSchema.parse({ ...req.body, tenantId: tid, suggestedValue: value, suggestedBy });
      const [result] = await db.insert(customFieldSuggestions).values(parsed).returning();
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/field-suggestions/:id", isAuthenticated, async (req, res) => {
    try {
      const crmUserId = (req as any).session?.crmUserId;
      if (!crmUserId) return res.status(401).json({ message: "Unauthorized" });
      const tid = await getDefaultTenantId(req);
      const allCrmUsers = await storage.getCrmUsers(tid);
      const crmUser = allCrmUsers.find((u: any) => u.id === crmUserId);
      if (!crmUser) return res.status(403).json({ message: "Not a CRM user" });
      if (crmUser.systemRoleId) {
        const allRoles = await storage.getMasterRecords("systemRoles", tid);
        const role = allRoles.find(r => r.id === crmUser.systemRoleId);
        if (!role || !["ADMIN", "SYS_ADMIN"].includes((role as any).code)) {
          return res.status(403).json({ message: "Admin access required to review suggestions" });
        }
      } else {
        return res.status(403).json({ message: "Admin access required to review suggestions" });
      }

      const id = Number(req.params.id);
      const { status, reviewNotes } = req.body;
      const reviewedBy = String(crmUserId);
      const [result] = await db.update(customFieldSuggestions)
        .set({ status, reviewNotes, reviewedBy, reviewedAt: new Date() })
        .where(eq(customFieldSuggestions.id, id))
        .returning();
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // =============================================
  // TESTING INTERFACE ROUTES (Admin only)
  // =============================================

  async function requireTestingAccess(req: any, res: any): Promise<boolean> {
    const crmUserId = req.session?.crmUserId;
    if (!crmUserId) { res.status(401).json({ message: "Unauthorized" }); return false; }
    const tid = await getDefaultTenantId(req);
    const allCrmUsers = await storage.getCrmUsers(tid);
    const crmUser = allCrmUsers.find((u: any) => u.id === crmUserId);
    if (!crmUser) { res.status(403).json({ message: "Not a CRM user" }); return false; }
    if (crmUser.systemRoleId) {
      const allRoles = await storage.getMasterRecords("systemRoles", tid);
      const role = allRoles.find(r => r.id === crmUser.systemRoleId);
      if (role && ((role as any).code === "ADMIN" || (role as any).code === "SYS_ADMIN")) return true;
    }
    res.status(403).json({ message: "Admin access required for testing interface" });
    return false;
  }

  app.get("/api/testing/stats", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const allLeads = await storage.getLeads(tid);
      const allPatients = await storage.getPatients(tid);
      const allCrmUsers = await storage.getCrmUsers(tid);
      const allAppointments = await storage.getAppointments(tid);
      const allTasks = await storage.getTasks(tid);
      const allActivities: any[] = [];
      for (const lead of allLeads.slice(0, 50)) {
        const acts = await storage.getActivities(lead.id);
        allActivities.push(...acts);
      }

      const statusCounts: Record<string, number> = {};
      allLeads.forEach(l => {
        statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
      });

      const priorityCounts: Record<string, number> = {};
      allLeads.forEach(l => {
        const p = l.priority || "Normal";
        priorityCounts[p] = (priorityCounts[p] || 0) + 1;
      });

      const assignmentCounts: Record<string, number> = {};
      allLeads.forEach(l => {
        if (l.assignedCrmUserId) {
          const user = allCrmUsers.find(u => u.id === l.assignedCrmUserId);
          const name = user?.name || `User ${l.assignedCrmUserId}`;
          assignmentCounts[name] = (assignmentCounts[name] || 0) + 1;
        } else {
          assignmentCounts["Unassigned"] = (assignmentCounts["Unassigned"] || 0) + 1;
        }
      });

      res.json({
        counts: {
          leads: allLeads.length,
          patients: allPatients.length,
          appointments: allAppointments.length,
          tasks: allTasks.length,
          activities: allActivities.length,
          crmUsers: allCrmUsers.length,
        },
        leadsByStatus: statusCounts,
        leadsByPriority: priorityCounts,
        leadsByAssignment: assignmentCounts,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/testing/crm-users", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const allCrmUsers = await storage.getCrmUsers(tid);
      const allRoles = await storage.getMasterRecords("systemRoles", tid);

      const enriched = allCrmUsers.map(u => {
        const role = allRoles.find(r => r.id === u.systemRoleId);
        return {
          ...u,
          roleName: role?.name || null,
          roleCode: (role as any)?.code || null,
        };
      });
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/testing/switch-role", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);

      const { targetCrmUserId } = req.body;
      if (!targetCrmUserId) return res.status(400).json({ message: "targetCrmUserId is required" });

      const targetUser = await storage.getCrmUser(targetCrmUserId, tid);
      if (!targetUser) return res.status(404).json({ message: "CRM user not found" });

      req.session.crmUserId = targetUser.id;
      req.session.tenantId = targetUser.tenantId;
      const updated = targetUser;

      const allRoles = await storage.getMasterRecords("systemRoles", tid);
      const role = allRoles.find(r => r.id === updated.systemRoleId);

      res.json({
        status: "active",
        crmUser: {
          ...updated,
          roleName: role?.name || null,
          roleCode: (role as any)?.code || null,
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/testing/seed-sample-data", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await requireTestingAccess(req, res))) return;
      const tid = await getDefaultTenantId(req);

      const allCrmUsers = await storage.getCrmUsers(tid);
      const allDoctors = await storage.getMasterRecords("doctors", tid);
      const allBranches = await storage.getMasterRecords("branches", tid);
      const allLeadStatuses = await storage.getMasterRecords("leadStatuses", tid);

      const firstNames = ["Rajesh", "Sunita", "Amit", "Kavita", "Deepak", "Neha", "Suresh", "Priyanka", "Rohan", "Anita", "Vikram", "Geeta", "Manish", "Sarita", "Arun"];
      const lastNames = ["Patel", "Shah", "Mehta", "Joshi", "Desai", "Kumar", "Sharma", "Singh", "Parmar", "Trivedi", "Rathod", "Soni", "Rao", "Chauhan", "Bhatt"];
      const treatments = ["Knee Replacement", "Hip Replacement", "Spine Surgery", "Shoulder Surgery", "Fracture Treatment", "ACL Repair", "Sports Injury", "Arthroscopy"];
      const sources = ["Facebook", "Google Ads", "Instagram", "Walk-in", "Referral", "Phone Call", "Website", "WhatsApp"];
      const statuses = ["Raw Lead Captured", "Contacted", "Appointment Booked", "Consultation Done", "Follow-Up", "Converted"];
      const priorities = ["High", "Normal", "Low", "Urgent"];
      const phoneBase = "+9198";

      const { type = "all", count = 10 } = req.body;
      const created: Record<string, number> = { leads: 0, patients: 0, appointments: 0, tasks: 0, activities: 0 };
      const limitedCount = Math.min(count, 50);

      if (type === "all" || type === "leads") {
        for (let i = 0; i < limitedCount; i++) {
          const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
          const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
          const phone = phoneBase + String(Math.floor(10000000 + Math.random() * 89999999));
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          const priority = priorities[Math.floor(Math.random() * priorities.length)];
          const assignedUser = allCrmUsers.length > 0 ? allCrmUsers[Math.floor(Math.random() * allCrmUsers.length)] : null;
          const doctor = allDoctors.length > 0 ? allDoctors[Math.floor(Math.random() * allDoctors.length)] : null;
          const branch = allBranches.length > 0 ? allBranches[0] : null;

          await storage.createLead({
            tenantId: tid,
            name: `${fn} ${ln}`,
            phoneE164: phone,
            email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@gmail.com`,
            status,
            priority,
            assignedCrmUserId: assignedUser?.id || undefined,
            doctorId: doctor?.id || undefined,
            branchId: branch?.id || undefined,
            utmSource: sources[Math.floor(Math.random() * sources.length)],
            notes: `Interested in ${treatments[Math.floor(Math.random() * treatments.length)]}`,
            leadScore: Math.floor(Math.random() * 100),
          });
          created.leads++;
        }
      }

      if (type === "all" || type === "patients") {
        const allLeadsForPatients = await storage.getLeads(tid);
        const leadsWithoutPatient = allLeadsForPatients.filter(l => !l.patientId);
        const bloodGroups = ["A+", "B+", "O+", "AB+", "A-", "B-"];

        for (let i = 0; i < Math.min(leadsWithoutPatient.length, limitedCount, 10); i++) {
          const lead = leadsWithoutPatient[i];
          const nameParts = lead.name.split(" ");
          const fn = nameParts[0] || "Patient";
          const ln = nameParts.slice(1).join(" ") || "";

          const patient = await storage.createPatient({
            tenantId: tid,
            firstName: fn,
            lastName: ln,
            primaryPhone: lead.phoneE164,
            email: lead.email || `${fn.toLowerCase()}.${(ln || "user").toLowerCase()}${i}@gmail.com`,
            gender: i % 2 === 0 ? "Male" : "Female",
            bloodGroup: bloodGroups[Math.floor(Math.random() * bloodGroups.length)],
            uhid: `UHID-${String(Date.now()).slice(-5)}-${i + 1}`,
            status: "Active",
          });

          await storage.updateLead(lead.id, { patientId: patient.id });
          created.patients++;
        }

        if (leadsWithoutPatient.length === 0) {
          for (let i = 0; i < Math.min(limitedCount, 5); i++) {
            const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
            const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
            const phone = phoneBase + String(Math.floor(10000000 + Math.random() * 89999999));

            await storage.createPatient({
              tenantId: tid,
              firstName: fn,
              lastName: ln,
              primaryPhone: phone,
              email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@gmail.com`,
              gender: i % 2 === 0 ? "Male" : "Female",
              bloodGroup: bloodGroups[Math.floor(Math.random() * bloodGroups.length)],
              uhid: `UHID-${String(Date.now()).slice(-5)}-${i + 1}`,
              status: "Active",
            });
            created.patients++;
          }
        }
      }

      if (type === "all" || type === "appointments") {
        const allLeads = await storage.getLeads(tid);
        if (allLeads.length > 0 && allDoctors.length > 0) {
          for (let i = 0; i < Math.min(limitedCount, 10); i++) {
            const lead = allLeads[Math.floor(Math.random() * allLeads.length)];
            const doctor = allDoctors[Math.floor(Math.random() * allDoctors.length)];
            const branch = allBranches.length > 0 ? allBranches[0] : null;
            const daysAhead = Math.floor(Math.random() * 14) + 1;
            const apptDate = new Date();
            apptDate.setDate(apptDate.getDate() + daysAhead);
            const hours = 9 + Math.floor(Math.random() * 8);
            const startTime = `${String(hours).padStart(2, "0")}:00`;
            const endTime = `${String(hours + 1).padStart(2, "0")}:00`;
            const statuses = ["Scheduled", "Confirmed", "Completed", "No Show"];

            await storage.createAppointment({
              tenantId: tid,
              leadId: lead.id,
              doctorId: doctor.id,
              branchId: branch?.id || undefined,
              appointmentDate: apptDate,
              startTime,
              endTime,
              status: statuses[Math.floor(Math.random() * statuses.length)],
              notes: `Consultation for ${treatments[Math.floor(Math.random() * treatments.length)]}`,
              bookedBy: String(req.session?.crmUserId || "system"),
            });
            created.appointments++;
          }
        }
      }

      if (type === "all" || type === "tasks") {
        const allLeads = await storage.getLeads(tid);
        if (allLeads.length > 0) {
          const taskTitles = ["Follow up call", "Send treatment info", "Schedule appointment", "Insurance verification", "Pre-op assessment", "Cost estimate", "Doctor consultation", "MRI review"];
          for (let i = 0; i < Math.min(limitedCount, 10); i++) {
            const lead = allLeads[Math.floor(Math.random() * allLeads.length)];
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 7) + 1);
            const assignedUser = allCrmUsers.length > 0 ? allCrmUsers[Math.floor(Math.random() * allCrmUsers.length)] : null;

            await storage.createTask({
              tenantId: tid,
              leadId: lead.id,
              title: taskTitles[Math.floor(Math.random() * taskTitles.length)],
              description: `Task for lead ${lead.name}`,
              priority: priorities[Math.floor(Math.random() * priorities.length)],
              dueDate,
              assignedCrmUserId: assignedUser?.id || undefined,
              status: "Pending",
              createdBy: String(req.session?.crmUserId || "system"),
            });
            created.tasks++;
          }
        }
      }

      res.json({ message: "Sample data created", created });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/testing/clear-data", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await requireTestingAccess(req, res))) return;
      const tid = await getDefaultTenantId(req);
      const { type } = req.body;

      if (type === "leads" || type === "all") {
        await db.delete(activities).where(eq(activities.tenantId, tid));
        await db.delete(tasks).where(eq(tasks.tenantId, tid));
        await db.delete(appointments).where(eq(appointments.tenantId, tid));
        await db.delete(leads).where(eq(leads.tenantId, tid));
      }
      if (type === "patients" || type === "all") {
        await db.delete(patientContactLinks).where(eq(patientContactLinks.tenantId, tid));
        await db.delete(contacts).where(eq(contacts.tenantId, tid));
        await db.delete(patients).where(eq(patients.tenantId, tid));
      }
      if (type === "appointments" || type === "all") {
        await db.delete(appointments).where(eq(appointments.tenantId, tid));
      }

      res.json({ message: `Cleared ${type} data` });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // =============================================
  // WHATSAPP SETTINGS ROUTES (SYS_ADMIN only)
  // =============================================
  const WA_SETTING_KEYS = ["wa_phone_number_id", "wa_access_token", "wa_business_account_id", "wa_enabled", "wa_template_appointment", "wa_test_phone"];

  app.get("/api/whatsapp-settings", isAuthenticated, async (req: any, res: any) => {
    if (!(await requireSysAdmin(req, res))) return;
    try {
      const tid = await getDefaultTenantId(req);
      const allSettings = await storage.getTenantSettings(tid);
      const waSettings: Record<string, string | null> = {};
      for (const key of WA_SETTING_KEYS) {
        const found = allSettings.find(s => s.settingKey === key);
        if (key === "wa_access_token" && found?.settingValue) {
          waSettings[key] = "••••••••";
        } else {
          waSettings[key] = found?.settingValue ?? null;
        }
      }
      res.json(waSettings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/whatsapp-settings", isAuthenticated, async (req: any, res: any) => {
    if (!(await requireSysAdmin(req, res))) return;
    try {
      const tid = await getDefaultTenantId(req);
      const body = req.body as Record<string, string | null>;
      if (body.wa_enabled === "true") {
        if (!body.wa_phone_number_id && !body.wa_access_token) {
          return res.status(400).json({ message: "Phone Number ID and Access Token are required when enabling WhatsApp" });
        }
      }
      for (const key of WA_SETTING_KEYS) {
        if (key in body) {
          if (key === "wa_access_token" && body[key] === "••••••••") continue;
          await storage.setTenantSetting(tid, key, body[key] ?? null);
        }
      }
      res.json({ success: true, message: "WhatsApp settings saved" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/whatsapp-settings/test", isAuthenticated, async (req: any, res: any) => {
    if (!(await requireSysAdmin(req, res))) return;
    try {
      const tid = await getDefaultTenantId(req);
      const allSettings = await storage.getTenantSettings(tid);
      const { testWhatsAppConnection, getWhatsAppConfigFromSettings } = await import("./whatsapp");
      const config = getWhatsAppConfigFromSettings(allSettings);
      const result = await testWhatsAppConnection(config);
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(400).json({ message: result.message });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/whatsapp-settings/send-test", isAuthenticated, async (req: any, res: any) => {
    if (!(await requireSysAdmin(req, res))) return;
    try {
      const tid = await getDefaultTenantId(req);
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ message: "Phone number is required" });
      const allSettings = await storage.getTenantSettings(tid);
      const { getWhatsAppConfigFromSettings, sendWhatsAppText, formatPhoneForWhatsApp } = await import("./whatsapp");
      const config = getWhatsAppConfigFromSettings(allSettings);
      if (!config.enabled) return res.status(400).json({ message: "WhatsApp is not enabled" });
      const result = await sendWhatsAppText(config, formatPhoneForWhatsApp(phone), "Hello from VIROC Hospital CRM! This is a test message to confirm your WhatsApp integration is working.");
      if (result.success) {
        res.json({ success: true, message: `Test message sent successfully! Message ID: ${result.messageId}` });
      } else {
        res.status(400).json({ message: `Failed to send: ${result.error}` });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // =============================================
  // EMAIL SETTINGS ROUTES (SYS_ADMIN only)
  // =============================================
  const EMAIL_SETTING_KEYS = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from_email", "smtp_from_name", "smtp_secure"];

  app.get("/api/email-settings", isAuthenticated, async (req: any, res: any) => {
    if (!(await requireSysAdmin(req, res))) return;
    try {
      const tid = await getDefaultTenantId(req);
      const allSettings = await storage.getTenantSettings(tid);
      const emailSettings: Record<string, string | null> = {};
      for (const key of EMAIL_SETTING_KEYS) {
        const found = allSettings.find(s => s.settingKey === key);
        if (key === "smtp_pass" && found?.settingValue) {
          emailSettings[key] = "••••••••";
        } else {
          emailSettings[key] = found?.settingValue ?? null;
        }
      }
      res.json(emailSettings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/email-settings", isAuthenticated, async (req: any, res: any) => {
    if (!(await requireSysAdmin(req, res))) return;
    try {
      const tid = await getDefaultTenantId(req);
      const body = req.body as Record<string, string | null>;
      for (const key of EMAIL_SETTING_KEYS) {
        if (key in body) {
          if (key === "smtp_pass" && body[key] === "••••••••") continue;
          await storage.setTenantSetting(tid, key, body[key] ?? null);
        }
      }
      res.json({ success: true, message: "Email settings saved" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/email-settings/test", isAuthenticated, async (req: any, res: any) => {
    if (!(await requireSysAdmin(req, res))) return;
    try {
      const tid = await getDefaultTenantId(req);
      const allSettings = await storage.getTenantSettings(tid);
      const smtpHost = allSettings.find(s => s.settingKey === "smtp_host")?.settingValue;
      const smtpPort = allSettings.find(s => s.settingKey === "smtp_port")?.settingValue;
      const smtpUser = allSettings.find(s => s.settingKey === "smtp_user")?.settingValue;
      if (!smtpHost || !smtpPort || !smtpUser) {
        return res.status(400).json({ message: "SMTP settings incomplete. Please save settings first." });
      }
      res.json({ success: true, message: "SMTP configuration looks valid. Test email would be sent to configured admin email." });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // =============================================
  // SYSTEM ADMIN MIDDLEWARE
  // =============================================
  async function isSysAdmin(req: any, res: any, next: any) {
    try {
      const session = req.session as any;
      const crmUserId = session?.crmUserId;
      if (!crmUserId) return res.status(403).json({ message: "Forbidden" });

      const sessionTid = session?.tenantId || tid;
      const allCrmUsers = await storage.getCrmUsers(sessionTid);
      const crmUser = allCrmUsers.find((u: any) => u.id === crmUserId);
      if (!crmUser) return res.status(403).json({ message: "Forbidden" });

      if (crmUser.systemRoleId) {
        const allRoles = await storage.getMasterRecords("systemRoles", sessionTid);
        const role = allRoles.find((r: any) => r.id === crmUser.systemRoleId);
        if (role && (role as any).code === "SYS_ADMIN") {
          return next();
        }
      }
      return res.status(403).json({ message: "Forbidden: System Admin access required" });
    } catch (err) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  // =============================================
  // SYSTEM ADMIN APIs (Platform Management)
  // =============================================

  // Admin Dashboard stats
  app.get("/api/admin/stats", isAuthenticated, isSysAdmin, async (req: any, res) => {
    try {
      const [tenantCount] = await db.select({ count: count() }).from(tenants);
      const [userCount] = await db.select({ count: count() }).from(crmUsers);
      const [leadCount] = await db.select({ count: count() }).from(leads);
      const [episodeCount] = await db.select({ count: count() }).from(episodes);
      const [activeSubs] = await db.select({ count: count() }).from(tenantSubscriptions).where(eq(tenantSubscriptions.status, "Active"));
      const [suspendedTenants] = await db.select({ count: count() }).from(tenants).where(eq(tenants.subscriptionStatus, "Suspended"));

      const allTenantsList = await db.select().from(tenants).orderBy(tenants.id);
      const tenantStats = [];
      for (const t of allTenantsList) {
        const [tUsers] = await db.select({ count: count() }).from(crmUsers).where(eq(crmUsers.tenantId, t.id));
        const [tLeads] = await db.select({ count: count() }).from(leads).where(eq(leads.tenantId, t.id));
        const [tEpisodes] = await db.select({ count: count() }).from(episodes).where(eq(episodes.tenantId, t.id));
        tenantStats.push({
          tenantId: t.id,
          tenantName: t.name,
          displayName: t.displayName,
          subdomain: t.subdomain,
          subscriptionStatus: t.subscriptionStatus,
          users: tUsers.count,
          leads: tLeads.count,
          episodes: tEpisodes.count,
        });
      }

      res.json({
        totalTenants: tenantCount.count,
        totalUsers: userCount.count,
        totalLeads: leadCount.count,
        totalEpisodes: episodeCount.count,
        activeSubscriptions: activeSubs.count,
        suspendedTenants: suspendedTenants.count,
        tenantStats,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Subscription Plans CRUD
  app.get("/api/admin/plans", isAuthenticated, isSysAdmin, async (req, res) => {
    try {
      const plans = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.price);
      res.json(plans);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/plans", isAuthenticated, isSysAdmin, async (req, res) => {
    try {
      const parsed = insertSubscriptionPlanSchema.parse(req.body);
      const [plan] = await db.insert(subscriptionPlans).values(parsed).returning();
      res.status(201).json(plan);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/admin/plans/:id", isAuthenticated, isSysAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [updated] = await db.update(subscriptionPlans).set({ ...req.body, modifiedAt: new Date() }).where(eq(subscriptionPlans.id, id)).returning();
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Tenant Subscriptions CRUD
  app.get("/api/admin/subscriptions", isAuthenticated, isSysAdmin, async (req, res) => {
    try {
      const subs = await db.select().from(tenantSubscriptions).orderBy(desc(tenantSubscriptions.createdAt));
      const plans = await db.select().from(subscriptionPlans);
      const allTenantsList = await db.select().from(tenants);

      const enriched = subs.map(s => ({
        ...s,
        tenantName: allTenantsList.find(t => t.id === s.tenantId)?.name || "Unknown",
        planName: plans.find(p => p.id === s.planId)?.name || "Unknown",
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/subscriptions", isAuthenticated, isSysAdmin, async (req, res) => {
    try {
      const body = coerceDateFields(req.body, ["startDate", "endDate"]);
      const parsed = insertTenantSubscriptionSchema.parse(body);
      const [sub] = await db.insert(tenantSubscriptions).values(parsed).returning();
      await db.update(tenants).set({ subscriptionStatus: "Active" }).where(eq(tenants.id, parsed.tenantId));
      res.status(201).json(sub);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/admin/subscriptions/:id", isAuthenticated, isSysAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const body = coerceDateFields(req.body, ["startDate", "endDate", "suspendedAt"]);
      const [updated] = await db.update(tenantSubscriptions).set({ ...body, modifiedAt: new Date() }).where(eq(tenantSubscriptions.id, id)).returning();

      if (body.status === "Suspended") {
        await db.update(tenants).set({ subscriptionStatus: "Suspended" }).where(eq(tenants.id, updated.tenantId));
      } else if (body.status === "Active") {
        await db.update(tenants).set({ subscriptionStatus: "Active" }).where(eq(tenants.id, updated.tenantId));
      }
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Suspend / Activate tenant
  app.post("/api/admin/tenants/:id/suspend", isAuthenticated, isSysAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { reason } = req.body;
      await db.update(tenants).set({ subscriptionStatus: "Suspended" }).where(eq(tenants.id, id));
      const activeSubs = await db.select().from(tenantSubscriptions).where(and(eq(tenantSubscriptions.tenantId, id), eq(tenantSubscriptions.status, "Active")));
      for (const sub of activeSubs) {
        await db.update(tenantSubscriptions).set({ status: "Suspended", suspendedAt: new Date(), suspendedReason: reason || "Payment overdue", modifiedAt: new Date() }).where(eq(tenantSubscriptions.id, sub.id));
      }
      res.json({ message: "Tenant suspended" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/tenants/:id/activate", isAuthenticated, isSysAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.update(tenants).set({ subscriptionStatus: "Active" }).where(eq(tenants.id, id));
      const suspendedSubs = await db.select().from(tenantSubscriptions).where(and(eq(tenantSubscriptions.tenantId, id), eq(tenantSubscriptions.status, "Suspended")));
      for (const sub of suspendedSubs) {
        await db.update(tenantSubscriptions).set({ status: "Active", suspendedAt: null, suspendedReason: null, modifiedAt: new Date() }).where(eq(tenantSubscriptions.id, sub.id));
      }
      res.json({ message: "Tenant activated" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update tenant details (admin)
  app.patch("/api/admin/tenants/:id", isAuthenticated, isSysAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { contactPerson, contactEmail, contactPhone, displayName } = req.body;
      const updateData: any = {};
      if (contactPerson !== undefined) updateData.contactPerson = contactPerson;
      if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
      if (contactPhone !== undefined) updateData.contactPhone = contactPhone;
      if (displayName !== undefined) updateData.displayName = displayName;
      const [updated] = await db.update(tenants).set(updateData).where(eq(tenants.id, id)).returning();
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Subscription Payments CRUD
  app.get("/api/admin/payments", isAuthenticated, isSysAdmin, async (req, res) => {
    try {
      const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
      let payments;
      if (tenantId) {
        payments = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.tenantId, tenantId)).orderBy(desc(subscriptionPayments.paymentDate));
      } else {
        payments = await db.select().from(subscriptionPayments).orderBy(desc(subscriptionPayments.paymentDate));
      }
      const allTenantsList = await db.select().from(tenants);
      const enriched = payments.map(p => ({
        ...p,
        tenantName: allTenantsList.find(t => t.id === p.tenantId)?.name || "Unknown",
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/payments", isAuthenticated, isSysAdmin, async (req, res) => {
    try {
      const body = coerceDateFields(req.body, ["paymentDate", "periodStart", "periodEnd"]);
      const parsed = insertSubscriptionPaymentSchema.parse(body);
      const [payment] = await db.insert(subscriptionPayments).values(parsed).returning();
      res.status(201).json(payment);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Tenant detail for admin view (with subscription + payment history)
  app.get("/api/admin/tenants/:id", isAuthenticated, isSysAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });

      const subs = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, id)).orderBy(desc(tenantSubscriptions.startDate));
      const payments = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.tenantId, id)).orderBy(desc(subscriptionPayments.paymentDate));
      const plans = await db.select().from(subscriptionPlans);
      const [userCount] = await db.select({ count: count() }).from(crmUsers).where(eq(crmUsers.tenantId, id));
      const [leadCount] = await db.select({ count: count() }).from(leads).where(eq(leads.tenantId, id));

      const enrichedSubs = subs.map(s => ({
        ...s,
        planName: plans.find(p => p.id === s.planId)?.name || "Unknown",
      }));

      res.json({
        ...tenant,
        subscriptions: enrichedSubs,
        payments,
        userCount: userCount.count,
        leadCount: leadCount.count,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Seed the database
  await seedDatabase();
  await ensurePatientsForConvertedLeads();
  await ensureSuperAdmin();
  await clearStaleConnectorMetrics();
  await fixPendingApprovalStatus();

  return httpServer;
}

async function ensureSuperAdmin() {
  try {
    const { hashPassword } = await import("./replit_integrations/auth/replitAuth");
    const allTenantRows = await db.select().from(tenants);
    if (allTenantRows.length === 0) return;
    const tid = allTenantRows[0].id;

    const phone = "+919033050100";
    const defaultPassword = "RGBTech@123";
    const existingUsers = await db.select().from(crmUsers).where(
      and(eq(crmUsers.phone, phone), eq(crmUsers.tenantId, tid))
    );

    if (existingUsers.length > 0) {
      const updates: Record<string, any> = {};
      if (!existingUsers[0].passwordHash) {
        updates.passwordHash = await hashPassword(defaultPassword);
      }
      const sysAdminRole = await db.select().from(systemRoles).where(
        and(eq(systemRoles.code, "SYS_ADMIN"), eq(systemRoles.tenantId, tid))
      );
      if (sysAdminRole.length > 0 && existingUsers[0].systemRoleId !== sysAdminRole[0].id) {
        updates.systemRoleId = sysAdminRole[0].id;
      }
      if (Object.keys(updates).length > 0) {
        await db.update(crmUsers).set(updates).where(eq(crmUsers.id, existingUsers[0].id));
        console.log("Super Admin updated:", Object.keys(updates).join(", "));
      }
      return;
    }

    let roleRows = await db.select().from(systemRoles).where(
      and(eq(systemRoles.code, "SYS_ADMIN"), eq(systemRoles.tenantId, tid))
    );
    if (roleRows.length === 0) {
      roleRows = await db.select().from(systemRoles).where(
        and(eq(systemRoles.code, "ADMIN"), eq(systemRoles.tenantId, tid))
      );
    }
    const adminRoleId = roleRows.length > 0 ? roleRows[0].id : null;

    const hash = await hashPassword(defaultPassword);
    await db.insert(crmUsers).values({
      tenantId: tid,
      code: "SUPERADMIN",
      name: "Super Admin",
      email: "superadmin@viroc.in",
      phone,
      systemRoleId: adminRoleId,
      isActive: true,
      status: "Active",
      accessScopeType: "All",
      phiAccessLevel: "Full",
      passwordHash: hash,
      displayOrder: 0,
    });
    console.log("Super Admin user created.");
  } catch (err) {
    console.error("Error ensuring super admin:", err);
  }
}

async function fixPendingApprovalStatus() {
  try {
    const tables = Object.values(MASTER_TABLE_REGISTRY);
    for (const tbl of tables) {
      try {
        await pool.query(`UPDATE "${tbl}" SET approval_status = 'Pending' WHERE approval_status = 'Pending Approval'`);
      } catch (_) {}
    }
    console.log("Fixed 'Pending Approval' -> 'Pending' in master tables");
  } catch (err) {
    console.error("Error fixing approval status:", err);
  }
}

async function clearStaleConnectorMetrics() {
  try {
    const cutoff = new Date("2026-02-26T12:00:00Z");
    const result = await db.execute(sql`UPDATE platform_connectors SET metrics_cache = NULL, metrics_cached_at = NULL WHERE metrics_cached_at IS NOT NULL AND metrics_cached_at < ${cutoff}`);
    console.log("Cleared stale connector metrics cache (pre-integration)");
  } catch (err) {
    console.error("Error clearing connector metrics:", err);
  }
}
