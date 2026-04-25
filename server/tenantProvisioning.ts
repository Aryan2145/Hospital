import { db } from "./db";
import {
  systemRoles,
  administrativeDepartments,
  designations,
  employmentTypes,
  leadStatuses,
  leadSourceCategories,
  leadSources,
  activityTypes,
  nextActionTypes,
  taskCategories,
  appointmentTypes,
  appointmentStatuses,
  callStatuses,
  callDirections,
  campaignChannels,
  consultationTypes,
  callingLines,
  lostReasons,
  noShowReasons,
  referralStatuses,
  conversionStages,
  roomTypes,
  costHeads,
} from "@shared/schema";

export async function provisionNewTenant(tid: number) {
  async function eachIdx<T>(arr: T[], fn: (item: T, i: number) => Promise<void>) {
    for (let i = 0; i < arr.length; i++) await fn(arr[i], i);
  }

  await eachIdx([
    { code: "SYS_ADMIN", name: "System Admin", displayOrder: 0 },
    { code: "ADMIN", name: "Admin", displayOrder: 1 },
    { code: "MANAGER", name: "Manager", displayOrder: 2 },
    { code: "PATIENT_COORDINATOR", name: "Patient Coordinator", displayOrder: 3 },
    { code: "COUNSELLOR", name: "Counsellor", displayOrder: 4 },
    { code: "TELECALLER", name: "Telecaller", displayOrder: 5 },
    { code: "RECEPTIONIST", name: "Receptionist", displayOrder: 6 },
    { code: "DOCTOR", name: "Doctor", displayOrder: 7 },
    { code: "MEDICAL_ASSISTANT", name: "Medical Assistant", displayOrder: 8 },
    { code: "BILLING", name: "Billing Executive", displayOrder: 9 },
    { code: "INSURANCE_DESK", name: "Insurance Desk", displayOrder: 10 },
    { code: "MIS_VIEWER", name: "MIS Viewer", displayOrder: 11 },
  ], async (r) => {
    await db.insert(systemRoles).values({ tenantId: tid, code: r.code, name: r.name, status: "Active", displayOrder: r.displayOrder });
  });

  await eachIdx([
    { code: "MKT", name: "Marketing" },
    { code: "SALES", name: "Sales" },
    { code: "HR", name: "HR" },
    { code: "IT", name: "IT" },
    { code: "ACCT", name: "Accounts" },
    { code: "FO", name: "Front Office" },
    { code: "TELECALLING", name: "Telecalling" },
    { code: "FINANCIAL", name: "Financial Counselling" },
    { code: "INSURANCE", name: "Insurance & TPA" },
    { code: "OT_IP", name: "OT / IP Desk" },
    { code: "POST_CARE", name: "Post Care" },
    { code: "REFERRAL", name: "Referral Management" },
    { code: "MGMT", name: "Management" },
  ], async (t, i) => {
    await db.insert(administrativeDepartments).values({ tenantId: tid, ...t, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "MD", name: "Managing Director" },
    { code: "DIR", name: "Director" },
    { code: "COO", name: "Chief Operating Officer" },
    { code: "CMO", name: "Chief Medical Officer" },
    { code: "CRM_MGR", name: "CRM Manager" },
    { code: "CRM_EXEC", name: "CRM Executive" },
    { code: "FRONT_DESK", name: "Front Desk Executive" },
    { code: "NURSE", name: "Nursing Staff" },
  ], async (d, i) => {
    await db.insert(designations).values({ tenantId: tid, ...d, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "PERM", name: "Permanent" },
    { code: "CONT", name: "Contract" },
    { code: "CONS", name: "Consultant" },
    { code: "INTERN", name: "Intern" },
  ], async (e, i) => {
    await db.insert(employmentTypes).values({ tenantId: tid, ...e, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "RAW", name: "Raw Lead Captured", isTerminal: false },
    { code: "CONT", name: "Contacted", isTerminal: false },
    { code: "QUAL", name: "Qualified", isTerminal: false },
    { code: "APPT", name: "Appointment Booked", isTerminal: false },
    { code: "REM", name: "Reminder Running", isTerminal: false },
    { code: "CONS", name: "Consultation Done", isTerminal: false },
    { code: "WON", name: "Closed Won", isTerminal: true },
    { code: "LOST", name: "Closed Lost", isTerminal: true },
    { code: "UNQUAL", name: "Unqualified", isTerminal: true },
    { code: "NURT", name: "Nurture", isTerminal: false },
  ], async (ls, i) => {
    await db.insert(leadStatuses).values({ tenantId: tid, code: ls.code, name: ls.name, displayOrder: i + 1, isTerminal: ls.isTerminal, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "DIGITAL", name: "Digital" },
    { code: "OFFLINE", name: "Offline" },
    { code: "PARTNER", name: "Partner / Referral" },
  ], async (ls, i) => {
    await db.insert(leadSourceCategories).values({ tenantId: tid, ...ls, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "FACEBOOK", name: "Facebook" },
    { code: "INSTAGRAM", name: "Instagram" },
    { code: "GOOGLE_ADS", name: "Google Ads" },
    { code: "WEBSITE", name: "Website" },
    { code: "PATIENT_REF", name: "Patient Referral (Word of Mouth)" },
    { code: "HOME_COUNSEL", name: "Home Counselling Request" },
    { code: "WHATSAPP", name: "WhatsApp" },
    { code: "PHONE", name: "Phone Inquiry" },
    { code: "GOOGLE_FORMS", name: "Google Forms" },
    { code: "CALLYZER", name: "Telephony Connector" },
    { code: "EMAIL_CAMP", name: "Email Campaign" },
    { code: "REFERRAL", name: "Referral (General)" },
    { code: "DIRECT_CRM", name: "Direct (CRM Entry)" },
    { code: "WALK_IN", name: "Walk-In" },
    { code: "OTHER", name: "Other" },
  ], async (s, i) => {
    await db.insert(leadSources).values({ tenantId: tid, ...s, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "NOTE", name: "Note" },
    { code: "CALL", name: "Call" },
    { code: "EMAIL", name: "Email" },
    { code: "SMS", name: "SMS" },
    { code: "WHATSAPP", name: "WhatsApp Message" },
    { code: "MEETING", name: "In-Person Meeting" },
    { code: "FOLLOW_UP", name: "Follow-Up" },
  ], async (at, i) => {
    await db.insert(activityTypes).values({ tenantId: tid, ...at, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "CALL_BACK", name: "Call Back" },
    { code: "FOLLOW_UP", name: "Follow-Up" },
    { code: "SEND_INFO", name: "Send Information" },
    { code: "BOOK_APPT", name: "Book Appointment" },
    { code: "HOME_VISIT", name: "Home Visit" },
  ], async (nat, i) => {
    await db.insert(nextActionTypes).values({ tenantId: tid, ...nat, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "GENERAL", name: "General" },
    { code: "FOLLOW_UP", name: "Follow-Up" },
    { code: "CALLBACK", name: "Callback" },
    { code: "NURTURE", name: "Nurture" },
    { code: "POST_CARE", name: "Post Care" },
  ], async (tc, i) => {
    await db.insert(taskCategories).values({ tenantId: tid, ...tc, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "FIRST_CONSULT", name: "First Consultation" },
    { code: "FOLLOW_UP", name: "Follow-Up Consultation" },
    { code: "PRE_OP", name: "Pre-Operative Assessment" },
    { code: "POST_OP", name: "Post-Operative Review" },
  ], async (apt, i) => {
    await db.insert(appointmentTypes).values({ tenantId: tid, ...apt, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "SCHEDULED", name: "Scheduled" },
    { code: "CONFIRMED", name: "Confirmed" },
    { code: "CHECKED_IN", name: "Checked In" },
    { code: "COMPLETED", name: "Completed" },
    { code: "CANCELLED", name: "Cancelled" },
    { code: "NO_SHOW", name: "No Show" },
    { code: "RESCHEDULED", name: "Rescheduled" },
  ], async (apst, i) => {
    await db.insert(appointmentStatuses).values({ tenantId: tid, ...apst, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "CONNECTED", name: "Connected" },
    { code: "NOT_ANSWERED", name: "Not Answered" },
    { code: "BUSY", name: "Busy" },
    { code: "SWITCHED_OFF", name: "Switched Off" },
    { code: "WRONG_NUMBER", name: "Wrong Number" },
    { code: "VOICEMAIL", name: "Voicemail Left" },
    { code: "CALL_BACK_LATER", name: "Asked to Call Back Later" },
  ], async (cs, i) => {
    await db.insert(callStatuses).values({ tenantId: tid, ...cs, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "INCOMING", name: "Incoming" },
    { code: "OUTGOING", name: "Outgoing" },
    { code: "MISSED", name: "Missed" },
    { code: "ABANDONED", name: "Abandoned" },
  ], async (cd, i) => {
    await db.insert(callDirections).values({ tenantId: tid, ...cd, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "FACEBOOK", name: "Facebook" },
    { code: "INSTAGRAM", name: "Instagram" },
    { code: "GOOGLE_ADS", name: "Google Ads" },
    { code: "WHATSAPP", name: "WhatsApp" },
    { code: "EMAIL", name: "Email" },
    { code: "SMS", name: "SMS" },
  ], async (cc, i) => {
    await db.insert(campaignChannels).values({ tenantId: tid, ...cc, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "FIRST", name: "First Consultation" },
    { code: "FOLLOW_UP", name: "Follow-Up" },
    { code: "EMERGENCY", name: "Emergency" },
  ], async (ct, i) => {
    await db.insert(consultationTypes).values({ tenantId: tid, ...ct, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "MAIN", name: "Main Reception Line" },
    { code: "CRM", name: "CRM Outbound Line" },
  ], async (cl, i) => {
    await db.insert(callingLines).values({ tenantId: tid, ...cl, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "COST", name: "Cost Too High" },
    { code: "COMPETITOR", name: "Chose Another Hospital" },
    { code: "NOT_READY", name: "Not Ready for Treatment" },
    { code: "INSURANCE", name: "Insurance Not Covered" },
    { code: "NO_RESPONSE", name: "No Response / Unreachable" },
    { code: "DISTANCE", name: "Hospital Too Far" },
    { code: "OTHER", name: "Other" },
  ], async (lr, i) => {
    await db.insert(lostReasons).values({ tenantId: tid, ...lr, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "FORGOT", name: "Forgot Appointment" },
    { code: "TRANSPORT", name: "Transportation Issue" },
    { code: "UNWELL", name: "Felt Unwell" },
    { code: "RESCHEDULED", name: "Rescheduled Elsewhere" },
    { code: "WORK_EMERGENCY", name: "Work / Family Emergency" },
    { code: "OTHER", name: "Other" },
  ], async (ns, i) => {
    await db.insert(noShowReasons).values({ tenantId: tid, ...ns, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "PENDING", name: "Pending" },
    { code: "CONTACTED", name: "Contacted" },
    { code: "CONVERTED", name: "Converted" },
    { code: "LOST", name: "Lost" },
  ], async (rs, i) => {
    await db.insert(referralStatuses).values({ tenantId: tid, ...rs, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "INITIAL", name: "Initial Consultation" },
    { code: "ESTIMATE_SHARED", name: "Estimate Shared" },
    { code: "NEGOTIATION", name: "Under Negotiation" },
    { code: "APPROVED", name: "Patient Approved" },
    { code: "SURGERY_DONE", name: "Surgery / Procedure Done" },
    { code: "BILLED", name: "Billed" },
    { code: "COMPLETED", name: "Completed" },
    { code: "DISCONTINUED", name: "Discontinued" },
  ], async (cst, i) => {
    await db.insert(conversionStages).values({ tenantId: tid, ...cst, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "GENERAL", name: "General" },
    { code: "SEMI_SPL", name: "Semi-Special" },
    { code: "SMALL_AC_SPL", name: "Small AC Special" },
    { code: "AC_SPECIAL", name: "AC Special" },
    { code: "DELUXE", name: "Deluxe" },
    { code: "SUITE", name: "Suite" },
  ], async (rt, i) => {
    await db.insert(roomTypes).values({ tenantId: tid, ...rt, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  await eachIdx([
    { code: "HOSPITAL_BILL", name: "Hospital Bill" },
    { code: "IMPLANT_BILL", name: "Implant Bill" },
    { code: "MEDICINE", name: "Medicine" },
    { code: "PRE_OP", name: "Pre-Op Investigation" },
    { code: "PHYSIO", name: "Physiotherapy" },
    { code: "EXTRA_MEDICAL", name: "Extra Medical Management" },
    { code: "SURGEON_FEE", name: "Surgeon Fee" },
    { code: "ANAESTHESIA", name: "Anaesthesia Charges" },
    { code: "OT_CHARGES", name: "OT / Operation Theatre Charges" },
    { code: "ICU_CHARGES", name: "ICU Charges" },
    { code: "ROOM_RENT", name: "Room Rent" },
    { code: "NURSING", name: "Nursing Charges" },
    { code: "BLOOD_BANK", name: "Blood Bank Charges" },
    { code: "CONSUMABLES", name: "Consumables & Disposables" },
    { code: "DIAGNOSTIC", name: "Diagnostic / Imaging" },
    { code: "LAB_CHARGES", name: "Laboratory Charges" },
    { code: "CONSULTATION", name: "Consultation Fee" },
    { code: "MISC", name: "Miscellaneous" },
  ], async (ch, i) => {
    await db.insert(costHeads).values({ tenantId: tid, ...ch, displayOrder: i + 1, status: "Active", approvalStatus: "Approved" });
  });

  console.log(`[tenantProvisioning] Provisioned new tenant #${tid} with all master data`);
}
