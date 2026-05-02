import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, MASTER_CATEGORIES } from "@shared/routes";
import { MASTER_TABLE_REGISTRY, bulkImportLogs, crmUsers, insertCrmUserSchema, insertPatientSchema, insertContactSchema, insertPatientContactLinkSchema, insertAppointmentSchema, insertEpisodeSchema, insertAuditLogSchema, insertCampaignSchema, insertPlatformConnectorSchema, leadImportLogs, leadCaptureRules, insertLeadCaptureRuleSchema, platformConnectors, customFieldSuggestions, insertCustomFieldSuggestionSchema, subscriptionPlans, tenantSubscriptions, subscriptionPayments, insertSubscriptionPlanSchema, insertTenantSubscriptionSchema, insertSubscriptionPaymentSchema, episodes, callyzerWebhookLogs, callyzerEmployees, handoverLogs, rescheduleHistory, temperatureLogs, revenueProbabilityConfig, insertRevenueProbabilityConfigSchema, clinicalNotesEditRoles, leadMergeAudits, leadMergeRoles, accessLogs, communicationPreferences, postCareProtocols, postCareProtocolSteps, insertPostCareProtocolSchema, insertPostCareProtocolStepSchema, referrals, insertReferralSchema, referrers, events, eventRegistrations, insertEventSchema, insertEventRegistrationSchema, referralConfig, insertReferralConfigSchema, referralRewardRules, insertReferralRewardRuleSchema, referralRewardLogs, supportUsers, supportTickets, supportTicketComments, episodeQuoteItems, costHeads, roomTypes, resourceLinks, insertResourceLinkSchema, insertContactPersonSchema, insertLeadContactPersonSchema, rolePermissions, userPermissionOverrides, inAppNotifications, tenantDiscountApprovers, insertRolePermissionSchema, insertUserPermissionOverrideSchema, insertInAppNotificationSchema, systemErrorLogs, tenantSettings, metaLeadCaptureLogs, googleSheetsSyncConfigs } from "@shared/schema";
import { toProperCase } from "./storage";
import crypto from "crypto";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { db, pool } from "./db";
import { tenants, leads, leadStatuses, activityTypes, nextActionTypes, taskCategories, callStatuses, callDirections, appointmentStatuses, referralStatuses, leadSourceCategories, leadSources, campaignChannels, campaigns, appointmentTypes, conversionStages, lostReasons, noShowReasons, consultationTypes, countries, states, cities, designations, employmentTypes, systemRoles, organisations, doctors, opdTimings, branches, administrativeDepartments, treatmentDepartments, areas, pinCodes, callingLines, activities, tasks, appointments, patients, contacts, patientContactLinks, doctorLeaveExceptions, slaRules, reminderPolicies, dataRetentionPolicies, contactPersons, leadContactPersons } from "@shared/schema";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { desc, eq, and, or, sql, count, gte, lte, isNull, inArray } from "drizzle-orm";
import { encryptValue, decryptValue, isEncrypted } from "./crypto";
import { sendDiscountApprovalEmail } from "./email";
import { sendDiscountApprovalSMS } from "./sms";
import { triggerPreopEntryAutomation, getOrCreatePreopAssessment } from "./services/preopAssessment";

const PHI_FIELDS_TO_MASK = [
  "phoneE164", "phone_e164", "mobileNormalized", "mobile_normalized",
  "email", "primaryPhone", "primary_phone", "secondaryPhone", "secondary_phone",
  "emergencyContactName", "emergency_contact_name", "emergencyContactPhone", "emergency_contact_phone",
  "whatsappNumber", "whatsapp_number",
];
const PHI_FIELDS_TO_HIDE = [
  "diagnosis", "treatmentPlan", "treatment_plan", "consultationNotes", "consultation_notes",
  "insuranceProvider", "insurance_provider", "insurancePolicyNumber", "insurance_policy_number",
  "bloodGroup", "blood_group",
];

function maskValue(val: string): string {
  if (!val) return val;
  if (val.includes("@")) return val[0] + "***@" + val.split("@")[1];
  if (val.length > 4) return val.slice(0, 2) + "****" + val.slice(-2);
  return "****";
}

function applyPhiMasking(data: any, level: string): any {
  if (!data || level === "Full") return data;
  if (Array.isArray(data)) return data.map(item => applyPhiMasking(item, level));
  if (typeof data !== "object") return data;
  const result = { ...data };
  for (const field of PHI_FIELDS_TO_MASK) {
    if (result[field]) {
      result[field] = level === "Masked" ? maskValue(result[field]) : "[RESTRICTED]";
    }
  }
  if (level === "None") {
    for (const field of PHI_FIELDS_TO_HIDE) {
      if (result[field]) result[field] = "[RESTRICTED]";
    }
  }
  return result;
}

// =============================================
// PERMISSION FRAMEWORK
// =============================================

// Module permission matrix: roleCode → module → {canView, canCreate, canEdit, canDelete}
const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>> = {
  SYS_ADMIN: {
    dashboard: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    leads: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    episodes: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    appointments: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    campaigns: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    transactions: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    team: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    masters: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    connectors: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    branding: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    settings: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    quotation: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    insurance: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    reports: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  },
  ADMIN: {
    dashboard: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    leads: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    episodes: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    appointments: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    campaigns: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    transactions: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    team: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    masters: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    connectors: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    branding: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    settings: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    quotation: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    insurance: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    reports: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  },
  MANAGER: {
    dashboard: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    leads: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    episodes: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    appointments: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    campaigns: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    transactions: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    team: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    masters: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    connectors: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    branding: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    settings: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    quotation: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    insurance: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    reports: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  },
  COUNSELLOR: {
    dashboard: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    leads: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    episodes: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    appointments: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    campaigns: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    transactions: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    team: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    masters: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    connectors: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    branding: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    settings: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    quotation: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    insurance: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    reports: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  },
  PATIENT_COORDINATOR: {
    dashboard: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    leads: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    episodes: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    appointments: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    campaigns: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    transactions: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    team: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    masters: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    connectors: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    branding: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    settings: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    quotation: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    insurance: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    reports: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  },
  TELECALLER: {
    dashboard: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    leads: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    episodes: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    appointments: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    campaigns: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    transactions: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    team: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    masters: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    connectors: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    branding: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    settings: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    quotation: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    insurance: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    reports: { canView: false, canCreate: false, canEdit: false, canDelete: false },
  },
  RECEPTIONIST: {
    dashboard: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    leads: { canView: true, canCreate: true, canEdit: false, canDelete: false },
    episodes: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    appointments: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    campaigns: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    transactions: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    team: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    masters: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    connectors: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    branding: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    settings: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    quotation: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    insurance: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    reports: { canView: false, canCreate: false, canEdit: false, canDelete: false },
  },
  BILLING: {
    dashboard: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    leads: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    episodes: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    appointments: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    campaigns: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    transactions: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    team: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    masters: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    connectors: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    branding: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    settings: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    quotation: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    insurance: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    reports: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  },
  INSURANCE_DESK: {
    dashboard: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    leads: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    episodes: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    appointments: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    campaigns: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    transactions: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    team: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    masters: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    connectors: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    branding: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    settings: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    quotation: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    insurance: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    reports: { canView: false, canCreate: false, canEdit: false, canDelete: false },
  },
  DOCTOR: {
    dashboard: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    leads: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    episodes: { canView: true, canCreate: false, canEdit: true, canDelete: false },
    appointments: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    campaigns: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    transactions: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    team: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    masters: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    connectors: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    branding: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    settings: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    quotation: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    insurance: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    reports: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  },
  MEDICAL_ASSISTANT: {
    dashboard: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    leads: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    episodes: { canView: true, canCreate: false, canEdit: true, canDelete: false },
    appointments: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    campaigns: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    transactions: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    team: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    masters: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    connectors: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    branding: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    settings: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    quotation: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    insurance: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    reports: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  },
  MIS_VIEWER: {
    dashboard: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    leads: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    episodes: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    appointments: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    campaigns: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    transactions: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    team: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    masters: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    connectors: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    branding: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    settings: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    quotation: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    insurance: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    reports: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  },
};

// Seed role_permissions for all roles for a given tenant
async function seedRolePermissions(tenantId: number): Promise<void> {
  const modules = ["dashboard", "leads", "episodes", "appointments", "campaigns", "transactions", "team", "masters", "connectors", "branding", "settings", "quotation", "insurance", "reports"];
  for (const [roleCode, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    for (const module of modules) {
      const p = perms[module] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
      await db.insert(rolePermissions)
        .values({ tenantId, roleCode, module, canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete })
        .onConflictDoNothing();
    }
  }
}


// Send in-app notification to a list of crm user IDs
async function sendInAppNotification(tenantId: number, crmUserIds: number[], type: string, title: string, body: string, opts?: { entityType?: string; entityId?: number; link?: string }) {
  for (const uid of crmUserIds) {
    await db.insert(inAppNotifications).values({
      tenantId, crmUserId: uid, type, title, body,
      entityType: opts?.entityType, entityId: opts?.entityId, link: opts?.link,
      isRead: false,
    });
  }
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(windowMs: number, maxRequests: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = (req.ip || "unknown") + ":" + req.path;
    const now = Date.now();
    const entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > maxRequests) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }
    next();
  };
}

async function logSystemError(req: any, statusCode: number, errorMessage: string, errorDetails?: string) {
  try {
    const session = (req as any).session;
    const crmUserId = session?.crmUserId || null;
    const tenantId = session?.tenantId || null;
    let userName: string | null = null;
    let userPhone: string | null = null;
    let roleCode: string | null = null;
    if (crmUserId) {
      const [u] = await db.select({ name: crmUsers.name, phone: crmUsers.phone, systemRoleId: crmUsers.systemRoleId })
        .from(crmUsers).where(eq(crmUsers.id, crmUserId)).limit(1);
      if (u) {
        userName = u.name || null;
        userPhone = u.phone || null;
        if (u.systemRoleId) {
          const [r] = await db.select({ code: systemRoles.code }).from(systemRoles).where(eq(systemRoles.id, u.systemRoleId)).limit(1);
          if (r) roleCode = r.code;
        }
      }
    }
    await db.insert(systemErrorLogs).values({
      tenantId,
      crmUserId,
      userName,
      userPhone,
      roleCode,
      method: req.method || null,
      endpoint: req.path || null,
      statusCode,
      errorMessage: errorMessage?.substring(0, 500) || null,
      errorDetails: errorDetails?.substring(0, 2000) || null,
      ipAddress: req.ip || null,
    });
  } catch {}
}

async function logAccess(tenantId: number, crmUserId: number, action: string, entityType: string, entityId: number | null, details: string | null, req: any) {
  try {
    await db.insert(accessLogs).values({
      tenantId,
      crmUserId,
      action,
      entityType,
      entityId: entityId || 0,
      details,
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      userAgent: req.headers?.["user-agent"]?.substring(0, 200) || null,
    });
  } catch {}
}
import { computeAndUpdateTemperature, checkDormantLeads } from "./services/temperatureEngine";
import { processAutoHandover } from "./services/handoverEngine";
import { createNurtureTaskChain, processNurtureTaskCompletion, processAutoNurtureOnNoShow } from "./services/nurtureEngine";
import { startBackgroundScheduler } from "./services/backgroundScheduler";
import { computeRevenueProbability, seedDefaultProbabilityConfig } from "./services/revenueProbability";
import { provisionNewTenant } from "./tenantProvisioning";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function humanizeError(err: any): string {
  const msg = err?.message || String(err);

  if (msg.includes("column") && msg.includes("does not exist")) {
    const col = msg.match(/column "([^"]+)"/)?.[1] || "field";
    return `The field "${col}" is not available for this record type. Please check the form and try again.`;
  }
  if (msg.includes("duplicate key") || msg.includes("unique constraint")) {
    const val = msg.match(/Key \(([^)]+)\)=\(([^)]+)\)/);
    if (val) return `A record with this ${val[1].replace(/_/g, " ")} already exists (${val[2]}). Please use a different value.`;
    return "A record with these details already exists. Please check for duplicates.";
  }
  if (msg.includes("violates not-null constraint")) {
    const col = msg.match(/column "([^"]+)"/)?.[1]?.replace(/_/g, " ") || "field";
    return `The "${col}" field is required and cannot be empty.`;
  }
  if (msg.includes("violates foreign key constraint")) {
    return "This record references another item that doesn't exist. Please check your selections and try again.";
  }
  if (msg.includes("violates check constraint")) {
    return "One of the values entered is not valid. Please review the form and try again.";
  }
  if (msg.includes("invalid input syntax")) {
    const type = msg.match(/for type (\w+)/)?.[1] || "value";
    return `Invalid format entered. Please check that all fields have the correct ${type} format.`;
  }
  if (msg.includes("relation") && msg.includes("does not exist")) {
    return "Something went wrong while saving. Please try again or contact support.";
  }
  if (msg.includes("No valid fields to update")) {
    return "No changes were detected. Please modify at least one field before saving.";
  }
  if (msg.includes("Record not found")) {
    return "The record you're trying to update was not found. It may have been deleted.";
  }
  if (msg.includes("connect ECONNREFUSED") || msg.includes("ENOTFOUND")) {
    return "Unable to connect to an external service. Please try again later.";
  }
  if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
    return "The request took too long. Please try again.";
  }
  if (/^(error:|ERROR:)/i.test(msg) || msg.includes("syntax error") || msg.includes("at position")) {
    return "Something went wrong while processing your request. Please try again or contact support.";
  }
  return msg;
}

function normalizePhoneNumber(phone: string): string {
  if (!phone || !phone.trim()) return "";
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 7) return "";
  if (digits.length === 12 && digits.startsWith("91")) return "+91" + digits.slice(2);
  if (digits.length === 10) return "+91" + digits;
  if (phone.startsWith("+")) return phone.replace(/[^+0-9]/g, "");
  return "+" + digits;
}

function normalizeCrmPhone(phone: string): string {
  if (!phone || !phone.trim()) return "";
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
  if (cleaned.startsWith("00")) cleaned = "+" + cleaned.slice(2);
  if (!cleaned.startsWith("+")) {
    const digits = cleaned.replace(/[^0-9]/g, "");
    if (digits.length === 10) return "+91" + digits;
    if (digits.startsWith("91") && digits.length === 12) return "+" + digits;
    return "+91" + digits;
  }
  return cleaned;
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

function format_date(d: any): string {
  try {
    const date = new Date(d);
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch { return String(d); }
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

    // Teams (CRM user groups / organizational teams)
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "MKT", name: "Marketing", status: "Active", displayOrder: 1 });
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "SALES", name: "Sales", status: "Active", displayOrder: 2 });
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "HR", name: "HR", status: "Active", displayOrder: 3 });
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "IT", name: "IT", status: "Active", displayOrder: 4 });
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "ACCT", name: "Accounts", status: "Active", displayOrder: 5 });
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "FO", name: "Front Office", status: "Active", displayOrder: 6 });
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "TELECALLING", name: "Telecalling", status: "Active", displayOrder: 7 });
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "FINANCIAL", name: "Financial Counselling", status: "Active", displayOrder: 8 });
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "INSURANCE", name: "Insurance & TPA", status: "Active", displayOrder: 9 });
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "OT_IP", name: "OT / IP Desk", status: "Active", displayOrder: 10 });
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "POST_CARE", name: "Post Care", status: "Active", displayOrder: 11 });
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "REFERRAL", name: "Referral Management", status: "Active", displayOrder: 12 });
    await db.insert(administrativeDepartments).values({ tenantId: tid, code: "MGMT", name: "Management", status: "Active", displayOrder: 13 });

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

    // System Roles — 11 tenant-assignable roles (SYS_ADMIN is developer-team only, never seeded into tenants)
    await db.insert(systemRoles).values({ tenantId: tid, code: "ADMIN", name: "Admin", status: "Active", displayOrder: 1 });
    await db.insert(systemRoles).values({ tenantId: tid, code: "MANAGER", name: "Manager", status: "Active", displayOrder: 2 });
    await db.insert(systemRoles).values({ tenantId: tid, code: "PATIENT_COORDINATOR", name: "Patient Coordinator", status: "Active", displayOrder: 3 });
    await db.insert(systemRoles).values({ tenantId: tid, code: "COUNSELLOR", name: "Counsellor", status: "Active", displayOrder: 4 });
    await db.insert(systemRoles).values({ tenantId: tid, code: "TELECALLER", name: "Telecaller", status: "Active", displayOrder: 5 });
    await db.insert(systemRoles).values({ tenantId: tid, code: "RECEPTIONIST", name: "Receptionist", status: "Active", displayOrder: 6 });
    await db.insert(systemRoles).values({ tenantId: tid, code: "DOCTOR", name: "Doctor", status: "Active", displayOrder: 7 });
    await db.insert(systemRoles).values({ tenantId: tid, code: "MEDICAL_ASSISTANT", name: "Medical Assistant", status: "Active", displayOrder: 8 });
    await db.insert(systemRoles).values({ tenantId: tid, code: "BILLING", name: "Billing", status: "Active", displayOrder: 9 });
    await db.insert(systemRoles).values({ tenantId: tid, code: "INSURANCE_DESK", name: "Insurance Desk", status: "Active", displayOrder: 10 });
    await db.insert(systemRoles).values({ tenantId: tid, code: "MIS_VIEWER", name: "MIS Viewer", status: "Active", displayOrder: 11 });
    // Seed role permissions for all roles
    await seedRolePermissions(tid);

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
    const [agentRoleRec] = await db.select().from(systemRoles).where(and(eq(systemRoles.code, "PATIENT_COORDINATOR"), eq(systemRoles.tenantId, tid)));
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
      { code: "CALLYZER", name: "Telephony Connector" },
      { code: "EMAIL_CAMP", name: "Email Campaign" },
      { code: "REFERRAL", name: "Referral (General)" },
      { code: "DIRECT_CRM", name: "Direct (CRM Entry)" },
      { code: "WALK_IN", name: "Walk-In" },
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

// Shared reachability validator: lead must have phone or linked contact with phone
// Uses only parameterized SQL (no string interpolation) to prevent injection
async function assertLeadReachable(leadId: number, tenantId: number, excludeLinkId?: number): Promise<void> {
  const rows = await pool.query(
    `SELECT l.phone_e164 FROM leads l WHERE l.id = $1 AND l.tenant_id = $2`,
    [leadId, tenantId]
  );
  if (!rows.rows.length) throw new Error("Lead not found");
  const phoneE164 = rows.rows[0].phone_e164;
  if (phoneE164 && phoneE164.trim()) return; // Direct phone present — always reachable
  // Check contact persons linked to this lead for a phone (exclude specific link if provided)
  const params: any[] = [leadId, tenantId];
  let sql = `SELECT cp.phone_e164 FROM lead_contact_persons lcp
     JOIN contact_persons cp ON cp.id = lcp.contact_person_id
     WHERE lcp.lead_id = $1 AND lcp.tenant_id = $2`;
  if (excludeLinkId !== undefined) {
    params.push(excludeLinkId);
    sql += ` AND lcp.id != $${params.length}`;
  }
  const cpRows = await pool.query(sql, params);
  const hasContactPhone = cpRows.rows.some((r: any) => r.phone_e164 && r.phone_e164.trim());
  if (!hasContactPhone) {
    throw new Error("A lead must have at least one reachable phone number — either a direct phone or via a linked contact person.");
  }
}

// Assert that a contact person phone update won't make any linked lead unreachable
// Called when updating/clearing a contact person's phone
async function assertContactPersonPhoneUpdateSafe(contactPersonId: number, tenantId: number, newPhone: string | null | undefined): Promise<void> {
  // Only check if phone is being removed/cleared
  if (newPhone && newPhone.trim()) return;
  // Find all leads linked to this contact person
  const linkedLeads = await pool.query(
    `SELECT DISTINCT lcp.lead_id FROM lead_contact_persons lcp
     WHERE lcp.contact_person_id = $1 AND lcp.tenant_id = $2`,
    [contactPersonId, tenantId]
  );
  for (const row of linkedLeads.rows) {
    const leadId = row.lead_id;
    // Check if this lead has any other reachable phone (own phone or another contact with phone)
    const reachCheck = await pool.query(
      `SELECT l.phone_e164,
              (SELECT COUNT(*) FROM lead_contact_persons lcp2
               JOIN contact_persons cp2 ON cp2.id = lcp2.contact_person_id
               WHERE lcp2.lead_id = l.id AND lcp2.tenant_id = l.tenant_id
               AND lcp2.contact_person_id != $1
               AND cp2.phone_e164 IS NOT NULL AND cp2.phone_e164 != '') as other_cp_phones
       FROM leads l WHERE l.id = $2 AND l.tenant_id = $3`,
      [contactPersonId, leadId, tenantId]
    );
    if (reachCheck.rows.length === 0) continue;
    const lead = reachCheck.rows[0];
    const hasDirectPhone = lead.phone_e164 && lead.phone_e164.trim();
    const hasOtherCpPhone = Number(lead.other_cp_phones) > 0;
    if (!hasDirectPhone && !hasOtherCpPhone) {
      throw new Error(
        `Removing this phone would leave Lead #${leadId} with no reachable phone. Update the lead's direct phone or add another contact person with a phone first.`
      );
    }
  }
}

async function triggerPostCareProtocol(episodeId: number, tid: number, triggerStatus: string, userId: string) {
  const [episode] = await db.select().from(episodes).where(and(eq(episodes.id, episodeId), eq(episodes.tenantId, tid)));
  if (!episode || !episode.leadId) return;

  if (episode.postCareProtocolId) {
    const existingTasks = await db.select().from(tasks).where(
      and(
        eq(tasks.tenantId, tid),
        eq(tasks.leadId, episode.leadId),
        sql`${tasks.notes} LIKE ${'%"postCareEpisodeId":' + episodeId + '%'}`
      )
    );
    if (existingTasks.length > 0) return;
  }

  let protocolId = episode.postCareProtocolId;
  if (!protocolId) {
    const [defaultProtocol] = await db.select().from(postCareProtocols).where(
      and(eq(postCareProtocols.tenantId, tid), eq(postCareProtocols.isDefault, true), eq(postCareProtocols.status, "Active"))
    );
    if (!defaultProtocol) {
      const activeProtocols = await db.select().from(postCareProtocols).where(
        and(eq(postCareProtocols.tenantId, tid), eq(postCareProtocols.status, "Active"), eq(postCareProtocols.triggerOn, triggerStatus))
      );
      if (activeProtocols.length === 0) return;
      protocolId = activeProtocols[0].id;
    } else {
      protocolId = defaultProtocol.id;
    }
    await db.update(episodes).set({ postCareProtocolId: protocolId }).where(eq(episodes.id, episodeId));
  }

  const steps = await db.select().from(postCareProtocolSteps).where(
    and(eq(postCareProtocolSteps.protocolId, protocolId), eq(postCareProtocolSteps.tenantId, tid), eq(postCareProtocolSteps.status, "Active"))
  ).orderBy(postCareProtocolSteps.stepNumber);

  if (steps.length === 0) return;

  const dischargeDate = episode.endDate || new Date();

  for (const step of steps) {
    const dueDate = new Date(dischargeDate);
    dueDate.setDate(dueDate.getDate() + step.daysAfterDischarge);

    let assignedCrmUserId: number | null = null;
    if (step.assigneeType === "PostCareOwner" && episode.postCareOwnerId) {
      const [doc] = await db.select().from(doctors).where(eq(doctors.id, episode.postCareOwnerId));
      if (doc?.phone) {
        const [matchingUser] = await db.select().from(crmUsers).where(
          and(eq(crmUsers.tenantId, tid), eq(crmUsers.phone, doc.phone), eq(crmUsers.isActive, true))
        );
        if (matchingUser) assignedCrmUserId = matchingUser.id;
      }
      if (!assignedCrmUserId && episode.assignedCrmUserId) {
        assignedCrmUserId = episode.assignedCrmUserId;
      }
    } else if (step.assigneeType === "Counsellor" && episode.assignedCrmUserId) {
      assignedCrmUserId = episode.assignedCrmUserId;
    } else if (step.assigneeType === "RoundRobin" && step.assigneeRoleCode) {
      const roleUsers = await db.select().from(crmUsers).where(
        and(eq(crmUsers.tenantId, tid), eq(crmUsers.isActive, true))
      );
      const sysRoles = await db.select().from(systemRoles).where(eq(systemRoles.tenantId, tid));
      const targetRole = sysRoles.find(r => (r as any).code === step.assigneeRoleCode);
      if (targetRole) {
        const eligible = roleUsers.filter(u => u.systemRoleId === targetRole.id);
        if (eligible.length > 0) {
          assignedCrmUserId = eligible[Math.floor(Math.random() * eligible.length)].id;
        }
      }
    }

    if (!assignedCrmUserId && episode.assignedCrmUserId) {
      assignedCrmUserId = episode.assignedCrmUserId;
    }

    const meta = JSON.stringify({
      postCareEpisodeId: episodeId,
      postCareProtocolId: protocolId,
      postCareStepNumber: step.stepNumber,
      source: "Post Care Protocol",
    });

    await db.insert(tasks).values({
      tenantId: tid,
      leadId: episode.leadId,
      title: step.taskTitle,
      description: step.taskDescription || `Post-care follow-up: Day ${step.daysAfterDischarge}`,
      priority: step.priority,
      dueDate,
      assignedCrmUserId,
      status: "Pending",
      notes: meta,
      createdBy: "system",
    });
  }

  console.log(`[post-care] Created ${steps.length} follow-up tasks for episode #${episodeId} using protocol #${protocolId}`);
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

  // Global error response interceptor — logs all 4xx/5xx API responses
  app.use("/api", (req: any, res: any, next: any) => {
    const origJson = res.json.bind(res);
    res.json = (body: any) => {
      const sc = res.statusCode;
      if (sc >= 400 && body?.message) {
        const skipPaths = ["/api/auth/", "/api/support-admin/login"];
        const shouldLog = !skipPaths.some(p => req.path.startsWith(p));
        if (shouldLog) {
          logSystemError(req, sc, body.message).catch(() => {});
        }
      }
      return origJson(body);
    };
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
          const crmUser = await storage.getCrmUser(crmUserId, sessionTid);
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

  async function getSessionCrmUserWithRole(req: any): Promise<{ id: number; name: string; roleCode: string; employeeName?: string } | null> {
    const sessionCrmUserId = (req as any).session?.crmUserId;
    if (!sessionCrmUserId) return null;
    const sessionTid = (req as any).session?.tenantId || defaultTid;
    const rows = await db
      .select({
        id: crmUsers.id,
        name: crmUsers.name,
        roleCode: systemRoles.code,
        accessScopeType: crmUsers.accessScopeType,
        systemRoleId: crmUsers.systemRoleId,
      })
      .from(crmUsers)
      // Join only on ID — tenantId check on the join caused null roleCode when role tenantId didn't match session tenantId
      .leftJoin(systemRoles, eq(crmUsers.systemRoleId, systemRoles.id))
      .where(and(eq(crmUsers.id, sessionCrmUserId), eq(crmUsers.tenantId, sessionTid)))
      .limit(1);
    if (!rows.length) return null;
    const row = rows[0];
    // Fallback: if role join returned nothing but user has All-scope access, treat as ADMIN
    let roleCode = row.roleCode || "";
    if (!roleCode && row.accessScopeType === "All") roleCode = "ADMIN";
    return { id: row.id, name: row.name || "", roleCode, employeeName: row.name || "" };
  }

  // Check if the current session user has a specific permission.
  // MUST live inside registerRoutes so it can access getSessionCrmUserWithRole and getDefaultTenantId.
  async function hasPermission(req: any, module: string, action: "canView" | "canCreate" | "canEdit" | "canDelete"): Promise<boolean> {
    try {
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser) return false;
      // SYS_ADMIN and ADMIN bypass all permission checks (Admins can do everything except delete)
      if (crmUser.roleCode === "SYS_ADMIN" || crmUser.roleCode === "ADMIN") return true;
      // User-level overrides take priority over role defaults
      const tid = await getDefaultTenantId(req);
      const now = new Date();
      const overrides = await db.select()
        .from(userPermissionOverrides)
        .where(and(
          eq(userPermissionOverrides.crmUserId, crmUser.id),
          eq(userPermissionOverrides.tenantId, tid),
          eq(userPermissionOverrides.module, module),
          eq(userPermissionOverrides.action, action),
          or(isNull(userPermissionOverrides.expiresAt), gte(userPermissionOverrides.expiresAt, now))
        ))
        .limit(1);
      if (overrides.length > 0) return overrides[0].isGranted;
      // Fall back to role permission defaults in DB
      const [rolePerm] = await db.select()
        .from(rolePermissions)
        .where(and(
          eq(rolePermissions.tenantId, tid),
          eq(rolePermissions.roleCode, crmUser.roleCode),
          eq(rolePermissions.module, module)
        ))
        .limit(1);
      if (rolePerm) return (rolePerm as any)[action] === true;
      // Final fallback: in-memory defaults
      return DEFAULT_ROLE_PERMISSIONS[crmUser.roleCode]?.[module]?.[action] ?? false;
    } catch (err: any) {
      console.error("[hasPermission] Error:", err.message);
      return false;
    }
  }

  // --- /api/me: Get current user's CRM profile with role ---
  app.get("/api/me", isAuthenticated, async (req, res) => {
    try {
      const session = req.session as any;
      const crmUserId = session.crmUserId;
      if (!crmUserId) return res.status(401).json({ message: "Unauthorized" });

      const sessionTid = (req.session as any).tenantId || tid;
      // Use direct ID lookup so SYS_ADMIN users (excluded from getCrmUsers) can also be found
      const crmUser = await storage.getCrmUser(crmUserId, sessionTid);

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
  app.post("/api/crm-users/:id/unlock", isAuthenticated, async (req: any, res) => {
    try {
      const reqTid = req.session?.tenantId || tid;
      const sessionCrmUserId = req.session?.crmUserId;
      const currentCrmUser = await storage.getCrmUser(sessionCrmUserId, reqTid);
      if (!currentCrmUser) return res.status(403).json({ message: "Not a CRM user" });

      let isAdmin = false;
      if (currentCrmUser.systemRoleId) {
        const allRoles = await storage.getMasterRecords("systemRoles", reqTid);
        const r = allRoles.find(r => r.id === currentCrmUser.systemRoleId);
        if (r && ((r as any).code === "ADMIN" || (r as any).code === "SYS_ADMIN")) isAdmin = true;
      }
      if (!isAdmin) return res.status(403).json({ message: "Only admins can unlock accounts" });

      const targetId = Number(req.params.id);
      const updated = await storage.updateCrmUser(targetId, reqTid, {
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      res.json({ success: true, userId: updated.id });
    } catch (error) {
      console.error("Error unlocking user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm-users/:id/set-password", isAuthenticated, async (req: any, res) => {
    try {
      const reqTid = req.session?.tenantId || tid;
      const sessionCrmUserId = req.session?.crmUserId;
      const currentCrmUser = await storage.getCrmUser(sessionCrmUserId, reqTid);
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
      if (!(await requireAdminRole(req, res, sessionTenantId))) return;

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
      if (!(await requireAdminRole(req, res, sessionTenantId))) return;

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
      res.status(500).json({ message: humanizeError(err) });
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

      await provisionNewTenant(newTenant.id);

      res.status(201).json(newTenant);
    } catch (err: any) {
      if (err.message?.includes("duplicate key")) {
        return res.status(400).json({ message: "A hospital with this subdomain already exists" });
      }
      res.status(400).json({ message: humanizeError(err) });
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
            const mapped = storage.mapRowToMaster(row);
            pendingItems.push({
              ...mapped,
              tableName: tbl,
              _allFields: row,
            });
          }
        } catch (_) { /* skip tables without approval_status */ }
      }

      res.json(pendingItems);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  // --- Leads (with access scope filtering + unified journey status) ---
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

    const leadIds = filtered.map(l => l.id);
    let episodeMap: Record<number, { episodeStatus: string; conversionStage: string | null; episodeId: number }> = {};
    if (leadIds.length > 0) {
      try {
        const episodeResult = await pool.query(`
          SELECT DISTINCT ON (e.lead_id)
            e.lead_id, e.id as episode_id, e.status as episode_status, cs.name as conversion_stage
          FROM episodes e
          LEFT JOIN conversion_stages cs ON cs.id = e.conversion_stage_id
          WHERE e.lead_id = ANY($1) AND e.tenant_id = $2
          ORDER BY e.lead_id, e.id DESC
        `, [leadIds, reqTid]);
        for (const row of episodeResult.rows) {
          episodeMap[row.lead_id] = {
            episodeStatus: row.episode_status,
            conversionStage: row.conversion_stage,
            episodeId: row.episode_id,
          };
        }
      } catch (err) {
        console.error("[leads] Error fetching episode statuses:", err);
      }
    }

    const enriched = filtered.map(l => ({
      ...l,
      latestEpisodeStatus: episodeMap[l.id]?.episodeStatus || null,
      latestConversionStage: episodeMap[l.id]?.conversionStage || null,
      latestEpisodeId: episodeMap[l.id]?.episodeId || null,
    }));

    const phiLevel = crmUser?.phiAccessLevel || "None";
    res.json(applyPhiMasking(enriched, phiLevel));
  });

  app.get("/api/leads/last-calls", isAuthenticated, async (req: any, res) => {
    try {
      const reqTid = req.session?.tenantId || tid;
      const lastCallsResult = await pool.query(`
        SELECT DISTINCT ON (lead_id) 
          id, lead_id, description, call_direction, call_duration_seconds, call_status, 
          outcome, created_by, created_at, metadata
        FROM activities 
        WHERE tenant_id = $1 AND type = 'call' AND lead_id IS NOT NULL
        ORDER BY lead_id, created_at DESC NULLS LAST, id DESC
      `, [reqTid]);
      const lastCallMap: Record<number, any> = {};
      lastCallsResult.rows.forEach((row: any) => {
        lastCallMap[row.lead_id] = {
          id: row.id,
          leadId: row.lead_id,
          description: row.description,
          callDirection: row.call_direction,
          callDurationSeconds: row.call_duration_seconds,
          callStatus: row.call_status,
          outcome: row.outcome,
          createdBy: row.created_by,
          createdAt: row.created_at,
          metadata: row.metadata,
        };
      });
      res.json(lastCallMap);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/leads/pending-handovers", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const sessionCrmUserId = req.session?.crmUserId;
      if (!sessionCrmUserId) return res.json([]);

      const allLeads = await storage.getLeads(tid);
      const allCrmUsers = await storage.getCrmUsers(tid);

      const pending = allLeads.filter(l =>
        l.handoverStatus === "Pending" &&
        l.handoverToUserId === sessionCrmUserId
      );

      const enriched = pending.map(l => {
        const fromUser = allCrmUsers.find((u: any) => u.id === l.handoverFromUserId);
        return {
          id: l.id,
          patientName: l.name,
          status: l.status,
          handoverFromUserId: l.handoverFromUserId,
          handoverFromUserName: fromUser?.name || `User #${l.handoverFromUserId}`,
          handoverAt: l.handoverAt,
          handoverReason: l.handoverReason,
        };
      });

      res.json(enriched);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch pending handovers" });
    }
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/leads/check-duplicate", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const mobile = req.query.mobile as string;
      if (!mobile || mobile.trim().length < 7) {
        return res.json({ isDuplicate: false });
      }
      const normalized = normalizePhone(mobile);
      const closedStatuses = ["Closed Won", "Closed Lost", "Unqualified"];
      const result = await pool.query(
        `SELECT l.id, l.name, l.status, l.phone_e164, l.created_at,
          cu.name as assigned_to_name
        FROM leads l
        LEFT JOIN crm_users cu ON l.assigned_crm_user_id = cu.id
        WHERE l.tenant_id = $1 AND l.mobile_normalized = $2
          AND (l.merge_status IS NULL OR l.merge_status = 'ACTIVE')
          AND l.status NOT IN (${closedStatuses.map((_, i) => `$${i + 3}`).join(",")})
          AND l.status NOT LIKE '%Closed%'
        ORDER BY l.created_at DESC LIMIT 1`,
        [tid, normalized, ...closedStatuses]
      );
      if (result.rows.length > 0) {
        const row = result.rows[0];
        return res.json({
          isDuplicate: true,
          existingLead: {
            id: row.id,
            name: row.name,
            status: row.status,
            phone: row.phone_e164,
            assignedTo: row.assigned_to_name || "Unassigned",
            createdAt: row.created_at,
          },
        });
      }
      // Also check contact person phones linked to leads
      const cpResult = await pool.query(
        `SELECT l.id, l.name, l.status, l.phone_e164, l.created_at,
          cu.name as assigned_to_name, cp.name as contact_person_name, lcp.relationship as cp_relationship
        FROM contact_persons cp
        JOIN lead_contact_persons lcp ON lcp.contact_person_id = cp.id
        JOIN leads l ON l.id = lcp.lead_id
        LEFT JOIN crm_users cu ON l.assigned_crm_user_id = cu.id
        WHERE cp.tenant_id = $1 AND cp.phone_e164 = $2
          AND (l.merge_status IS NULL OR l.merge_status = 'ACTIVE')
          AND l.status NOT IN (${closedStatuses.map((_, i) => `$${i + 3}`).join(",")})
          AND l.status NOT LIKE '%Closed%'
        ORDER BY l.created_at DESC LIMIT 1`,
        [tid, mobile, ...closedStatuses]
      );
      if (cpResult.rows.length > 0) {
        const row = cpResult.rows[0];
        return res.json({
          isDuplicate: true,
          matchType: "contact_person",
          existingLead: {
            id: row.id,
            name: row.name,
            status: row.status,
            phone: row.phone_e164,
            assignedTo: row.assigned_to_name || "Unassigned",
            createdAt: row.created_at,
            matchedVia: `Contact: ${row.contact_person_name} (${row.cp_relationship})`,
          },
        });
      }
      res.json({ isDuplicate: false });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/leads/duplicates", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const mobile = req.query.mobile as string | undefined;

      let query: string;
      let params: any[];

      if (mobile) {
        const normalized = normalizePhone(mobile);
        query = `
          SELECT l.id, l.name, l.phone_e164, l.mobile_normalized, l.email, l.status,
            l.created_at, l.last_activity_at, l.lead_temperature, l.lead_source_id,
            l.assigned_crm_user_id, l.notes, l.tags, l.campaign_id,
            cu.name as assigned_to_name,
            ls.name as source_name
          FROM leads l
          LEFT JOIN crm_users cu ON l.assigned_crm_user_id = cu.id
          LEFT JOIN lead_sources ls ON l.lead_source_id = ls.id
          WHERE l.tenant_id = $1 AND (l.mobile_normalized = $2 OR l.phone_e164 = $2) AND l.merge_status = 'ACTIVE'
          ORDER BY l.last_activity_at DESC NULLS LAST, l.created_at DESC
        `;
        params = [tid, normalized];
      } else {
        query = `
          SELECT COALESCE(l.mobile_normalized, l.phone_e164) as mobile_normalized, 
            json_agg(json_build_object(
              'id', l.id, 'name', l.name, 'phone', l.phone_e164, 'email', l.email,
              'status', l.status, 'createdAt', l.created_at, 'lastActivityAt', l.last_activity_at,
              'temperature', l.lead_temperature
            ) ORDER BY l.created_at DESC) as leads, count(*) as lead_count
          FROM leads l
          WHERE l.tenant_id = $1 AND l.merge_status = 'ACTIVE' 
            AND COALESCE(l.mobile_normalized, l.phone_e164) IS NOT NULL
          GROUP BY COALESCE(l.mobile_normalized, l.phone_e164)
          HAVING count(*) > 1
          ORDER BY count(*) DESC
          LIMIT 100
        `;
        params = [tid];
      }

      const result = await pool.query(query, params);

      if (mobile) {
        res.json({ leads: result.rows, count: result.rows.length });
      } else {
        res.json({
          groups: result.rows.map((r: any) => ({
            mobileNormalized: r.mobile_normalized,
            leads: r.leads,
            count: Number(r.lead_count),
          })),
        });
      }
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/leads/merge-roles", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const allowedRoles = await getMergeAllowedRoles(tid);
      res.json({ allowedRoles });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get(api.leads.get.path, isAuthenticated, async (req: any, res) => {
    const lead = await storage.getLead(Number(req.params.id));
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    const reqTid = req.session?.tenantId;
    const sessionCrmUserId = req.session?.crmUserId;
    if (sessionCrmUserId && reqTid) {
      const [crmUser] = await db.select().from(crmUsers).where(eq(crmUsers.id, sessionCrmUserId));
      const phiLevel = crmUser?.phiAccessLevel || "None";
      logAccess(reqTid, sessionCrmUserId, "VIEW", "lead", lead.id, null, req);
      return res.json(applyPhiMasking(lead, phiLevel));
    }
    res.json(lead);
  });

  app.post(api.leads.create.path, isAuthenticated, async (req, res) => {
    try {
      if (!(await hasPermission(req, "leads", "canCreate"))) {
        const sessionUser = await getSessionCrmUserWithRole(req);
        await logSystemError(req, 403, "You do not have permission to create leads", `User: ${sessionUser?.name || "unknown"} (${sessionUser?.roleCode || "no-role"}), Endpoint: POST /api/leads`);
        return res.status(403).json({ message: "You do not have permission to create leads" });
      }
      const tid = await getDefaultTenantId(req);
      const input = api.leads.create.input.parse({ ...req.body, tenantId: tid });
      if (input.phoneE164) {
        (input as any).mobileNormalized = normalizePhone(input.phoneE164);
      }
      const closedStatuses = ["Closed Won", "Closed Lost", "Unqualified"];
      if (input.phoneE164) {
        const dupResult = await pool.query(
          `SELECT l.id, l.name, l.status, l.created_at, cu.name as assigned_to_name
           FROM leads l
           LEFT JOIN crm_users cu ON l.assigned_crm_user_id = cu.id
           WHERE l.tenant_id = $1 AND l.mobile_normalized = $2
           AND (l.merge_status IS NULL OR l.merge_status = 'ACTIVE')
           AND l.status NOT IN (${closedStatuses.map((_, i) => `$${i + 3}`).join(",")})
           AND l.status NOT LIKE '%Closed%'
           LIMIT 1`,
          [tid, (input as any).mobileNormalized, ...closedStatuses]
        );
        if (dupResult.rows.length > 0) {
          const dup = dupResult.rows[0];
          return res.status(409).json({
            message: `A lead with this mobile number already exists: ${dup.name} (${dup.status})`,
            existingLeadId: dup.id,
            existingLead: {
              id: dup.id,
              name: dup.name,
              status: dup.status,
              assignedTo: dup.assigned_to_name || "Unassigned",
              createdAt: dup.created_at,
            },
          });
        }
        // Also check contact person phone duplicates
        const cpDupResult = await pool.query(
          `SELECT l.id, l.name, l.status, l.created_at, cu.name as assigned_to_name, cp.name as cp_name, lcp.relationship as cp_rel
           FROM contact_persons cp
           JOIN lead_contact_persons lcp ON lcp.contact_person_id = cp.id
           JOIN leads l ON l.id = lcp.lead_id
           LEFT JOIN crm_users cu ON l.assigned_crm_user_id = cu.id
           WHERE cp.tenant_id = $1 AND cp.phone_e164 = $2
           AND (l.merge_status IS NULL OR l.merge_status = 'ACTIVE')
           AND l.status NOT IN (${closedStatuses.map((_, i) => `$${i + 3}`).join(",")})
           AND l.status NOT LIKE '%Closed%'
           LIMIT 1`,
          [tid, input.phoneE164, ...closedStatuses]
        );
        if (cpDupResult.rows.length > 0) {
          const dup = cpDupResult.rows[0];
          return res.status(409).json({
            message: `This phone matches a contact person (${dup.cp_name}, ${dup.cp_rel}) linked to an existing lead: ${dup.name}`,
            existingLeadId: dup.id,
            existingLead: {
              id: dup.id,
              name: dup.name,
              status: dup.status,
              assignedTo: dup.assigned_to_name || "Unassigned",
              createdAt: dup.created_at,
              matchedVia: `Contact: ${dup.cp_name} (${dup.cp_rel})`,
            },
          });
        }
      }
      const sessionCrmUserId = (req.session as any)?.crmUserId;
      if (sessionCrmUserId) {
        const crmUserResult = await pool.query(
          `SELECT cu.id, cu.name, sr.code as role_code, cu.branch_id
           FROM crm_users cu
           LEFT JOIN system_roles sr ON cu.system_role_id = sr.id
           WHERE cu.id = $1 AND cu.tenant_id = $2 AND cu.is_active = true
           LIMIT 1`,
          [sessionCrmUserId, tid]
        );
        const creatingUser = crmUserResult.rows[0];
        if (creatingUser) {
          if (!input.assignedCrmUserId) {
            (input as any).assignedCrmUserId = creatingUser.id;
          }
          if (!(input as any).primaryOwnerUserId) {
            (input as any).primaryOwnerUserId = creatingUser.id;
          }
          if (!(input as any).ownerTeam) {
            const roleTeamMap: Record<string, string> = {
              PATIENT_COORDINATOR: "Telecalling", COUNSELLOR: "Front Office", MANAGER: "Management", ADMIN: "Management"
            };
            (input as any).ownerTeam = roleTeamMap[creatingUser.role_code] || "Telecalling";
          }
        }
      }
      (input as any).lastActivityAt = new Date();

      if (!input.leadSourceId) {
        const [directSource] = await db.select().from(leadSources)
          .where(and(eq(leadSources.tenantId, tid), eq(leadSources.code, "DIRECT_CRM")));
        if (directSource) {
          (input as any).leadSourceId = directSource.id;
        }
      }

      // Reachability validation: must have phoneE164 or at least one contact person with a phone
      const inlineContacts: any[] = Array.isArray(req.body.contactPersons) ? req.body.contactPersons : [];
      const hasPhone = !!(input.phoneE164 && input.phoneE164.trim());
      const hasContactPhone = inlineContacts.some((c: any) => c.phoneE164 && c.phoneE164.trim());
      if (!hasPhone && !hasContactPhone) {
        return res.status(400).json({
          message: "A lead must have at least one reachable phone number — either a direct phone or via a linked contact person.",
          field: "phoneE164",
        });
      }

      // Create lead and inline contact persons in a single transaction
      const lead = await db.transaction(async (tx) => {
        const [newLead] = await tx.insert(leads).values(input as any).returning();
        for (const cpData of inlineContacts) {
          let cpId = cpData.contactPersonId;
          if (cpId) {
            // Verify tenant ownership of existing contact person
            const [existingCp] = await tx.select({ id: contactPersons.id })
              .from(contactPersons)
              .where(and(eq(contactPersons.id, Number(cpId)), eq(contactPersons.tenantId, tid)));
            if (!existingCp) throw new Error(`Contact person ${cpId} not found in this tenant`);
          } else {
            // Create new contact person
            const [newCp] = await tx.insert(contactPersons).values({
              tenantId: tid,
              name: cpData.name,
              phoneE164: cpData.phoneE164 || null,
              whatsappNumber: cpData.whatsappNumber || null,
              email: cpData.email || null,
              relationship: cpData.relationship || "Other",
            }).returning();
            cpId = newCp.id;
          }
          await tx.insert(leadContactPersons).values({
            tenantId: tid,
            leadId: newLead.id,
            contactPersonId: cpId,
            relationship: cpData.relationship || "Other",
            isPrimary: cpData.isPrimary || false,
            isBillingContact: cpData.isBillingContact || false,
            isEmergencyContact: cpData.isEmergencyContact || false,
            isWhatsAppConsentHolder: cpData.isWhatsAppConsentHolder || false,
            isAppointmentCoordinator: cpData.isAppointmentCoordinator || false,
          });
        }
        return newLead;
      });

      res.status(201).json(lead);
    } catch (err: any) {
      if (err?.code === "23505") {
        const dupResult = await pool.query(
          `SELECT l.id, l.name, l.status, l.created_at, cu.name as assigned_to_name
           FROM leads l LEFT JOIN crm_users cu ON l.assigned_crm_user_id = cu.id
           WHERE l.tenant_id = $1 AND l.mobile_normalized = $2 LIMIT 1`,
          [await getDefaultTenantId(req), normalizePhone(req.body.phoneE164)]
        );
        const dup = dupResult.rows[0];
        return res.status(409).json({
          message: `A lead with this mobile number already exists${dup ? `: ${dup.name} (${dup.status})` : ""}`,
          existingLeadId: dup?.id,
          existingLead: dup ? { id: dup.id, name: dup.name, status: dup.status, assignedTo: dup.assigned_to_name || "Unassigned", createdAt: dup.created_at } : undefined,
        });
      }
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.patch(api.leads.update.path, isAuthenticated, async (req, res) => {
    try {
      if (!(await hasPermission(req, "leads", "canEdit"))) {
        return res.status(403).json({ message: "You do not have permission to edit leads" });
      }
      const body = coerceDateFields(req.body, ["nextActionDate"]);
      const input = api.leads.update.input.parse(body);
      const leadId = Number(req.params.id);
      if (input.phoneE164) {
        (input as any).mobileNormalized = normalizePhone(input.phoneE164);
        const tid = await getDefaultTenantId(req);
        const closedStatuses = ["Closed Won", "Closed Lost", "Unqualified"];
        const dupResult = await pool.query(
          `SELECT l.id, l.name, l.status, l.created_at, cu.name as assigned_to_name
           FROM leads l
           LEFT JOIN crm_users cu ON l.assigned_crm_user_id = cu.id
           WHERE l.tenant_id = $1 AND l.mobile_normalized = $2
           AND l.id != $3
           AND (l.merge_status IS NULL OR l.merge_status = 'ACTIVE')
           AND l.status NOT IN (${closedStatuses.map((_, i) => `$${i + 4}`).join(",")})
           AND l.status NOT LIKE '%Closed%'
           LIMIT 1`,
          [tid, (input as any).mobileNormalized, leadId, ...closedStatuses]
        );
        if (dupResult.rows.length > 0) {
          const dup = dupResult.rows[0];
          return res.status(409).json({
            message: `A lead with this mobile number already exists: ${dup.name} (${dup.status})`,
            existingLeadId: dup.id,
            existingLead: {
              id: dup.id,
              name: dup.name,
              status: dup.status,
              assignedTo: dup.assigned_to_name || "Unassigned",
              createdAt: dup.created_at,
            },
          });
        }
        // Also check contact person phone duplicates for update
        const cpDupResult = await pool.query(
          `SELECT l.id, l.name, l.status, l.created_at, cu.name as assigned_to_name, cp.name as cp_name, lcp.relationship as cp_rel
           FROM contact_persons cp
           JOIN lead_contact_persons lcp ON lcp.contact_person_id = cp.id
           JOIN leads l ON l.id = lcp.lead_id
           LEFT JOIN crm_users cu ON l.assigned_crm_user_id = cu.id
           WHERE cp.tenant_id = $1 AND cp.phone_e164 = $2 AND l.id != $3
           AND (l.merge_status IS NULL OR l.merge_status = 'ACTIVE')
           AND l.status NOT IN (${closedStatuses.map((_, i) => `$${i + 4}`).join(",")})
           AND l.status NOT LIKE '%Closed%'
           LIMIT 1`,
          [tid, input.phoneE164, leadId, ...closedStatuses]
        );
        if (cpDupResult.rows.length > 0) {
          const dup = cpDupResult.rows[0];
          return res.status(409).json({
            message: `This phone matches a contact person (${dup.cp_name}) linked to another lead: ${dup.name}`,
            existingLeadId: dup.id,
            existingLead: {
              id: dup.id,
              name: dup.name,
              status: dup.status,
              assignedTo: dup.assigned_to_name || "Unassigned",
              createdAt: dup.created_at,
              matchedVia: `Contact: ${dup.cp_name} (${dup.cp_rel})`,
            },
          });
        }
      }

      const oldLead = await storage.getLead(leadId);

      // Pre-write reachability guard: validate BEFORE updating lead to keep the write atomic
      // (only relevant when phoneE164 is being cleared)
      if ("phoneE164" in input && (input.phoneE164 === null || input.phoneE164 === "")) {
        const tidForCheck = await getDefaultTenantId(req);
        const cpRows = await pool.query(
          `SELECT cp.phone_e164 FROM lead_contact_persons lcp
           JOIN contact_persons cp ON cp.id = lcp.contact_person_id
           WHERE lcp.lead_id = $1 AND lcp.tenant_id = $2
           AND cp.phone_e164 IS NOT NULL AND cp.phone_e164 != ''
           LIMIT 1`,
          [leadId, tidForCheck]
        );
        if (cpRows.rows.length === 0) {
          return res.status(400).json({
            message: "Cannot remove the phone number — the lead would have no reachable contact. Add a contact person with a phone first.",
            field: "phoneE164",
          });
        }
      }

      let lead = await storage.updateLead(leadId, input);

      if (input.status === "Nurture" && oldLead?.status !== "Nurture") {
        try {
          const tid = await getDefaultTenantId(req);
          const userId = String((req as any).session?.crmUserId || "system");
          await createNurtureTaskChain(leadId, tid, lead.assignedCrmUserId || null, userId);
        } catch (nurtureErr: any) {
          console.error("Nurture task chain creation failed:", nurtureErr.message);
        }
      }

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
      res.status(500).json({ message: humanizeError(err) });
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
        { code: "CALLYZER", name: "Telephony", displayOrder: 17 },
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // --- Tasks ---
  app.get(api.tasks.list.path, isAuthenticated, async (req, res) => {
    const tid = await getDefaultTenantId(req);
    const leadId = req.query.leadId ? Number(req.query.leadId) : undefined;
    const allTasks = await storage.getTasks(tid, leadId);

    const taskIds = allTasks.map(t => t.id);
    if (taskIds.length === 0) return res.json(allTasks);

    const nameResult = await pool.query(
      `SELECT t.id as task_id, cu.name as assigned_to_name
       FROM tasks t
       LEFT JOIN crm_users cu ON t.assigned_crm_user_id = cu.id
       WHERE t.id = ANY($1)`,
      [taskIds]
    );
    const nameMap = new Map(nameResult.rows.map((r: any) => [r.task_id, r.assigned_to_name]));

    const enriched = allTasks.map(t => ({
      ...t,
      assignedToName: nameMap.get(t.id) || null,
    }));
    res.json(enriched);
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
      const taskId = Number(req.params.id);
      const task = await storage.updateTask(taskId, input);

      if (input.status === "Completed") {
        try {
          const tid = await getDefaultTenantId(req);
          const userId = String((req as any).session?.crmUserId || "system");
          const outcome = (req.body as any).nurtureOutcome || null;
          await processNurtureTaskCompletion(taskId, tid, outcome, userId);
        } catch {}
      }

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
      return res.status(500).json({ message: humanizeError(err) });
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
      return res.status(500).json({ message: humanizeError(err) });
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
      return res.status(500).json({ message: humanizeError(err) });
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

  // =============================================
  // LEAD MERGE — DUPLICATE DETECTION & MERGE
  // =============================================

  const DEFAULT_MERGE_ROLES = ["SYS_ADMIN", "ADMIN", "MANAGER"];

  async function getMergeAllowedRoles(tenantId: number): Promise<string[]> {
    const configured = await db
      .select({ roleCode: leadMergeRoles.roleCode })
      .from(leadMergeRoles)
      .where(and(eq(leadMergeRoles.tenantId, tenantId), eq(leadMergeRoles.isActive, true)));
    return configured.length > 0 ? configured.map(r => r.roleCode) : DEFAULT_MERGE_ROLES;
  }

  const LEAD_STATUS_FUNNEL_ORDER: Record<string, number> = {
    "Raw Lead Captured": 1,
    "Contacted": 2,
    "Qualified": 3,
    "Nurture": 4,
    "Appointment Booked": 5,
    "Checked In": 6,
    "Consultation Done": 7,
    "Episode Created": 8,
    "Estimate Shared": 9,
    "Negotiation": 10,
    "Closed Won": 11,
    "Closed Lost": 0,
    "Unqualified": 0,
  };

  // =============================================
  // LEAD JOURNEY AGGREGATION ENDPOINT
  // =============================================
  app.get("/api/leads/:id/journey", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const leadId = Number(req.params.id);
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const offset = Number(req.query.offset) || 0;

      const lead = await storage.getLead(leadId);
      if (!lead || lead.tenantId !== tid) {
        return res.status(404).json({ message: "Lead not found" });
      }

      const [episodesResult, activitiesResult, appointmentsResult, episodeAuditResult, tasksResult] = await Promise.all([
        pool.query(`
          SELECT e.id, e.episode_name, e.status, e.start_date, e.end_date, e.created_at, e.modified_at,
            e.estimated_cost, e.final_estimated_amount, e.revenue_probability, e.expected_revenue_amount,
            e.insurance_applicable, e.lost_at_stage, e.lost_notes, e.episode_type, e.priority,
            d.name as doctor_name, td.name as department_name
          FROM episodes e
          LEFT JOIN crm_users d ON e.doctor_id = d.id
          LEFT JOIN treatment_departments td ON e.treatment_department_id = td.id
          WHERE e.lead_id = $1 AND e.tenant_id = $2
          ORDER BY e.created_at DESC
        `, [leadId, tid]),

        pool.query(`
          SELECT a.id, a.type, a.description, a.created_at,
            a.old_status, a.new_status, a.outcome, a.metadata,
            a.call_direction, a.call_duration_seconds as call_duration, a.call_status as call_type,
            COALESCE(cu.name, a.created_by) as created_by_name
          FROM activities a
          LEFT JOIN crm_users cu ON a.created_by = cu.id::text AND cu.tenant_id = $2
          WHERE a.lead_id = $1 AND a.tenant_id = $2
          ORDER BY a.created_at DESC
          LIMIT $3 OFFSET $4
        `, [leadId, tid, limit, offset]),

        pool.query(`
          SELECT ap.id, ap.appointment_date, ap.start_time, ap.end_time, ap.status, ap.checked_in_at,
            ap.notes, ap.created_at, ap.token_number, ap.reschedule_count, ap.no_show_reason_id,
            at2.name as appointment_type_name,
            d.name as doctor_name, b.name as branch_name,
            ap.booked_by_crm_user_id, bcu.name as booked_by_name
          FROM appointments ap
          LEFT JOIN crm_users d ON ap.doctor_id = d.id
          LEFT JOIN branches b ON ap.branch_id = b.id
          LEFT JOIN appointment_types at2 ON ap.appointment_type_id = at2.id
          LEFT JOIN crm_users bcu ON ap.booked_by_crm_user_id = bcu.id
          WHERE ap.lead_id = $1 AND ap.tenant_id = $2
          ORDER BY ap.appointment_date DESC NULLS LAST, ap.created_at DESC
          LIMIT $3
        `, [leadId, tid, limit]),

        pool.query(`
          SELECT al.id, al.entity_type, al.entity_id, al.action, al.old_values, al.new_values,
            al.changed_fields, al.performed_by, al.created_at
          FROM audit_logs al
          WHERE al.entity_type = 'episode' AND al.tenant_id = $1
            AND al.entity_id IN (SELECT id FROM episodes WHERE lead_id = $2 AND tenant_id = $1)
          ORDER BY al.created_at DESC
          LIMIT $3
        `, [tid, leadId, limit]),

        pool.query(`
          SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
            t.completed_at, t.created_at, t.notes,
            cu.name as assigned_to_name,
            tc.name as category_name
          FROM tasks t
          LEFT JOIN crm_users cu ON t.assigned_crm_user_id = cu.id
          LEFT JOIN task_categories tc ON t.task_category_id = tc.id
          WHERE t.lead_id = $1 AND t.tenant_id = $2
          ORDER BY t.created_at DESC
          LIMIT $3
        `, [leadId, tid, limit]),
      ]);

      const episodes = episodesResult.rows;
      const latestEpisode = episodes[0] || null;

      const unifiedEvents: any[] = [];

      for (const a of activitiesResult.rows) {
        unifiedEvents.push({
          id: `act-${a.id}`,
          source: "Lead",
          type: a.type,
          description: a.description,
          timestamp: a.created_at,
          performedBy: a.created_by_name,
          oldStatus: a.old_status,
          newStatus: a.new_status,
          outcome: a.outcome,
          metadata: a.metadata,
          callDirection: a.call_direction,
          callDuration: a.call_duration,
          callType: a.call_type,
        });
      }

      for (const ap of appointmentsResult.rows) {
        const apptDateStr = ap.appointment_date ? format_date(ap.appointment_date) : null;
        const apptDesc = [
          ap.appointment_type_name || "Appointment",
          ap.doctor_name ? `with Dr. ${ap.doctor_name}` : "",
          ap.branch_name ? `at ${ap.branch_name}` : "",
          apptDateStr ? `on ${apptDateStr}` : "",
          ap.start_time ? `at ${ap.start_time}` : "",
          ap.token_number ? `(Token #${ap.token_number})` : "",
        ].filter(Boolean).join(" ");

        unifiedEvents.push({
          id: `apt-${ap.id}`,
          source: "Appointment",
          type: "appointment",
          description: apptDesc,
          timestamp: ap.created_at,
          appointmentDate: ap.appointment_date,
          appointmentTime: ap.start_time || null,
          appointmentEndTime: ap.end_time || null,
          tokenNumber: ap.token_number,
          appointmentStatus: ap.status,
          checkedInAt: ap.checked_in_at,
          doctorName: ap.doctor_name,
          branchName: ap.branch_name,
          bookedByName: ap.booked_by_name,
          rescheduleCount: ap.reschedule_count,
          notes: ap.notes,
        });
      }

      for (const al of episodeAuditResult.rows) {
        const ep = episodes.find((e: any) => e.id === al.entity_id);
        const oldVals = typeof al.old_values === "string" ? JSON.parse(al.old_values) : al.old_values;
        const newVals = typeof al.new_values === "string" ? JSON.parse(al.new_values) : al.new_values;
        unifiedEvents.push({
          id: `epl-${al.id}`,
          source: "Episode",
          type: al.action,
          description: al.action === "status_change"
            ? `${ep?.episode_name || "Episode"}: ${oldVals?.status || "?"} → ${newVals?.status || "?"}`
            : `${ep?.episode_name || "Episode"}: ${al.action.replace(/_/g, " ")}`,
          timestamp: al.created_at,
          performedBy: al.performed_by,
          episodeId: al.entity_id,
          episodeName: ep?.episode_name,
          oldStatus: oldVals?.status,
          newStatus: newVals?.status,
          action: al.action,
          changedFields: al.changed_fields,
        });
      }

      for (const t of tasksResult.rows) {
        const isPostCare = (t.category_name || "").toLowerCase().includes("post care")
          || (t.title || "").toLowerCase().includes("physio")
          || (t.title || "").toLowerCase().includes("dressing")
          || (t.title || "").toLowerCase().includes("home visit")
          || (t.title || "").toLowerCase().includes("stitch removal");
        unifiedEvents.push({
          id: `tsk-${t.id}`,
          source: isPostCare ? "Post Care" : "Task",
          type: "task",
          description: t.title,
          timestamp: t.created_at,
          taskStatus: t.status,
          taskPriority: t.priority,
          dueDate: t.due_date,
          completedAt: t.completed_at,
          assignedToName: t.assigned_to_name,
          categoryName: t.category_name,
          notes: t.notes,
        });
      }

      unifiedEvents.push({
        id: `lead-created`,
        source: "Lead",
        type: "lead_created",
        description: `Lead created: ${lead.name}${lead.phoneE164 ? ` (${lead.phoneE164})` : ""}`,
        timestamp: lead.createdAt,
        performedBy: null,
        newStatus: lead.status,
      });

      if (lead.status && lead.status !== "Raw Lead Captured") {
        unifiedEvents.push({
          id: `lead-status-current`,
          source: "Lead",
          type: "status_change",
          description: `Lead status: ${lead.status}`,
          timestamp: lead.lastActivityAt || lead.updatedAt || lead.createdAt,
          newStatus: lead.status,
        });
      }

      for (const ep of episodes) {
        unifiedEvents.push({
          id: `ep-created-${ep.id}`,
          source: "Episode",
          type: "episode_created",
          description: `Episode created: ${ep.episode_name || "New Episode"} — ${ep.doctor_name || ""}`,
          timestamp: ep.created_at,
          episodeId: ep.id,
          episodeName: ep.episode_name,
          newStatus: ep.status,
        });
      }

      unifiedEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      let quickStatus = "Active";
      if (latestEpisode) {
        if (latestEpisode.status === "Completed") quickStatus = "Completed";
        else if (latestEpisode.status === "Discontinued") quickStatus = "Discontinued";
      } else {
        if (lead.status === "Closed Won") quickStatus = "Completed";
        else if (lead.status === "Closed Lost") quickStatus = "Discontinued";
      }

      const upcomingAppt = appointmentsResult.rows.find((a: any) =>
        a.status === "Scheduled" || a.status === "Confirmed"
      );

      res.json({
        leadSummary: {
          id: lead.id,
          name: lead.name,
          status: lead.status,
          leadTemperature: lead.leadTemperature,
          ownerTeam: lead.ownerTeam,
          quickStatus,
          episodeCount: episodes.length,
          latestEpisodeStage: latestEpisode?.status || null,
          latestEpisodeRevenueProbability: latestEpisode?.revenue_probability || null,
          latestEpisodeExpectedRevenue: latestEpisode?.expected_revenue_amount || null,
        },
        upcomingAppointment: upcomingAppt ? {
          id: upcomingAppt.id,
          appointmentDate: upcomingAppt.appointment_date,
          startTime: upcomingAppt.start_time,
          endTime: upcomingAppt.end_time,
          status: upcomingAppt.status,
          doctorName: upcomingAppt.doctor_name,
          branchName: upcomingAppt.branch_name,
          tokenNumber: upcomingAppt.token_number,
          checkedInAt: upcomingAppt.checked_in_at,
          appointmentTypeName: upcomingAppt.appointment_type_name,
        } : null,
        episodes: episodes.map((e: any) => ({
          id: e.id,
          episodeName: e.episode_name,
          status: e.status,
          startDate: e.start_date,
          endDate: e.end_date,
          createdAt: e.created_at,
          updatedAt: e.modified_at,
          estimatedCost: e.estimated_cost,
          finalEstimatedAmount: e.final_estimated_amount,
          revenueProbability: e.revenue_probability,
          expectedRevenueAmount: e.expected_revenue_amount,
          insuranceApplicable: e.insurance_applicable,
          lostAtStage: e.lost_at_stage,
          lostNotes: e.lost_notes,
          episodeType: e.episode_type,
          priority: e.priority,
          doctorName: e.doctor_name,
          departmentName: e.department_name,
        })),
        unifiedTimeline: unifiedEvents.slice(0, limit),
        totalEvents: unifiedEvents.length,
        hasMore: unifiedEvents.length > limit,
      });
    } catch (err: any) {
      console.error("[journey] Error for lead", req.params.id, ":", err.message, err.code, err.detail);
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/leads/:id/merge-preview", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const primaryId = Number(req.params.id);
      const withIds = (req.query.with as string || "").split(",").map(Number).filter(Boolean);

      if (withIds.length === 0) {
        return res.status(400).json({ message: "Provide ?with=id1,id2 for merge preview" });
      }

      const allIds = [primaryId, ...withIds];
      const leadsResult = await pool.query(
        `SELECT l.*, cu.name as assigned_to_name, ls.name as source_name
         FROM leads l
         LEFT JOIN crm_users cu ON l.assigned_crm_user_id = cu.id
         LEFT JOIN lead_sources ls ON l.lead_source_id = ls.id
         WHERE l.id = ANY($1) AND l.tenant_id = $2 AND l.merge_status = 'ACTIVE'`,
        [allIds, tid]
      );

      if (leadsResult.rows.length < 2) {
        return res.status(400).json({ message: "At least 2 active leads required for merge" });
      }

      const recordCounts: Record<number, Record<string, number>> = {};
      for (const lid of allIds) {
        const counts: Record<string, number> = {};
        const tables = [
          { name: "activities", col: "lead_id" },
          { name: "tasks", col: "lead_id" },
          { name: "episodes", col: "lead_id" },
          { name: "appointments", col: "lead_id" },
          { name: "temperature_logs", col: "lead_id" },
          { name: "callyzer_webhook_logs", col: "matched_lead_id" },
        ];
        for (const t of tables) {
          const r = await pool.query(
            `SELECT count(*) as cnt FROM ${t.name} WHERE ${t.col} = $1 AND tenant_id = $2`,
            [lid, tid]
          );
          counts[t.name] = Number(r.rows[0].cnt);
        }
        const hlr = await pool.query(
          `SELECT count(*) as cnt FROM handover_logs WHERE entity_type = 'Lead' AND entity_id = $1 AND tenant_id = $2`,
          [lid, tid]
        );
        counts["handover_logs"] = Number(hlr.rows[0].cnt);
        recordCounts[lid] = counts;
      }

      const mergeFields = [
        "name", "email", "status", "notes", "tags", "address", "pinCode",
        "leadSourceId", "campaignId", "assignedCrmUserId", "doctorId",
        "treatmentDepartmentId", "utmSource", "utmMedium", "utmCampaign",
        "gender", "dateOfBirth", "bloodGroup", "insuranceProvider", "insurancePolicyNumber",
      ];

      const fieldComparison: Record<string, Record<number, any>> = {};
      for (const field of mergeFields) {
        const snakeField = field.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
        const values: Record<number, any> = {};
        for (const row of leadsResult.rows) {
          values[row.id] = row[snakeField] ?? null;
        }
        const hasConflict = new Set(Object.values(values).filter(v => v != null)).size > 1;
        if (hasConflict || Object.values(values).some(v => v != null)) {
          fieldComparison[field] = values;
        }
      }

      res.json({
        leads: leadsResult.rows,
        fieldComparison,
        recordCounts,
        recommendation: {
          primaryLeadId: leadsResult.rows.reduce((best: any, row: any) => {
            const bestOrder = LEAD_STATUS_FUNNEL_ORDER[best.status] || 0;
            const rowOrder = LEAD_STATUS_FUNNEL_ORDER[row.status] || 0;
            if (rowOrder > bestOrder) return row;
            if (rowOrder === bestOrder && row.last_activity_at > best.last_activity_at) return row;
            return best;
          }).id,
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/leads/merge", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      const allowedRoles = await getMergeAllowedRoles(tid);
      if (!crmUser || !allowedRoles.includes(crmUser.roleCode)) {
        return res.status(403).json({ message: "You don't have permission to merge leads." });
      }

      const { primaryLeadId, mergedLeadIds, fieldDecisions, notes: mergeNotes } = req.body;

      if (!primaryLeadId || !Array.isArray(mergedLeadIds) || mergedLeadIds.length === 0) {
        return res.status(400).json({ message: "Primary lead and at least one lead to merge are required." });
      }

      if (mergedLeadIds.includes(primaryLeadId)) {
        return res.status(400).json({ message: "Primary lead cannot be in merged list." });
      }

      const userName = crmUser.name || crmUser.employeeName || "System";
      const allIds = [primaryLeadId, ...mergedLeadIds];

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const lockResult = await client.query(
          `SELECT id, merge_status, name, notes, phone_e164, mobile_normalized, status
           FROM leads
           WHERE id = ANY($1) AND tenant_id = $2
           FOR UPDATE`,
          [allIds, tid]
        );

        const lockedLeads = lockResult.rows;
        const primaryLead = lockedLeads.find((l: any) => l.id === primaryLeadId);
        if (!primaryLead) {
          await client.query("ROLLBACK");
          return res.status(404).json({ message: "Primary lead not found." });
        }

        const activeMerged = lockedLeads.filter(
          (l: any) => mergedLeadIds.includes(l.id) && l.merge_status === "ACTIVE"
        );
        if (activeMerged.length === 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "No active leads to merge." });
        }

        if (primaryLead.merge_status !== "ACTIVE") {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "Primary lead is already merged." });
        }

        const fieldUpdates: Record<string, any> = {};
        if (fieldDecisions && typeof fieldDecisions === "object") {
          for (const [field, sourceLeadId] of Object.entries(fieldDecisions)) {
            if (Number(sourceLeadId) !== primaryLeadId) {
              const sourceRow = lockedLeads.find((l: any) => l.id === Number(sourceLeadId));
              if (sourceRow) {
                const snakeField = field.replace(/[A-Z]/g, (m: string) => "_" + m.toLowerCase());
                fieldUpdates[snakeField] = sourceRow[snakeField];
              }
            }
          }
        }

        for (const merged of activeMerged) {
          if (!primaryLead.notes && merged.notes) {
            fieldUpdates.notes = merged.notes;
          } else if (primaryLead.notes && merged.notes && merged.notes !== primaryLead.notes) {
            fieldUpdates.notes = (fieldUpdates.notes || primaryLead.notes) +
              `\n\n[From merged lead #${merged.id} on ${new Date().toISOString().split("T")[0]}]\n${merged.notes}`;
          }
        }

        const bestStatus = activeMerged.reduce((best: string, l: any) => {
          const bestOrder = LEAD_STATUS_FUNNEL_ORDER[best] || 0;
          const lOrder = LEAD_STATUS_FUNNEL_ORDER[l.status] || 0;
          return lOrder > bestOrder ? l.status : best;
        }, primaryLead.status);
        if (bestStatus !== primaryLead.status && !fieldUpdates.status) {
          fieldUpdates.status = bestStatus;
        }

        if (Object.keys(fieldUpdates).length > 0) {
          const setClauses = Object.keys(fieldUpdates)
            .map((k, i) => `${k} = $${i + 3}`)
            .join(", ");
          await client.query(
            `UPDATE leads SET ${setClauses}, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
            [primaryLeadId, tid, ...Object.values(fieldUpdates)]
          );
        }

        const movedRecordCounts: Record<string, number> = {};
        const mergedIds = activeMerged.map((l: any) => l.id);

        const directFkTables = [
          { name: "activities", col: "lead_id" },
          { name: "tasks", col: "lead_id" },
          { name: "episodes", col: "lead_id" },
          { name: "appointments", col: "lead_id" },
          { name: "temperature_logs", col: "lead_id" },
          { name: "callyzer_webhook_logs", col: "matched_lead_id" },
        ];

        for (const t of directFkTables) {
          const r = await client.query(
            `UPDATE ${t.name} SET ${t.col} = $1 WHERE ${t.col} = ANY($2) AND tenant_id = $3`,
            [primaryLeadId, mergedIds, tid]
          );
          movedRecordCounts[t.name] = r.rowCount || 0;
        }

        const hlr = await client.query(
          `UPDATE handover_logs SET entity_id = $1 WHERE entity_type = 'Lead' AND entity_id = ANY($2) AND tenant_id = $3`,
          [primaryLeadId, mergedIds, tid]
        );
        movedRecordCounts["handover_logs"] = hlr.rowCount || 0;

        const alr = await client.query(
          `UPDATE audit_logs SET entity_id = $1 WHERE entity_type = 'lead' AND entity_id = ANY($2) AND tenant_id = $3`,
          [primaryLeadId, mergedIds, tid]
        );
        movedRecordCounts["audit_logs"] = alr.rowCount || 0;

        await client.query(
          `UPDATE leads SET merge_status = 'MERGED', merged_into_lead_id = $1,
           merged_at = NOW(), merged_by = $2, updated_at = NOW()
           WHERE id = ANY($3) AND tenant_id = $4`,
          [primaryLeadId, userName, mergedIds, tid]
        );

        await client.query(
          `INSERT INTO lead_merge_audits (tenant_id, primary_lead_id, merged_lead_ids, merge_strategy,
           field_decisions, moved_record_counts, merged_by, merged_by_crm_user_id, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            tid, primaryLeadId, JSON.stringify(mergedIds), "KEEP_PRIMARY",
            JSON.stringify(fieldDecisions || {}), JSON.stringify(movedRecordCounts),
            userName, crmUser.id, mergeNotes || null,
          ]
        );

        await client.query(
          `INSERT INTO audit_logs (tenant_id, entity_type, entity_id, action, old_values, new_values,
           changed_fields, performed_by, performed_by_crm_user_id)
           VALUES ($1, 'lead', $2, 'lead_merge', $3, $4, $5, $6, $7)`,
          [
            tid, primaryLeadId,
            JSON.stringify({ mergedLeadIds: mergedIds }),
            JSON.stringify({ movedRecordCounts, fieldUpdates: Object.keys(fieldUpdates) }),
            "merge_status,merged_lead_ids",
            userName, crmUser.id,
          ]
        );

        for (const mid of mergedIds) {
          await client.query(
            `INSERT INTO activities (tenant_id, lead_id, type, description, created_by)
             VALUES ($1, $2, 'note', $3, $4)`,
            [tid, primaryLeadId, `Lead #${mid} was merged into this lead.`, userName]
          );
        }

        await client.query("COMMIT");

        const updatedLead = await storage.getLead(primaryLeadId);
        res.json({
          success: true,
          primaryLeadId,
          movedRecordCounts,
          lead: updatedLead,
        });
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/leads/bulk-merge-duplicates", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const sessionCrmUserId = req.session?.crmUserId;
      if (!sessionCrmUserId) {
        return res.status(403).json({ message: "Only admins can perform bulk merge." });
      }

      const crmUserResult = await pool.query(
        `SELECT cu.id, cu.name, cu.tenant_id, sr.code as role_code
         FROM crm_users cu
         LEFT JOIN system_roles sr ON cu.system_role_id = sr.id
         WHERE cu.id = $1`,
        [sessionCrmUserId]
      );
      const crmUser = crmUserResult.rows[0];
      if (!crmUser || !["SYS_ADMIN", "ADMIN"].includes(crmUser.role_code)) {
        return res.status(403).json({ message: "Only admins can perform bulk merge." });
      }

      const userName = crmUser.name || req.user?.email || "System";
      const dryRun = req.body.dryRun !== false;

      const dupeResult = await pool.query(
        `WITH dupe_phones AS (
           SELECT phone_e164, COUNT(*) as cnt
           FROM leads
           WHERE phone_e164 IS NOT NULL AND phone_e164 != ''
             AND tenant_id = $1
             AND merge_status = 'ACTIVE'
           GROUP BY phone_e164
           HAVING COUNT(*) > 1
         )
         SELECT l.id, l.name, l.phone_e164, l.status, l.created_at,
           (SELECT COUNT(*) FROM activities a WHERE a.lead_id = l.id 
            AND a.type NOT IN ('status_change','temperature_change','lead_created')) as real_acts,
           (SELECT COUNT(*) FROM appointments ap WHERE ap.lead_id = l.id) as appts,
           (SELECT COUNT(*) FROM episodes e WHERE e.lead_id = l.id) as eps
         FROM leads l
         JOIN dupe_phones dp ON l.phone_e164 = dp.phone_e164
         WHERE l.tenant_id = $1 AND l.merge_status = 'ACTIVE'
         ORDER BY l.phone_e164, l.created_at ASC`,
        [tid]
      );

      const groupedByPhone: Record<string, any[]> = {};
      for (const row of dupeResult.rows) {
        if (!groupedByPhone[row.phone_e164]) groupedByPhone[row.phone_e164] = [];
        groupedByPhone[row.phone_e164].push(row);
      }

      const STATUS_PRIORITY: Record<string, number> = {
        "Closed Won": 10, "Consultation Done": 9, "Reminder Running": 8,
        "Appointment Booked": 7, "Qualified": 6, "Contacted": 5,
        "Raw Lead Captured": 1, "Nurture": 3, "Closed Lost": 2, "Unqualified": 0,
      };

      let mergedCount = 0;
      let skippedCount = 0;
      const mergeLog: any[] = [];

      for (const [phone, leads] of Object.entries(groupedByPhone)) {
        if (leads.length < 2) continue;

        const sorted = leads.sort((a: any, b: any) => {
          const aPri = (STATUS_PRIORITY[a.status] || 0);
          const bPri = (STATUS_PRIORITY[b.status] || 0);
          if (aPri !== bPri) return bPri - aPri;
          const aEng = Number(a.real_acts) + Number(a.appts) * 10 + Number(a.eps) * 20;
          const bEng = Number(b.real_acts) + Number(b.appts) * 10 + Number(b.eps) * 20;
          if (aEng !== bEng) return bEng - aEng;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        const primary = sorted[0];
        const toMerge = sorted.slice(1);

        mergeLog.push({
          phone,
          primaryId: primary.id,
          primaryName: primary.name,
          primaryStatus: primary.status,
          mergedIds: toMerge.map((l: any) => l.id),
          mergedNames: toMerge.map((l: any) => l.name),
        });

        if (!dryRun) {
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            const mergedIds = toMerge.map((l: any) => l.id);

            const directFkTables = [
              { name: "activities", col: "lead_id" },
              { name: "tasks", col: "lead_id" },
              { name: "episodes", col: "lead_id" },
              { name: "appointments", col: "lead_id" },
              { name: "temperature_logs", col: "lead_id" },
              { name: "callyzer_webhook_logs", col: "matched_lead_id" },
            ];

            for (const t of directFkTables) {
              await client.query(
                `UPDATE ${t.name} SET ${t.col} = $1 WHERE ${t.col} = ANY($2) AND tenant_id = $3`,
                [primary.id, mergedIds, tid]
              );
            }

            await client.query(
              `UPDATE handover_logs SET entity_id = $1 WHERE entity_type = 'Lead' AND entity_id = ANY($2) AND tenant_id = $3`,
              [primary.id, mergedIds, tid]
            );
            await client.query(
              `UPDATE audit_logs SET entity_id = $1 WHERE entity_type = 'lead' AND entity_id = ANY($2) AND tenant_id = $3`,
              [primary.id, mergedIds, tid]
            );

            await client.query(
              `UPDATE leads SET merge_status = 'MERGED', merged_into_lead_id = $1,
               merged_at = NOW(), merged_by = $2, updated_at = NOW()
               WHERE id = ANY($3) AND tenant_id = $4`,
              [primary.id, userName, mergedIds, tid]
            );

            await client.query(
              `INSERT INTO lead_merge_audits (tenant_id, primary_lead_id, merged_lead_ids, merge_strategy,
               field_decisions, moved_record_counts, merged_by, merged_by_crm_user_id, notes)
               VALUES ($1, $2, $3, 'BULK_AUTO', '{}', '{}', $4, $5, $6)`,
              [tid, primary.id, JSON.stringify(mergedIds), userName, crmUser.id,
               `Bulk duplicate merge — ${mergedIds.length} lead(s) merged into #${primary.id}`]
            );

            await client.query(
              `INSERT INTO activities (tenant_id, lead_id, type, description, created_by)
               VALUES ($1, $2, 'note', $3, $4)`,
              [tid, primary.id,
               `Bulk merge: ${mergedIds.length} duplicate lead(s) [${mergedIds.join(", ")}] merged into this lead.`,
               userName]
            );

            await client.query("COMMIT");
            mergedCount += mergedIds.length;
          } catch (txErr) {
            await client.query("ROLLBACK");
            skippedCount++;
            console.error(`[bulk-merge] Error merging phone ${phone}:`, txErr);
          } finally {
            client.release();
          }
        }
      }

      res.json({
        success: true,
        dryRun,
        totalDuplicateGroups: Object.keys(groupedByPhone).length,
        leadsToMerge: mergeLog.reduce((sum, l) => sum + l.mergedIds.length, 0),
        mergedCount: dryRun ? 0 : mergedCount,
        skippedCount,
        mergeLog: mergeLog.slice(0, 50),
      });
    } catch (err: any) {
      console.error("[bulk-merge] Error:", err);
      res.status(500).json({ message: humanizeError(err) });
    }
  });

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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // --- Google Sheets CSV helpers ---
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

  function buildCsvExportUrl(spreadsheetId: string, gid?: string | null): string {
    let url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    if (gid) url += `&gid=${gid}`;
    return url;
  }

  async function fetchSheetCsv(spreadsheetId: string, gid?: string | null): Promise<string[][]> {
    const url = buildCsvExportUrl(spreadsheetId, gid);
    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (resp.status === 401 || resp.status === 403) {
      throw new Error("Access denied. Make sure the sheet is shared as \"Anyone with the link can view\".");
    }
    if (resp.status === 404) throw new Error("Sheet not found. Please check the URL.");
    if (!resp.ok) throw new Error(`Failed to read sheet (HTTP ${resp.status}). Check that the sheet is publicly shared.`);
    const text = await resp.text();
    if (text.includes("<!DOCTYPE html>") || text.includes("<HTML>")) {
      throw new Error("The sheet is not publicly accessible. Change sharing to \"Anyone with the link can view\".");
    }
    return parseCsv(text);
  }

  // --- Google Sheets Lead Extraction ---
  app.post("/api/google-sheets/headers", isAuthenticated, async (req, res) => {
    try {
      const { sheetUrl } = req.body;
      if (!sheetUrl) return res.status(400).json({ message: "Sheet URL is required" });

      const spreadsheetId = extractSpreadsheetId(sheetUrl);
      if (!spreadsheetId) return res.status(400).json({ message: "Invalid Google Sheets URL. Copy the full URL from your browser while the sheet is open." });

      const gidMatch = sheetUrl.match(/[#&]gid=(\d+)/);
      const gid = gidMatch ? gidMatch[1] : null;

      const allRows = await fetchSheetCsv(spreadsheetId, gid);
      if (allRows.length === 0) return res.status(400).json({ message: "The sheet appears to be empty." });

      const headers = allRows[0].map(h => h.trim()).filter(Boolean);
      if (headers.length === 0) return res.status(400).json({ message: "No column headers found in the first row." });

      res.json({ headers, sheetTitle: "Google Sheet", sheets: [], spreadsheetId, gid, selectedSheet: "Sheet1" });
    } catch (err: any) {
      res.status(400).json({ message: err.message || humanizeError(err) });
    }
  });

  app.post("/api/google-sheets/preview", isAuthenticated, async (req, res) => {
    try {
      const { spreadsheetId, gid } = req.body;
      if (!spreadsheetId) return res.status(400).json({ message: "Missing spreadsheetId" });

      const allRows = await fetchSheetCsv(spreadsheetId, gid);
      const rows = allRows.slice(0, 11); // header + 10 preview rows
      res.json({ rows, totalPreview: rows.length });
    } catch (err: any) {
      res.status(400).json({ message: err.message || humanizeError(err) });
    }
  });

  app.post("/api/google-sheets/import", isAuthenticated, async (req, res) => {
    try {
      const { spreadsheetId, gid, columnMapping, duplicateStrategy, defaultLeadStatus, defaultTags } = req.body;
      if (!spreadsheetId) return res.status(400).json({ message: "Missing spreadsheetId" });
      if (!columnMapping || Object.keys(columnMapping).length === 0) return res.status(400).json({ message: "Column mapping is required" });

      const tid = await getDefaultTenantId(req);
      const userId = String((req as any).session?.crmUserId || "system");
      const dedupStrategy = duplicateStrategy || "skip";
      const leadStatus = defaultLeadStatus || "Raw Lead Captured";

      const allRows = await fetchSheetCsv(spreadsheetId, gid);
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
        fileName: `Google Sheet: ${spreadsheetId}${gid ? `#${gid}` : ""}`,
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  function extractSpreadsheetId(url: string): string | null {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  // --- Google Sheets Auto-Sync CRUD ---
  app.get("/api/google-sheets/sync-configs", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const configs = await db.select().from(googleSheetsSyncConfigs)
        .where(eq(googleSheetsSyncConfigs.tenantId, tid))
        .orderBy(desc(googleSheetsSyncConfigs.createdAt));
      const safe = configs.map(c => ({ ...c, apiKeyEncrypted: undefined }));
      res.json(safe);
    } catch (err: any) { res.status(500).json({ message: humanizeError(err) }); }
  });

  app.post("/api/google-sheets/sync-configs", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const userId = String(req.session?.crmUserId || "system");
      const { name, spreadsheetId, gid, columnMapping, duplicateStrategy, defaultLeadStatus, defaultTags } = req.body;
      if (!name || !spreadsheetId || !columnMapping) return res.status(400).json({ message: "name, spreadsheetId, and columnMapping are required" });

      const [created] = await db.insert(googleSheetsSyncConfigs).values({
        tenantId: tid, name, spreadsheetId,
        apiKeyEncrypted: null,
        sheetGid: gid || null,
        sheetName: "Sheet1",
        columnMapping, duplicateStrategy: duplicateStrategy || "skip",
        defaultLeadStatus: defaultLeadStatus || "Raw Lead Captured",
        defaultTags: defaultTags || null,
        isActive: true, lastSyncedRow: 1,
        createdBy: userId,
      }).returning();
      res.json({ ...created, apiKeyEncrypted: undefined });
    } catch (err: any) { res.status(500).json({ message: humanizeError(err) }); }
  });

  app.patch("/api/google-sheets/sync-configs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const id = Number(req.params.id);
      const { name, columnMapping, duplicateStrategy, defaultLeadStatus, defaultTags, isActive } = req.body;
      const updates: Record<string, any> = { modifiedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (columnMapping !== undefined) updates.columnMapping = columnMapping;
      if (duplicateStrategy !== undefined) updates.duplicateStrategy = duplicateStrategy;
      if (defaultLeadStatus !== undefined) updates.defaultLeadStatus = defaultLeadStatus;
      if (defaultTags !== undefined) updates.defaultTags = defaultTags;
      if (isActive !== undefined) updates.isActive = isActive;
      const [updated] = await db.update(googleSheetsSyncConfigs).set(updates)
        .where(and(eq(googleSheetsSyncConfigs.id, id), eq(googleSheetsSyncConfigs.tenantId, tid)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Config not found" });
      res.json({ ...updated, apiKeyEncrypted: undefined });
    } catch (err: any) { res.status(500).json({ message: humanizeError(err) }); }
  });

  app.delete("/api/google-sheets/sync-configs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const id = Number(req.params.id);
      await db.delete(googleSheetsSyncConfigs)
        .where(and(eq(googleSheetsSyncConfigs.id, id), eq(googleSheetsSyncConfigs.tenantId, tid)));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: humanizeError(err) }); }
  });

  app.post("/api/google-sheets/sync-configs/:id/sync", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const id = Number(req.params.id);
      const userId = String(req.session?.crmUserId || "manual");
      const { runGoogleSheetsSync } = await import("./services/googleSheetsSync");
      const result = await runGoogleSheetsSync(id, tid, `manual:${userId}`);
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: humanizeError(err) }); }
  });

  app.post("/api/google-sheets/sync-configs/:id/reset", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const id = Number(req.params.id);
      await db.update(googleSheetsSyncConfigs).set({ lastSyncedRow: 1, lastSyncedAt: null, lastSyncStatus: null, lastSyncMessage: null, modifiedAt: new Date() })
        .where(and(eq(googleSheetsSyncConfigs.id, id), eq(googleSheetsSyncConfigs.tenantId, tid)));
      res.json({ success: true, message: "Sync position reset. Next sync will re-import all rows." });
    } catch (err: any) { res.status(500).json({ message: humanizeError(err) }); }
  });

  // --- Lead Capture Rules CRUD ---
  app.get("/api/lead-capture-rules", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const rules = await db.select().from(leadCaptureRules)
        .where(eq(leadCaptureRules.tenantId, tid))
        .orderBy(desc(leadCaptureRules.createdAt));
      res.json(rules);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  // GET: Combined stats for ALL meta lead capture rules for the tenant (used for card headers)
  app.get("/api/lead-capture-rules/meta-stats", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const rows = await db.select({
        ruleId: metaLeadCaptureLogs.ruleId,
        total: sql<number>`COUNT(*)::int`,
        created: sql<number>`COUNT(*) FILTER (WHERE ${metaLeadCaptureLogs.processingStatus} = 'created')::int`,
        errors: sql<number>`COUNT(*) FILTER (WHERE ${metaLeadCaptureLogs.processingStatus} = 'error')::int`,
        lastReceivedAt: sql<string>`MAX(${metaLeadCaptureLogs.createdAt})`,
      })
        .from(metaLeadCaptureLogs)
        .where(eq(metaLeadCaptureLogs.tenantId, tid))
        .groupBy(metaLeadCaptureLogs.ruleId);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // GET: Meta lead capture logs for a rule
  app.get("/api/lead-capture-rules/:id/logs", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const ruleId = Number(req.params.id);
      const limit = Math.min(Number(req.query.limit || 50), 200);
      const page = Math.max(0, Number(req.query.page || 0));
      const statusFilter = req.query.status as string | undefined;
      const conditions: any[] = [
        eq(metaLeadCaptureLogs.tenantId, tid),
        eq(metaLeadCaptureLogs.ruleId, ruleId),
      ];
      if (statusFilter && statusFilter !== "all") {
        conditions.push(eq(metaLeadCaptureLogs.processingStatus, statusFilter));
      }
      const logs = await db.select()
        .from(metaLeadCaptureLogs)
        .where(and(...conditions))
        .orderBy(desc(metaLeadCaptureLogs.createdAt))
        .limit(limit)
        .offset(page * limit);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // GET: Stats for a Meta lead capture rule (last received, counts)
  app.get("/api/lead-capture-rules/:id/logs/stats", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const ruleId = Number(req.params.id);
      const [stats] = await db.select({
        total: sql<number>`COUNT(*)::int`,
        created: sql<number>`COUNT(*) FILTER (WHERE ${metaLeadCaptureLogs.processingStatus} = 'created')::int`,
        duplicateSkipped: sql<number>`COUNT(*) FILTER (WHERE ${metaLeadCaptureLogs.processingStatus} = 'duplicate_skipped')::int`,
        duplicateUpdated: sql<number>`COUNT(*) FILTER (WHERE ${metaLeadCaptureLogs.processingStatus} = 'duplicate_updated')::int`,
        errors: sql<number>`COUNT(*) FILTER (WHERE ${metaLeadCaptureLogs.processingStatus} = 'error')::int`,
        lastReceivedAt: sql<string>`MAX(${metaLeadCaptureLogs.createdAt})`,
      })
        .from(metaLeadCaptureLogs)
        .where(and(eq(metaLeadCaptureLogs.tenantId, tid), eq(metaLeadCaptureLogs.ruleId, ruleId)));
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // --- Webhook Endpoint for Lead Capture ---

  // GET: Meta webhook verification challenge (hub.mode=subscribe)
  app.get("/api/webhook/lead-capture/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const mode = req.query["hub.mode"] as string;
      const verifyToken = req.query["hub.verify_token"] as string;
      const challenge = req.query["hub.challenge"] as string;

      // Only respond to Meta's subscribe verification
      if (mode === "subscribe") {
        // Verify the token matches the stored rule token (or use it directly as the verify token)
        const [rule] = await db.select().from(leadCaptureRules)
          .where(and(eq(leadCaptureRules.webhookToken, token), eq(leadCaptureRules.isActive, true)));

        if (rule && (verifyToken === token || verifyToken === rule.webhookToken)) {
          console.log(`[MetaWebhook] Verification successful for rule ${rule.id} (${rule.name})`);
          return res.status(200).send(challenge);
        }
        console.warn(`[MetaWebhook] Verification failed — token mismatch. Expected: ${token}, Got: ${verifyToken}`);
        return res.status(403).json({ message: "Verification token mismatch" });
      }

      res.status(400).json({ message: "Invalid request" });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // POST: Handle incoming lead capture webhooks (generic JSON + Meta Lead Ads format)
  app.post("/api/webhook/lead-capture/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const [rule] = await db.select().from(leadCaptureRules)
        .where(and(eq(leadCaptureRules.webhookToken, token), eq(leadCaptureRules.isActive, true)));

      if (!rule) {
        return res.status(404).json({ message: "Invalid or inactive webhook" });
      }

      const tid = rule.tenantId;
      const payload = req.body;

      // ── Detect Meta Lead Ads webhook format ─────────────────────────────
      // Meta sends: { object: "page", entry: [{ changes: [{ field: "leadgen", value: { leadgen_id: "..." } }] }] }
      const isMetaLeadAdsFormat =
        payload.object === "page" &&
        Array.isArray(payload.entry) &&
        payload.entry.length > 0;

      if (isMetaLeadAdsFormat) {
        // Acknowledge immediately — Meta requires a 200 response within 5 seconds
        res.status(200).json({ status: "received" });

        // Process all lead changes asynchronously
        (async () => {
          try {
            // Full envelope for logging (stored once per leadgen event for full audit trail)
            const envelopePayload = payload as Record<string, unknown>;

            // ── Step 1: Create log rows for every leadgen ID BEFORE access-token check ──
            // This ensures every incoming event is recorded even if token/credentials are missing.
            type LogRowRef = { logId: number; leadgenId: string; changeValue: Record<string, unknown> };
            const logRows: LogRowRef[] = [];

            for (const entry of payload.entry) {
              if (!Array.isArray(entry.changes)) continue;
              for (const change of entry.changes) {
                if (change.field !== "leadgen") continue;
                const leadgenId = change.value?.leadgen_id;
                if (!leadgenId) continue;

                const changeValue = change.value as Record<string, unknown>;
                const [logEntry] = await db.insert(metaLeadCaptureLogs).values({
                  tenantId: tid,
                  ruleId: rule.id,
                  ruleName: rule.name,
                  leadgenId,
                  formId: String(changeValue?.form_id || ""),
                  adId: String(changeValue?.ad_id || ""),
                  rawPayload: envelopePayload,
                  processingStatus: "received",
                }).returning();
                logRows.push({ logId: logEntry.id, leadgenId, changeValue });
              }
            }

            // ── Step 2: Resolve access token ──
            const connectors = await storage.getPlatformConnectors(tid);
            const metaConn = connectors.find((c: any) => c.platform === "meta" && c.status === "connected");
            const creds = metaConn?.credentials as any;
            const accessToken = creds?.accessToken || process.env.META_ACCESS_TOKEN;

            if (!accessToken) {
              console.error(`[MetaWebhook] No Meta access token found for tenant ${tid}`);
              // Mark all log rows as error
              for (const { logId } of logRows) {
                await db.update(metaLeadCaptureLogs)
                  .set({ processingStatus: "error", errorMessage: "No Meta access token configured for this tenant" })
                  .where(eq(metaLeadCaptureLogs.id, logId));
              }
              return;
            }

            const { fetchLeadgenData } = await import("./services/metaAds");

            // ── Step 3: Process each logged leadgen event ──
            for (const { logId, leadgenId, changeValue } of logRows) {

                try {
                  // Fetch actual lead data from Meta Graph API
                  const leadData = await fetchLeadgenData(leadgenId, accessToken);
                  const fields: Record<string, string> = {};
                  for (const f of leadData.field_data || []) {
                    fields[f.name] = (f.values || [])[0] || "";
                  }

                  // Standard Meta Lead Ads field names → CRM fields
                  const rawName = [
                    fields["full_name"],
                    fields["first_name"] ? `${fields["first_name"]} ${fields["last_name"] || ""}`.trim() : "",
                  ].find(Boolean) || "";
                  const name = toProperCase(rawName.trim());

                  const rawPhone = fields["phone_number"] || fields["mobile_number"] || fields["phone"] || "";
                  const phone = rawPhone ? normalizePhone(rawPhone) : "";
                  const email = fields["email"] || fields["email_address"] || "";
                  const city = fields["city"] || fields["location"] || "";

                  // Apply field mapping overrides if configured
                  const fieldMapping = (rule.fieldMapping || {}) as Record<string, string>;
                  const mapped: Record<string, string> = { ...fields };
                  for (const [crmField, sourceField] of Object.entries(fieldMapping)) {
                    if (sourceField && fields[sourceField] !== undefined) {
                      mapped[crmField] = fields[sourceField];
                    }
                  }

                  const finalName = toProperCase((mapped.name || name || "").trim());
                  const finalPhone = phone || normalizePhone(mapped.phoneE164 || mapped.phone || "");
                  const finalEmail = email || mapped.email || "";

                  // Update log with fetched lead info
                  await db.update(metaLeadCaptureLogs)
                    .set({
                      leadgenPayload: leadData as unknown as Record<string, unknown>,
                      formId: leadData.form_id || String(changeValue?.form_id || ""),
                      adId: leadData.ad_id || String(changeValue?.ad_id || ""),
                      leadName: finalName || undefined,
                      leadPhone: finalPhone || undefined,
                    })
                    .where(eq(metaLeadCaptureLogs.id, logId));

                  if (!finalPhone) {
                    console.warn(`[MetaWebhook] Leadgen ${leadgenId} has no phone — skipping`);
                    await db.update(metaLeadCaptureLogs)
                      .set({ processingStatus: "error", errorMessage: "No phone number found in lead data" })
                      .where(eq(metaLeadCaptureLogs.id, logId));
                    continue;
                  }

                  const existingLead = await storage.findLeadByPhone(tid, finalPhone);
                  if (existingLead) {
                    const dupOption = rule.duplicateLeadOption || "skip";
                    if (dupOption === "skip") {
                      console.log(`[MetaWebhook] Duplicate lead phone ${finalPhone} — skipped`);
                      await db.update(metaLeadCaptureLogs)
                        .set({ processingStatus: "duplicate_skipped", leadId: existingLead.id })
                        .where(eq(metaLeadCaptureLogs.id, logId));
                      continue;
                    } else if (dupOption === "update_blank") {
                      const updates: Record<string, any> = {};
                      if (!existingLead.email && finalEmail) updates.email = finalEmail;
                      if (!existingLead.name && finalName) updates.name = finalName;
                      if (Object.keys(updates).length > 0) await storage.updateLead(existingLead.id, updates);
                      console.log(`[MetaWebhook] Duplicate lead ${existingLead.id} — updated blank fields`);
                      await db.update(metaLeadCaptureLogs)
                        .set({ processingStatus: "duplicate_updated", leadId: existingLead.id })
                        .where(eq(metaLeadCaptureLogs.id, logId));
                      continue;
                    }
                  }

                  let assignedUser = null;
                  const strategy = rule.assignmentStrategy || "round_robin";
                  if (strategy === "round_robin") {
                    assignedUser = await storage.getNextAssignableCrmUser(tid);
                  } else if (strategy === "specific" && rule.assignToEmployeeIds) {
                    const empIds = rule.assignToEmployeeIds as number[];
                    if (empIds.length > 0) {
                      const users = await storage.getCrmUsers(tid);
                      const randomIdx = Math.floor(Math.random() * empIds.length);
                      assignedUser = users.find(u => u.id === empIds[randomIdx]) || null;
                    }
                  }

                  const newLead = await storage.createLead({
                    tenantId: tid,
                    name: finalName || "Unknown",
                    phoneE164: finalPhone,
                    email: finalEmail || undefined,
                    status: rule.defaultLeadStatus || "Raw Lead Captured",
                    tags: mapped.tags || rule.defaultTags || "facebook,lead-ad",
                    utmSource: "facebook",
                    utmMedium: "lead-ad",
                    utmCampaign: String(changeValue?.ad_id || leadData.ad_id || ""),
                    notes: city ? `City: ${city}` : undefined,
                    priority: "Normal",
                    assignedCrmUserId: assignedUser?.id,
                    assignedTo: assignedUser?.name,
                  });

                  await storage.createActivity({
                    leadId: newLead.id, tenantId: tid, createdBy: "meta-webhook",
                    type: "note",
                    description: `Lead captured from Meta Lead Ads (Form ID: ${leadData.form_id || "N/A"})${assignedUser ? ` — auto-assigned to ${assignedUser.name}` : ""}`,
                  });

                  await db.update(metaLeadCaptureLogs)
                    .set({ processingStatus: "created", leadId: newLead.id })
                    .where(eq(metaLeadCaptureLogs.id, logId));

                  console.log(`[MetaWebhook] Created lead ${newLead.id} for ${finalName} (${finalPhone}) from leadgen ${leadgenId}`);
                } catch (leadErr: any) {
                  console.error(`[MetaWebhook] Failed to process leadgen ${leadgenId}:`, leadErr.message);
                  await db.update(metaLeadCaptureLogs)
                    .set({ processingStatus: "error", errorMessage: leadErr.message })
                    .where(eq(metaLeadCaptureLogs.id, logId));
                }
            }
          } catch (asyncErr: any) {
            console.error("[MetaWebhook] Async processing error:", asyncErr.message);
          }
        })();

        return; // Response already sent above
      }

      // ── Generic JSON webhook (Zapier / Make / manual POST) ────────────────
      const fieldMapping = (rule.fieldMapping || {}) as Record<string, string>;

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
      res.status(500).json({ message: humanizeError(err) });
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
        return res.status(404).json({ message: "Telephony connector not found or inactive" });
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
        const noteUpdatedAt = call.note_updated_at || call.noteUpdatedAt || call.note_updated_date || "";
        const callyzerLeadStatus = call.lead_status || call.leadStatus || call.status_name || "";
        const callyzerLeadStatusDate = call.lead_status_date || call.leadStatusDate || call.status_date || "";
        const clientName = call.client_name || call.clientName || call.name || "";

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
          // Also check contact persons linked to leads
          if (!matchedLead) {
            matchedLead = await storage.findLeadByContactPhone(tid, clientNumber) || null;
          }
          if (!matchedLead) {
            const altFormats = getPhoneVariants(clientNumber);
            for (const alt of altFormats) {
              const cpLead = await storage.findLeadByContactPhone(tid, alt);
              if (cpLead) { matchedLead = cpLead; break; }
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
              clientName,
              callTimestamp,
              connectorId: connector.id,
              noteUpdatedAt: noteUpdatedAt || undefined,
              callyzerLeadStatus: callyzerLeadStatus || undefined,
              callyzerLeadStatusDate: callyzerLeadStatusDate || undefined,
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
              primaryOwnerUserId: matchedCrmUser?.id || null,
              ownerTeam: matchedCrmUser ? "Telecalling" : null,
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
                clientName,
                callTimestamp,
                connectorId: connector.id,
                autoCreated: true,
                noteUpdatedAt: noteUpdatedAt || undefined,
                callyzerLeadStatus: callyzerLeadStatus || undefined,
                callyzerLeadStatusDate: callyzerLeadStatusDate || undefined,
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
      if (callType) conditions.push(sql`LOWER(${callyzerWebhookLogs.callType}) LIKE ${'%' + callType.toLowerCase() + '%'}`);
      if (status) {
        if (status === "matched") {
          conditions.push(eq(callyzerWebhookLogs.processingStatus, "matched"));
        } else if (status === "unmatched") {
          conditions.push(eq(callyzerWebhookLogs.processingStatus, "unmatched"));
        } else if (status === "auto_created") {
          conditions.push(eq(callyzerWebhookLogs.processingStatus, "auto_created"));
        } else {
          conditions.push(eq(callyzerWebhookLogs.processingStatus, status));
        }
      }
      if (employeeNumber) conditions.push(eq(callyzerWebhookLogs.employeeNumber, employeeNumber));

      const baseDateConditions: any[] = [eq(callyzerWebhookLogs.tenantId, tid)];
      if (from) baseDateConditions.push(gte(callyzerWebhookLogs.createdAt, new Date(from)));
      if (to) baseDateConditions.push(lte(callyzerWebhookLogs.createdAt, new Date(to + "T23:59:59")));

      const summaryResult = await db.select({
        totalCalls: sql<number>`COUNT(*)::int`,
        incomingCalls: sql<number>`COUNT(*) FILTER (WHERE LOWER(${callyzerWebhookLogs.callType}) LIKE '%incoming%')::int`,
        outgoingCalls: sql<number>`COUNT(*) FILTER (WHERE LOWER(${callyzerWebhookLogs.callType}) LIKE '%outgoing%')::int`,
        missedCalls: sql<number>`COUNT(*) FILTER (WHERE LOWER(${callyzerWebhookLogs.callType}) LIKE '%missed%')::int`,
        matchedCalls: sql<number>`COUNT(*) FILTER (WHERE ${callyzerWebhookLogs.processingStatus} = 'matched')::int`,
        autoCreatedCalls: sql<number>`COUNT(*) FILTER (WHERE ${callyzerWebhookLogs.processingStatus} = 'auto_created')::int`,
        unmatchedCalls: sql<number>`COUNT(*) FILTER (WHERE ${callyzerWebhookLogs.processingStatus} = 'unmatched')::int`,
        totalDuration: sql<number>`COALESCE(SUM(${callyzerWebhookLogs.callDuration}), 0)::int`,
      }).from(callyzerWebhookLogs).where(and(...baseDateConditions));

      const stats = summaryResult[0] || { totalCalls: 0, incomingCalls: 0, outgoingCalls: 0, missedCalls: 0, matchedCalls: 0, autoCreatedCalls: 0, unmatchedCalls: 0, totalDuration: 0 };
      const avgDuration = stats.totalCalls > 0 ? Math.round(stats.totalDuration / stats.totalCalls) : 0;

      const logs = await db.select().from(callyzerWebhookLogs)
        .where(and(...conditions))
        .orderBy(desc(callyzerWebhookLogs.createdAt))
        .limit(parseInt(limitParam || "500"));

      const allCrmUsers = await storage.getCrmUsers(tid);
      const crmUserMap: Record<number, string> = {};
      allCrmUsers.forEach(u => { crmUserMap[u.id] = u.name || "Unknown"; });

      const leadIds = Array.from(new Set(logs.filter(l => l.matchedLeadId).map(l => l.matchedLeadId!)));
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

      const empStatsRows = await db.select({
        employeeNumber: callyzerWebhookLogs.employeeNumber,
        matchedCrmUserId: callyzerWebhookLogs.matchedCrmUserId,
        total: sql<number>`COUNT(*)::int`,
        incoming: sql<number>`COUNT(*) FILTER (WHERE LOWER(${callyzerWebhookLogs.callType}) LIKE '%incoming%')::int`,
        outgoing: sql<number>`COUNT(*) FILTER (WHERE LOWER(${callyzerWebhookLogs.callType}) LIKE '%outgoing%')::int`,
        missed: sql<number>`COUNT(*) FILTER (WHERE LOWER(${callyzerWebhookLogs.callType}) LIKE '%missed%')::int`,
        totalDuration: sql<number>`COALESCE(SUM(${callyzerWebhookLogs.callDuration}), 0)::int`,
        matched: sql<number>`COUNT(*) FILTER (WHERE ${callyzerWebhookLogs.processingStatus} = 'matched')::int`,
      }).from(callyzerWebhookLogs)
        .where(and(...conditions))
        .groupBy(callyzerWebhookLogs.employeeNumber, callyzerWebhookLogs.matchedCrmUserId)
        .orderBy(sql`COUNT(*) DESC`);

      const empGrouped: Record<string, { name: string; total: number; incoming: number; outgoing: number; missed: number; totalDuration: number; matched: number }> = {};
      empStatsRows.forEach(r => {
        const emp = r.employeeNumber || "Unknown";
        if (!empGrouped[emp]) {
          empGrouped[emp] = { name: r.matchedCrmUserId ? (crmUserMap[r.matchedCrmUserId] || emp) : emp, total: 0, incoming: 0, outgoing: 0, missed: 0, totalDuration: 0, matched: 0 };
        }
        empGrouped[emp].total += r.total;
        empGrouped[emp].incoming += r.incoming;
        empGrouped[emp].outgoing += r.outgoing;
        empGrouped[emp].missed += r.missed;
        empGrouped[emp].totalDuration += r.totalDuration;
        empGrouped[emp].matched += r.matched;
      });

      res.json({
        logs: enrichedLogs,
        summary: { ...stats, avgDuration },
        employeeStats: Object.values(empGrouped).sort((a, b) => b.total - a.total),
      });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // --- CRM Users list (for assignment dropdown) ---
  app.get("/api/crm-users/active", isAuthenticated, async (req, res) => {
    const tid = await getDefaultTenantId(req);
    const users = await storage.getCrmUsers(tid);
    const active = users.filter(u => u.isActive && u.code !== "SUPERADMIN");
    // Enrich with role info via a single JOIN query
    const enriched = await db.execute(sql`
      SELECT cu.id, sr.name AS "roleName", sr.code AS "roleCode"
      FROM crm_users cu
      LEFT JOIN system_roles sr ON cu.system_role_id = sr.id
      WHERE cu.tenant_id = ${tid} AND cu.is_active = true
    `);
    interface RoleRow { id: number; roleName: string | null; roleCode: string | null }
    const roleMap: Record<number, { roleName: string | null; roleCode: string | null }> = {};
    for (const row of enriched.rows as RoleRow[]) {
      roleMap[row.id] = { roleName: row.roleName ?? null, roleCode: row.roleCode ?? null };
    }
    res.json(active.map(u => ({ ...u, ...(roleMap[u.id] ?? { roleName: null, roleCode: null }) })));
  });

  // Helper: get the default tenant ID
  async function getDefaultTenantId(req?: any): Promise<number> {
    // 1. Use session tenantId (authoritative)
    const sessionTid = req?.session?.tenantId;
    if (sessionTid && !isNaN(Number(sessionTid))) return Number(sessionTid);

    // 2. Recover tenantId from the authenticated user's own record
    const sessionCrmUserId = req?.session?.crmUserId;
    if (sessionCrmUserId) {
      const [u] = await db.select({ tenantId: crmUsers.tenantId }).from(crmUsers).where(eq(crmUsers.id, sessionCrmUserId));
      if (u?.tenantId) {
        if (req?.session) {
          req.session.tenantId = u.tenantId;
          req.session.save?.(() => {});
        }
        return u.tenantId;
      }
    }

    // 3. Last resort: first tenant (deterministic, ordered by id)
    const [t] = await db.select({ id: tenants.id }).from(tenants).orderBy(tenants.id).limit(1);
    return t?.id ?? 1;
  }

  // --- Generic Master CRUD ---
  app.get(api.masters.categories.path, isAuthenticated, async (_req, res) => {
    res.json(MASTER_CATEGORIES);
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/masters/bulk-approval", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      if (!(await requireAdminRole(req, res, tid))) return;
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "items array is required" });
      }
      let approvedCount = 0;
      let rejectedCount = 0;
      const errors: string[] = [];
      for (const item of items) {
        const { tableName, id, action } = item;
        if (!tableName || !id || !["approve", "reject"].includes(action)) {
          errors.push(`Invalid item: ${JSON.stringify(item)}`);
          continue;
        }
        if (!MASTER_TABLE_REGISTRY[tableName]) {
          errors.push(`Unknown table: ${tableName}`);
          continue;
        }
        try {
          const newStatus = action === "approve" ? "Approved" : "Rejected";
          await storage.updateMasterRecord(tableName, Number(id), { approvalStatus: newStatus }, tid);
          if (action === "approve") approvedCount++;
          else rejectedCount++;
        } catch (err: any) {
          errors.push(`${tableName}#${id}: ${err.message}`);
        }
      }
      res.json({ approvedCount, rejectedCount, errors });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get(api.masters.list.path, isAuthenticated, async (req: any, res) => {
    const tableName = req.params.tableName as string;
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }
    try {
      const tid = await getDefaultTenantId(req);
      let records = await storage.getMasterRecords(tableName, tid);
      if (tableName === "systemRoles") {
        // SYS_ADMIN is developer-team only — never expose it in tenant-facing role lists
        records = records.filter((r: any) => r.code !== "SYS_ADMIN");
      }
      res.json(records);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  // --- CSV Export (Download) --- must be before /:tableName/:id to avoid conflict
  app.get("/api/masters/:tableName/export", isAuthenticated, async (req: any, res) => {
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
      const sessionCrmUserId = req.session?.crmUserId;
      if (sessionCrmUserId) {
        logAccess(tid, sessionCrmUserId, "EXPORT", "master_data", 0, `table=${tableName}, records=${records.length}`, req);
      }
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${tableName}_export.csv"`);
      res.send(csvData);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  const TEMPLATE_FK_FRIENDLY: Record<string, string> = {
    stateId: "state",
    countryId: "country",
    cityId: "city",
    organisationId: "organisation",
    branchId: "branch",
    treatmentDepartmentId: "treatmentDepartment",
    categoryId: "category",
    defaultNearestBranchId: "defaultNearestBranch",
    crmUserId: "crmUser",
    callingLineId: "callingLine",
    departmentId: "department",
    designationId: "designation",
    employmentTypeId: "employmentType",
    systemRoleId: "systemRole",
    doctorId: "doctor",
  };

  const FK_FRIENDLY_TO_ID: Record<string, string> = {};
  for (const [idField, friendly] of Object.entries(TEMPLATE_FK_FRIENDLY)) {
    FK_FRIENDLY_TO_ID[friendly.toLowerCase()] = idField;
  }

  app.get("/api/masters/:tableName/template", isAuthenticated, async (req, res) => {
    const tableName = req.params.tableName as string;
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }

    const baseColumns = ["code", "name", "status", "displayOrder"];
    const extraFieldKeys = IMPORT_EXTRA_FIELDS[tableName] || [];
    const allColumns = [...baseColumns];
    const sampleRow: Record<string, any> = { code: "SAMPLE_CODE", name: "Sample Name", status: "Active", displayOrder: 1 };

    for (const fieldKey of extraFieldKeys) {
      const colName = TEMPLATE_FK_FRIENDLY[fieldKey] || fieldKey;
      allColumns.push(colName);
      if (REF_FIELD_TABLES[fieldKey]) {
        sampleRow[colName] = `Enter ${colName} name or code`;
      } else if (["isTerminal", "isBusinessAchieved", "requiresNextTask", "allowNurtureOption", "serviceable", "isPrimary"].includes(fieldKey)) {
        sampleRow[colName] = "true";
      } else {
        sampleRow[colName] = "";
      }
    }

    const csvData = stringify([sampleRow], { header: true, columns: allColumns });
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  const IMPORT_EXTRA_FIELDS: Record<string, string[]> = {
    states: ["countryId"],
    cities: ["stateId"],
    pinCodes: ["cityId"],
    areas: ["cityId", "pinCode", "serviceable", "defaultNearestBranchId"],
    branches: ["organisationId", "cityId", "address", "phone"],
    callingLines: ["phoneNumber", "provider"],
    userLineAssignments: ["crmUserId", "callingLineId", "isPrimary"],
    crmUsers: ["email", "phone", "branchId", "departmentId", "designationId", "employmentTypeId", "systemRoleId", "accessScopeType", "phiAccessLevel", "isActive"],
    consultationTypes: ["treatmentDepartmentId"],
    doctors: ["specialization", "qualification", "branchId", "treatmentDepartmentId", "consultationTypeId", "phone", "email"],
    opdTimings: ["doctorId", "branchId", "dayOfWeek", "startTime", "endTime", "maxPatients", "slotDuration"],
    doctorLeaveExceptions: ["doctorId", "leaveDate", "leaveEndDate", "reason"],
    leadSources: ["categoryId"],
    referrers: ["type", "phone", "email"],
    corporateInsurances: ["type"],
    conversionStages: ["isTerminal", "isBusinessAchieved"],
    leadStatuses: ["isTerminal", "isBusinessAchieved", "requiresNextTask", "allowNurtureOption", "defaultOwnerRole"],
    templates: ["channel", "subject", "body"],
    holidays: ["holidayDate"],
    tags: ["color"],
    slaRules: ["triggerEvent", "timeLimitMinutes", "appliesToRole", "escalationRole"],
    reminderPolicies: ["offsetMinutes", "channel", "fallbackChannel"],
    dataRetentionPolicies: ["entityType", "retentionMonths", "action"],
  };

  const REF_FIELD_TABLES: Record<string, string> = {
    stateId: "states",
    countryId: "countries",
    cityId: "cities",
    organisationId: "organisations",
    branchId: "branches",
    treatmentDepartmentId: "treatment_departments",
    consultationTypeId: "consultation_types",
    categoryId: "lead_source_categories",
    defaultNearestBranchId: "branches",
    crmUserId: "crm_users",
    callingLineId: "calling_lines",
    departmentId: "administrative_departments",
    designationId: "designations",
    employmentTypeId: "employment_types",
    systemRoleId: "system_roles",
    doctorId: "doctors",
  };

  async function resolveRefField(fieldName: string, value: string, tenantId: number): Promise<number | null> {
    const refTable = REF_FIELD_TABLES[fieldName];
    if (!refTable) return null;
    const numVal = parseInt(value);
    if (!isNaN(numVal)) {
      const check = await pool.query(
        `SELECT id FROM "${refTable}" WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        [tenantId, numVal]
      );
      return check.rows[0]?.id || null;
    }
    const result = await pool.query(
      `SELECT id FROM "${refTable}" WHERE tenant_id = $1 AND (UPPER(code) = UPPER($2) OR UPPER(name) = UPPER($2)) LIMIT 1`,
      [tenantId, value.trim()]
    );
    return result.rows[0]?.id || null;
  }

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
    const autoApprove = tableName === "referrers";

    try {
      const csvContent = req.file.buffer.toString("utf-8");
      const rows = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];

      const existingRecords = await storage.getMasterRecords(tableName, tenantId);
      const existingCodes = new Set(existingRecords.map(r => r.code?.toUpperCase()));

      const extraFieldKeys = IMPORT_EXTRA_FIELDS[tableName] || [];

      const REQUIRED_FK_FIELDS: Record<string, string[]> = {
        cities: ["stateId"],
        pinCodes: ["cityId"],
        areas: ["cityId"],
        branches: ["organisationId"],
        opdTimings: ["doctorId", "branchId"],
        doctorLeaveExceptions: ["doctorId"],
        leadSources: ["categoryId"],
        userLineAssignments: ["crmUserId", "callingLineId"],
      };
      const requiredFks = REQUIRED_FK_FIELDS[tableName] || [];

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
          const recordData: Record<string, any> = {
            tenantId,
            code,
            name,
            status,
            displayOrder,
            approvalStatus: autoApprove ? "Approved" : "Pending",
          };

          for (const fieldKey of extraFieldKeys) {
            const friendlyName = TEMPLATE_FK_FRIENDLY[fieldKey] || fieldKey;
            const csvValue = (row[fieldKey] || row[friendlyName] || "").trim();
            if (!csvValue) {
              if (requiredFks.includes(fieldKey)) {
                recordData[`_unresolved_${fieldKey}`] = `(missing - required)`;
              }
              continue;
            }

            if (REF_FIELD_TABLES[fieldKey]) {
              const resolvedId = await resolveRefField(fieldKey, csvValue, tenantId);
              if (resolvedId) {
                recordData[fieldKey] = resolvedId;
              } else {
                recordData[`_unresolved_${fieldKey}`] = csvValue;
              }
            } else if (["isTerminal", "isBusinessAchieved", "requiresNextTask", "allowNurtureOption", "serviceable"].includes(fieldKey)) {
              recordData[fieldKey] = ["true", "1", "yes"].includes(csvValue.toLowerCase());
            } else if (["timeLimitMinutes", "offsetMinutes", "retentionMonths", "maxPatients", "slotDuration"].includes(fieldKey)) {
              const numVal = parseInt(csvValue);
              if (!isNaN(numVal)) recordData[fieldKey] = numVal;
            } else {
              recordData[fieldKey] = csvValue;
            }
          }

          const unresolvedKeys = Object.keys(recordData).filter(k => k.startsWith("_unresolved_"));
          if (unresolvedKeys.length > 0) {
            const details = unresolvedKeys.map(k => {
              const field = k.replace("_unresolved_", "");
              const friendlyCol = TEMPLATE_FK_FRIENDLY[field] || field;
              const val = recordData[k];
              if (val === "(missing - required)") {
                return `"${friendlyCol}" column is required but missing from CSV`;
              }
              return `${friendlyCol}="${val}" not found in tenant`;
            }).join("; ");
            failureCount++;
            errors.push({ row: i + 2, message: details });
            continue;
          }

          await storage.createMasterRecord(tableName, recordData);
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
        sentToApproval: !autoApprove,
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

      if (tableName === "crmUsers") {
        if (!body.accessScopeType) body.accessScopeType = "Self";
        if (!body.phiAccessLevel) body.phiAccessLevel = "None";
        if (body.isActive === undefined || body.isActive === "") body.isActive = true;
      }

      if (tableName === "referrers" && body.phone) {
        const normalizedPhone = normalizePhoneNumber(body.phone);
        const allReferrersForTenant = await db.select().from(referrers).where(eq(referrers.tenantId, tid));
        const duplicate = allReferrersForTenant.find(r => r.phone && normalizePhoneNumber(r.phone) === normalizedPhone);
        if (duplicate) {
          return res.status(400).json({ message: `A referrer with mobile number ${body.phone} already exists (${duplicate.name})` });
        }
        body.phone = normalizedPhone || body.phone;
      }

      const autoApproveTable = tableName === "referrers";
      const record = await storage.createMasterRecord(tableName, { ...body, tenantId: tid, approvalStatus: autoApproveTable ? "Approved" : "Pending" });
      res.status(201).json(record);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(400).json({ message: humanizeError(err) });
    }
  });


  // =============================================
  // CRM USER MANAGEMENT ROUTES
  // =============================================
  app.get("/api/crm-users", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const includeInactive = req.query.includeInactive === "true";
      const sessionUser = await getSessionCrmUserWithRole(req);
      const isSysAdmin = sessionUser?.roleCode === "SYS_ADMIN";
      if (includeInactive) {
        if (!sessionUser || (!isSysAdmin && sessionUser.roleCode !== "ADMIN")) {
          return res.status(403).json({ message: "Admin access required to view inactive users" });
        }
      }
      const users = await storage.getCrmUsers(tid);
      // Also fetch SYS_ADMIN role IDs so we can exclude those users from non-SYS_ADMIN views
      const sysAdminRoleIds = isSysAdmin ? new Set<number>() : new Set(
        (await db.select({ id: systemRoles.id }).from(systemRoles)
          .where(and(eq(systemRoles.tenantId, tid), eq(systemRoles.code, "SYS_ADMIN"))))
          .map(r => r.id)
      );
      const filtered = users.filter(u =>
        u.code !== "SUPERADMIN" &&
        (isSysAdmin || !u.systemRoleId || !sysAdminRoleIds.has(u.systemRoleId)) &&
        (includeInactive ? true : u.isActive !== false)
      );
      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/crm-users/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const user = await storage.getCrmUser(Number(req.params.id), tid);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  async function requireAdminRole(req: any, res: any, tenantId: number): Promise<boolean> {
    const sessionUser = await getSessionCrmUserWithRole(req);
    if (!sessionUser) { res.status(403).json({ message: "Not a CRM user" }); return false; }
    if (sessionUser.roleCode === "SYS_ADMIN" || sessionUser.roleCode === "ADMIN") return true;
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
      const normalizedPhone = normalizeCrmPhone(body.phone);
      body.phone = normalizedPhone;

      const existingUsers = await storage.getCrmUsers(tid);
      const phoneDuplicate = existingUsers.find((u: any) => normalizeCrmPhone(u.phone || "") === normalizedPhone);
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

      if (!body.accessScopeType) body.accessScopeType = "Self";
      if (!body.phiAccessLevel) body.phiAccessLevel = "None";

      const parsed = insertCrmUserSchema.parse({ ...body, tenantId: tid, passwordHash });
      const user = await storage.createCrmUser(parsed);
      const { passwordHash: _, ...safeUser } = user as any;
      res.status(201).json(safeUser);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.patch("/api/crm-users/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      if (!(await requireAdminRole(req, res, tid))) return;
      const body = coerceDateFields(req.body, ["joiningDate", "resetTokenExpiry"]);
      const userId = Number(req.params.id);

      if (body.phone) {
        const normalizedPhone = normalizeCrmPhone(body.phone);
        body.phone = normalizedPhone;
        const existingUsers = await storage.getCrmUsers(tid);
        const phoneDuplicate = existingUsers.find((u: any) => u.id !== userId && normalizeCrmPhone(u.phone || "") === normalizedPhone);
        if (phoneDuplicate) {
          return res.status(400).json({ message: "A user with this mobile number already exists" });
        }
      }

      const parsed = insertCrmUserSchema.partial().parse(body);
      const user = await storage.updateCrmUser(userId, tid, parsed);
      res.json(user);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/crm-users/:id/revive", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      if (!(await requireAdminRole(req, res, tid))) return;
      const userId = Number(req.params.id);
      const user = await storage.updateCrmUser(userId, tid, { isActive: true, status: "Active" });
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/crm-users/:id/team", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const directReports = await storage.getCrmUserDirectReports(Number(req.params.id), tid);
      res.json(directReports);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/patients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const patient = await storage.getPatient(Number(req.params.id), tid);
      if (!patient) return res.status(404).json({ message: "Patient not found" });
      const sessionCrmUserId = req.session?.crmUserId;
      if (sessionCrmUserId) {
        const [crmUser] = await db.select().from(crmUsers).where(eq(crmUsers.id, sessionCrmUserId));
        const phiLevel = crmUser?.phiAccessLevel || "None";
        logAccess(tid, sessionCrmUserId, "VIEW", "patient", patient.id, null, req);
        return res.json(applyPhiMasking(patient, phiLevel));
      }
      res.json(patient);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/patients", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const body = coerceDateFields(req.body, ["dateOfBirth"]);
      if (body.primaryPhone) body.primaryPhone = normalizeCrmPhone(body.primaryPhone);
      if (body.secondaryPhone) body.secondaryPhone = normalizeCrmPhone(body.secondaryPhone);
      const parsed = insertPatientSchema.parse({ ...body, tenantId: tid });
      const patient = await storage.createPatient(parsed);
      res.status(201).json(patient);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.patch("/api/patients/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const body = coerceDateFields(req.body, ["dateOfBirth"]);
      if (body.primaryPhone) body.primaryPhone = normalizeCrmPhone(body.primaryPhone);
      if (body.secondaryPhone) body.secondaryPhone = normalizeCrmPhone(body.secondaryPhone);
      const parsed = insertPatientSchema.partial().parse(body);
      const patient = await storage.updatePatient(Number(req.params.id), tid, parsed);
      res.json(patient);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/patients/:id/contacts", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const result = await storage.getContactsForPatient(Number(req.params.id), tid);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // PATIENT CONTACT-PERSON MANAGEMENT
  // GET returns: patient-direct links (patientContactLinks) + lead-derived (lead_contact_persons via episodes)
  // POST/DELETE/PATCH: operate on patientContactLinks (patient-specific, independent of lead links)
  // =============================================
  app.get("/api/patients/:id/contact-persons", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const patientId = Number(req.params.id);

      // 1) Patient-direct contact persons from patientContactLinks
      const patientLinkRows = await pool.query(
        `SELECT pcl.id, pcl.patient_id, pcl.relationship,
                pcl.is_primary, pcl.is_billing_contact, pcl.is_emergency_contact,
                pcl.is_whatsapp_consent_holder, pcl.is_appointment_coordinator,
                cp.id as cp_id, cp.name as cp_name, cp.phone_e164, cp.whatsapp_number,
                cp.email, cp.gender, cp.status,
                'patient' as link_source
         FROM patient_contact_links pcl
         JOIN contact_persons cp ON cp.id = pcl.contact_person_id
         WHERE pcl.patient_id = $1 AND pcl.tenant_id = $2
         ORDER BY pcl.is_primary DESC, cp.name ASC`,
        [patientId, tid]
      );

      // 2) Lead-derived contacts from lead_contact_persons via episodes
      const episodeRows = await pool.query(
        `SELECT DISTINCT e.lead_id FROM episodes e WHERE e.patient_id = $1 AND e.tenant_id = $2 AND e.lead_id IS NOT NULL`,
        [patientId, tid]
      );
      let leadDerivedRows: any[] = [];
      if (episodeRows.rows.length > 0) {
        const leadIds = episodeRows.rows.map((r: any) => r.lead_id);
        const cpRows = await pool.query(
          `SELECT lcp.id, lcp.lead_id, lcp.relationship, lcp.notes,
                  lcp.is_primary, lcp.is_billing_contact, lcp.is_emergency_contact,
                  lcp.is_whatsapp_consent_holder, lcp.is_appointment_coordinator,
                  cp.id as cp_id, cp.name as cp_name, cp.phone_e164, cp.whatsapp_number,
                  cp.email, cp.gender, cp.status,
                  'lead' as link_source
           FROM lead_contact_persons lcp
           JOIN contact_persons cp ON cp.id = lcp.contact_person_id
           WHERE lcp.lead_id = ANY($1) AND lcp.tenant_id = $2
           ORDER BY lcp.is_primary DESC, cp.name ASC`,
          [leadIds, tid]
        );
        leadDerivedRows = cpRows.rows;
      }

      const mapRow = (r: any) => ({
        id: r.id,
        leadId: r.lead_id || null,
        patientId: r.patient_id || null,
        linkSource: r.link_source,
        relationship: r.relationship,
        notes: r.notes || null,
        isPrimary: r.is_primary,
        isBillingContact: r.is_billing_contact,
        isEmergencyContact: r.is_emergency_contact,
        isWhatsAppConsentHolder: r.is_whatsapp_consent_holder,
        isAppointmentCoordinator: r.is_appointment_coordinator,
        contactPerson: {
          id: r.cp_id, name: r.cp_name, phoneE164: r.phone_e164,
          whatsappNumber: r.whatsapp_number, email: r.email, gender: r.gender, status: r.status,
        },
      });

      const result = [
        ...patientLinkRows.rows.map(mapRow),
        ...leadDerivedRows.map(mapRow),
      ];

      const sessionCrmUserId = (req as any).session?.crmUserId;
      const [crmUser] = await db.select().from(crmUsers).where(eq(crmUsers.id, sessionCrmUserId || 0));
      const phiLevel = crmUser?.phiAccessLevel || "Masked";
      res.json(applyPhiMasking(result, phiLevel));
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // PATIENT CONTACT-PERSON MANAGEMENT (via patientContactLinks.contactPersonId)
  // These are patient-specific associations, independent of lead_contact_persons
  // =============================================

  // POST /api/patients/:id/contact-persons - link a contact person directly to patient
  app.post("/api/patients/:id/contact-persons", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const patientId = Number(req.params.id);
      // Verify patient belongs to this tenant
      const [patient] = await db.select({ id: patients.id }).from(patients)
        .where(and(eq(patients.id, patientId), eq(patients.tenantId, tid)));
      if (!patient) return res.status(404).json({ message: "Patient not found" });
      // Resolve contactPersonId — either provided or create new contact person
      let cpId: number = req.body.contactPersonId ? Number(req.body.contactPersonId) : 0;
      if (cpId) {
        const [cp] = await db.select({ id: contactPersons.id }).from(contactPersons)
          .where(and(eq(contactPersons.id, cpId), eq(contactPersons.tenantId, tid)));
        if (!cp) return res.status(403).json({ message: "Contact person not found or access denied" });
      } else {
        // Create new contact person from inline data
        const [newCp] = await db.insert(contactPersons).values({
          tenantId: tid,
          name: req.body.name,
          phoneE164: req.body.phoneE164 || null,
          whatsappNumber: req.body.whatsappNumber || null,
          email: req.body.email || null,
          relationship: req.body.relationship || "Other",
        }).returning();
        cpId = newCp.id;
      }
      // Create direct patient→contactPerson link in patientContactLinks
      const [link] = await db.insert(patientContactLinks).values({
        tenantId: tid,
        patientId,
        contactPersonId: cpId,
        relationship: req.body.relationship || "Other",
        isPrimary: req.body.isPrimary || false,
        isBillingContact: req.body.isBillingContact || false,
        isEmergencyContact: req.body.isEmergencyContact || false,
        isWhatsAppConsentHolder: req.body.isWhatsAppConsentHolder || false,
        isAppointmentCoordinator: req.body.isAppointmentCoordinator || false,
      }).returning();
      res.status(201).json(link);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  // DELETE /api/patients/:id/contact-persons/:linkId - remove patient contact-person link
  app.delete("/api/patients/:id/contact-persons/:linkId", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const patientId = Number(req.params.id);
      const linkId = Number(req.params.linkId);
      // Verify the link belongs to this patient and tenant
      const [existingLink] = await db.select().from(patientContactLinks)
        .where(and(
          eq(patientContactLinks.id, linkId),
          eq(patientContactLinks.tenantId, tid),
          eq(patientContactLinks.patientId, patientId)
        ));
      if (!existingLink) return res.status(404).json({ message: "Contact person link not found" });
      await db.delete(patientContactLinks).where(eq(patientContactLinks.id, linkId));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // PATCH /api/patients/:id/contact-persons/:linkId - update patient contact-person link flags
  app.patch("/api/patients/:id/contact-persons/:linkId", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const patientId = Number(req.params.id);
      const linkId = Number(req.params.linkId);
      const [existingLink] = await db.select().from(patientContactLinks)
        .where(and(
          eq(patientContactLinks.id, linkId),
          eq(patientContactLinks.tenantId, tid),
          eq(patientContactLinks.patientId, patientId)
        ));
      if (!existingLink) return res.status(404).json({ message: "Contact person link not found" });
      const [updated] = await db.update(patientContactLinks).set({
        relationship: req.body.relationship || existingLink.relationship,
        isPrimary: req.body.isPrimary ?? existingLink.isPrimary,
        isBillingContact: req.body.isBillingContact ?? existingLink.isBillingContact,
        isEmergencyContact: req.body.isEmergencyContact ?? existingLink.isEmergencyContact,
        isWhatsAppConsentHolder: req.body.isWhatsAppConsentHolder ?? existingLink.isWhatsAppConsentHolder,
        isAppointmentCoordinator: req.body.isAppointmentCoordinator ?? existingLink.isAppointmentCoordinator,
      }).where(eq(patientContactLinks.id, linkId)).returning();
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/contacts", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const parsed = insertContactSchema.parse({ ...req.body, tenantId: tid });
      const contact = await storage.createContact(parsed);
      res.status(201).json(contact);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.patch("/api/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const parsed = insertContactSchema.partial().parse(req.body);
      const contact = await storage.updateContact(Number(req.params.id), tid, parsed);
      res.json(contact);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.delete("/api/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      await storage.deleteContact(Number(req.params.id), tid);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/patient-contact-links", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const parsed = insertPatientContactLinkSchema.parse({ ...req.body, tenantId: tid });
      const link = await storage.linkPatientContact(parsed);
      res.status(201).json(link);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.delete("/api/patient-contact-links/:patientId/:contactId", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      await storage.unlinkPatientContact(Number(req.params.patientId), Number(req.params.contactId), tid);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // CONTACT PERSONS ROUTES
  // =============================================
  // GET /api/contact-persons/search?phone=... — find contact persons by phone (for duplicate reuse)
  app.get("/api/contact-persons/search", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const phone = String(req.query.phone || "").trim();
      if (!phone || phone.length < 6) return res.json([]);
      const rows = await pool.query(
        `SELECT id, name, phone_e164, whatsapp_number, email, relationship, status
         FROM contact_persons
         WHERE tenant_id = $1 AND (phone_e164 ILIKE $2 OR phone_e164 = $3)
         AND status != 'Inactive'
         LIMIT 5`,
        [tid, `%${phone}%`, phone]
      );
      const sessionCrmUserId = (req as any).session?.crmUserId;
      const [crmUser] = await db.select().from(crmUsers).where(eq(crmUsers.id, sessionCrmUserId || 0));
      const phiLevel = crmUser?.phiAccessLevel || "Masked";
      const result = rows.rows.map((r: any) => ({
        id: r.id, name: r.name, phoneE164: r.phone_e164,
        whatsappNumber: r.whatsapp_number, email: r.email,
        relationship: r.relationship, status: r.status,
      }));
      res.json(applyPhiMasking(result, phiLevel));
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/contact-persons", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const search = req.query.search as string | undefined;
      const result = await storage.getContactPersons(tid, search);
      // Enrich with lead counts and patient counts
      const countResult = await pool.query(
        `SELECT contact_person_id, COUNT(*) as cnt FROM lead_contact_persons WHERE tenant_id = $1 GROUP BY contact_person_id`,
        [tid]
      );
      const countMap = new Map<number, number>();
      countResult.rows.forEach((r: any) => countMap.set(Number(r.contact_person_id), Number(r.cnt)));
      // Patient count: via episodes (lead-derived) UNION direct patient_contact_links
      const patCountResult = await pool.query(
        `SELECT contact_person_id, SUM(cnt) as cnt FROM (
           SELECT lcp.contact_person_id, COUNT(DISTINCT e.patient_id) as cnt
           FROM lead_contact_persons lcp
           JOIN episodes e ON e.lead_id = lcp.lead_id AND e.patient_id IS NOT NULL
           WHERE lcp.tenant_id = $1
           GROUP BY lcp.contact_person_id
           UNION ALL
           SELECT pcl.contact_person_id, COUNT(DISTINCT pcl.patient_id) as cnt
           FROM patient_contact_links pcl
           WHERE pcl.tenant_id = $1 AND pcl.contact_person_id IS NOT NULL
           GROUP BY pcl.contact_person_id
         ) sub GROUP BY contact_person_id`,
        [tid]
      );
      const patCountMap = new Map<number, number>();
      patCountResult.rows.forEach((r: any) => patCountMap.set(Number(r.contact_person_id), Number(r.cnt)));
      const enriched = result.map((cp: any) => ({
        ...cp,
        _leadCount: countMap.get(cp.id) || 0,
        _patientCount: patCountMap.get(cp.id) || 0,
      }));
      const sessionCrmUserId = (req as any).session?.crmUserId;
      const [crmUser] = await db.select().from(crmUsers).where(eq(crmUsers.id, sessionCrmUserId || 0));
      const phiLevel = crmUser?.phiAccessLevel || "Masked";
      res.json(applyPhiMasking(enriched, phiLevel));
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/contact-persons/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const cp = await storage.getContactPerson(Number(req.params.id), tid);
      if (!cp) return res.status(404).json({ message: "Contact person not found" });
      const sessionCrmUserId = (req as any).session?.crmUserId;
      const [crmUser] = await db.select().from(crmUsers).where(eq(crmUsers.id, sessionCrmUserId || 0));
      const phiLevel = crmUser?.phiAccessLevel || "Masked";
      res.json(applyPhiMasking(cp, phiLevel));
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/contact-persons", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const parsed = insertContactPersonSchema.parse({ ...req.body, tenantId: tid });
      const cp = await storage.createContactPerson(parsed);
      res.status(201).json(cp);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.patch("/api/contact-persons/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const cpId = Number(req.params.id);
      // Reachability guard: if phone is being cleared, ensure no linked lead loses its last reachable phone
      if ("phoneE164" in req.body && (!req.body.phoneE164 || !String(req.body.phoneE164).trim())) {
        try {
          await assertContactPersonPhoneUpdateSafe(cpId, tid, req.body.phoneE164);
        } catch (reachErr: any) {
          return res.status(400).json({ message: reachErr.message });
        }
      }
      const parsed = insertContactPersonSchema.partial().parse(req.body);
      const cp = await storage.updateContactPerson(cpId, tid, parsed);
      res.json(cp);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.delete("/api/contact-persons/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const cpId = Number(req.params.id);
      // Reachability guard: treat delete as clearing phone (same effect on linked leads)
      try {
        await assertContactPersonPhoneUpdateSafe(cpId, tid, null);
      } catch (reachErr: any) {
        return res.status(400).json({ message: reachErr.message });
      }
      await storage.deleteContactPerson(cpId, tid);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // Lead → Contact Person linking
  app.get("/api/leads/:id/contact-persons", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const result = await storage.getLeadContactPersons(Number(req.params.id), tid);
      const sessionCrmUserId = (req as any).session?.crmUserId;
      const [crmUser] = await db.select().from(crmUsers).where(eq(crmUsers.id, sessionCrmUserId || 0));
      const phiLevel = crmUser?.phiAccessLevel || "Masked";
      // Apply masking to the contactPerson sub-object
      const masked = result.map((link: any) => ({
        ...link,
        contactPerson: applyPhiMasking(link.contactPerson, phiLevel),
      }));
      res.json(masked);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/leads/:id/contact-persons", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const leadId = Number(req.params.id);
      // Verify lead belongs to this tenant
      const [lead] = await db.select({ id: leads.id }).from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, tid)));
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      // If contactPersonId provided, verify it belongs to this tenant
      if (req.body.contactPersonId) {
        const [cp] = await db.select({ id: contactPersons.id }).from(contactPersons)
          .where(and(eq(contactPersons.id, Number(req.body.contactPersonId)), eq(contactPersons.tenantId, tid)));
        if (!cp) return res.status(403).json({ message: "Contact person not found or access denied" });
      }
      const parsed = insertLeadContactPersonSchema.parse({ ...req.body, tenantId: tid, leadId });
      const link = await storage.addLeadContactPerson(parsed);
      res.status(201).json(link);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.patch("/api/leads/:id/contact-persons/:linkId", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const leadId = Number(req.params.id);
      const linkId = Number(req.params.linkId);
      // Verify the link belongs to THIS lead and this tenant (IDOR protection)
      const [existingLink] = await db.select().from(leadContactPersons)
        .where(and(
          eq(leadContactPersons.id, linkId),
          eq(leadContactPersons.tenantId, tid),
          eq(leadContactPersons.leadId, leadId)
        ));
      if (!existingLink) return res.status(404).json({ message: "Contact person link not found" });
      const parsed = insertLeadContactPersonSchema.partial().parse(req.body);
      const link = await storage.updateLeadContactPerson(linkId, tid, parsed);
      res.json(link);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.delete("/api/leads/:id/contact-persons/:linkId", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const leadId = Number(req.params.id);
      const linkId = Number(req.params.linkId);
      // Verify the link belongs to THIS lead and this tenant (IDOR protection)
      const [existingLink] = await db.select().from(leadContactPersons)
        .where(and(
          eq(leadContactPersons.id, linkId),
          eq(leadContactPersons.tenantId, tid),
          eq(leadContactPersons.leadId, leadId)
        ));
      if (!existingLink) return res.status(404).json({ message: "Contact person link not found" });
      // Reachability guard: simulate removal and check if the VERIFIED lead still has a reachable phone
      try {
        await assertLeadReachable(existingLink.leadId, tid, linkId);
      } catch (reachErr: any) {
        return res.status(400).json({ message: reachErr.message });
      }
      await storage.removeLeadContactPerson(linkId, tid);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // Get leads linked to a contact person
  app.get("/api/contact-persons/:id/leads", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const cpId = Number(req.params.id);
      const result = await pool.query(
        `SELECT lcp.*, l.name as "leadName", l.status as "leadStatus", l.phone_e164 as "leadPhone"
         FROM lead_contact_persons lcp
         JOIN leads l ON l.id = lcp.lead_id
         WHERE lcp.contact_person_id = $1 AND lcp.tenant_id = $2
         ORDER BY lcp.id DESC`,
        [cpId, tid]
      );
      const sessionCrmUserId = (req as any).session?.crmUserId;
      const [crmUser] = await db.select().from(crmUsers).where(eq(crmUsers.id, sessionCrmUserId || 0));
      const phiLevel = crmUser?.phiAccessLevel || "Masked";
      res.json(applyPhiMasking(result.rows, phiLevel));
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // GET /api/contact-persons/:id/patients - all patients linked to a contact person
  // Includes: lead-derived (episodes) + patient-direct (patientContactLinks)
  app.get("/api/contact-persons/:id/patients", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const cpId = Number(req.params.id);
      const rows = await pool.query(
        `SELECT DISTINCT p.id, p.first_name, p.last_name, p.tenant_id,
                'lead' as link_source
         FROM lead_contact_persons lcp
         JOIN episodes e ON e.lead_id = lcp.lead_id AND e.patient_id IS NOT NULL
         JOIN patients p ON p.id = e.patient_id
         WHERE lcp.contact_person_id = $1 AND lcp.tenant_id = $2
         UNION
         SELECT DISTINCT p.id, p.first_name, p.last_name, p.tenant_id,
                'patient' as link_source
         FROM patient_contact_links pcl
         JOIN patients p ON p.id = pcl.patient_id
         WHERE pcl.contact_person_id = $1 AND pcl.tenant_id = $2`,
        [cpId, tid]
      );
      const sessionCrmUserId = (req as any).session?.crmUserId;
      const [crmUser] = await db.select().from(crmUsers).where(eq(crmUsers.id, sessionCrmUserId || 0));
      const phiLevel = crmUser?.phiAccessLevel || "Masked";
      res.json(applyPhiMasking(rows.rows, phiLevel));
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
        return res.json({ available: false, reason: "Doctor on leave", slots: [], windows: [] });
      }

      const timings = await storage.getDoctorOpdTimings(doctorId, tid);
      const dayTimings = timings.filter((t: any) => t.dayOfWeek === dayOfWeek);
      if (dayTimings.length === 0) {
        return res.json({ available: false, reason: "No OPD on this day", slots: [], windows: [] });
      }

      // Fetch existing appointments enriched with patient/lead names for this doctor on this date
      const enrichedAppts = (await pool.query(
        `SELECT a.start_time,
          COALESCE(
            NULLIF(CONCAT(p.first_name, ' ', COALESCE(p.last_name,'')), ' '),
            l.name,
            'Patient'
          ) as patient_name
         FROM appointments a
         LEFT JOIN leads l ON l.id = a.lead_id
         LEFT JOIN patients p ON p.id = a.patient_id
         WHERE a.doctor_id = $1 AND a.tenant_id = $2
           AND DATE(a.appointment_date AT TIME ZONE 'UTC') = $3::date
           AND a.status != 'Cancelled'`,
        [doctorId, tid, date]
      )).rows;

      // Helper: convert "HH:MM" or "HH:MM:SS" to total minutes
      function timeToMin(t: string): number {
        const parts = t.split(":");
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
      }
      function minToTime(m: number): string {
        const h = Math.floor(m / 60) % 24;
        const mm = m % 60;
        return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      }

      // For backward-compat: keep top-level slots as window summaries
      interface WindowSlot {
        startTime: string; endTime: string; maxPatients: number; booked: number; availableCount: number;
      }
      interface IndividualSlot {
        startTime: string; endTime: string;
        windowStart: string; windowEnd: string;
        isBooked: boolean; patientName: string | null;
        availableCount: number;
      }

      const windowSlots: WindowSlot[] = [];
      const individualSlots: IndividualSlot[] = [];

      for (const timing of dayTimings) {
        const winStart = timing.startTime.slice(0, 5);
        const winEnd = timing.endTime.slice(0, 5);
        const winStartMin = timeToMin(winStart);
        const winEndMin = timeToMin(winEnd);
        const slotDurMin = timing.slotDuration || 15;
        const maxP = timing.maxPatients || 20;

        // Window-level summary (backward compat)
        const winBooked = enrichedAppts.filter((a: any) => {
          const t = (a.start_time || "").slice(0, 5);
          const tMin = timeToMin(t || "00:00");
          return tMin >= winStartMin && tMin < winEndMin;
        }).length;
        windowSlots.push({
          startTime: winStart,
          endTime: winEnd,
          maxPatients: maxP,
          booked: winBooked,
          availableCount: Math.max(0, maxP - winBooked),
        });

        // Individual slots within this window
        let cur = winStartMin;
        while (cur + slotDurMin <= winEndMin) {
          const slotStart = minToTime(cur);
          const slotEnd = minToTime(cur + slotDurMin);
          // Find appointment(s) whose start time falls in this slot
          const apptInSlot = enrichedAppts.find((a: any) => {
            const tMin = timeToMin((a.start_time || "00:00").slice(0, 5));
            return tMin >= cur && tMin < cur + slotDurMin;
          });
          individualSlots.push({
            startTime: slotStart,
            endTime: slotEnd,
            windowStart: winStart,
            windowEnd: winEnd,
            isBooked: !!apptInSlot,
            patientName: apptInSlot ? apptInSlot.patient_name : null,
            availableCount: apptInSlot ? 0 : 1,
          });
          cur += slotDurMin;
        }
      }

      res.json({
        available: true,
        dayOfWeek,
        slots: windowSlots,       // backward compat: window-level summary
        individualSlots,          // new: individual 15-min slots for the slot grid
        windows: dayTimings.map((t: any) => ({
          startTime: t.startTime.slice(0, 5),
          endTime: t.endTime.slice(0, 5),
          maxPatients: t.maxPatients || 20,
          slotDuration: t.slotDuration || 15,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/appointments/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const appt = await storage.getAppointment(Number(req.params.id), tid);
      if (!appt) return res.status(404).json({ message: "Appointment not found" });
      res.json(appt);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
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
        const timings = await storage.getDoctorOpdTimings(parsed.doctorId, tid);
        const dayOfWeek = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
        const dayTimings = timings.filter((t: any) => t.dayOfWeek === dayOfWeek && t.status === "Active");

        const leaves = await storage.getDoctorLeaveExceptions(parsed.doctorId, tid, dateStr);
        if (leaves.length > 0) {
          if (parsed.leadId) {
            await storage.createActivity({
              leadId: parsed.leadId, tenantId: tid, createdBy: userId,
              type: "note",
              description: "Doctor slot unavailable — lead interested.",
            });
          }
          return res.status(400).json({ message: "Doctor is on leave on this date" });
        }

        const timeToMinutes = (t: string) => {
          const [h, m] = t.split(":").map(Number);
          return h * 60 + (m || 0);
        };
        const apptMinutes = timeToMinutes(parsed.startTime);

        const matchingSlot = dayTimings.find((t: any) => {
          const slotStart = timeToMinutes(t.startTime);
          const slotEnd = timeToMinutes(t.endTime);
          return apptMinutes >= slotStart && apptMinutes < slotEnd;
        });

        if (!matchingSlot) {
          if (parsed.leadId) {
            await storage.createActivity({
              leadId: parsed.leadId, tenantId: tid, createdBy: userId,
              type: "note",
              description: "Doctor slot unavailable — lead interested.",
            });
          }
          const availableSlots = dayTimings.map((t: any) => `${t.startTime}-${t.endTime}`).join(", ");
          return res.status(400).json({
            message: availableSlots
              ? `Time ${parsed.startTime} is outside the doctor's available slots. Available: ${availableSlots}`
              : `Doctor has no OPD slots on ${dayOfWeek}`
          });
        }

        const existingAppts = await storage.getAppointmentsForDoctorOnDate(parsed.doctorId, tid, dateStr);
        const bookedInSlot = existingAppts.filter((a: any) => {
          const aMin = timeToMinutes(a.startTime || "00:00");
          const slotStart = timeToMinutes(matchingSlot.startTime);
          const slotEnd = timeToMinutes(matchingSlot.endTime);
          return aMin >= slotStart && aMin < slotEnd;
        }).length;
        const maxP = matchingSlot.maxPatients || 20;
        if (bookedInSlot >= maxP) {
          if (parsed.leadId) {
            await storage.createActivity({
              leadId: parsed.leadId, tenantId: tid, createdBy: userId,
              type: "note",
              description: "Doctor slot unavailable — lead interested.",
            });
          }
          return res.status(409).json({ message: `Slot ${matchingSlot.startTime}-${matchingSlot.endTime} is fully booked (${bookedInSlot}/${maxP})` });
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

        await pool.query(
          `UPDATE leads SET last_activity_at = NOW(), last_contact_at = NOW() WHERE id = $1 AND tenant_id = $2`,
          [parsed.leadId, tid]
        );

        try {
          const { computeAndUpdateTemperature } = await import("./services/temperatureEngine");
          await computeAndUpdateTemperature(parsed.leadId, tid, "Appointment Booked", userId);
        } catch (tempErr) {
          console.error("[appointment] Temperature update failed:", tempErr);
        }

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
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.patch("/api/appointments/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const parsed = insertAppointmentSchema.partial().parse(req.body);
      const appt = await storage.updateAppointment(Number(req.params.id), tid, parsed);
      res.json(appt);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
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

      if (appt.episodeId) {
        const [linkedEpisode] = await db.select().from(episodes).where(
          and(eq(episodes.id, appt.episodeId), eq(episodes.tenantId, tid))
        );
        if (!linkedEpisode) {
          return res.status(400).json({ message: "The linked episode could not be found. Please verify the episode exists." });
        }
      } else if (appt.leadId) {
        const [existingEpisode] = await db.select().from(episodes).where(
          and(eq(episodes.leadId, appt.leadId), eq(episodes.tenantId, tid))
        ).limit(1);
        if (!existingEpisode) {
          return res.status(400).json({ message: "An episode must be created for this patient before marking consultation as done. Please create an episode first." });
        }
      } else if (appt.patientId) {
        const [existingEpisode] = await db.select().from(episodes).where(
          and(eq(episodes.patientId, appt.patientId), eq(episodes.tenantId, tid))
        ).limit(1);
        if (!existingEpisode) {
          return res.status(400).json({ message: "An episode must be created for this patient before marking consultation as done. Please create an episode first." });
        }
      }

      const updated = await storage.updateAppointment(apptId, tid, {
        status: "Consultation Done",
        consultationNotes: consultationNotes || null,
        consultationDoneAt: new Date(),
        consultationDoneBy: userId,
      });

      if (appt.episodeId) {
        const [linkedEp] = await db.select().from(episodes).where(
          and(eq(episodes.id, appt.episodeId), eq(episodes.tenantId, tid))
        );
        if (linkedEp && linkedEp.status === "Consultation In Progress") {
          await storage.updateEpisode(appt.episodeId, tid, {
            status: "Consultation Done",
          });
        }
      }

      if (appt.leadId) {
        const lead = await storage.getLead(appt.leadId);
        await storage.updateLead(appt.leadId, { status: "Consultation Done" });
        await storage.createActivity({
          leadId: appt.leadId, tenantId: tid, createdBy: userId,
          type: "status_change",
          description: `Consultation completed${consultationNotes ? `: ${consultationNotes}` : ""}`,
          oldStatus: lead?.status || "Appointment Booked",
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
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
        const timings = await storage.getDoctorOpdTimings(appt.doctorId, tid);
        const dayOfWeek = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
        const dayTimings = timings.filter((t: any) => t.dayOfWeek === dayOfWeek && t.status === "Active");

        const leaves = await storage.getDoctorLeaveExceptions(appt.doctorId, tid, dateStr);
        if (leaves.length > 0) {
          return res.status(400).json({ message: "Doctor is on leave on this date" });
        }

        const timeToMinutes = (t: string) => {
          const [h, m] = t.split(":").map(Number);
          return h * 60 + (m || 0);
        };
        const apptMinutes = timeToMinutes(startTime);

        const matchingSlot = dayTimings.find((t: any) => {
          const slotStart = timeToMinutes(t.startTime);
          const slotEnd = timeToMinutes(t.endTime);
          return apptMinutes >= slotStart && apptMinutes < slotEnd;
        });

        if (!matchingSlot) {
          const availableSlots = dayTimings.map((t: any) => `${t.startTime}-${t.endTime}`).join(", ");
          return res.status(400).json({
            message: availableSlots
              ? `Time ${startTime} is outside the doctor's available slots. Available: ${availableSlots}`
              : `Doctor has no OPD slots on ${dayOfWeek}`
          });
        }

        const existingAppts = await storage.getAppointmentsForDoctorOnDate(appt.doctorId, tid, dateStr);
        const bookedInSlot = existingAppts.filter((a: any) => {
          if (a.id === apptId) return false;
          const aMin = timeToMinutes(a.startTime || "00:00");
          const slotStart = timeToMinutes(matchingSlot.startTime);
          const slotEnd = timeToMinutes(matchingSlot.endTime);
          return aMin >= slotStart && aMin < slotEnd;
        }).length;
        const maxP = matchingSlot.maxPatients || 20;
        if (bookedInSlot >= maxP) {
          return res.status(409).json({ message: `Slot ${matchingSlot.startTime}-${matchingSlot.endTime} is fully booked` });
        }
      }

      const newToken = await storage.getNextTokenNumber(appt.doctorId, tid, dateStr);

      const newRescheduleCount = (appt.rescheduleCount || 0) + 1;

      const updated = await storage.updateAppointment(apptId, tid, {
        appointmentDate: new Date(appointmentDate),
        startTime: startTime || appt.startTime,
        endTime: endTime || appt.endTime,
        tokenNumber: newToken,
        rescheduleCount: newRescheduleCount,
        status: "Rescheduled",
      });

      const oldDate = appt.appointmentDate ? new Date(appt.appointmentDate) : null;
      const newDateObj = new Date(appointmentDate);
      const daysBetween = oldDate ? Math.round(Math.abs(newDateObj.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

      await db.insert(rescheduleHistory).values({
        tenantId: tid,
        appointmentId: apptId,
        oldDate: oldDate,
        newDate: newDateObj,
        oldStartTime: appt.startTime || null,
        newStartTime: startTime || appt.startTime || null,
        reason: req.body.reason || null,
        rescheduledBy: userId,
        daysBetween,
      });

      if (appt.leadId) {
        await storage.createActivity({
          leadId: appt.leadId, tenantId: tid, createdBy: userId,
          type: "appointment",
          description: `Appointment rescheduled to ${dateStr} - Token #${newToken}`,
        });

        await db.update(leads).set({
          rescheduleCount: sql`COALESCE(reschedule_count, 0) + 1`,
          lastActivityAt: new Date(),
        }).where(and(eq(leads.id, appt.leadId), eq(leads.tenantId, tid)));

        if (newRescheduleCount >= 2) {
          try {
            await computeAndUpdateTemperature(appt.leadId, tid, "Reschedule 2+", userId, apptId, "Appointment");
          } catch {}
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
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

        const newNoShowCount = (await pool.query(
          `UPDATE leads SET no_show_count = COALESCE(no_show_count, 0) + 1, last_activity_at = NOW()
           WHERE id = $1 AND tenant_id = $2 RETURNING no_show_count`,
          [appt.leadId, tid]
        )).rows[0]?.no_show_count || 1;

        try {
          await computeAndUpdateTemperature(appt.leadId, tid, "No Show", userId, apptId, "Appointment");
        } catch {}

        try {
          await storage.createTask({
            tenantId: tid,
            leadId: appt.leadId,
            title: `Follow up after No Show - Appointment #${apptId}`,
            description: `Patient did not show for their appointment. Please follow up to reschedule.`,
            priority: newNoShowCount >= 2 ? "High" : "Normal",
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            assignedTo: appt.bookedBy || userId,
            assignedCrmUserId: appt.bookedByCrmUserId || (req as any).session?.crmUserId || null,
            status: "Pending",
            createdBy: userId,
          } as any);
        } catch {}

        if (newNoShowCount >= 2) {
          try {
            const supervisorResult = await pool.query(
              `SELECT cu.id, cu.name FROM crm_users cu
               JOIN system_roles sr ON cu.system_role_id = sr.id
               WHERE cu.tenant_id = $1 AND sr.code IN ('MANAGER', 'ADMIN') AND cu.is_active = true
               AND ($2::integer IS NULL OR cu.branch_id = $2)
               ORDER BY CASE sr.code WHEN 'MANAGER' THEN 1 WHEN 'ADMIN' THEN 2 END
               LIMIT 1`,
              [tid, appt.branchId || null]
            );
            if (supervisorResult.rows[0]) {
              await storage.createTask({
                tenantId: tid,
                leadId: appt.leadId,
                title: `ESCALATION: Multiple No Shows (${newNoShowCount}) - Appointment #${apptId}`,
                description: `Patient has missed ${newNoShowCount} appointments. High risk drop-off. Immediate attention required.`,
                priority: "Urgent",
                dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000),
                assignedCrmUserId: supervisorResult.rows[0].id,
                status: "Pending",
                createdBy: "system",
              } as any);
            }
          } catch {}

          try {
            await processAutoNurtureOnNoShow(appt.leadId, tid, newNoShowCount, userId);
          } catch (nurtureErr: any) {
            console.error("Auto-nurture on no-show failed:", nurtureErr.message);
          }
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // FRONT OFFICE — CHECK-IN
  // =============================================
  app.post("/api/appointments/:id/check-in", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const userId = String((req as any).session?.crmUserId || "system");
      const apptId = Number(req.params.id);

      const appt = await storage.getAppointment(apptId, tid);
      if (!appt) return res.status(404).json({ message: "Appointment not found" });
      if (appt.status === "Checked In") return res.status(400).json({ message: "Already checked in" });
      if (appt.status === "Done" || appt.status === "Cancelled") return res.status(400).json({ message: `Cannot check in — appointment is ${appt.status}` });

      let patientId = appt.patientId;

      if (!patientId && appt.leadId) {
        const lead = await storage.getLead(appt.leadId);
        if (lead) {
          if (lead.patientId) {
            patientId = lead.patientId;
          } else {
            const nameParts = lead.name.trim().split(/\s+/);
            const firstName = nameParts[0] || "Patient";
            const lastName = nameParts.slice(1).join(" ") || "";

            const existingPatients = await pool.query(
              `SELECT id FROM patients WHERE tenant_id = $1 ORDER BY id DESC LIMIT 1`, [tid]
            );
            const nextNum = (existingPatients.rows[0]?.id || 0) + 1;
            const uhid = `PAT_${String(nextNum).padStart(4, "0")}`;

            const newPatient = await storage.createPatient({
              tenantId: tid,
              uhid,
              firstName,
              lastName: lastName || null,
              primaryPhone: lead.phoneE164,
              email: lead.email || null,
              status: "Active",
              createdBy: userId,
            } as any);
            patientId = newPatient.id;

            await storage.updateLead(lead.id, { patientId });
          }
        }
      }

      const updated = await storage.updateAppointment(apptId, tid, {
        status: "Checked In",
        patientId,
        checkedInAt: new Date(),
        checkedInBy: userId,
        checkedInByCrmUserId: (req as any).session?.crmUserId || null,
      } as any);

      if (appt.leadId) {
        await storage.createActivity({
          leadId: appt.leadId, tenantId: tid, createdBy: userId,
          type: "status_change",
          description: `Patient checked in for appointment with Dr. ${appt.doctorId}`,
        });

        try {
          await processAutoHandover("Lead", appt.leadId, "Checked In", tid, userId, {
            branchId: appt.branchId,
            doctorId: appt.doctorId,
            appointmentId: apptId,
          });
        } catch {}
      }

      let existingEpisodes: any[] = [];
      if (patientId) {
        const epResult = await pool.query(
          `SELECT id, episode_name, status, doctor_id, treatment_department_id, created_at
           FROM episodes WHERE tenant_id = $1 AND patient_id = $2
           AND status NOT IN ('Completed', 'Discontinued')
           ORDER BY created_at DESC LIMIT 10`,
          [tid, patientId]
        );
        existingEpisodes = epResult.rows;
      }

      res.json({ ...updated, patientId, existingEpisodes, needsEpisodeAction: true });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/appointments/checked-in-today", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const doctorId = req.query.doctorId ? Number(req.query.doctorId) : null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let query = `
        SELECT a.*, p.first_name, p.last_name, p.primary_phone, p.uhid,
               l.name as lead_name
        FROM appointments a
        LEFT JOIN patients p ON a.patient_id = p.id
        LEFT JOIN leads l ON a.lead_id = l.id
        WHERE a.tenant_id = $1
          AND a.status = 'Checked In'
          AND a.appointment_date >= $2
          AND a.appointment_date < $3
      `;
      const params: any[] = [tid, today, tomorrow];

      if (doctorId) {
        query += ` AND a.doctor_id = $${params.length + 1}`;
        params.push(doctorId);
      }

      query += ` ORDER BY a.checked_in_at ASC`;

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/campaigns/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const c = await storage.getCampaign(Number(req.params.id), tid);
      if (!c) return res.status(404).json({ message: "Campaign not found" });
      res.json(c);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.delete("/api/connectors/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
      const tid = await getDefaultTenantId(req);
      await storage.deletePlatformConnector(Number(req.params.id), tid);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
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
          const creds = c.credentials as any;
          if (!creds?.accessToken || !creds?.adAccountId) {
            await storage.updatePlatformConnector(c.id, tid, { status: "error", syncStatus: null });
            return res.status(400).json({ message: "Meta credentials are missing. Please click Configure, enter your Access Token and Ad Account ID, then Save before testing." });
          }
          const { testMetaConnection, fetchAccountInsights, setTenantCredentials, clearTenantCredentials } = await import("./services/metaAds");
          setTenantCredentials({ accessToken: creds.accessToken, adAccountId: creds.adAccountId, appId: creds.appId });
          try {
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
              let userMsg = testResult.error || "Unknown error";
              if (userMsg.includes("does not exist") || userMsg.includes("(10)")) {
                userMsg = "Ad Account ID not found. Please verify the ID is correct (format: act_XXXXXXXX). Also ensure the System User has been granted access to this Ad Account in Meta Business Settings.";
              } else if (userMsg.includes("could not be decrypted") || userMsg.includes("(190)")) {
                userMsg = "Access Token is invalid or expired. Please generate a new token from Meta Business Manager (System Users → Generate New Token) and update it in the connector configuration.";
              } else if (userMsg.includes("permission") || userMsg.includes("(200)")) {
                userMsg = "Insufficient permissions. Please ensure the access token has these permissions: ads_read, ads_management, leads_retrieval, pages_read_engagement, pages_manage_ads.";
              }
              res.status(400).json({ message: `Meta connection failed: ${userMsg}` });
            }
          } finally {
            clearTenantCredentials();
          }
        } catch (e: any) {
          await storage.updatePlatformConnector(c.id, tid, { status: "error", syncStatus: null });
          let errMsg = e?.message || "Unknown error";
          if (errMsg.includes("does not exist") || errMsg.includes("(10)")) {
            errMsg = "Ad Account ID not found. Please verify the ID is correct (format: act_XXXXXXXX) and that the System User has access to it.";
          } else if (errMsg.includes("could not be decrypted") || errMsg.includes("(190)")) {
            errMsg = "Access Token is invalid or expired. Please generate a new token and update the configuration.";
          }
          res.status(400).json({ message: errMsg });
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
      res.status(500).json({ message: humanizeError(err) });
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
          const { fetchAccountInsights, setTenantCredentials, clearTenantCredentials } = await import("./services/metaAds");
          const creds = c.credentials as any;
          if (creds?.accessToken && creds?.adAccountId) {
            setTenantCredentials({ accessToken: creds.accessToken, adAccountId: creds.adAccountId, appId: creds.appId });
          }
          try {
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
          } finally {
            clearTenantCredentials();
          }
        } catch (e: any) {
          await storage.updatePlatformConnector(c.id, tid, { syncStatus: "error" });
          res.status(400).json({ message: "Unable to sync data from Meta Ads. Please check your connection and try again." });
        }
      } else {
        await storage.updatePlatformConnector(c.id, tid, {
          syncStatus: "synced",
          lastSyncAt: new Date(),
        });
        res.json({ message: "Sync completed" });
      }
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/connectors/meta/insights", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
      const tid = await getDefaultTenantId(req);
      const datePreset = (req.query.datePreset as string) || "last_30d";
      const { fetchAccountInsights, setTenantCredentials, clearTenantCredentials } = await import("./services/metaAds");
      const connectors = await storage.getPlatformConnectors(tid);
      const metaConn = connectors.find((cn: any) => cn.platform === "meta" && cn.status === "connected");
      if (metaConn) {
        const creds = metaConn.credentials as any;
        if (creds?.accessToken && creds?.adAccountId) {
          setTenantCredentials({ accessToken: creds.accessToken, adAccountId: creds.adAccountId, appId: creds.appId });
        }
      }
      try {
        const insights = await fetchAccountInsights(datePreset);
        res.json(insights || {});
      } finally {
        clearTenantCredentials();
      }
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/connectors/meta/campaigns", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
      const tid = await getDefaultTenantId(req);
      const datePreset = (req.query.datePreset as string) || "last_30d";
      const { fetchCampaignInsights, setTenantCredentials, clearTenantCredentials } = await import("./services/metaAds");
      const connectors = await storage.getPlatformConnectors(tid);
      const metaConn = connectors.find((cn: any) => cn.platform === "meta" && cn.status === "connected");
      if (metaConn) {
        const creds = metaConn.credentials as any;
        if (creds?.accessToken && creds?.adAccountId) {
          setTenantCredentials({ accessToken: creds.accessToken, adAccountId: creds.adAccountId, appId: creds.appId });
        }
      }
      try {
        const campaigns = await fetchCampaignInsights(datePreset);
        res.json(campaigns);
      } finally {
        clearTenantCredentials();
      }
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/connectors/meta/daily-insights", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
      const tid = await getDefaultTenantId(req);
      const days = parseInt(req.query.days as string) || 7;
      const { fetchDailyInsights, setTenantCredentials, clearTenantCredentials } = await import("./services/metaAds");
      const connectors = await storage.getPlatformConnectors(tid);
      const metaConn = connectors.find((cn: any) => cn.platform === "meta" && cn.status === "connected");
      if (metaConn) {
        const creds = metaConn.credentials as any;
        if (creds?.accessToken && creds?.adAccountId) {
          setTenantCredentials({ accessToken: creds.accessToken, adAccountId: creds.adAccountId, appId: creds.appId });
        }
      }
      try {
        const daily = await fetchDailyInsights(days);
        res.json(daily);
      } finally {
        clearTenantCredentials();
      }
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // GET /api/connectors/meta/campaigns/:metaCampaignId/insights
  // Fetches insights for a single linked Meta campaign. Cached for 1 hour in-memory.
  app.get("/api/connectors/meta/campaigns/:metaCampaignId/insights", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
      const tid = await getDefaultTenantId(req);
      const { metaCampaignId } = req.params;
      const datePreset = (req.query.datePreset as string) || "last_30d";
      const force = req.query.force === "true";
      const { fetchSingleCampaignInsights, setTenantCredentials, clearTenantCredentials } = await import("./services/metaAds");
      const connectors = await storage.getPlatformConnectors(tid);
      const metaConn = connectors.find((cn: any) => cn.platform === "meta" && cn.status === "connected");
      if (metaConn) {
        const creds = metaConn.credentials as any;
        if (creds?.accessToken && creds?.adAccountId) {
          setTenantCredentials({ accessToken: creds.accessToken, adAccountId: creds.adAccountId, appId: creds.appId });
        }
      }
      try {
        const insights = await fetchSingleCampaignInsights(metaCampaignId, datePreset, force, tid);
        res.json(insights || {});
      } finally {
        clearTenantCredentials();
      }
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // GET /api/analytics/utm-funnel?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
  // Attribution funnel grouped by utmCampaign value.
  app.get("/api/analytics/utm-funnel", isAuthenticated, async (req: any, res: any) => {
    try {
      const tid = await getDefaultTenantId(req);
      const { dateFrom, dateTo } = req.query as { dateFrom?: string; dateTo?: string };

      const fromDate = dateFrom ? new Date(dateFrom) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
      const toDate = dateTo ? new Date(dateTo + "T23:59:59Z") : new Date();

      // Use CTEs to avoid join-multiplication when a lead has multiple appointments AND episodes.
      const rows = await db.execute(sql`
        WITH base AS (
          SELECT l.id AS lead_id, l.utm_campaign, l.utm_source, l.utm_medium
          FROM leads l
          WHERE l.tenant_id = ${tid}
            AND l.utm_campaign IS NOT NULL
            AND l.utm_campaign <> ''
            AND l.created_at >= ${fromDate}
            AND l.created_at <= ${toDate}
        ),
        appt_agg AS (
          SELECT DISTINCT a.lead_id
          FROM appointments a
          WHERE a.tenant_id = ${tid}
            AND a.lead_id IN (SELECT lead_id FROM base)
        ),
        ep_agg AS (
          SELECT
            e.lead_id,
            COUNT(e.id)                                                                        AS ep_count,
            COUNT(CASE WHEN e.status NOT IN ('Consultation In Progress','Consultation Done','Treatment Planning') THEN 1 END) AS tx_count,
            COUNT(CASE WHEN e.surgery_date IS NOT NULL THEN 1 END)                            AS surg_count,
            SUM(CASE WHEN e.surgery_date IS NOT NULL THEN COALESCE(e.actual_bill, e.estimated_cost, 0) ELSE 0 END) AS revenue
          FROM episodes e
          WHERE e.tenant_id = ${tid}
            AND e.lead_id IN (SELECT lead_id FROM base)
          GROUP BY e.lead_id
        )
        SELECT
          b.utm_campaign,
          MAX(b.utm_source)                                                                  AS utm_source,
          MAX(b.utm_medium)                                                                  AS utm_medium,
          COUNT(DISTINCT b.lead_id)                                                          AS leads,
          COUNT(DISTINCT aa.lead_id)                                                         AS appointments,
          COUNT(DISTINCT CASE WHEN ea.ep_count > 0    THEN b.lead_id END)                   AS episodes,
          COUNT(DISTINCT CASE WHEN ea.tx_count > 0    THEN b.lead_id END)                   AS treatment_started,
          COUNT(DISTINCT CASE WHEN ea.surg_count > 0  THEN b.lead_id END)                   AS surgery_done,
          COALESCE(SUM(ea.revenue), 0)                                                       AS revenue
        FROM base b
        LEFT JOIN appt_agg aa ON aa.lead_id = b.lead_id
        LEFT JOIN ep_agg   ea ON ea.lead_id  = b.lead_id
        GROUP BY b.utm_campaign
        ORDER BY leads DESC
      `);

      const result = (rows.rows || rows as any[]).map((r: any) => ({
        utmCampaign: r.utm_campaign,
        utmSource: r.utm_source,
        utmMedium: r.utm_medium,
        leads: Number(r.leads),
        appointments: Number(r.appointments),
        episodes: Number(r.episodes),
        treatmentStarted: Number(r.treatment_started),
        surgeryDone: Number(r.surgery_done),
        revenue: Number(r.revenue),
      }));

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/episodes/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const ep = await storage.getEpisode(Number(req.params.id), tid);
      if (!ep) return res.status(404).json({ message: "Episode not found" });
      res.json(ep);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/episodes", isAuthenticated, async (req, res) => {
    try {
      if (!(await hasPermission(req, "episodes", "canCreate"))) {
        return res.status(403).json({ message: "You do not have permission to create episodes" });
      }
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

      let patientId = body.patientId || lead.patientId;

      if (!patientId && lead) {
        const nameParts = lead.name.trim().split(/\s+/);
        const firstName = nameParts[0] || "Patient";
        const lastName = nameParts.slice(1).join(" ") || "";

        const existingPatients = await pool.query(
          `SELECT id FROM patients WHERE tenant_id = $1 ORDER BY id DESC LIMIT 1`, [tid]
        );
        const nextNum = (existingPatients.rows[0]?.id || 0) + 1;
        const uhid = `PAT_${String(nextNum).padStart(4, "0")}`;

        const userId = String((req as any).session?.crmUserId || "system");
        const newPatient = await storage.createPatient({
          tenantId: tid,
          uhid,
          firstName,
          lastName: lastName || null,
          primaryPhone: lead.phoneE164,
          email: lead.email || null,
          status: "Active",
          createdBy: userId,
        } as any);
        patientId = newPatient.id;

        await storage.updateLead(lead.id, { patientId });
      }

      const existingCount = patientId
        ? await storage.getEpisodeCountForPatient(patientId, treatmentDeptName)
        : await storage.getEpisodeCountForLead(lead.id, treatmentDeptName);
      const episodeName = existingCount > 0
        ? `${patientName}_${treatmentDeptName}_${existingCount + 1}`
        : `${patientName}_${treatmentDeptName}`;

      let visitNumber = 1;
      if (body.visitType === "Follow Up" && body.parentEpisodeId) {
        const vnResult = await pool.query(
          `SELECT COUNT(*) + 2 AS next_num FROM episodes WHERE parent_episode_id = $1 AND tenant_id = $2`,
          [body.parentEpisodeId, tid]
        );
        visitNumber = Number(vnResult.rows[0]?.next_num) || 2;
      }

      const parsed = insertEpisodeSchema.parse({
        ...body,
        tenantId: tid,
        episodeName,
        visitType: body.visitType || "New",
        parentEpisodeId: body.parentEpisodeId || null,
        visitNumber,
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
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.patch("/api/episodes/:id", isAuthenticated, async (req, res) => {
    try {
      if (!(await hasPermission(req, "episodes", "canEdit"))) {
        return res.status(403).json({ message: "You do not have permission to edit episodes" });
      }
      const tid = await getDefaultTenantId(req);
      const episodeId = Number(req.params.id);
      const oldEpisode = await storage.getEpisode(episodeId, tid);
      const body = coerceDateFields(req.body, ["startDate", "endDate", "nextActionDate", "slaDeadline", "estimateSharedAt", "discountApprovedAt", "preauthSubmittedAt", "surgeryDate"]);
      const terminalStatuses = ["Completed", "Discontinued"];
      if (body.status && terminalStatuses.includes(body.status) && !body.endDate) {
        body.endDate = new Date();
      }

      if (body.status === "Discontinued" || body.status === "Lost") {
        if (!body.lostReasonId && !oldEpisode?.lostReasonId) {
          return res.status(400).json({ message: "A lost reason is required when discontinuing an episode" });
        }
        body.lostAtStage = oldEpisode?.status || null;
        body.lostValue = oldEpisode?.finalEstimatedAmount || oldEpisode?.estimatedCost || null;
      }

      if (body.estimateShared === true && !oldEpisode?.estimateShared) {
        body.estimateSharedAt = new Date();
      }

      if (body.discountApplied && body.discountType && body.discountValue != null) {
        const baseAmount = body.estimatedCost || oldEpisode?.estimatedCost || 0;
        if (body.discountType === "Percentage") {
          body.finalEstimatedAmount = Math.round(baseAmount * (1 - (body.discountValue / 100)));
        } else {
          body.finalEstimatedAmount = Math.max(0, baseAmount - body.discountValue);
        }
      } else if (body.estimatedCost && !body.discountApplied) {
        body.finalEstimatedAmount = body.estimatedCost;
      }

      if (body.initialQuote !== undefined || body.approvedDiscount !== undefined) {
        const iq = body.initialQuote ?? oldEpisode?.initialQuote ?? 0;
        const discountStatus = oldEpisode?.discountStatus || "Draft";
        const ad = discountStatus === "Approved" ? (body.approvedDiscount ?? oldEpisode?.approvedDiscount ?? 0) : 0;
        body.finalQuote = Math.max(0, iq - ad);
        body.initialQuote = iq;
        body.originalQuotedAmount = iq;
        body.finalEstimatedAmount = body.finalQuote;
      }

      if (body.actualBill !== undefined) {
        const fq = body.finalQuote ?? oldEpisode?.finalQuote ?? oldEpisode?.finalEstimatedAmount ?? 0;
        body.variance = fq - (body.actualBill || 0);
      }

      if (oldEpisode && body.status && body.status !== oldEpisode.status) {
        if (!body.stageRemarks || !body.stageRemarks.trim() || body.stageRemarks.trim().length < 5) {
          return res.status(400).json({ message: "Stage transition remarks are required (minimum 5 characters)" });
        }
      }

      if (body.status === "Surgery Scheduled" && body.surgeryAlertUserId) {
        const alertUserCheck = await pool.query(`SELECT id FROM crm_users WHERE id = $1 AND tenant_id = $2`, [body.surgeryAlertUserId, tid]);
        if (alertUserCheck.rows.length === 0) {
          return res.status(400).json({ message: "Invalid surgery alert user" });
        }
      }

      if (body.status === "Surgery Done" && oldEpisode?.status === "Pre-op Assessment") {
        const clearanceGiven = oldEpisode?.preopClearanceGiven;
        const managerOverride = body.preopClearanceOverrideBy;
        if (!clearanceGiven && !managerOverride) {
          return res.status(422).json({
            message: "Pre-op clearance has not been given. A manager override is required to proceed to Surgery Done.",
            code: "PREOP_CLEARANCE_REQUIRED",
            preopClearanceRequired: true,
          });
        }
        if (managerOverride) {
          body.preopClearanceOverrideBy = managerOverride;
          body.preopClearanceOverrideAt = new Date();
        }
      }

      if (body.status === "Pre-op Assessment" && oldEpisode?.status === "Surgery Scheduled") {
        body.preopEnteredAt = new Date();
        body.preopReadinessStatus = "Not Started";
        body.preopClearanceGiven = false;
      }

      const stageRemarksVal = body.stageRemarks;
      delete body.stageRemarks;

      const parsed = insertEpisodeSchema.partial().parse(body);
      const ep = await storage.updateEpisode(episodeId, tid, parsed);

      const userId = String((req as any).session?.crmUserId || "system");

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
          newValues: { status: body.status, stageRemarks: stageRemarksVal?.trim() || "" },
          changedFields: changedFields.join(","),
          performedBy: userName,
        });

        if (oldEpisode.leadId) {
          const tempEvent = body.status === "Discontinued" ? "No Show"
            : body.estimateShared ? "Estimate Shared"
            : body.status;
          if (["Estimate Shared", "Consultation Done"].includes(tempEvent)) {
            try {
              await computeAndUpdateTemperature(oldEpisode.leadId, tid, tempEvent, userId, episodeId, "Episode");
            } catch {}
          }

          if (["Estimate Shared", "Checked In", "Consultation Done"].includes(body.status)) {
            try {
              await processAutoHandover("Lead", oldEpisode.leadId, body.status, tid, userId, {
                branchId: oldEpisode.branchId,
                doctorId: oldEpisode.doctorId,
              });
            } catch {}
          }
        }
      }

      if (oldEpisode && body.status === "Pre-op Assessment" && body.status !== oldEpisode.status) {
        try {
          const leadRow = oldEpisode.leadId
            ? await pool.query(`SELECT name FROM leads WHERE id = $1 AND tenant_id = $2`, [oldEpisode.leadId, tid])
            : null;
          const episodeForPreop = {
            ...oldEpisode,
            status: "Pre-op Assessment",
            preopAssignedUserId: body.preopAssignedUserId || oldEpisode.preopAssignedUserId,
            leadName: leadRow?.rows[0]?.name,
          };
          const crmUserId = (req as any).session?.crmUserId || null;
          const userName = (req as any).user?.firstName
            ? `${(req as any).user.firstName} ${(req as any).user.lastName || ""}`.trim()
            : "system";
          await triggerPreopEntryAutomation(episodeId, tid, episodeForPreop, userName, crmUserId);
        } catch (preopErr: any) {
          console.error("[preop] Error triggering automation:", preopErr.message);
        }
      }

      if (oldEpisode && body.status === "Surgery Scheduled" && body.surgeryAlertUserId && oldEpisode.leadId) {
        try {
          const surgeryDateVal = body.surgeryDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const leadRow = await pool.query(`SELECT name FROM leads WHERE id = $1 AND tenant_id = $2`, [oldEpisode.leadId, tid]);
          const patientName = leadRow.rows[0]?.name || "Patient";
          const surgeryDateStr = new Date(surgeryDateVal).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
          await storage.createTask({
            tenantId: tid,
            leadId: oldEpisode.leadId,
            title: `Surgery Alert: ${patientName} scheduled on ${surgeryDateStr}`,
            description: `Surgery scheduled for ${patientName} (Episode: ${oldEpisode.episodeName}). ${stageRemarksVal ? `Remarks: ${stageRemarksVal}` : ""}`,
            priority: "High",
            dueDate: new Date(surgeryDateVal),
            assignedCrmUserId: body.surgeryAlertUserId,
            status: "Pending",
            createdBy: userId,
          } as any);
        } catch (taskErr) {
          console.error("[surgery-alert] Error creating task:", taskErr);
        }
      }

      if (body.insuranceApplicable && oldEpisode?.leadId) {
        try {
          await computeAndUpdateTemperature(oldEpisode.leadId, tid, "Insurance Approved", userId, episodeId, "Episode");
          await processAutoHandover("Lead", oldEpisode.leadId, "Insurance Applicable", tid, userId, {
            branchId: oldEpisode.branchId,
          });
        } catch {}
      }

      if (body.advanceReceivedAmount && body.advanceReceivedAmount > 0 && oldEpisode?.leadId) {
        try {
          await computeAndUpdateTemperature(oldEpisode.leadId, tid, "Advance Received", userId, episodeId, "Episode");
        } catch {}
      }

      try {
        await computeRevenueProbability(episodeId, tid);
      } catch {}

      if (oldEpisode && body.status && body.status !== oldEpisode.status) {
        const postCareTriggerStatuses = ["Post Care", "Completed"];
        if (postCareTriggerStatuses.includes(body.status)) {
          try {
            await triggerPostCareProtocol(episodeId, tid, body.status, userId);
          } catch (pcErr) {
            console.error("[post-care] Error triggering protocol:", pcErr);
          }
        }
        try {
          await checkAndTriggerReferralReward(tid, episodeId, body.status);
        } catch (rwErr) {
          console.error("[referral-reward] Error checking reward trigger:", rwErr);
        }
      }

      res.json(ep);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // PRE-OP ASSESSMENT
  // =============================================

  app.get("/api/episodes/:id/preop-assessment", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const episodeId = Number(req.params.id);
      const episode = await storage.getEpisode(episodeId, tid);
      if (!episode) return res.status(404).json({ message: "Episode not found" });
      const assessment = await getOrCreatePreopAssessment(episodeId, tid);
      res.json({
        assessment: assessment || null,
        episode: {
          preopAssignedUserId: episode.preopAssignedUserId,
          preopReadinessStatus: episode.preopReadinessStatus,
          preopClearanceGiven: episode.preopClearanceGiven,
          preopClearanceOverrideBy: episode.preopClearanceOverrideBy,
          preopClearanceOverrideAt: episode.preopClearanceOverrideAt,
          preopEnteredAt: episode.preopEnteredAt,
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.put("/api/episodes/:id/preop-assessment", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await hasPermission(req, "episodes", "canEdit"))) {
        return res.status(403).json({ message: "No permission" });
      }
      const tid = await getDefaultTenantId(req);
      const episodeId = Number(req.params.id);
      const episode = await storage.getEpisode(episodeId, tid);
      if (!episode) return res.status(404).json({ message: "Episode not found" });

      const {
        bloodWorkDone, imagingDone, anesthesiaConsultDone, consentFormSigned,
        npoConfirmed, allergiesReviewed, medicationsReviewed, vitalsStable,
        notes, overallReadiness, grantClearance, preopAssignedUserId,
      } = req.body;

      const crmUser = (req as any).session?.crmUserId;
      const userName = (req as any).user?.firstName
        ? `${(req as any).user.firstName} ${(req as any).user.lastName || ""}`.trim()
        : (req as any).user?.email || "system";

      const existing = await getOrCreatePreopAssessment(episodeId, tid);
      if (existing) {
        await pool.query(
          `UPDATE episode_preop_assessments SET
             blood_work_done=$1, imaging_done=$2, anesthesia_consult_done=$3, consent_form_signed=$4,
             npo_confirmed=$5, allergies_reviewed=$6, medications_reviewed=$7, vitals_stable=$8,
             notes=$9, overall_readiness=$10, submitted_by=$11, submitted_by_crm_user_id=$12, modified_at=NOW()
           WHERE episode_id=$13 AND tenant_id=$14`,
          [bloodWorkDone, imagingDone, anesthesiaConsultDone, consentFormSigned,
           npoConfirmed, allergiesReviewed, medicationsReviewed, vitalsStable,
           notes, overallReadiness, userName, crmUser, episodeId, tid]
        );
      } else {
        await pool.query(
          `INSERT INTO episode_preop_assessments
             (tenant_id, episode_id, blood_work_done, imaging_done, anesthesia_consult_done, consent_form_signed,
              npo_confirmed, allergies_reviewed, medications_reviewed, vitals_stable, notes, overall_readiness, submitted_by, submitted_by_crm_user_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [tid, episodeId, bloodWorkDone, imagingDone, anesthesiaConsultDone, consentFormSigned,
           npoConfirmed, allergiesReviewed, medicationsReviewed, vitalsStable,
           notes, overallReadiness, userName, crmUser]
        );
      }

      const episodeUpdates: Record<string, any> = { preopReadinessStatus: overallReadiness };
      if (preopAssignedUserId !== undefined) episodeUpdates.preopAssignedUserId = preopAssignedUserId || null;
      if (grantClearance === true) {
        episodeUpdates.preopClearanceGiven = true;
      }
      await storage.updateEpisode(episodeId, tid, episodeUpdates);

      res.json({ success: true, clearanceGranted: grantClearance === true });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/episodes/:id/preop-clearance-override", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const episodeId = Number(req.params.id);
      const episode = await storage.getEpisode(episodeId, tid);
      if (!episode) return res.status(404).json({ message: "Episode not found" });

      const crmUser = await pool.query(
        `SELECT cu.id, cu.name, sr.code as role_code FROM crm_users cu
         JOIN system_roles sr ON cu.system_role_id = sr.id
         WHERE cu.id = $1 AND cu.tenant_id = $2`,
        [(req as any).session?.crmUserId, tid]
      );
      const user = crmUser.rows[0];
      if (!user || !["MANAGER", "ADMIN", "SYS_ADMIN"].includes(user.role_code)) {
        return res.status(403).json({ message: "Only managers or admins can grant pre-op override clearance" });
      }

      const { overrideReason } = req.body;
      await storage.updateEpisode(episodeId, tid, {
        preopClearanceGiven: true,
        preopClearanceOverrideBy: user.name,
        preopClearanceOverrideAt: new Date(),
      });

      await pool.query(
        `INSERT INTO in_app_notifications (tenant_id, crm_user_id, type, title, body, entity_type, entity_id, link, is_read, created_at)
         SELECT $1, cu.id, 'preop_override', $3, $4, 'episode', $2, $5, FALSE, NOW()
         FROM crm_users cu WHERE cu.tenant_id = $1 AND cu.is_active = TRUE
           AND (cu.id = (SELECT preop_assigned_user_id FROM episodes WHERE id = $2)
                OR cu.id = (SELECT assigned_crm_user_id FROM episodes WHERE id = $2))
           AND cu.id IS NOT NULL`,
        [
          tid,
          episodeId,
          `Pre-op Override Granted — Episode #${episodeId}`,
          `${user.name} has granted a manager override for surgery clearance. Reason: ${overrideReason || "Not provided"}. Episode can now proceed to Surgery Done.`,
          `/episodes/${episodeId}`,
        ]
      );

      res.json({ success: true, overrideBy: user.name });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/dashboard/preop-cases", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const result = await pool.query(
        `SELECT e.id, e.episode_name, e.preop_entered_at, e.surgery_date, e.preop_clearance_given,
                e.preop_readiness_status, e.preop_clearance_override_by,
                COALESCE(l.name, CONCAT(p.first_name, ' ', p.last_name)) as patient_name,
                d.name as doctor_name,
                cu.name as assigned_user_name
         FROM episodes e
         LEFT JOIN leads l ON e.lead_id = l.id
         LEFT JOIN patients p ON e.patient_id = p.id
         LEFT JOIN doctors d ON e.doctor_id = d.id
         LEFT JOIN crm_users cu ON e.preop_assigned_user_id = cu.id
         WHERE e.tenant_id = $1
           AND e.status = 'Pre-op Assessment'
         ORDER BY e.surgery_date ASC NULLS LAST, e.preop_entered_at DESC
         LIMIT 50`,
        [tid]
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // SURGERY CALENDAR
  // =============================================

  app.get("/api/surgery-calendar", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const branchId = req.query.branchId ? Number(req.query.branchId) : null;
      const doctorId = req.query.doctorId ? Number(req.query.doctorId) : null;
      const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;

      let filters = "";
      const params: any[] = [tid];
      let paramIdx = 2;

      if (branchId) {
        filters += ` AND e.branch_id = $${paramIdx}`;
        params.push(branchId);
        paramIdx++;
      }
      if (doctorId) {
        filters += ` AND (e.surgery_doctor_id = $${paramIdx} OR e.doctor_id = $${paramIdx})`;
        params.push(doctorId);
        paramIdx++;
      }
      if (departmentId) {
        filters += ` AND e.treatment_department_id = $${paramIdx}`;
        params.push(departmentId);
        paramIdx++;
      }

      const surgeries = (await pool.query(
        `SELECT e.id, e.episode_name, e.surgery_date, e.status, e.surgery_doctor_id,
          e.doctor_id, e.treatment_department_id, e.branch_id, e.lead_id,
          l.name as patient_name, l.phone_e164 as patient_phone,
          d.name as doctor_name, sd.name as surgery_doctor_name,
          td.name as department_name, b.name as branch_name,
          au.name as alert_user_name
        FROM episodes e
        LEFT JOIN leads l ON e.lead_id = l.id
        LEFT JOIN doctors d ON e.doctor_id = d.id
        LEFT JOIN doctors sd ON e.surgery_doctor_id = sd.id
        LEFT JOIN treatment_departments td ON e.treatment_department_id = td.id
        LEFT JOIN branches b ON e.branch_id = b.id
        LEFT JOIN crm_users au ON e.surgery_alert_user_id = au.id
        WHERE e.tenant_id = $1
          AND e.status = 'Surgery Scheduled'
          AND e.surgery_date IS NOT NULL
          AND e.surgery_date >= CURRENT_DATE
          ${filters}
        ORDER BY e.surgery_date ASC`,
        params
      )).rows;

      res.json(surgeries);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // POST-CARE FOLLOW-UP PROTOCOLS
  // =============================================

  app.get("/api/post-care-protocols", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const rows = await db.select().from(postCareProtocols).where(eq(postCareProtocols.tenantId, tid)).orderBy(postCareProtocols.displayOrder);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/post-care-protocols/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const id = Number(req.params.id);
      const [protocol] = await db.select().from(postCareProtocols).where(and(eq(postCareProtocols.id, id), eq(postCareProtocols.tenantId, tid)));
      if (!protocol) return res.status(404).json({ message: "Protocol not found" });
      const steps = await db.select().from(postCareProtocolSteps).where(and(eq(postCareProtocolSteps.protocolId, id), eq(postCareProtocolSteps.tenantId, tid))).orderBy(postCareProtocolSteps.stepNumber);
      res.json({ ...protocol, steps });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/post-care-protocols", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const userId = String((req as any).session?.crmUserId || "system");
      const { steps, ...protocolData } = req.body;
      const parsed = insertPostCareProtocolSchema.parse({ ...protocolData, tenantId: tid, createdBy: userId, modifiedBy: userId });

      if (parsed.isDefault) {
        await db.update(postCareProtocols).set({ isDefault: false }).where(and(eq(postCareProtocols.tenantId, tid), eq(postCareProtocols.isDefault, true)));
      }

      const [protocol] = await db.insert(postCareProtocols).values(parsed).returning();

      if (steps && Array.isArray(steps)) {
        for (let i = 0; i < steps.length; i++) {
          const stepParsed = insertPostCareProtocolStepSchema.parse({
            ...steps[i],
            tenantId: tid,
            protocolId: protocol.id,
            stepNumber: i + 1,
          });
          await db.insert(postCareProtocolSteps).values(stepParsed);
        }
      }

      const savedSteps = await db.select().from(postCareProtocolSteps).where(eq(postCareProtocolSteps.protocolId, protocol.id)).orderBy(postCareProtocolSteps.stepNumber);
      res.json({ ...protocol, steps: savedSteps });
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.patch("/api/post-care-protocols/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const id = Number(req.params.id);
      const userId = String((req as any).session?.crmUserId || "system");
      const { steps, ...protocolData } = req.body;

      if (protocolData.isDefault) {
        await db.update(postCareProtocols).set({ isDefault: false }).where(and(eq(postCareProtocols.tenantId, tid), eq(postCareProtocols.isDefault, true)));
      }

      const updateData: any = { ...protocolData, modifiedBy: userId, modifiedAt: new Date() };
      delete updateData.id;
      delete updateData.tenantId;
      delete updateData.createdAt;
      delete updateData.createdBy;
      const [protocol] = await db.update(postCareProtocols).set(updateData).where(and(eq(postCareProtocols.id, id), eq(postCareProtocols.tenantId, tid))).returning();
      if (!protocol) return res.status(404).json({ message: "Protocol not found" });

      if (steps && Array.isArray(steps)) {
        await db.delete(postCareProtocolSteps).where(and(eq(postCareProtocolSteps.protocolId, id), eq(postCareProtocolSteps.tenantId, tid)));
        for (let i = 0; i < steps.length; i++) {
          const stepParsed = insertPostCareProtocolStepSchema.parse({
            ...steps[i],
            tenantId: tid,
            protocolId: id,
            stepNumber: i + 1,
          });
          await db.insert(postCareProtocolSteps).values(stepParsed);
        }
      }

      const savedSteps = await db.select().from(postCareProtocolSteps).where(eq(postCareProtocolSteps.protocolId, id)).orderBy(postCareProtocolSteps.stepNumber);
      res.json({ ...protocol, steps: savedSteps });
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.delete("/api/post-care-protocols/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const id = Number(req.params.id);
      await db.delete(postCareProtocolSteps).where(and(eq(postCareProtocolSteps.protocolId, id), eq(postCareProtocolSteps.tenantId, tid)));
      await db.delete(postCareProtocols).where(and(eq(postCareProtocols.id, id), eq(postCareProtocols.tenantId, tid)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/episodes/:id/post-care-timeline", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const episodeId = Number(req.params.id);
      const [episode] = await db.select().from(episodes).where(and(eq(episodes.id, episodeId), eq(episodes.tenantId, tid)));
      if (!episode) return res.status(404).json({ message: "Episode not found" });

      if (!episode.postCareProtocolId) {
        return res.json({ protocol: null, steps: [], tasks: [] });
      }

      const [protocol] = await db.select().from(postCareProtocols).where(and(eq(postCareProtocols.id, episode.postCareProtocolId), eq(postCareProtocols.tenantId, tid)));
      if (!protocol) return res.json({ protocol: null, steps: [], tasks: [] });
      const steps = await db.select().from(postCareProtocolSteps).where(and(eq(postCareProtocolSteps.protocolId, episode.postCareProtocolId), eq(postCareProtocolSteps.tenantId, tid))).orderBy(postCareProtocolSteps.stepNumber);

      const postCareTasks = await db.select().from(tasks).where(
        and(
          eq(tasks.tenantId, tid),
          eq(tasks.leadId, episode.leadId),
          sql`${tasks.notes} LIKE ${'%"postCareEpisodeId":' + episodeId + '%'}`
        )
      ).orderBy(tasks.dueDate);

      const enrichedSteps = steps.map(step => {
        const matchingTask = postCareTasks.find(t => {
          try {
            const meta = JSON.parse(t.notes || "{}");
            return meta.postCareStepNumber === step.stepNumber && meta.postCareEpisodeId === episodeId;
          } catch { return false; }
        });
        return {
          ...step,
          task: matchingTask || null,
          taskStatus: matchingTask?.status || "Upcoming",
          taskDueDate: matchingTask?.dueDate || null,
          taskCompletedAt: matchingTask?.completedAt || null,
        };
      });

      res.json({ protocol, steps: enrichedSteps });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // EVENT MANAGEMENT (Webinars / Seminars / Health Camps)
  // =============================================

  app.get("/api/events/stats", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const allEvents = await db.select().from(events).where(eq(events.tenantId, tid));
      const total = allEvents.length;
      const upcoming = allEvents.filter(e => e.status === "Published" && e.startDate && new Date(e.startDate) > new Date()).length;
      const ongoing = allEvents.filter(e => e.status === "Ongoing").length;
      const completed = allEvents.filter(e => e.status === "Completed").length;
      const totalRegistrations = allEvents.reduce((s, e) => s + (e.registeredCount || 0), 0);
      const totalAttended = allEvents.reduce((s, e) => s + (e.attendedCount || 0), 0);
      const totalConverted = allEvents.reduce((s, e) => s + (e.convertedCount || 0), 0);
      const totalBudget = allEvents.reduce((s, e) => s + (e.budget || 0), 0);

      const typeBreakdown: Record<string, number> = {};
      for (const e of allEvents) {
        typeBreakdown[e.type] = (typeBreakdown[e.type] || 0) + 1;
      }

      res.json({ total, upcoming, ongoing, completed, totalRegistrations, totalAttended, totalConverted, totalBudget, typeBreakdown });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/events", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const rows = await db.select().from(events).where(eq(events.tenantId, tid)).orderBy(sql`${events.startDate} DESC NULLS LAST`);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/events/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const id = Number(req.params.id);
      const [event] = await db.select().from(events).where(and(eq(events.id, id), eq(events.tenantId, tid)));
      if (!event) return res.status(404).json({ message: "Event not found" });
      res.json(event);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  const EVENT_MUTABLE_FIELDS = ["name", "type", "description", "venue", "location", "startDate", "endDate", "maxCapacity", "organizer", "budget", "campaignId", "contactPhone", "contactEmail", "notes", "status"];

  async function validateEventFKs(tid: number, body: any) {
    if (body.campaignId) {
      const [camp] = await db.select().from(campaigns).where(and(eq(campaigns.id, Number(body.campaignId)), eq(campaigns.tenantId, tid)));
      if (!camp) throw new Error("Campaign not found in your tenant");
    }
  }

  app.post("/api/events", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const userId = String((req as any).session?.crmUserId || "system");
      const body = coerceDateFields(req.body, ["startDate", "endDate"]);

      await validateEventFKs(tid, body);

      const existingEvents = await db.select({ id: events.id }).from(events).where(eq(events.tenantId, tid));
      const code = `EVT-${String(existingEvents.length + 1).padStart(4, "0")}`;

      const safeBody: any = {};
      for (const k of EVENT_MUTABLE_FIELDS) { if (body[k] !== undefined) safeBody[k] = body[k]; }

      const parsed = insertEventSchema.parse({ ...safeBody, tenantId: tid, code, createdBy: userId, modifiedBy: userId });
      const [event] = await db.insert(events).values(parsed).returning();
      res.json(event);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.patch("/api/events/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const id = Number(req.params.id);
      const userId = String((req as any).session?.crmUserId || "system");
      const body = coerceDateFields(req.body, ["startDate", "endDate"]);

      await validateEventFKs(tid, body);

      const updateData: any = { modifiedBy: userId, modifiedAt: new Date() };
      for (const k of EVENT_MUTABLE_FIELDS) { if (body[k] !== undefined) updateData[k] = body[k]; }

      const [event] = await db.update(events).set(updateData).where(and(eq(events.id, id), eq(events.tenantId, tid))).returning();
      if (!event) return res.status(404).json({ message: "Event not found" });
      res.json(event);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.delete("/api/events/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const id = Number(req.params.id);
      await db.delete(eventRegistrations).where(and(eq(eventRegistrations.eventId, id), eq(eventRegistrations.tenantId, tid)));
      const [event] = await db.delete(events).where(and(eq(events.id, id), eq(events.tenantId, tid))).returning();
      if (!event) return res.status(404).json({ message: "Event not found" });
      res.json({ message: "Event deleted" });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/events/:id/registrations", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const eventId = Number(req.params.id);
      const [event] = await db.select().from(events).where(and(eq(events.id, eventId), eq(events.tenantId, tid)));
      if (!event) return res.status(404).json({ message: "Event not found" });

      const rows = await db.select().from(eventRegistrations)
        .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.tenantId, tid)))
        .orderBy(sql`${eventRegistrations.createdAt} DESC`);

      const enriched = await Promise.all(rows.map(async (r) => {
        let resultingLeadName = null;
        let resultingLeadStatus = null;
        if (r.resultingLeadId) {
          const [lead] = await db.select().from(leads).where(and(eq(leads.id, r.resultingLeadId), eq(leads.tenantId, tid)));
          if (lead) { resultingLeadName = lead.name; resultingLeadStatus = lead.status; }
        }
        return { ...r, resultingLeadName, resultingLeadStatus };
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/events/:id/registrations", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const eventId = Number(req.params.id);
      const userId = String((req as any).session?.crmUserId || "system");

      const [event] = await db.select().from(events).where(and(eq(events.id, eventId), eq(events.tenantId, tid)));
      if (!event) return res.status(404).json({ message: "Event not found" });

      if (event.maxCapacity && (event.registeredCount || 0) >= event.maxCapacity) {
        return res.status(400).json({ message: "Event has reached maximum capacity" });
      }

      const body = coerceDateFields(req.body, ["registrationDate", "checkedInAt"]);
      const parsed = insertEventRegistrationSchema.parse({ ...body, tenantId: tid, eventId, createdBy: userId, modifiedBy: userId });
      const [reg] = await db.insert(eventRegistrations).values(parsed).returning();

      await db.update(events).set({
        registeredCount: sql`COALESCE(${events.registeredCount}, 0) + 1`,
        modifiedAt: new Date(),
      }).where(eq(events.id, eventId));

      res.json(reg);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.patch("/api/events/:id/registrations/:regId", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const eventId = Number(req.params.id);
      const regId = Number(req.params.regId);
      const userId = String((req as any).session?.crmUserId || "system");

      const [event] = await db.select().from(events).where(and(eq(events.id, eventId), eq(events.tenantId, tid)));
      if (!event) return res.status(404).json({ message: "Event not found" });

      const [existing] = await db.select().from(eventRegistrations).where(
        and(eq(eventRegistrations.id, regId), eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.tenantId, tid))
      );
      if (!existing) return res.status(404).json({ message: "Registration not found" });

      const body = coerceDateFields(req.body, ["registrationDate", "checkedInAt"]);
      const updateData: any = { ...body, modifiedBy: userId, modifiedAt: new Date() };
      delete updateData.id;
      delete updateData.tenantId;
      delete updateData.eventId;
      delete updateData.createdAt;
      delete updateData.createdBy;

      if (updateData.attendanceStatus === "Attended" && existing.attendanceStatus !== "Attended") {
        updateData.checkedInAt = new Date();
        await db.update(events).set({
          attendedCount: sql`COALESCE(${events.attendedCount}, 0) + 1`,
          modifiedAt: new Date(),
        }).where(eq(events.id, eventId));
      } else if (existing.attendanceStatus === "Attended" && updateData.attendanceStatus && updateData.attendanceStatus !== "Attended") {
        await db.update(events).set({
          attendedCount: sql`GREATEST(COALESCE(${events.attendedCount}, 0) - 1, 0)`,
          modifiedAt: new Date(),
        }).where(eq(events.id, eventId));
      }

      if (updateData.attendanceStatus === "Cancelled" && existing.attendanceStatus !== "Cancelled") {
        await db.update(events).set({
          registeredCount: sql`GREATEST(COALESCE(${events.registeredCount}, 0) - 1, 0)`,
          modifiedAt: new Date(),
        }).where(eq(events.id, eventId));
      } else if (existing.attendanceStatus === "Cancelled" && updateData.attendanceStatus && updateData.attendanceStatus !== "Cancelled") {
        await db.update(events).set({
          registeredCount: sql`COALESCE(${events.registeredCount}, 0) + 1`,
          modifiedAt: new Date(),
        }).where(eq(events.id, eventId));
      }

      const [reg] = await db.update(eventRegistrations).set(updateData).where(
        and(eq(eventRegistrations.id, regId), eq(eventRegistrations.tenantId, tid))
      ).returning();
      res.json(reg);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/events/:id/registrations/:regId/convert-to-lead", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const eventId = Number(req.params.id);
      const regId = Number(req.params.regId);
      const userId = String((req as any).session?.crmUserId || "system");

      const [event] = await db.select().from(events).where(and(eq(events.id, eventId), eq(events.tenantId, tid)));
      if (!event) return res.status(404).json({ message: "Event not found" });

      const [reg] = await db.select().from(eventRegistrations).where(
        and(eq(eventRegistrations.id, regId), eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.tenantId, tid))
      );
      if (!reg) return res.status(404).json({ message: "Registration not found" });

      if (reg.resultingLeadId) {
        return res.status(400).json({ message: "This registrant has already been converted to a lead" });
      }

      const phoneE164 = reg.phone.startsWith("+") ? reg.phone : `+91${reg.phone.replace(/^0/, "")}`;
      const normalized = phoneE164.replace(/\D/g, "").slice(-10);

      const existingLeads = await db.select().from(leads).where(
        and(eq(leads.tenantId, tid), eq(leads.mobileNormalized, normalized))
      );

      let leadId: number;
      if (existingLeads.length > 0) {
        leadId = existingLeads[0].id;
      } else {
        const [newLead] = await db.insert(leads).values({
          tenantId: tid,
          name: reg.name,
          phoneE164,
          mobileNormalized: normalized,
          email: reg.email,
          status: "Raw",
          source: `Event: ${event.name}`,
          campaignId: event.campaignId,
          createdBy: userId,
          modifiedBy: userId,
        }).returning();
        leadId = newLead.id;
      }

      await db.update(eventRegistrations).set({
        resultingLeadId: leadId,
        modifiedBy: userId,
        modifiedAt: new Date(),
      }).where(eq(eventRegistrations.id, regId));

      await db.update(events).set({
        convertedCount: sql`COALESCE(${events.convertedCount}, 0) + 1`,
        modifiedAt: new Date(),
      }).where(eq(events.id, eventId));

      res.json({ message: "Registrant converted to lead", leadId });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/events/:id/bulk-attendance", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const eventId = Number(req.params.id);
      const userId = String((req as any).session?.crmUserId || "system");
      const { registrationIds, status } = req.body;

      if (!Array.isArray(registrationIds) || !status) {
        return res.status(400).json({ message: "registrationIds array and status are required" });
      }

      const [event] = await db.select().from(events).where(and(eq(events.id, eventId), eq(events.tenantId, tid)));
      if (!event) return res.status(404).json({ message: "Event not found" });

      let attendedDelta = 0;
      for (const regId of registrationIds) {
        const [existing] = await db.select().from(eventRegistrations).where(
          and(eq(eventRegistrations.id, Number(regId)), eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.tenantId, tid))
        );
        if (!existing) continue;

        if (status === "Attended" && existing.attendanceStatus !== "Attended") attendedDelta++;
        else if (status !== "Attended" && existing.attendanceStatus === "Attended") attendedDelta--;

        await db.update(eventRegistrations).set({
          attendanceStatus: status,
          checkedInAt: status === "Attended" ? new Date() : existing.checkedInAt,
          modifiedBy: userId,
          modifiedAt: new Date(),
        }).where(eq(eventRegistrations.id, Number(regId)));
      }

      if (attendedDelta !== 0) {
        await db.update(events).set({
          attendedCount: sql`GREATEST(COALESCE(${events.attendedCount}, 0) + ${attendedDelta}, 0)`,
          modifiedAt: new Date(),
        }).where(eq(events.id, eventId));
      }

      res.json({ message: `${registrationIds.length} registrations updated`, attendedDelta });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // RESOURCE LINKS (Campaign & Event Creatives)
  // =============================================

  const CAMPAIGN_LINK_TYPES = ["Poster", "Reel", "Video", "Ad Creative", "Landing Page", "Other"];
  const EVENT_LINK_TYPES = ["Registration Form", "Landing Page", "Poster", "Invitation", "Brochure", "Video", "Other"];

  function validateResourceUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  }

  async function verifyEntityOwnership(entityType: string, entityId: number, tid: number): Promise<boolean> {
    if (entityType === "campaign") {
      const [c] = await db.select({ id: campaigns.id }).from(campaigns).where(and(eq(campaigns.id, entityId), eq(campaigns.tenantId, tid)));
      return !!c;
    } else if (entityType === "event") {
      const [e] = await db.select({ id: events.id }).from(events).where(and(eq(events.id, entityId), eq(events.tenantId, tid)));
      return !!e;
    }
    return false;
  }

  app.get("/api/campaigns/:id/links", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const entityId = Number(req.params.id);
      if (!Number.isFinite(entityId) || entityId <= 0) return res.status(400).json({ message: "Invalid campaign id" });
      if (!(await verifyEntityOwnership("campaign", entityId, tid))) return res.status(404).json({ message: "Campaign not found" });
      const links = await db.select().from(resourceLinks).where(
        and(eq(resourceLinks.tenantId, tid), eq(resourceLinks.entityType, "campaign"), eq(resourceLinks.entityId, entityId))
      ).orderBy(resourceLinks.displayOrder, resourceLinks.createdAt);
      res.json(links);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/campaigns/:id/links", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const entityId = Number(req.params.id);
      if (!Number.isFinite(entityId) || entityId <= 0) return res.status(400).json({ message: "Invalid campaign id" });
      if (!(await verifyEntityOwnership("campaign", entityId, tid))) return res.status(404).json({ message: "Campaign not found" });
      const userId = String((req as any).session?.crmUserId || "system");
      const linksPayload = Array.isArray(req.body) ? req.body : [req.body];
      await db.delete(resourceLinks).where(
        and(eq(resourceLinks.tenantId, tid), eq(resourceLinks.entityType, "campaign"), eq(resourceLinks.entityId, entityId))
      );
      const created = [];
      for (let i = 0; i < linksPayload.length; i++) {
        const { linkType, label, url } = linksPayload[i];
        if (!CAMPAIGN_LINK_TYPES.includes(linkType)) return res.status(400).json({ message: `Invalid campaign linkType: ${linkType}. Must be one of: ${CAMPAIGN_LINK_TYPES.join(", ")}` });
        if (!url || !validateResourceUrl(url)) return res.status(400).json({ message: "URL must be a valid http or https URL" });
        const [link] = await db.insert(resourceLinks).values({
          tenantId: tid, entityType: "campaign", entityId, linkType, label: label || null, url, displayOrder: i, createdBy: userId,
        }).returning();
        created.push(link);
      }
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.delete("/api/campaigns/:id/links", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const entityId = Number(req.params.id);
      if (!Number.isFinite(entityId) || entityId <= 0) return res.status(400).json({ message: "Invalid campaign id" });
      await db.delete(resourceLinks).where(
        and(eq(resourceLinks.tenantId, tid), eq(resourceLinks.entityType, "campaign"), eq(resourceLinks.entityId, entityId))
      );
      res.json({ message: "All campaign links deleted" });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/events/:id/links", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const entityId = Number(req.params.id);
      if (!Number.isFinite(entityId) || entityId <= 0) return res.status(400).json({ message: "Invalid event id" });
      if (!(await verifyEntityOwnership("event", entityId, tid))) return res.status(404).json({ message: "Event not found" });
      const links = await db.select().from(resourceLinks).where(
        and(eq(resourceLinks.tenantId, tid), eq(resourceLinks.entityType, "event"), eq(resourceLinks.entityId, entityId))
      ).orderBy(resourceLinks.displayOrder, resourceLinks.createdAt);
      res.json(links);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/events/:id/links", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const entityId = Number(req.params.id);
      if (!Number.isFinite(entityId) || entityId <= 0) return res.status(400).json({ message: "Invalid event id" });
      if (!(await verifyEntityOwnership("event", entityId, tid))) return res.status(404).json({ message: "Event not found" });
      const userId = String((req as any).session?.crmUserId || "system");
      const linksPayload = Array.isArray(req.body) ? req.body : [req.body];
      await db.delete(resourceLinks).where(
        and(eq(resourceLinks.tenantId, tid), eq(resourceLinks.entityType, "event"), eq(resourceLinks.entityId, entityId))
      );
      const created = [];
      for (let i = 0; i < linksPayload.length; i++) {
        const { linkType, label, url } = linksPayload[i];
        if (!EVENT_LINK_TYPES.includes(linkType)) return res.status(400).json({ message: `Invalid event linkType: ${linkType}. Must be one of: ${EVENT_LINK_TYPES.join(", ")}` });
        if (!url || !validateResourceUrl(url)) return res.status(400).json({ message: "URL must be a valid http or https URL" });
        const [link] = await db.insert(resourceLinks).values({
          tenantId: tid, entityType: "event", entityId, linkType, label: label || null, url, displayOrder: i, createdBy: userId,
        }).returning();
        created.push(link);
      }
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.delete("/api/events/:id/links", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const entityId = Number(req.params.id);
      if (!Number.isFinite(entityId) || entityId <= 0) return res.status(400).json({ message: "Invalid event id" });
      await db.delete(resourceLinks).where(
        and(eq(resourceLinks.tenantId, tid), eq(resourceLinks.entityType, "event"), eq(resourceLinks.entityId, entityId))
      );
      res.json({ message: "All event links deleted" });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // REFERRAL MANAGEMENT
  // =============================================

  app.get("/api/referrals/treated-patients", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const treatedStatuses = ["Surgery Done", "In Treatment", "Post Care", "Follow Up", "Completed"];
      const treatedEpisodes = await db.select({
        episodeId: episodes.id,
        leadId: episodes.leadId,
        patientId: episodes.patientId,
        status: episodes.status,
      }).from(episodes).where(
        and(eq(episodes.tenantId, tid), inArray(episodes.status, treatedStatuses))
      );

      const patientIds = [...new Set(treatedEpisodes.map(e => e.patientId).filter(Boolean))] as number[];
      const leadIds = [...new Set(treatedEpisodes.map(e => e.leadId).filter(Boolean))] as number[];

      const result: Array<{ id: string; name: string; phone: string; type: string; episodeStatus: string; patientId?: number; leadId?: number }> = [];
      const seen = new Set<string>();

      if (patientIds.length > 0) {
        const patientRows = await db.select().from(patients).where(and(eq(patients.tenantId, tid), inArray(patients.id, patientIds)));
        for (const p of patientRows) {
          if (!p.name) continue;
          const ep = treatedEpisodes.find(e => e.patientId === p.id);
          const key = `patient-${p.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            result.push({ id: key, name: p.name, phone: p.phone || "", type: "Patient", episodeStatus: ep?.status || "", patientId: p.id });
          }
        }
      }

      if (leadIds.length > 0) {
        const leadRows = await db.select().from(leads).where(and(eq(leads.tenantId, tid), inArray(leads.id, leadIds)));
        for (const l of leadRows) {
          if (!l.name) continue;
          const ep = treatedEpisodes.find(e => e.leadId === l.id);
          const key = `lead-${l.id}`;
          if (!seen.has(key) && !result.find(r => r.phone && r.phone === l.phone)) {
            seen.add(key);
            result.push({ id: key, name: l.name, phone: l.phone || "", type: "Lead", episodeStatus: ep?.status || "", leadId: l.id });
          }
        }
      }

      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/referrals", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const rows = await db.select().from(referrals).where(eq(referrals.tenantId, tid)).orderBy(sql`${referrals.createdAt} DESC`);

      const enriched = await Promise.all(rows.map(async (r) => {
        let referrerName = null;
        let referrerType = null;
        if (r.referrerId) {
          const [ref] = await db.select().from(referrers).where(and(eq(referrers.id, r.referrerId), eq(referrers.tenantId, tid)));
          if (ref) { referrerName = ref.name; referrerType = ref.type; }
        }
        let referrerPatientName = null;
        if (r.referrerPatientId) {
          const [pat] = await db.select().from(patients).where(and(eq(patients.id, r.referrerPatientId), eq(patients.tenantId, tid)));
          if (pat) referrerPatientName = pat.name;
        }
        if (!referrerName && !referrerPatientName && r.referrerExternalName) {
          referrerName = r.referrerExternalName;
          referrerType = "External";
        }
        let resultingLeadName = null;
        let resultingLeadStatus = null;
        if (r.resultingLeadId) {
          const [lead] = await db.select().from(leads).where(and(eq(leads.id, r.resultingLeadId), eq(leads.tenantId, tid)));
          if (lead) { resultingLeadName = lead.name; resultingLeadStatus = lead.status; }
        }
        return { ...r, referrerName, referrerType, referrerPatientName, resultingLeadName, resultingLeadStatus };
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/referrals/stats", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const allReferrals = await db.select().from(referrals).where(eq(referrals.tenantId, tid));
      const total = allReferrals.length;
      const converted = allReferrals.filter(r => r.outcome === "Converted" || r.outcome === "Appointment Booked" || r.outcome === "Consulted" || r.outcome === "Won").length;
      const pending = allReferrals.filter(r => r.outcome === "Pending").length;

      const topReferrersMap: Record<string, { name: string; count: number; converted: number }> = {};
      for (const r of allReferrals) {
        let name = "Unknown";
        if (r.referrerId) {
          const [ref] = await db.select().from(referrers).where(and(eq(referrers.id, r.referrerId), eq(referrers.tenantId, tid)));
          if (ref) name = ref.name;
        } else if (r.referrerPatientId) {
          const [pat] = await db.select().from(patients).where(and(eq(patients.id, r.referrerPatientId), eq(patients.tenantId, tid)));
          if (pat) name = pat.name;
        }
        if (!topReferrersMap[name]) topReferrersMap[name] = { name, count: 0, converted: 0 };
        topReferrersMap[name].count++;
        if (["Converted", "Appointment Booked", "Consulted", "Won"].includes(r.outcome)) {
          topReferrersMap[name].converted++;
        }
      }
      const topReferrers = Object.values(topReferrersMap).sort((a, b) => b.count - a.count).slice(0, 10);

      const channelBreakdown: Record<string, number> = {};
      for (const r of allReferrals) {
        channelBreakdown[r.referralChannel] = (channelBreakdown[r.referralChannel] || 0) + 1;
      }

      res.json({
        total,
        converted,
        pending,
        conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
        topReferrers,
        channelBreakdown,
      });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  async function validateReferralFKs(tid: number, body: any) {
    if (body.referrerId) {
      const [ref] = await db.select().from(referrers).where(and(eq(referrers.id, Number(body.referrerId)), eq(referrers.tenantId, tid)));
      if (!ref) throw new Error("Referrer not found in your tenant");
    }
    if (body.referrerPatientId) {
      const [pat] = await db.select().from(patients).where(and(eq(patients.id, Number(body.referrerPatientId)), eq(patients.tenantId, tid)));
      if (!pat) throw new Error("Referrer patient not found in your tenant");
    }
    if (body.referrerLeadId) {
      const [lead] = await db.select().from(leads).where(and(eq(leads.id, Number(body.referrerLeadId)), eq(leads.tenantId, tid)));
      if (!lead) throw new Error("Referrer lead not found in your tenant");
    }
    if (body.resultingLeadId) {
      const [lead] = await db.select().from(leads).where(and(eq(leads.id, Number(body.resultingLeadId)), eq(leads.tenantId, tid)));
      if (!lead) throw new Error("Resulting lead not found in your tenant");
    }
  }

  app.post("/api/referrals", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const userId = String((req as any).session?.crmUserId || "system");
      const body = coerceDateFields(req.body, ["referralDate", "outcomeDate"]);
      await validateReferralFKs(tid, body);
      const parsed = insertReferralSchema.parse({ ...body, tenantId: tid, createdBy: userId, modifiedBy: userId });
      const [referral] = await db.insert(referrals).values(parsed).returning();

      let autoLeadId: number | null = null;
      try {
        autoLeadId = await autoCreateLeadFromReferral(tid, referral, userId);
      } catch (err: any) {
        console.error("[referral] Auto-lead creation failed (non-blocking):", err.message);
      }

      const [updated] = await db.select().from(referrals).where(eq(referrals.id, referral.id));
      res.json({ ...updated, autoCreatedLeadId: autoLeadId });
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.patch("/api/referrals/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const id = Number(req.params.id);
      const userId = String((req as any).session?.crmUserId || "system");
      const body = coerceDateFields(req.body, ["referralDate", "outcomeDate"]);
      await validateReferralFKs(tid, body);
      const updateData: any = { ...body, modifiedBy: userId, modifiedAt: new Date() };
      delete updateData.id;
      delete updateData.tenantId;
      delete updateData.createdAt;
      delete updateData.createdBy;
      const [referral] = await db.update(referrals).set(updateData).where(and(eq(referrals.id, id), eq(referrals.tenantId, tid))).returning();
      if (!referral) return res.status(404).json({ message: "Referral not found" });
      res.json(referral);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.delete("/api/referrals/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const id = Number(req.params.id);
      const [referral] = await db.delete(referrals).where(and(eq(referrals.id, id), eq(referrals.tenantId, tid))).returning();
      if (!referral) return res.status(404).json({ message: "Referral not found" });
      res.json({ message: "Referral deleted" });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/episodes/:id/referral-ready", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const id = Number(req.params.id);
      const [episode] = await db.update(episodes).set({
        referralReady: true,
        referralReadyAt: new Date(),
        modifiedAt: new Date(),
      }).where(and(eq(episodes.id, id), eq(episodes.tenantId, tid))).returning();
      if (!episode) return res.status(404).json({ message: "Episode not found" });
      res.json(episode);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // REFERRAL CONFIGURATION MODULE
  // =============================================

  async function getReferralConfig(tid: number) {
    const [config] = await db.select().from(referralConfig).where(eq(referralConfig.tenantId, tid));
    return config;
  }

  async function autoCreateLeadFromReferral(tid: number, referral: any, userId: string) {
    const config = await getReferralConfig(tid);
    if (!config || !config.autoCreateLead) return null;

    const phoneNorm = normalizePhoneNumber(referral.referredPhone);
    if (!phoneNorm) return null;

    const closedStatuses = ["Closed Won", "Closed Lost", "Closed - Converted", "Closed - Junk", "Closed - Dormant"];
    const dupResult = await pool.query(
      `SELECT id, name, status FROM leads
       WHERE tenant_id = $1 AND mobile_normalized = $2
       AND (merge_status IS NULL OR merge_status = 'ACTIVE')
       AND status NOT IN (${closedStatuses.map((_, i) => `$${i + 3}`).join(",")})
       AND status NOT LIKE '%Closed%' LIMIT 1`,
      [tid, phoneNorm, ...closedStatuses]
    );
    if (dupResult.rows.length > 0) {
      const existingLead = dupResult.rows[0];
      await db.update(referrals).set({ resultingLeadId: existingLead.id, modifiedAt: new Date() })
        .where(eq(referrals.id, referral.id));
      return existingLead.id;
    }

    let [referralSource] = await db.select().from(leadSources)
      .where(and(eq(leadSources.tenantId, tid), eq(leadSources.code, "REFERRAL")));
    if (!referralSource) {
      [referralSource] = await db.select().from(leadSources)
        .where(and(eq(leadSources.tenantId, tid), eq(leadSources.name, "Referral")));
    }

    let assignedUserId: number | null = null;
    const userIds = (config.assignToUserIds as number[]) || [];
    if (config.assignmentStrategy === "specific_user" && userIds.length > 0) {
      assignedUserId = userIds[0];
    } else if (config.assignmentStrategy === "round_robin" && userIds.length > 0) {
      const lastLeadResult = await pool.query(
        `SELECT assigned_crm_user_id FROM leads WHERE tenant_id = $1
         AND assigned_crm_user_id = ANY($2::int[])
         ORDER BY created_at DESC LIMIT 1`,
        [tid, userIds]
      );
      if (lastLeadResult.rows.length > 0) {
        const lastIdx = userIds.indexOf(lastLeadResult.rows[0].assigned_crm_user_id);
        assignedUserId = userIds[(lastIdx + 1) % userIds.length];
      } else {
        assignedUserId = userIds[0];
      }
    } else if (config.assignmentStrategy === "least_loaded" && userIds.length > 0) {
      const loadResult = await pool.query(
        `SELECT u.id, COUNT(l.id) as lead_count
         FROM crm_users u LEFT JOIN leads l ON l.assigned_crm_user_id = u.id AND l.tenant_id = $1
           AND l.status NOT IN ('Closed Won','Closed Lost','Closed - Converted','Closed - Junk','Closed - Dormant')
         WHERE u.id = ANY($2::int[]) GROUP BY u.id ORDER BY lead_count ASC LIMIT 1`,
        [tid, userIds]
      );
      assignedUserId = loadResult.rows.length > 0 ? loadResult.rows[0].id : userIds[0];
    }

    const leadInput: any = {
      tenantId: tid,
      name: referral.referredName,
      phoneE164: referral.referredPhone,
      mobileNormalized: phoneNorm,
      email: referral.referredEmail || null,
      status: config.defaultLeadStatus || "Raw Lead Captured",
      referrerId: referral.referrerId || null,
      referralId: referral.id,
      referralSourceFlag: true,
      leadSourceId: referralSource?.id || null,
      assignedCrmUserId: assignedUserId || Number(userId) || null,
      primaryOwnerUserId: assignedUserId || Number(userId) || null,
      ownerTeam: "Telecalling",
      branchId: config.assignToBranchId || null,
      lastActivityAt: new Date(),
      createdBy: userId,
    };

    try {
      const lead = await storage.createLead(leadInput);
      await db.update(referrals).set({ resultingLeadId: lead.id, modifiedAt: new Date() })
        .where(eq(referrals.id, referral.id));
      return lead.id;
    } catch (err: any) {
      console.error("[referral-auto-lead] Error creating lead:", err.message);
      return null;
    }
  }

  async function checkAndTriggerReferralReward(tid: number, episodeId: number, newStatus: string) {
    try {
      const [episode] = await db.select().from(episodes).where(and(eq(episodes.id, episodeId), eq(episodes.tenantId, tid)));
      if (!episode || !episode.leadId) return;

      const [lead] = await db.select().from(leads).where(and(eq(leads.id, episode.leadId), eq(leads.tenantId, tid)));
      if (!lead || !lead.referralSourceFlag || !lead.referralId) return;

      const rules = await db.select().from(referralRewardRules)
        .where(and(eq(referralRewardRules.tenantId, tid), eq(referralRewardRules.isActive, true), eq(referralRewardRules.triggerStage, newStatus)));
      if (rules.length === 0) return;

      const [referral] = await db.select().from(referrals).where(and(eq(referrals.id, lead.referralId), eq(referrals.tenantId, tid)));

      for (const rule of rules) {
        if (rule.referrerTypeFilter && referral?.referrerId) {
          const [ref] = await db.select().from(referrers).where(and(eq(referrers.id, referral.referrerId), eq(referrers.tenantId, tid)));
          if (ref && rule.referrerTypeFilter !== "All" && ref.type !== rule.referrerTypeFilter) continue;
        }

        const [existingLog] = await db.select().from(referralRewardLogs)
          .where(and(
            eq(referralRewardLogs.tenantId, tid),
            eq(referralRewardLogs.rewardRuleId, rule.id),
            eq(referralRewardLogs.referralId, lead.referralId),
          ));
        if (existingLog) continue;

        await db.insert(referralRewardLogs).values({
          tenantId: tid,
          rewardRuleId: rule.id,
          referralId: lead.referralId,
          referrerId: referral?.referrerId || null,
          leadId: lead.id,
          episodeId,
          triggerStage: newStatus,
          rewardType: rule.rewardType,
          rewardLabel: rule.rewardLabel,
          rewardValue: rule.rewardValue,
          status: "Pending",
        });
        console.log(`[referral-reward] Triggered reward rule "${rule.name}" for referral #${lead.referralId}, episode #${episodeId}`);
      }
    } catch (err: any) {
      console.error("[referral-reward] Error:", err.message);
    }
  }

  async function requireAdminOrManagerRole(req: any): Promise<void> {
    const sessionUser = await getSessionCrmUserWithRole(req);
    if (!sessionUser) throw new Error("Unauthorized: no active session");
    const allowed = ["SYS_ADMIN", "ADMIN", "MANAGER"];
    if (!allowed.includes(sessionUser.roleCode)) {
      throw new Error("Forbidden: Admin or Manager role required");
    }
  }

  app.get("/api/referral-config", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      let config = await getReferralConfig(tid);
      if (!config) {
        [config] = await db.insert(referralConfig).values({
          tenantId: tid,
          autoCreateLead: true,
          defaultLeadStatus: "Raw Lead Captured",
          assignmentStrategy: "round_robin",
          assignToUserIds: [],
          trackReferralLeads: true,
          trackedFunnelStages: ["Consultation Done", "Surgery Done", "Completed"],
        }).returning();
      }
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.put("/api/referral-config", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      await requireAdminOrManagerRole(req);
      const userId = String((req as any).session?.crmUserId || "system");
      const existing = await getReferralConfig(tid);
      const body = req.body;

      if (body.assignToUserIds && Array.isArray(body.assignToUserIds) && body.assignToUserIds.length > 0) {
        const tenantUsers = await storage.getCrmUsers(tid);
        const tenantUserIds = tenantUsers.map(u => u.id);
        for (const uid of body.assignToUserIds) {
          if (!tenantUserIds.includes(uid)) throw new Error(`User ID ${uid} does not belong to your tenant`);
        }
      }
      if (body.assignToBranchId) {
        const branches = await storage.getMasterRecords("branches", tid);
        if (!branches.find((b: any) => b.id === body.assignToBranchId)) {
          throw new Error("Branch does not belong to your tenant");
        }
      }

      const merged: any = {
        autoCreateLead: body.autoCreateLead ?? existing?.autoCreateLead ?? true,
        defaultLeadStatus: body.defaultLeadStatus ?? existing?.defaultLeadStatus ?? "Raw Lead Captured",
        assignmentStrategy: body.assignmentStrategy ?? existing?.assignmentStrategy ?? "round_robin",
        assignToUserIds: body.assignToUserIds ?? existing?.assignToUserIds ?? [],
        assignToBranchId: body.assignToBranchId !== undefined ? body.assignToBranchId : (existing?.assignToBranchId ?? null),
        trackReferralLeads: body.trackReferralLeads ?? existing?.trackReferralLeads ?? true,
        trackedFunnelStages: body.trackedFunnelStages ?? existing?.trackedFunnelStages ?? [],
        modifiedAt: new Date(),
        modifiedBy: userId,
      };
      if (existing) {
        const [updated] = await db.update(referralConfig).set(merged)
          .where(eq(referralConfig.id, existing.id)).returning();
        res.json(updated);
      } else {
        const [created] = await db.insert(referralConfig).values({ ...merged, tenantId: tid }).returning();
        res.json(created);
      }
    } catch (err: any) {
      const status = err.message?.includes("Forbidden") ? 403 : 400;
      res.status(status).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/referral-reward-rules", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const rules = await db.select().from(referralRewardRules).where(eq(referralRewardRules.tenantId, tid))
        .orderBy(sql`${referralRewardRules.createdAt} DESC`);
      res.json(rules);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/referral-reward-rules", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      await requireAdminOrManagerRole(req);
      const userId = String((req as any).session?.crmUserId || "system");
      const [rule] = await db.insert(referralRewardRules).values({
        tenantId: tid,
        name: req.body.name,
        triggerStage: req.body.triggerStage,
        referrerTypeFilter: req.body.referrerTypeFilter || null,
        rewardType: req.body.rewardType || "Recognition",
        rewardLabel: req.body.rewardLabel || null,
        rewardValue: req.body.rewardValue || null,
        notifyReferrer: req.body.notifyReferrer ?? false,
        isActive: req.body.isActive ?? true,
        modifiedBy: userId,
      }).returning();
      res.status(201).json(rule);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.patch("/api/referral-reward-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      await requireAdminOrManagerRole(req);
      const id = Number(req.params.id);
      const userId = String((req as any).session?.crmUserId || "system");
      const updateData: any = { ...req.body, modifiedAt: new Date(), modifiedBy: userId };
      delete updateData.id;
      delete updateData.tenantId;
      delete updateData.createdAt;
      const [rule] = await db.update(referralRewardRules).set(updateData)
        .where(and(eq(referralRewardRules.id, id), eq(referralRewardRules.tenantId, tid))).returning();
      if (!rule) return res.status(404).json({ message: "Rule not found" });
      res.json(rule);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.delete("/api/referral-reward-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      await requireAdminOrManagerRole(req);
      const id = Number(req.params.id);
      const [rule] = await db.delete(referralRewardRules)
        .where(and(eq(referralRewardRules.id, id), eq(referralRewardRules.tenantId, tid))).returning();
      if (!rule) return res.status(404).json({ message: "Rule not found" });
      res.json({ message: "Rule deleted" });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/referral-reward-logs", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const logs = await db.select().from(referralRewardLogs).where(eq(referralRewardLogs.tenantId, tid))
        .orderBy(sql`${referralRewardLogs.createdAt} DESC`);

      const enriched = await Promise.all(logs.map(async (log) => {
        let referrerName = null;
        if (log.referrerId) {
          const [ref] = await db.select().from(referrers).where(eq(referrers.id, log.referrerId));
          if (ref) referrerName = ref.name;
        }
        let leadName = null;
        if (log.leadId) {
          const [lead] = await db.select().from(leads).where(and(eq(leads.id, log.leadId), eq(leads.tenantId, tid)));
          if (lead) leadName = lead.name;
        }
        let ruleName = null;
        const [rule] = await db.select().from(referralRewardRules).where(eq(referralRewardRules.id, log.rewardRuleId));
        if (rule) ruleName = rule.name;
        return { ...log, referrerName, leadName, ruleName };
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.patch("/api/referral-reward-logs/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      await requireAdminOrManagerRole(req);
      const id = Number(req.params.id);
      const [log] = await db.update(referralRewardLogs).set({
        status: req.body.status,
        processedAt: req.body.status === "Processed" ? new Date() : null,
      }).where(and(eq(referralRewardLogs.id, id), eq(referralRewardLogs.tenantId, tid))).returning();
      if (!log) return res.status(404).json({ message: "Reward log not found" });
      res.json(log);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // EPISODE CLINICAL NOTES EDIT WITH AUDIT (T008)
  // =============================================

  const DEFAULT_CLINICAL_EDIT_ROLES = ["SYS_ADMIN", "ADMIN", "MANAGER"];
  const ROLE_DISPLAY_NAMES: Record<string, string> = {
    SYS_ADMIN: "Super Admin",
    ADMIN: "Medical Admin",
    MANAGER: "Doctor / Manager",
    PATIENT_COORDINATOR: "Patient Coordinator",
    COUNSELLOR: "Counsellor",
  };

  async function getClinicalNotesAllowedRoles(tenantId: number): Promise<string[]> {
    const configured = await db
      .select({ roleCode: clinicalNotesEditRoles.roleCode })
      .from(clinicalNotesEditRoles)
      .where(and(
        eq(clinicalNotesEditRoles.tenantId, tenantId),
        eq(clinicalNotesEditRoles.isActive, true)
      ));
    if (configured.length > 0) {
      return configured.map(r => r.roleCode);
    }
    return DEFAULT_CLINICAL_EDIT_ROLES;
  }

  app.get("/api/episodes/clinical-notes-edit-roles", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const allowedRoles = await getClinicalNotesAllowedRoles(tid);
      res.json({ allowedRoles });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/episodes/clinical-notes-edit-roles/config", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser || !["SYS_ADMIN", "ADMIN"].includes(crmUser.roleCode)) {
        return res.status(403).json({ message: "Only Admins can manage clinical notes edit roles" });
      }
      const rows = await db
        .select()
        .from(clinicalNotesEditRoles)
        .where(eq(clinicalNotesEditRoles.tenantId, tid));
      res.json({ roles: rows, defaults: DEFAULT_CLINICAL_EDIT_ROLES });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/episodes/clinical-notes-edit-roles/config", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser || !["SYS_ADMIN", "ADMIN"].includes(crmUser.roleCode)) {
        return res.status(403).json({ message: "Only Admins can manage clinical notes edit roles" });
      }
      const { roleCodes } = req.body;
      if (!Array.isArray(roleCodes) || roleCodes.length === 0) {
        return res.status(400).json({ message: "At least one role must be selected" });
      }
      await db.delete(clinicalNotesEditRoles).where(eq(clinicalNotesEditRoles.tenantId, tid));
      for (const rc of roleCodes) {
        await db.insert(clinicalNotesEditRoles).values({ tenantId: tid, roleCode: rc, isActive: true });
      }
      const userName = crmUser.employeeName || req.user?.email || "System";
      await storage.createAuditLog({
        tenantId: tid,
        entityType: "config",
        entityId: 0,
        action: "clinical_notes_edit_roles_updated",
        oldValues: null,
        newValues: { roleCodes },
        changedFields: "roleCodes",
        performedBy: userName,
        performedByCrmUserId: crmUser.id,
      });
      res.json({ allowedRoles: roleCodes });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.put("/api/episodes/:id/clinical-notes", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const episodeId = Number(req.params.id);
      const { diagnosis, treatmentPlan, notes, editReason } = req.body;

      if (!editReason || !editReason.trim()) {
        return res.status(400).json({ message: "Reason for edit is required" });
      }

      const crmUser = await getSessionCrmUserWithRole(req);
      const allowedRoles = await getClinicalNotesAllowedRoles(tid);
      if (!crmUser || !allowedRoles.includes(crmUser.roleCode)) {
        const roleNames = allowedRoles.map(r => ROLE_DISPLAY_NAMES[r] || r).join(" / ");
        return res.status(403).json({ message: `You don't have permission to edit clinical notes. Allowed: ${roleNames}.` });
      }

      const oldEpisode = await storage.getEpisode(episodeId, tid);
      if (!oldEpisode) return res.status(404).json({ message: "Episode not found" });

      const changedFields: string[] = [];
      const oldValues: Record<string, any> = {};
      const newValues: Record<string, any> = {};
      const updates: Record<string, any> = {};

      if (diagnosis !== undefined && diagnosis !== oldEpisode.diagnosis) {
        changedFields.push("diagnosis");
        oldValues.diagnosis = oldEpisode.diagnosis;
        newValues.diagnosis = diagnosis;
        updates.diagnosis = diagnosis;
      }
      if (treatmentPlan !== undefined && treatmentPlan !== oldEpisode.treatmentPlan) {
        changedFields.push("treatmentPlan");
        oldValues.treatmentPlan = oldEpisode.treatmentPlan;
        newValues.treatmentPlan = treatmentPlan;
        updates.treatmentPlan = treatmentPlan;
      }
      if (notes !== undefined && notes !== oldEpisode.notes) {
        changedFields.push("notes");
        oldValues.notes = oldEpisode.notes;
        newValues.notes = notes;
        updates.notes = notes;
      }

      if (changedFields.length === 0) {
        return res.json(oldEpisode);
      }

      const ep = await storage.updateEpisode(episodeId, tid, updates);

      const userName = crmUser?.employeeName || req.user?.firstName
        ? `${req.user?.firstName || ""} ${req.user?.lastName || ""}`.trim()
        : req.user?.email || "System";
      await storage.createAuditLog({
        tenantId: tid,
        entityType: "episode",
        entityId: episodeId,
        action: "clinical_edit",
        oldValues,
        newValues: { ...newValues, editReason: editReason.trim() },
        changedFields: changedFields.join(","),
        performedBy: userName,
        performedByCrmUserId: crmUser?.id,
      });

      res.json(ep);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // DISCOUNT APPROVAL WORKFLOW (T011)
  // =============================================

  app.post("/api/episodes/:id/discount", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const episodeId = Number(req.params.id);
      const { originalQuotedAmount, discountType, discountPercent, discountAmount, discountNotes } = req.body;

      if (!discountNotes || !discountNotes.trim()) {
        return res.status(400).json({ message: "Discount notes/reason are required" });
      }

      const oldEpisode = await storage.getEpisode(episodeId, tid);
      if (!oldEpisode) return res.status(404).json({ message: "Episode not found" });

      if (oldEpisode.discountStatus === "Approved") {
        return res.status(400).json({ message: "Cannot modify an approved discount. Revoke approval first." });
      }

      const baseAmount = originalQuotedAmount || oldEpisode.initialQuote || oldEpisode.originalQuotedAmount || oldEpisode.estimatedCost || 0;

      let calcPercent = 0;
      let calcAmount = 0;

      if (discountType === "Percentage") {
        calcPercent = Math.min(100, Math.max(0, discountPercent || 0));
        calcAmount = Math.round(baseAmount * calcPercent / 100);
      } else {
        calcAmount = Math.min(baseAmount, Math.max(0, discountAmount || 0));
        calcPercent = 0;
      }

      const updates: Record<string, any> = {
        discountApplied: true,
        discountType,
        discountPercent: calcPercent,
        discountAmount: calcAmount,
        discountValue: calcAmount,
        discountNotes: discountNotes.trim(),
        discountStatus: "Pending",
        initialQuote: baseAmount,
        originalQuotedAmount: baseAmount,
        finalQuote: baseAmount,
        finalEstimatedAmount: baseAmount,
        discountRequestedAt: new Date(),
        discountEscalatedAt: null,
      };

      await storage.updateEpisode(episodeId, tid, updates);
      await computeRevenueProbability(episodeId, tid);

      const crmUser = await getSessionCrmUserWithRole(req);
      const userName = crmUser?.employeeName || crmUser?.name || "System";
      await storage.createAuditLog({
        tenantId: tid,
        entityType: "episode",
        entityId: episodeId,
        action: "discount_submitted",
        oldValues: { discountStatus: oldEpisode.discountStatus, discountAmount: oldEpisode.discountAmount },
        newValues: { discountStatus: "Pending", discountAmount: calcAmount, discountPercent: calcPercent },
        changedFields: "discountStatus,discountAmount,discountPercent,finalEstimatedAmount",
        performedBy: userName,
        performedByCrmUserId: crmUser?.id,
      });

      const freshEp = await storage.getEpisode(episodeId, tid);

      // Notify all configured discount approvers (in-app + email)
      try {
        const approvers = await db.select({ crmUserId: tenantDiscountApprovers.crmUserId })
          .from(tenantDiscountApprovers)
          .where(eq(tenantDiscountApprovers.tenantId, tid));
        const approverIds = approvers.map(a => a.crmUserId);
        if (approverIds.length > 0) {
          const patientName = freshEp && (freshEp as any).patientName ? (freshEp as any).patientName : `Episode #${episodeId}`;
          await sendInAppNotification(
            tid, approverIds,
            "discount_request",
            "Discount Approval Required",
            `${userName} requested ${calcPercent}% discount (₹${calcAmount.toLocaleString("en-IN")}) for ${patientName}. Please review and approve or reject.`,
            { entityType: "episode", entityId: episodeId, link: `/episodes/${episodeId}?tab=financial` }
          );
          // Email + SMS approvers
          const approverDetails = await db.select({ email: crmUsers.email, name: crmUsers.name, phone: crmUsers.phone })
            .from(crmUsers)
            .where(inArray(crmUsers.id, approverIds));
          for (const approver of approverDetails) {
            if (approver.email) {
              sendDiscountApprovalEmail({
                to: approver.email,
                approverName: approver.name,
                requestedBy: userName,
                patientName,
                episodeId,
                discountPercent: calcPercent,
                discountAmount: calcAmount,
                discountNotes: discountNotes.trim(),
              }).catch((e: any) => console.error("Discount email error:", e.message));
            }
            if (approver.phone) {
              sendDiscountApprovalSMS({
                phone: approver.phone,
                approverName: approver.name || "Approver",
                requestedBy: userName,
                patientName,
                episodeId,
                discountPercent: calcPercent,
                discountAmount: calcAmount,
              }).catch((e: any) => console.error("Discount SMS error:", e.message));
            }
          }
        }
      } catch (notifErr: any) {
        console.error("Discount notification error:", notifErr.message);
      }

      res.json(freshEp);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/episodes/:id/discount/approve", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const episodeId = Number(req.params.id);

      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const hasApprovers = await storage.hasAnyDiscountApprovers(tid);
      if (hasApprovers) {
        const isApprover = await storage.isDiscountApprover(tid, crmUser.id);
        if (!isApprover) {
          return res.status(403).json({ message: "You are not designated as a discount approver for this hospital" });
        }
      } else {
        const allowedRoles = ["SYS_ADMIN", "ADMIN"];
        if (!allowedRoles.includes(crmUser.roleCode)) {
          return res.status(403).json({ message: "Only Admins and System Admins can approve discounts" });
        }
      }

      const oldEpisode = await storage.getEpisode(episodeId, tid);
      if (!oldEpisode) return res.status(404).json({ message: "Episode not found" });

      if (!oldEpisode.discountApplied) {
        return res.status(400).json({ message: "No discount has been submitted for approval" });
      }
      if (oldEpisode.discountStatus === "Approved") {
        return res.status(400).json({ message: "Discount is already approved" });
      }

      const { approvedAmount, approverRemark } = req.body;
      if (!approverRemark || !String(approverRemark).trim()) {
        return res.status(400).json({ message: "Approver remark is required" });
      }

      const requestedAmt = oldEpisode.discountAmount || 0;
      // Approved amount defaults to requested if not provided; must not exceed the requested amount
      const finalApprovedAmt = approvedAmount != null ? Math.max(0, Number(approvedAmount)) : requestedAmt;
      if (finalApprovedAmt > requestedAmt) {
        return res.status(400).json({ message: `Approved discount (₹${finalApprovedAmt.toLocaleString("en-IN")}) cannot exceed the requested discount (₹${requestedAmt.toLocaleString("en-IN")})` });
      }

      const userName = crmUser?.employeeName || crmUser?.name || req.user?.email || "System";
      const baseAmt = oldEpisode.initialQuote || oldEpisode.originalQuotedAmount || oldEpisode.estimatedCost || 0;
      const newFinalQuote = Math.max(0, baseAmt - finalApprovedAmt);
      const updateFields: Record<string, any> = {
        discountStatus: "Approved",
        discountApprovedBy: userName,
        discountApprovedAt: new Date(),
        discountApproverRemark: String(approverRemark).trim(),
        negotiationStatus: "Approved",
        approvedDiscount: finalApprovedAmt,
        finalQuote: newFinalQuote,
        finalEstimatedAmount: newFinalQuote,
      };
      if (oldEpisode.actualBill != null) {
        updateFields.variance = newFinalQuote - (oldEpisode.actualBill || 0);
      }
      await storage.updateEpisode(episodeId, tid, updateFields);
      await computeRevenueProbability(episodeId, tid);

      await storage.createAuditLog({
        tenantId: tid,
        entityType: "episode",
        entityId: episodeId,
        action: "discount_approved",
        oldValues: { discountStatus: oldEpisode.discountStatus, requestedAmount: requestedAmt },
        newValues: { discountStatus: "Approved", approvedBy: userName, requestedAmount: requestedAmt, approvedAmount: finalApprovedAmt, remark: String(approverRemark).trim() },
        changedFields: "discountStatus,discountApprovedBy,discountApprovedAt,discountApproverRemark,approvedDiscount",
        performedBy: userName,
        performedByCrmUserId: crmUser?.id,
      });

      const freshEp = await storage.getEpisode(episodeId, tid);
      res.json(freshEp);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/episodes/:id/discount/reject", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const episodeId = Number(req.params.id);

      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const hasApprovers = await storage.hasAnyDiscountApprovers(tid);
      if (hasApprovers) {
        const isApprover = await storage.isDiscountApprover(tid, crmUser.id);
        if (!isApprover) {
          return res.status(403).json({ message: "You are not designated as a discount approver for this hospital" });
        }
      } else {
        const allowedRoles = ["SYS_ADMIN", "ADMIN"];
        if (!allowedRoles.includes(crmUser.roleCode)) {
          return res.status(403).json({ message: "Only Admins and System Admins can reject discounts" });
        }
      }

      const { reason } = req.body;
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      const oldEpisode = await storage.getEpisode(episodeId, tid);
      if (!oldEpisode) return res.status(404).json({ message: "Episode not found" });

      if (oldEpisode.discountStatus !== "Pending") {
        return res.status(400).json({ message: "Only a Pending discount request can be rejected" });
      }

      const userName = crmUser?.employeeName || crmUser?.name || req.user?.email || "System";
      const baseAmt = oldEpisode.initialQuote || oldEpisode.originalQuotedAmount || oldEpisode.estimatedCost || 0;
      const rejectFields: Record<string, any> = {
        discountStatus: "Rejected",
        discountApprovedBy: userName,
        discountApprovedAt: new Date(),
        discountApproverRemark: String(reason).trim(),
        negotiationStatus: "In Discussion",
        approvedDiscount: 0,
        finalQuote: baseAmt,
        finalEstimatedAmount: baseAmt,
      };
      if (oldEpisode.actualBill != null) {
        rejectFields.variance = baseAmt - (oldEpisode.actualBill || 0);
      }
      await storage.updateEpisode(episodeId, tid, rejectFields);
      await computeRevenueProbability(episodeId, tid);

      await storage.createAuditLog({
        tenantId: tid,
        entityType: "episode",
        entityId: episodeId,
        action: "discount_rejected",
        oldValues: { discountStatus: oldEpisode.discountStatus, requestedAmount: oldEpisode.discountAmount },
        newValues: { discountStatus: "Rejected", rejectedBy: userName, reason: String(reason).trim() },
        changedFields: "discountStatus,discountApprovedBy,discountApprovedAt,discountApproverRemark",
        performedBy: userName,
        performedByCrmUserId: crmUser?.id,
      });

      const freshEp = await storage.getEpisode(episodeId, tid);
      res.json(freshEp);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/episodes/:id/discount/revoke", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const episodeId = Number(req.params.id);
      const { reason } = req.body;

      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const hasApprovers = await storage.hasAnyDiscountApprovers(tid);
      if (hasApprovers) {
        const isApprover = await storage.isDiscountApprover(tid, crmUser.id);
        if (!isApprover) {
          return res.status(403).json({ message: "You are not designated as a discount approver for this hospital" });
        }
      } else {
        const allowedRoles = ["SYS_ADMIN", "ADMIN"];
        if (!allowedRoles.includes(crmUser.roleCode)) {
          return res.status(403).json({ message: "Only Admins and System Admins can revoke discounts" });
        }
      }

      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: "Reason for revoking is required" });
      }

      const oldEpisode = await storage.getEpisode(episodeId, tid);
      if (!oldEpisode) return res.status(404).json({ message: "Episode not found" });

      const userName = crmUser?.employeeName || crmUser?.name || req.user?.email || "System";
      const baseAmt = oldEpisode.initialQuote || oldEpisode.originalQuotedAmount || oldEpisode.estimatedCost || 0;
      const revokeFields: Record<string, any> = {
        discountStatus: "Draft",
        discountApprovedBy: null,
        discountApprovedAt: null,
        negotiationStatus: "In Discussion",
        approvedDiscount: 0,
        finalQuote: baseAmt,
        finalEstimatedAmount: baseAmt,
      };
      if (oldEpisode.actualBill != null) {
        revokeFields.variance = baseAmt - (oldEpisode.actualBill || 0);
      }
      await storage.updateEpisode(episodeId, tid, revokeFields);
      await computeRevenueProbability(episodeId, tid);

      await storage.createAuditLog({
        tenantId: tid,
        entityType: "episode",
        entityId: episodeId,
        action: "discount_revoked",
        oldValues: { discountStatus: oldEpisode.discountStatus, approvedBy: oldEpisode.discountApprovedBy },
        newValues: { discountStatus: "Draft", revokeReason: reason.trim() },
        changedFields: "discountStatus,discountApprovedBy,discountApprovedAt",
        performedBy: userName,
        performedByCrmUserId: crmUser?.id,
      });

      const freshEp = await storage.getEpisode(episodeId, tid);
      res.json(freshEp);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // DISCOUNT APPROVERS CONFIG
  // =============================================

  app.get("/api/discount-approvers", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser || !["SYS_ADMIN", "ADMIN"].includes(crmUser.roleCode)) {
        return res.status(403).json({ message: "Only Admins can view discount approver configuration" });
      }
      const approvers = await storage.getDiscountApprovers(tid);
      res.json(approvers);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/discount-approvers", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser || !["SYS_ADMIN", "ADMIN"].includes(crmUser.roleCode)) {
        return res.status(403).json({ message: "Only Admins can manage discount approvers" });
      }
      const { crmUserId } = req.body;
      if (!crmUserId || isNaN(Number(crmUserId))) {
        return res.status(400).json({ message: "crmUserId is required" });
      }
      const row = await storage.addDiscountApprover(tid, Number(crmUserId), crmUser.name);
      res.json(row);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.delete("/api/discount-approvers/:crmUserId", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser || !["SYS_ADMIN", "ADMIN"].includes(crmUser.roleCode)) {
        return res.status(403).json({ message: "Only Admins can manage discount approvers" });
      }
      const crmUserId = Number(req.params.crmUserId);
      await storage.removeDiscountApprover(tid, crmUserId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/discount-approvers/me", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser) return res.json({ canApprove: false });

      const hasApprovers = await storage.hasAnyDiscountApprovers(tid);
      if (!hasApprovers) {
        const canApprove = ["SYS_ADMIN", "ADMIN"].includes(crmUser.roleCode);
        return res.json({ canApprove });
      }
      const isApprover = await storage.isDiscountApprover(tid, crmUser.id);
      res.json({ canApprove: isApprover });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // DISCOUNT APPROVAL SLA SETTINGS
  // =============================================

  app.get("/api/settings/discount-sla", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const row = await pool.query(
        `SELECT setting_value FROM tenant_settings WHERE tenant_id = $1 AND setting_key = 'discountApprovalSlaHours' LIMIT 1`,
        [tid]
      );
      const slaHours = row.rows[0] ? parseInt(row.rows[0].setting_value, 10) : 4;
      res.json({ discountApprovalSlaHours: isNaN(slaHours) ? 4 : slaHours });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.put("/api/settings/discount-sla", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser || !["SYS_ADMIN", "ADMIN"].includes(crmUser.roleCode)) {
        return res.status(403).json({ message: "Only Admins can change SLA settings" });
      }
      const hours = Number(req.body.discountApprovalSlaHours);
      if (!hours || hours < 1 || hours > 720) {
        return res.status(400).json({ message: "SLA hours must be between 1 and 720" });
      }
      const existing = await pool.query(
        `SELECT id FROM tenant_settings WHERE tenant_id = $1 AND setting_key = 'discountApprovalSlaHours' LIMIT 1`,
        [tid]
      );
      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE tenant_settings SET setting_value = $1, modified_at = NOW() WHERE tenant_id = $2 AND setting_key = 'discountApprovalSlaHours'`,
          [String(hours), tid]
        );
      } else {
        await pool.query(
          `INSERT INTO tenant_settings (tenant_id, setting_key, setting_value, setting_type, description) VALUES ($1, 'discountApprovalSlaHours', $2, 'number', 'Hours before discount approval escalates to Admin')`,
          [tid, String(hours)]
        );
      }
      res.json({ discountApprovalSlaHours: hours });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // EPISODE QUOTE ITEMS
  // =============================================

  app.get("/api/episodes/:id/quote-items", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const episodeId = Number(req.params.id);
      const items = await db.select().from(episodeQuoteItems)
        .where(and(eq(episodeQuoteItems.tenantId, tid), eq(episodeQuoteItems.episodeId, episodeId)))
        .orderBy(episodeQuoteItems.displayOrder);
      const enriched = [];
      for (const item of items) {
        const ch = await db.select().from(costHeads).where(and(eq(costHeads.id, item.costHeadId), eq(costHeads.tenantId, tid))).limit(1);
        enriched.push({ ...item, costHeadName: ch[0]?.name || "Unknown" });
      }
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/episodes/:id/quote-items", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const episodeId = Number(req.params.id);
      const ep = await storage.getEpisode(episodeId, tid);
      if (!ep) return res.status(404).json({ message: "Episode not found" });

      const { items } = req.body;
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ message: "items array is required" });
      }

      await db.delete(episodeQuoteItems)
        .where(and(eq(episodeQuoteItems.tenantId, tid), eq(episodeQuoteItems.episodeId, episodeId)));

      let total = 0;
      const crmUser = await getSessionCrmUserWithRole(req);
      const userName = crmUser?.name || "System";

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.costHeadId || !item.amount) continue;
        const chCheck = await db.select().from(costHeads).where(and(eq(costHeads.id, Number(item.costHeadId)), eq(costHeads.tenantId, tid))).limit(1);
        if (chCheck.length === 0) continue;
        const amt = Math.max(0, Math.round(Number(item.amount)));
        total += amt;
        await db.insert(episodeQuoteItems).values({
          tenantId: tid,
          episodeId,
          costHeadId: Number(item.costHeadId),
          amount: amt,
          remarks: item.remarks || null,
          displayOrder: i + 1,
          createdBy: userName,
        });
      }

      const updateFields: Record<string, any> = {
        initialQuote: total,
        originalQuotedAmount: total,
      };
      if (ep.discountStatus !== "Approved") {
        updateFields.finalQuote = total;
        updateFields.finalEstimatedAmount = total;
      } else {
        const disc = ep.approvedDiscount || 0;
        updateFields.finalQuote = Math.max(0, total - disc);
        updateFields.finalEstimatedAmount = Math.max(0, total - disc);
      }
      if (ep.actualBill != null) {
        updateFields.variance = (updateFields.finalQuote || total) - (ep.actualBill || 0);
      }
      await storage.updateEpisode(episodeId, tid, updateFields);

      const saved = await db.select().from(episodeQuoteItems)
        .where(and(eq(episodeQuoteItems.tenantId, tid), eq(episodeQuoteItems.episodeId, episodeId)))
        .orderBy(episodeQuoteItems.displayOrder);
      res.json({ items: saved, total });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.delete("/api/episodes/:id/quote-items/:itemId", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const episodeId = Number(req.params.id);
      const itemId = Number(req.params.itemId);

      await db.delete(episodeQuoteItems)
        .where(and(eq(episodeQuoteItems.id, itemId), eq(episodeQuoteItems.tenantId, tid), eq(episodeQuoteItems.episodeId, episodeId)));

      const remaining = await db.select().from(episodeQuoteItems)
        .where(and(eq(episodeQuoteItems.tenantId, tid), eq(episodeQuoteItems.episodeId, episodeId)));
      const total = remaining.reduce((sum, i) => sum + (i.amount || 0), 0);

      const ep = await storage.getEpisode(episodeId, tid);
      const updateFields: Record<string, any> = {
        initialQuote: total,
        originalQuotedAmount: total,
      };
      if (ep && ep.discountStatus !== "Approved") {
        updateFields.finalQuote = total;
        updateFields.finalEstimatedAmount = total;
      } else if (ep) {
        const disc = ep.approvedDiscount || 0;
        updateFields.finalQuote = Math.max(0, total - disc);
        updateFields.finalEstimatedAmount = Math.max(0, total - disc);
      }
      if (ep?.actualBill != null) {
        updateFields.variance = (updateFields.finalQuote || total) - (ep.actualBill || 0);
      }
      await storage.updateEpisode(episodeId, tid, updateFields);

      res.json({ success: true, total });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // EPISODE INTELLIGENCE V2 — NEW ENDPOINTS
  // =============================================

  app.get("/api/handover-logs", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const entityType = req.query.entityType as string | undefined;
      const entityId = req.query.entityId ? Number(req.query.entityId) : undefined;

      let query = `SELECT hl.*, 
        fu.name as from_user_name, tu.name as to_user_name
        FROM handover_logs hl
        LEFT JOIN crm_users fu ON hl.from_user_id = fu.id
        LEFT JOIN crm_users tu ON hl.to_user_id = tu.id
        WHERE hl.tenant_id = $1`;
      const params: any[] = [tid];

      if (entityType) {
        params.push(entityType);
        query += ` AND hl.entity_type = $${params.length}`;
      }
      if (entityId) {
        params.push(entityId);
        query += ` AND hl.entity_id = $${params.length}`;
      }
      query += ` ORDER BY hl.created_at DESC LIMIT 100`;

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/temperature-logs", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const leadId = req.query.leadId ? Number(req.query.leadId) : undefined;

      let query = `SELECT * FROM temperature_logs WHERE tenant_id = $1`;
      const params: any[] = [tid];

      if (leadId) {
        params.push(leadId);
        query += ` AND lead_id = $${params.length}`;
      }
      query += ` ORDER BY created_at DESC LIMIT 100`;

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/reschedule-history", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const appointmentId = req.query.appointmentId ? Number(req.query.appointmentId) : undefined;

      let query = `SELECT * FROM reschedule_history WHERE tenant_id = $1`;
      const params: any[] = [tid];

      if (appointmentId) {
        params.push(appointmentId);
        query += ` AND appointment_id = $${params.length}`;
      }
      query += ` ORDER BY created_at DESC LIMIT 100`;

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/revenue-probability-config", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      await seedDefaultProbabilityConfig(tid);
      const configs = await db.select().from(revenueProbabilityConfig).where(
        eq(revenueProbabilityConfig.tenantId, tid)
      );
      res.json(configs);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.patch("/api/revenue-probability-config/:id", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const configId = Number(req.params.id);
      const { probability, status } = req.body;

      await db.update(revenueProbabilityConfig).set({
        probability: probability != null ? probability : undefined,
        status: status || undefined,
        modifiedAt: new Date(),
      }).where(and(
        eq(revenueProbabilityConfig.id, configId),
        eq(revenueProbabilityConfig.tenantId, tid)
      ));

      const [updated] = await db.select().from(revenueProbabilityConfig).where(
        eq(revenueProbabilityConfig.id, configId)
      );
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/intelligence/stats", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);

      const [tempStats] = (await pool.query(
        `SELECT 
          COUNT(*) FILTER (WHERE lead_temperature = 'Very Hot') as very_hot,
          COUNT(*) FILTER (WHERE lead_temperature = 'Hot') as hot,
          COUNT(*) FILTER (WHERE lead_temperature = 'Warm++') as warm_plus_plus,
          COUNT(*) FILTER (WHERE lead_temperature = 'Warm+') as warm_plus,
          COUNT(*) FILTER (WHERE lead_temperature = 'Warm') as warm,
          COUNT(*) FILTER (WHERE lead_temperature = 'Cold') as cold,
          COUNT(*) FILTER (WHERE lead_temperature = 'Dormant') as dormant,
          AVG(no_show_count) FILTER (WHERE no_show_count > 0) as avg_no_show,
          AVG(reschedule_count) FILTER (WHERE reschedule_count > 0) as avg_reschedule,
          COUNT(*) FILTER (WHERE appointment_conversion_flag = true) as converted_leads,
          COUNT(*) as total_leads
        FROM leads WHERE tenant_id = $1 AND status NOT IN ('Closed Won', 'Closed Lost', 'Unqualified')`,
        [tid]
      )).rows;

      const [episodeStats] = (await pool.query(
        `SELECT 
          COUNT(*) as total_episodes,
          SUM(expected_revenue_amount) FILTER (WHERE status NOT IN ('Completed', 'Discontinued')) as revenue_forecast,
          AVG(revenue_probability) FILTER (WHERE revenue_probability IS NOT NULL) as avg_probability,
          COUNT(*) FILTER (WHERE status = 'Consultation Done') as consultation_done,
          COUNT(*) FILTER (WHERE status IN ('Surgery Scheduled', 'Surgery Done')) as surgery_count,
          COUNT(*) FILTER (WHERE insurance_applicable = true) as insurance_cases,
          COUNT(*) FILTER (WHERE insurance_applicable = true AND preauth_status_id IS NOT NULL) as insurance_approved,
          COUNT(*) FILTER (WHERE status = 'Discontinued') as lost_count
        FROM episodes WHERE tenant_id = $1`,
        [tid]
      )).rows;

      const noShowByDoctor = (await pool.query(
        `SELECT d.name as doctor_name, COUNT(*) as no_show_count,
          COUNT(*) FILTER (WHERE a.status = 'No Show')::float / NULLIF(COUNT(*), 0) * 100 as no_show_rate
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        WHERE a.tenant_id = $1
        GROUP BY d.id, d.name
        HAVING COUNT(*) FILTER (WHERE a.status = 'No Show') > 0
        ORDER BY no_show_rate DESC LIMIT 10`,
        [tid]
      )).rows;

      const dropOffByStage = (await pool.query(
        `SELECT lost_at_stage as stage, COUNT(*) as count,
          SUM(lost_value) as total_lost_value
        FROM episodes
        WHERE tenant_id = $1 AND status = 'Discontinued' AND lost_at_stage IS NOT NULL
        GROUP BY lost_at_stage ORDER BY count DESC`,
        [tid]
      )).rows;

      res.json({
        temperatureBreakdown: tempStats,
        episodeStats,
        noShowByDoctor,
        dropOffByStage,
      });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // DASHBOARD STATS (Role-Aware)
  // =============================================
  app.get("/api/dashboard/stats", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUserId = req.session?.crmUserId;
      let roleCode = "PATIENT_COORDINATOR";
      let userName = "User";
      if (crmUserId) {
        const [userRow] = (await pool.query(
          `SELECT cu.name, sr.code as role_code FROM crm_users cu
           LEFT JOIN system_roles sr ON cu.system_role_id = sr.id
           WHERE cu.id = $1 AND cu.tenant_id = $2`,
          [crmUserId, tid]
        )).rows;
        if (userRow) {
          roleCode = userRow.role_code || "PATIENT_COORDINATOR";
          userName = userRow.name || "User";
        }
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      const todayISO = todayStart.toISOString();
      const todayEndISO = todayEnd.toISOString();

      const isManagement = roleCode === "SYS_ADMIN" || roleCode === "ADMIN";
      const isManager = roleCode === "MANAGER";

      const scopeFilter = isManagement ? "" : ` AND (l.assigned_crm_user_id = ${crmUserId} OR l.assigned_to = '${crmUserId}')`;
      const epScopeFilter = isManagement ? "" : ` AND (e.assigned_crm_user_id = ${crmUserId} OR e.doctor_id IN (SELECT id FROM doctors WHERE tenant_id = ${tid}))`;

      const [leadCounts] = (await pool.query(
        `SELECT 
          COUNT(*) as total_leads,
          COUNT(*) FILTER (WHERE l.status = 'Raw Lead Captured') as raw_leads,
          COUNT(*) FILTER (WHERE l.status = 'Contacted') as contacted,
          COUNT(*) FILTER (WHERE l.status = 'Qualified') as qualified,
          COUNT(*) FILTER (WHERE l.status = 'Appointment Booked') as appointment_booked,
          COUNT(*) FILTER (WHERE l.status = 'Consultation Done') as consultation_done,
          COUNT(*) FILTER (WHERE l.status = 'Closed Won') as closed_won,
          COUNT(*) FILTER (WHERE l.status = 'Closed Lost') as closed_lost,
          COUNT(*) FILTER (WHERE l.status = 'Nurture') as nurture,
          COUNT(*) FILTER (WHERE l.created_at >= $2) as today_new,
          COUNT(*) FILTER (WHERE l.lead_temperature IN ('Very Hot', 'Hot')) as hot_leads,
          COUNT(*) FILTER (WHERE l.lead_temperature = 'Dormant' OR (l.last_contact_at IS NOT NULL AND l.last_contact_at < NOW() - INTERVAL '5 days')) as dormant_leads,
          COUNT(*) FILTER (WHERE l.next_action_date IS NOT NULL AND l.next_action_date < $2) as overdue_actions,
          COUNT(*) FILTER (WHERE l.next_action_date >= $2 AND l.next_action_date < $3) as today_actions
        FROM leads l WHERE l.tenant_id = $1${scopeFilter}`,
        [tid, todayISO, todayEndISO]
      )).rows;

      const [episodeCounts] = (await pool.query(
        `SELECT
          COUNT(*) as total_episodes,
          COUNT(*) FILTER (WHERE e.status NOT IN ('Completed', 'Discontinued')) as active_episodes,
          COUNT(*) FILTER (WHERE e.status = 'Consultation Done') as consultations,
          COUNT(*) FILTER (WHERE e.status IN ('Surgery Scheduled', 'Surgery Done')) as surgeries,
          COUNT(*) FILTER (WHERE e.status = 'Completed') as completed,
          COUNT(*) FILTER (WHERE e.status = 'Discontinued') as discontinued,
          COALESCE(SUM(e.initial_quote) FILTER (WHERE e.status NOT IN ('Completed', 'Discontinued')), 0) as pipeline_value,
          COALESCE(SUM(e.actual_bill) FILTER (WHERE e.status = 'Completed'), 0) as realized_revenue,
          COUNT(*) FILTER (WHERE e.insurance_applicable = true) as insurance_cases,
          COUNT(*) FILTER (WHERE e.next_action_date IS NOT NULL AND e.next_action_date < $2) as overdue_ep_actions,
          COUNT(*) FILTER (WHERE e.next_action_date >= $2 AND e.next_action_date < $3) as today_ep_actions
        FROM episodes e WHERE e.tenant_id = $1${isManagement ? "" : ` AND e.assigned_crm_user_id = ${crmUserId}`}`,
        [tid, todayISO, todayEndISO]
      )).rows;

      const [appointmentCounts] = (await pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE a.appointment_date >= $2 AND a.appointment_date < $3) as today_appointments,
          COUNT(*) FILTER (WHERE a.appointment_date >= $2 AND a.appointment_date < $3 AND a.status = 'Completed') as today_completed,
          COUNT(*) FILTER (WHERE a.appointment_date >= $2 AND a.appointment_date < $3 AND a.status = 'No Show') as today_no_shows,
          COUNT(*) FILTER (WHERE a.appointment_date >= $2 AND a.appointment_date < $3 AND a.status IN ('Scheduled', 'Confirmed')) as today_pending
        FROM appointments a WHERE a.tenant_id = $1`,
        [tid, todayISO, todayEndISO]
      )).rows;

      const nextActions = (await pool.query(
        `(SELECT 'lead' as entity_type, l.id as entity_id, l.name as entity_name, l.next_action_date, l.next_action_notes, 
            nat.name as action_type_name, cu.name as assigned_to_name
          FROM leads l
          LEFT JOIN next_action_types nat ON l.next_action_type_id = nat.id
          LEFT JOIN crm_users cu ON l.next_action_assigned_to = cu.id
          WHERE l.tenant_id = $1 AND l.next_action_date IS NOT NULL
            AND l.next_action_date >= $2 AND l.next_action_date < $3
            ${isManagement ? "" : `AND (l.next_action_assigned_to = ${crmUserId} OR l.assigned_crm_user_id = ${crmUserId})`}
          ORDER BY l.next_action_date LIMIT 20)
        UNION ALL
        (SELECT 'episode' as entity_type, e.id as entity_id, e.episode_name as entity_name, e.next_action_date, e.next_action_notes,
            nat.name as action_type_name, cu.name as assigned_to_name
          FROM episodes e
          LEFT JOIN next_action_types nat ON e.next_action_type_id = nat.id
          LEFT JOIN crm_users cu ON e.next_action_assigned_to = cu.id
          WHERE e.tenant_id = $1 AND e.next_action_date IS NOT NULL
            AND e.next_action_date >= $2 AND e.next_action_date < $3
            ${isManagement ? "" : `AND (e.next_action_assigned_to = ${crmUserId} OR e.assigned_crm_user_id = ${crmUserId})`}
          ORDER BY e.next_action_date LIMIT 20)
        ORDER BY next_action_date
        LIMIT 20`,
        [tid, todayISO, todayEndISO]
      )).rows;

      const overdueActions = (await pool.query(
        `(SELECT 'lead' as entity_type, l.id as entity_id, l.name as entity_name, l.next_action_date, l.next_action_notes,
            nat.name as action_type_name, cu.name as assigned_to_name
          FROM leads l
          LEFT JOIN next_action_types nat ON l.next_action_type_id = nat.id
          LEFT JOIN crm_users cu ON l.next_action_assigned_to = cu.id
          WHERE l.tenant_id = $1 AND l.next_action_date IS NOT NULL AND l.next_action_date < $2
            ${isManagement ? "" : `AND (l.next_action_assigned_to = ${crmUserId} OR l.assigned_crm_user_id = ${crmUserId})`}
          ORDER BY l.next_action_date DESC LIMIT 10)
        UNION ALL
        (SELECT 'episode' as entity_type, e.id as entity_id, e.episode_name as entity_name, e.next_action_date, e.next_action_notes,
            nat.name as action_type_name, cu.name as assigned_to_name
          FROM episodes e
          LEFT JOIN next_action_types nat ON e.next_action_type_id = nat.id
          LEFT JOIN crm_users cu ON e.next_action_assigned_to = cu.id
          WHERE e.tenant_id = $1 AND e.next_action_date IS NOT NULL AND e.next_action_date < $2
            ${isManagement ? "" : `AND (e.next_action_assigned_to = ${crmUserId} OR e.assigned_crm_user_id = ${crmUserId})`}
          ORDER BY e.next_action_date DESC LIMIT 10)
        ORDER BY next_action_date
        LIMIT 10`,
        [tid, todayISO]
      )).rows;

      let conversionRatios = null;
      if (isManagement || isManager) {
        const ratioResult = (await pool.query(
          `SELECT
            COUNT(*) FILTER (WHERE e.status IN ('Treatment Planning','Surgery Scheduled','Surgery Done','In Treatment','Post Care','Follow Up','Completed','Discontinued')) as treatment_planned_count,
            COUNT(*) FILTER (WHERE e.status IN ('Surgery Scheduled','Surgery Done','In Treatment','Post Care','Follow Up','Completed')) as surgery_scheduled_count,
            COUNT(*) FILTER (WHERE e.status IN ('Surgery Done','In Treatment','Post Care','Follow Up','Completed')) as surgery_done_count
          FROM episodes e WHERE e.tenant_id = $1`,
          [tid]
        )).rows;
        const r = ratioResult[0] || {};
        const tp = Number(r.treatment_planned_count) || 0;
        const ss = Number(r.surgery_scheduled_count) || 0;
        const sd = Number(r.surgery_done_count) || 0;
        conversionRatios = {
          treatmentPlannedCount: tp,
          surgeryScheduledCount: ss,
          surgeryDoneCount: sd,
          treatmentToSurgeryRatio: tp > 0 ? Math.round((ss / tp) * 100) : 0,
          surgeryToCompletionRatio: ss > 0 ? Math.round((sd / ss) * 100) : 0,
        };
      }

      let teamStats = null;
      let teamOverdueActions = null;
      if (isManagement || isManager) {
        const teamLeadCounts = (await pool.query(
          `SELECT cu.id, cu.name, sr.code as role_code,
            COUNT(l.id) as total_leads,
            COUNT(l.id) FILTER (WHERE l.status = 'Raw Lead Captured') as untouched,
            COUNT(l.id) FILTER (WHERE l.created_at >= $2) as today_new,
            COUNT(l.id) FILTER (WHERE l.next_action_date IS NOT NULL AND l.next_action_date < $2) as overdue
          FROM crm_users cu
          LEFT JOIN system_roles sr ON cu.system_role_id = sr.id
          LEFT JOIN leads l ON (l.assigned_crm_user_id = cu.id OR l.assigned_to = cu.id::text) AND l.tenant_id = $1
          WHERE cu.tenant_id = $1 AND cu.is_active = true
            AND sr.code IN ('PATIENT_COORDINATOR', 'COUNSELLOR', 'MANAGER')
          GROUP BY cu.id, cu.name, sr.code
          ORDER BY total_leads DESC`,
          [tid, todayISO]
        )).rows;
        teamStats = teamLeadCounts;

        teamOverdueActions = (await pool.query(
          `(SELECT 'lead' as entity_type, l.id as entity_id, l.name as entity_name, l.next_action_date, l.next_action_notes,
              nat.name as action_type_name, cu.name as assigned_to_name, cu.id as assigned_to_id
            FROM leads l
            LEFT JOIN next_action_types nat ON l.next_action_type_id = nat.id
            LEFT JOIN crm_users cu ON l.next_action_assigned_to = cu.id
            WHERE l.tenant_id = $1 AND l.next_action_date IS NOT NULL AND l.next_action_date < $2
              AND l.next_action_assigned_to IS NOT NULL AND l.next_action_assigned_to != $3
            ORDER BY l.next_action_date DESC LIMIT 15)
          UNION ALL
          (SELECT 'episode' as entity_type, e.id as entity_id, e.episode_name as entity_name, e.next_action_date, e.next_action_notes,
              nat.name as action_type_name, cu.name as assigned_to_name, cu.id as assigned_to_id
            FROM episodes e
            LEFT JOIN next_action_types nat ON e.next_action_type_id = nat.id
            LEFT JOIN crm_users cu ON e.next_action_assigned_to = cu.id
            WHERE e.tenant_id = $1 AND e.next_action_date IS NOT NULL AND e.next_action_date < $2
              AND e.next_action_assigned_to IS NOT NULL AND e.next_action_assigned_to != $3
            ORDER BY e.next_action_date DESC LIMIT 15)
          ORDER BY next_action_date
          LIMIT 20`,
          [tid, todayISO, crmUserId]
        )).rows;
      }

      let recentActivities = null;
      let individualPerformance = null;
      if (!isManagement) {
        recentActivities = (await pool.query(
          `SELECT a.id, a.type, a.description, a.outcome, a.created_at, l.name as lead_name, l.id as lead_id
          FROM activities a
          JOIN leads l ON a.lead_id = l.id
          WHERE a.tenant_id = $1 AND a.created_by = $2
          ORDER BY a.created_at DESC LIMIT 10`,
          [tid, String(crmUserId)]
        )).rows;

        const [callStats] = (await pool.query(
          `SELECT 
            COUNT(*) FILTER (WHERE a.type = 'call') as total_calls,
            COUNT(*) FILTER (WHERE a.type = 'call' AND a.call_direction = 'outbound') as outbound_calls,
            COUNT(*) FILTER (WHERE a.type = 'call' AND a.call_direction = 'inbound') as inbound_calls,
            COALESCE(AVG(a.call_duration_seconds) FILTER (WHERE a.type = 'call' AND a.call_duration_seconds > 0), 0) as avg_call_duration,
            COUNT(*) FILTER (WHERE a.type = 'call' AND a.created_at >= $2) as today_calls,
            COUNT(*) FILTER (WHERE a.type = 'call' AND a.created_at >= NOW() - interval '7 days') as week_calls,
            COUNT(*) FILTER (WHERE a.outcome = 'Interested') as interested_outcomes,
            COUNT(*) FILTER (WHERE a.outcome = 'Confirmed') as confirmed_outcomes,
            COUNT(*) FILTER (WHERE a.outcome = 'Not Available') as not_available_outcomes,
            COUNT(*) FILTER (WHERE a.outcome = 'Callback Requested') as callback_outcomes,
            COUNT(*) as total_activities
          FROM activities a WHERE a.tenant_id = $1 AND a.created_by = $3`,
          [tid, todayISO, String(crmUserId)]
        )).rows;

        const leadSourceBreakdown = (await pool.query(
          `SELECT ls.name as source_name, COUNT(l.id) as lead_count,
            COUNT(l.id) FILTER (WHERE l.status IN ('Consultation Done', 'Closed Won')) as converted
          FROM leads l
          LEFT JOIN lead_sources ls ON l.lead_source_id = ls.id
          WHERE l.tenant_id = $1 AND (l.assigned_crm_user_id = $2 OR l.assigned_to = $3)
          GROUP BY ls.name ORDER BY lead_count DESC LIMIT 8`,
          [tid, crmUserId, String(crmUserId)]
        )).rows;

        const myEpisodeStats = (await pool.query(
          `SELECT
            COUNT(*) as total_episodes,
            COUNT(*) FILTER (WHERE e.status NOT IN ('Completed', 'Discontinued')) as active_episodes,
            COUNT(*) FILTER (WHERE e.status = 'Completed') as completed_episodes,
            COUNT(*) FILTER (WHERE e.status IN ('Surgery Scheduled', 'Surgery Done')) as surgery_episodes,
            COALESCE(SUM(e.estimated_cost) FILTER (WHERE e.status NOT IN ('Completed', 'Discontinued')), 0) as pipeline_value,
            COALESCE(SUM(e.actual_bill) FILTER (WHERE e.status = 'Completed'), 0) as realized_revenue,
            COALESCE(SUM(e.expected_revenue_amount) FILTER (WHERE e.status NOT IN ('Completed', 'Discontinued')), 0) as expected_revenue
          FROM episodes e WHERE e.tenant_id = $1 AND e.assigned_crm_user_id = $2`,
          [tid, crmUserId]
        )).rows;

        const conversionFunnel = (await pool.query(
          `SELECT
            COUNT(*) FILTER (WHERE l.status = 'Raw Lead Captured') as raw,
            COUNT(*) FILTER (WHERE l.status = 'Contacted') as contacted,
            COUNT(*) FILTER (WHERE l.status = 'Qualified') as qualified,
            COUNT(*) FILTER (WHERE l.status = 'Appointment Booked') as appointment_booked,
            COUNT(*) FILTER (WHERE l.status = 'Consultation Done') as consultation_done,
            COUNT(*) FILTER (WHERE l.status = 'Closed Won') as closed_won,
            COUNT(*) FILTER (WHERE l.status = 'Closed Lost') as closed_lost,
            COUNT(*) FILTER (WHERE l.status = 'Nurture') as nurture,
            COUNT(*) as total
          FROM leads l WHERE l.tenant_id = $1 AND (l.assigned_crm_user_id = $2 OR l.assigned_to = $3)`,
          [tid, crmUserId, String(crmUserId)]
        )).rows;

        individualPerformance = {
          callStats: callStats || {},
          leadSourceBreakdown,
          myEpisodeStats: myEpisodeStats[0] || {},
          conversionFunnel: conversionFunnel[0] || {},
        };
      }

      res.json({
        roleCode,
        userName,
        leadCounts,
        episodeCounts,
        appointmentCounts,
        nextActions,
        overdueActions,
        teamStats,
        teamOverdueActions,
        recentActivities,
        individualPerformance,
        conversionRatios,
      });
    } catch (err: any) {
      console.error("Dashboard stats error:", err);
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/audit-logs", isAuthenticated, async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const parsed = insertAuditLogSchema.parse({ ...req.body, tenantId: tid });
      const log = await storage.createAuditLog(parsed);
      res.status(201).json(log);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // WHATSAPP SETTINGS ROUTES (ADMIN+ access — each tenant admin manages their own)
  // =============================================
  const WA_SETTING_KEYS = ["wa_phone_number_id", "wa_access_token", "wa_business_account_id", "wa_enabled", "wa_template_appointment", "wa_test_phone"];

  app.get("/api/whatsapp-settings", isAuthenticated, async (req: any, res: any) => {
    if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.put("/api/whatsapp-settings", isAuthenticated, async (req: any, res: any) => {
    if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/whatsapp-settings/test", isAuthenticated, async (req: any, res: any) => {
    if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/whatsapp-settings/send-test", isAuthenticated, async (req: any, res: any) => {
    if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
    try {
      const tid = await getDefaultTenantId(req);
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ message: "Phone number is required" });
      const allSettings = await storage.getTenantSettings(tid);
      const { getWhatsAppConfigFromSettings, sendWhatsAppText, formatPhoneForWhatsApp } = await import("./whatsapp");
      const config = getWhatsAppConfigFromSettings(allSettings);
      if (!config.enabled) return res.status(400).json({ message: "WhatsApp is not enabled" });
      const result = await sendWhatsAppText(config, formatPhoneForWhatsApp(phone), "Hello from RGB Hospital CRM! This is a test message to confirm your WhatsApp integration is working.");
      if (result.success) {
        res.json({ success: true, message: `Test message sent successfully! Message ID: ${result.messageId}` });
      } else {
        res.status(400).json({ message: `Failed to send: ${result.error}` });
      }
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // EMAIL SETTINGS ROUTES (ADMIN+ access)
  // =============================================
  const EMAIL_SETTING_KEYS = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from_email", "smtp_from_name", "smtp_secure"];

  app.get("/api/email-settings", isAuthenticated, async (req: any, res: any) => {
    if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.put("/api/email-settings", isAuthenticated, async (req: any, res: any) => {
    if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
    try {
      const tid = await getDefaultTenantId(req);
      const body = req.body as Record<string, string | null>;
      const savedKeys: string[] = [];
      for (const key of EMAIL_SETTING_KEYS) {
        if (key in body) {
          if (key === "smtp_pass" && body[key] === "••••••••") continue;
          const val = body[key] ?? null;
          await storage.setTenantSetting(tid, key, val);
          savedKeys.push(`${key}=${key === "smtp_pass" ? "***" : val}`);
        }
      }
      console.log(`[email-settings] Saved for tenant ${tid}:`, savedKeys.join(", "));
      res.json({ success: true, message: "Email settings saved" });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/email-settings/test", isAuthenticated, async (req: any, res: any) => {
    if (!(await requireAdminRole(req, res, await getDefaultTenantId(req)))) return;
    try {
      const tid = await getDefaultTenantId(req);
      const allSettings = await storage.getTenantSettings(tid);
      const getSetting = (key: string) => allSettings.find(s => s.settingKey === key)?.settingValue || "";
      const smtpHost = getSetting("smtp_host");
      const smtpUser = getSetting("smtp_user");
      const smtpPass = getSetting("smtp_pass");
      if (!smtpHost || !smtpUser || !smtpPass) {
        return res.status(400).json({ message: "SMTP settings incomplete. Please save host, username, and password first." });
      }

      const smtpPort = parseInt(getSetting("smtp_port") || "587");
      const smtpSecure = getSetting("smtp_secure") !== "false";
      const fromEmail = getSetting("smtp_from_email") || smtpUser;
      const fromName = getSetting("smtp_from_name") || "RGB Hospital CRM";

      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.verify();

      const crmUserId = req.session?.crmUserId;
      const allCrmUsers = await storage.getCrmUsers(tid);
      const currentUser = allCrmUsers.find((u: any) => u.id === crmUserId);
      const testRecipient = currentUser?.email || smtpUser;

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: testRecipient,
        subject: "SMTP Test - Email Settings Verified",
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #fff;">
            <h2 style="color: #0f4c81; margin: 0 0 16px 0; font-size: 20px;">SMTP Test Successful</h2>
            <p style="font-size: 15px; color: #333;">Your SMTP configuration is working correctly. Emails from this tenant will be sent using these settings.</p>
            <p style="font-size: 13px; color: #888; margin-top: 20px;">Host: ${smtpHost}:${smtpPort} | From: ${fromEmail}</p>
          </div>
        `,
      });

      res.json({ success: true, message: `Test email sent successfully to ${testRecipient}. Please check your inbox.` });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // =============================================
  // SYSTEM ADMIN MIDDLEWARE
  // =============================================
  async function isSysAdmin(req: any, res: any, next: any) {
    try {
      const session = req.session as any;
      const crmUserId = session?.crmUserId;
      if (!crmUserId) {
        console.warn("[isSysAdmin] No crmUserId in session");
        return res.status(403).json({ message: "Forbidden" });
      }

      const sessionTid = session?.tenantId || tid;
      // Use direct DB lookup — getCrmUser uses tenant scoping, getCrmUsers excludes SYS_ADMIN
      const [crmUser] = await db.select().from(crmUsers).where(
        and(eq(crmUsers.id, crmUserId), eq(crmUsers.tenantId, sessionTid))
      );
      if (!crmUser) {
        console.warn(`[isSysAdmin] crmUser ${crmUserId} not found in tenant ${sessionTid}`);
        return res.status(403).json({ message: "Forbidden" });
      }

      if (crmUser.systemRoleId) {
        // Direct DB query — bypasses status filter so Inactive SYS_ADMIN role still grants access
        const [role] = await db.select().from(systemRoles).where(eq(systemRoles.id, crmUser.systemRoleId));
        if (role && role.code === "SYS_ADMIN") {
          return next();
        }
        console.warn(`[isSysAdmin] User ${crmUserId} role is ${role?.code ?? "unknown"} — not SYS_ADMIN`);
      } else {
        console.warn(`[isSysAdmin] User ${crmUserId} has no systemRoleId`);
      }
      return res.status(403).json({ message: "Forbidden: System Admin access required" });
    } catch (err) {
      console.error("[isSysAdmin] Unexpected error:", err);
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
          createdAt: t.createdAt,
          contactPerson: t.contactPerson,
          contactEmail: t.contactEmail,
          contactPhone: t.contactPhone,
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // System Error Logs — SYS_ADMIN only
  app.get("/api/admin/error-logs", isAuthenticated, isSysAdmin, async (req: any, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 200, 500);
      const offset = Number(req.query.offset) || 0;
      const tenantFilter = req.query.tenantId ? Number(req.query.tenantId) : null;
      const statusFilter = req.query.statusCode ? Number(req.query.statusCode) : null;

      const conditions: any[] = [];
      if (tenantFilter) conditions.push(eq(systemErrorLogs.tenantId, tenantFilter));
      if (statusFilter) conditions.push(eq(systemErrorLogs.statusCode, statusFilter));

      const rows = await db.select().from(systemErrorLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(sql`${systemErrorLogs.createdAt} DESC`)
        .limit(limit)
        .offset(offset);

      const [totalRow] = await db.select({ count: count() }).from(systemErrorLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      res.json({ logs: rows, total: totalRow.count });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.delete("/api/admin/error-logs", isAuthenticated, isSysAdmin, async (req: any, res) => {
    try {
      await db.delete(systemErrorLogs);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // Subscription Plans CRUD
  app.get("/api/admin/plans", isAuthenticated, isSysAdmin, async (req, res) => {
    try {
      const plans = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.price);
      res.json(plans);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/admin/plans", isAuthenticated, isSysAdmin, async (req, res) => {
    try {
      const parsed = insertSubscriptionPlanSchema.parse(req.body);
      const [plan] = await db.insert(subscriptionPlans).values(parsed).returning();
      res.status(201).json(plan);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  app.patch("/api/admin/plans/:id", isAuthenticated, isSysAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [updated] = await db.update(subscriptionPlans).set({ ...req.body, modifiedAt: new Date() }).where(eq(subscriptionPlans.id, id)).returning();
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // ── Demo Tenant Seed ──────────────────────────────────────────────────────
  app.get("/api/admin/seed-demo-stats", isAuthenticated, isSysAdmin, async (req: any, res) => {
    try {
      const DEMO_SUBDOMAIN = "rgb-demo";
      const [demoTenant] = await db
        .select({ id: tenants.id, name: tenants.name, createdAt: tenants.createdAt })
        .from(tenants)
        .where(eq(tenants.subdomain, DEMO_SUBDOMAIN));

      if (!demoTenant) {
        return res.json({ exists: false });
      }

      const tid = demoTenant.id;
      const [[leadCount], [episodeCount], [appointmentCount], [userCount], lastSeedRow] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(leads).where(eq(leads.tenantId, tid)),
        db.select({ count: sql<number>`count(*)::int` }).from(episodes).where(eq(episodes.tenantId, tid)),
        db.select({ count: sql<number>`count(*)::int` }).from(appointments).where(eq(appointments.tenantId, tid)),
        db.select({ count: sql<number>`count(*)::int` }).from(crmUsers).where(eq(crmUsers.tenantId, tid)),
        db.select({ settingValue: tenantSettings.settingValue }).from(tenantSettings).where(and(eq(tenantSettings.tenantId, tid), eq(tenantSettings.settingKey, "lastDemoSeedAt"))),
      ]);

      return res.json({
        exists: true,
        tenantId: tid,
        tenantName: demoTenant.name,
        tenantCreatedAt: demoTenant.createdAt,
        lastSeededAt: lastSeedRow?.[0]?.settingValue ?? null,
        leads: leadCount.count,
        episodes: episodeCount.count,
        appointments: appointmentCount.count,
        users: userCount.count,
      });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/admin/seed-demo-tenant", isAuthenticated, isSysAdmin, async (req: any, res) => {
    try {
      const { seedDemoTenant } = await import("./seedDemo");
      const result = await seedDemoTenant();
      // Persist last-seed timestamp for the demo tenant
      let lastSeededAt: string | null = null;
      let timestampPersisted = false;
      try {
        lastSeededAt = new Date().toISOString();
        const existing = await db
          .select({ id: tenantSettings.id })
          .from(tenantSettings)
          .where(and(eq(tenantSettings.tenantId, result.stats.tenantId as number), eq(tenantSettings.settingKey, "lastDemoSeedAt")));
        if (existing.length > 0) {
          await db.update(tenantSettings)
            .set({ settingValue: lastSeededAt, modifiedAt: new Date() })
            .where(and(eq(tenantSettings.tenantId, result.stats.tenantId as number), eq(tenantSettings.settingKey, "lastDemoSeedAt")));
        } else {
          await db.insert(tenantSettings).values({
            tenantId: result.stats.tenantId as number,
            settingKey: "lastDemoSeedAt",
            settingValue: lastSeededAt,
            settingType: "string",
            description: "Timestamp of the last demo tenant seed run",
          });
        }
        timestampPersisted = true;
      } catch (settingErr) {
        console.warn("[seed-demo-tenant] Failed to persist lastDemoSeedAt:", settingErr);
      }
      res.json({ ...result, lastSeededAt: timestampPersisted ? lastSeededAt : null, timestampPersisted });
    } catch (err: any) {
      console.error("[seed-demo-tenant] Error:", err);
      res.status(500).json({ message: humanizeError(err), detail: err?.message });
    }
  });

  // ── Fast appointment reseed for demo tenant (no full data wipe) ────────────
  // Deletes only Scheduled appointments for the demo tenant and recreates 290+
  // distributed across today + next 10 days. Completes in a few seconds.
  app.post("/api/admin/reseed-demo-appointments", isAuthenticated, isSysAdmin, async (req: any, res) => {
    try {
      const [demoTenant] = await db.select({ id: tenants.id })
        .from(tenants).where(eq(tenants.subdomain, "rgb-demo")).limit(1);
      if (!demoTenant) return res.status(404).json({ message: "Demo tenant not found" });
      const tid = demoTenant.id;

      // Fetch lookup data
      const doctorRows = await pool.query(
        `SELECT id, branch_id FROM doctors WHERE tenant_id = $1 ORDER BY id`, [tid]
      );
      const branchRows = await pool.query(
        `SELECT id FROM branches WHERE tenant_id = $1 AND status = 'Active' ORDER BY id`, [tid]
      );
      const leadRows = await pool.query(
        `SELECT l.id AS lead_id, l.patient_id, l.branch_id AS lead_branch FROM leads l WHERE l.tenant_id = $1 ORDER BY RANDOM()`, [tid]
      );

      const doctorList: { id: number; branchId: number }[] = doctorRows.rows.map((r: any) => ({ id: r.id, branchId: r.branch_id }));
      const branchIds: number[] = branchRows.rows.map((r: any) => r.id);
      const leadPool: { leadId: number; patientId: number | null }[] = leadRows.rows.map((r: any) => ({ leadId: r.lead_id, patientId: r.patient_id }));

      if (!doctorList.length || !branchIds.length || !leadPool.length) {
        return res.status(400).json({ message: "Demo data not seeded yet — run a full seed first." });
      }

      const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
      const consultSlots = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","14:00","14:30","15:00","15:30","16:00","16:30"];
      const dayWeights = [40, 34, 32, 30, 26, 25, 24, 22, 20, 19, 18]; // today → day+10

      // Delete only Scheduled appointments (keep historical completed/cancelled)
      const deleted = await pool.query(
        `DELETE FROM appointments WHERE tenant_id = $1 AND status = 'Scheduled' RETURNING id`, [tid]
      );

      // Shuffle leads
      const shuffled = [...leadPool].sort(() => Math.random() - 0.5);
      let idx = 0;
      let created = 0;

      for (let dayOffset = 0; dayOffset <= 10; dayOffset++) {
        const count = dayWeights[dayOffset];
        const apptDate = new Date();
        apptDate.setHours(0, 0, 0, 0);
        apptDate.setDate(apptDate.getDate() + dayOffset);
        const apptDateStr = apptDate.toISOString();

        for (let slot = 0; slot < count; slot++) {
          const lead = shuffled[idx % shuffled.length];
          idx++;
          const branchId = pick(branchIds);
          const branchDoctors = doctorList.filter(d => d.branchId === branchId);
          const doctor = pick(branchDoctors.length ? branchDoctors : doctorList);
          await pool.query(
            `INSERT INTO appointments (tenant_id, lead_id, patient_id, doctor_id, branch_id, appointment_date, start_time, status, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'Scheduled','system-reseed')`,
            [tid, lead.leadId, lead.patientId, doctor.id, branchId, apptDateStr, consultSlots[slot % consultSlots.length]]
          );
          created++;
        }
      }

      console.log(`[reseed-demo-appointments] Deleted ${deleted.rowCount} old, created ${created} new Scheduled appointments for tenant ${tid}`);
      res.json({
        success: true,
        deleted: deleted.rowCount,
        created,
        todayCount: dayWeights[0],
        message: `Reseeded ${created} appointments across today + next 10 days. Today has ${dayWeights[0]} scheduled.`,
      });
    } catch (err: any) {
      console.error("[reseed-demo-appointments] Error:", err);
      res.status(500).json({ message: humanizeError(err), detail: err?.message });
    }
  });

  // ── Export tenant data ──────────────────────────────────────────────────────
  // POST /api/admin/export-tenant/:tenantId
  // Returns an encrypted .hcrmx file download. Audit-logged on every request.
  app.post("/api/admin/export-tenant/:tenantId", isAuthenticated, isSysAdmin, async (req: any, res) => {
    try {
      const { buildTenantExport, validatePassphrase } = await import("./exportTenant");
      const tenantId = Number(req.params.tenantId);
      const { passphrase, includePhiData, purpose, purposeNote } = req.body;

      const passphraseErr = validatePassphrase(passphrase);
      if (passphraseErr) return res.status(400).json({ message: passphraseErr });

      const session = req.session as any;
      const adminId = Number(session?.crmUserId) || 0;
      // Resolve admin email from DB (session only stores crmUserId)
      const [adminUser] = adminId
        ? await db.select({ email: crmUsers.email, name: crmUsers.name })
            .from(crmUsers).where(eq(crmUsers.id, adminId))
        : [{ email: "unknown", name: "unknown" }];
      const adminEmail = adminUser?.email || `user#${adminId}`;

      const fileBuffer = await buildTenantExport({
        tenantId,
        includePhiData: includePhiData === true,
        purpose: purpose || "BACKUP",
        purposeNote: purposeNote || undefined,
        exportedBy: adminEmail,
        exportedByCrmUserId: adminId,
        passphrase,
        requestIp: req.ip || req.socket?.remoteAddress,
      });

      const ts = new Date().toISOString().slice(0, 10);
      const filename = `hcrmx-${tenantId}-${ts}.hcrmx`;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", fileBuffer.length);
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.send(fileBuffer);
    } catch (err: any) {
      console.error("[export-tenant] Error:", err);
      return res.status(500).json({ message: err?.message || "Export failed" });
    }
  });

  // ── Import: decrypt & preview (no data written) ─────────────────────────────
  const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

  app.post("/api/admin/import-tenant/preview", isAuthenticated, isSysAdmin,
    importUpload.single("file"), async (req: any, res) => {
    try {
      const { parseTenantExport } = await import("./exportTenant");
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const { passphrase } = req.body;
      if (!passphrase) return res.status(400).json({ message: "Passphrase is required" });

      const parsed = parseTenantExport(req.file.buffer, passphrase);
      // Return meta + counts — never return actual data rows in preview
      return res.json({
        meta:            parsed.meta,
        compliance:      parsed.compliance,
        counts:          parsed.counts,
        includesPhiData: parsed.includesPhiData,
        totalRecords:    Object.values(parsed.counts).reduce((a, b) => a + b, 0),
      });
    } catch (err: any) {
      return res.status(400).json({ message: err?.message || "Preview failed" });
    }
  });

  // ── Import: apply master data ────────────────────────────────────────────────
  app.post("/api/admin/import-tenant/apply", isAuthenticated, isSysAdmin,
    importUpload.single("file"), async (req: any, res) => {
    try {
      const { parseTenantExport, applyMasterDataImport } = await import("./exportTenant");
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const { passphrase, targetTenantId } = req.body;
      if (!passphrase) return res.status(400).json({ message: "Passphrase is required" });
      if (!targetTenantId) return res.status(400).json({ message: "Target tenant is required" });

      const session = req.session as any;
      const adminId = Number(session?.crmUserId) || 0;
      const [adminUser2] = adminId
        ? await db.select({ email: crmUsers.email })
            .from(crmUsers).where(eq(crmUsers.id, adminId))
        : [{ email: "unknown" }];
      const adminEmail = adminUser2?.email || `user#${adminId}`;

      const parsed = parseTenantExport(req.file.buffer, passphrase);
      const applied = await applyMasterDataImport(
        parsed,
        Number(targetTenantId),
        adminId,
        adminEmail,
        req.ip || req.socket?.remoteAddress
      );

      const total = Object.values(applied).reduce((a, b) => a + b, 0);
      return res.json({ message: `Master data import complete — ${total} records restored.`, applied });
    } catch (err: any) {
      console.error("[import-tenant/apply] Error:", err);
      return res.status(500).json({ message: err?.message || "Import failed" });
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
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/admin/payments", isAuthenticated, isSysAdmin, async (req, res) => {
    try {
      const body = coerceDateFields(req.body, ["paymentDate", "periodStart", "periodEnd"]);
      const parsed = insertSubscriptionPaymentSchema.parse(body);
      const [payment] = await db.insert(subscriptionPayments).values(parsed).returning();
      res.status(201).json(payment);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
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
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/communication-preferences/:entityType/:entityId", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const { entityType, entityId } = req.params;
      const col = entityType === "patient" ? "patient_id" : "lead_id";
      const result = await pool.query(
        `SELECT * FROM communication_preferences WHERE tenant_id = $1 AND ${col} = $2 ORDER BY channel`,
        [tid, Number(entityId)]
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/communication-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const { leadId, patientId, channel, optedIn } = req.body;
      if (!channel) return res.status(400).json({ message: "Channel is required" });
      if (leadId) {
        const [ownerCheck] = (await pool.query(`SELECT id FROM leads WHERE id = $1 AND tenant_id = $2`, [leadId, tid])).rows;
        if (!ownerCheck) return res.status(403).json({ message: "Lead not found or access denied" });
      }
      if (patientId) {
        const [ownerCheck] = (await pool.query(`SELECT id FROM patients WHERE id = $1 AND tenant_id = $2`, [patientId, tid])).rows;
        if (!ownerCheck) return res.status(403).json({ message: "Patient not found or access denied" });
      }
      const existing = await pool.query(
        `SELECT id FROM communication_preferences
         WHERE tenant_id = $1 AND channel = $2
         AND (lead_id = $3 OR patient_id = $4)`,
        [tid, channel, leadId || null, patientId || null]
      );
      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE communication_preferences SET opted_in = $1 WHERE id = $2`,
          [optedIn ?? true, existing.rows[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO communication_preferences (tenant_id, lead_id, patient_id, channel, opted_in)
           VALUES ($1, $2, $3, $4, $5)`,
          [tid, leadId || null, patientId || null, channel, optedIn ?? true]
        );
      }
      const sessionCrmUserId = req.session?.crmUserId;
      if (sessionCrmUserId) {
        logAccess(tid, sessionCrmUserId, "UPDATE", "communication_preferences", leadId || patientId || 0, `channel=${channel}, optedIn=${optedIn}`, req);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/access-logs", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const sessionCrmUserId = req.session?.crmUserId;
      const allCrmUsers = await storage.getCrmUsers(tid);
      const crmUser = allCrmUsers.find((u: any) => u.id === sessionCrmUserId);
      if (!crmUser) return res.status(403).json({ message: "Forbidden" });
      const [role] = crmUser.systemRoleId ? await db.select().from(systemRoles).where(eq(systemRoles.id, crmUser.systemRoleId)) : [null];
      if (!role || !["SYS_ADMIN", "ADMIN"].includes(role.code)) {
        return res.status(403).json({ message: "Only admins can view access logs" });
      }
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const result = await pool.query(
        `SELECT al.*, cu.name as user_name FROM access_logs al
         LEFT JOIN crm_users cu ON cu.id = al.crm_user_id
         WHERE al.tenant_id = $1
         ORDER BY al.created_at DESC LIMIT $2`,
        [tid, limit]
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/leads/:id/consent", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const leadId = Number(req.params.id);
      const { consentGiven, consentMethod, consentPurpose } = req.body;
      await pool.query(
        `UPDATE leads SET consent_given = $1, consent_timestamp = NOW(), consent_method = $2, consent_purpose = $3
         WHERE id = $4 AND tenant_id = $5`,
        [consentGiven ?? true, consentMethod || "form", consentPurpose || "data_processing", leadId, tid]
      );
      const sessionCrmUserId = req.session?.crmUserId;
      if (sessionCrmUserId) {
        logAccess(tid, sessionCrmUserId, "UPDATE", "consent", leadId, `consentGiven=${consentGiven}`, req);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/patients/:id/consent", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const patientId = Number(req.params.id);
      const { consentGiven, consentMethod, consentPurpose } = req.body;
      await pool.query(
        `UPDATE patients SET consent_given = $1, consent_timestamp = NOW(), consent_method = $2, consent_purpose = $3
         WHERE id = $4 AND tenant_id = $5`,
        [consentGiven ?? true, consentMethod || "form", consentPurpose || "data_processing", patientId, tid]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // Seed the database
  // =============================================
  // SUPPORT TICKETING SYSTEM
  // =============================================

  async function generateTicketNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = `TKT-${dateStr}`;
    const result = await pool.query(
      `SELECT COUNT(*) as cnt FROM support_tickets WHERE ticket_number LIKE $1`,
      [`${prefix}-%`]
    );
    const seq = (parseInt(result.rows[0].cnt) || 0) + 1;
    return `${prefix}-${String(seq).padStart(3, "0")}`;
  }

  function isSupportAdmin(req: any): boolean {
    return !!(req.session as any)?.supportUserId;
  }

  function requireSupportAuth(req: any, res: any, next: any) {
    if ((req.session as any)?.supportUserId) return next();
    return res.status(401).json({ message: "Support authentication required" });
  }

  // --- CRM User: Create ticket ---
  app.post("/api/support-tickets", isAuthenticated, upload.array("screenshots", 5), async (req, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUserId = (req as any).session?.crmUserId;
      if (!crmUserId) return res.status(401).json({ message: "Unauthorized" });

      const { category, priority, subject, description } = req.body;
      if (!category || !subject || !description) {
        return res.status(400).json({ message: "Category, subject, and description are required" });
      }

      const attachmentUrls: string[] = [];
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          const mimeType = file.mimetype || "application/octet-stream";
          const dataUrl = `data:${mimeType};base64,${file.buffer.toString("base64")}`;
          attachmentUrls.push(dataUrl);
        }
      }

      const ticketNumber = await generateTicketNumber();
      const [ticket] = await db.insert(supportTickets).values({
        ticketNumber,
        tenantId: tid,
        crmUserId,
        category,
        priority: priority || "Medium",
        subject,
        description,
        attachments: attachmentUrls,
        status: "Open",
      }).returning();

      res.status(201).json(ticket);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  // --- CRM User: List my tickets (cross-tenant by same person's phone/email) ---
  app.get("/api/support-tickets", isAuthenticated, async (req, res) => {
    try {
      const crmUserId = (req as any).session?.crmUserId;
      if (!crmUserId) return res.status(401).json({ message: "Unauthorized" });

      const [currentUser] = await db.select({ phone: crmUsers.phone, email: crmUsers.email })
        .from(crmUsers).where(eq(crmUsers.id, crmUserId));

      let allMyUserIds: number[] = [crmUserId];
      if (currentUser) {
        const conditions: any[] = [];
        if (currentUser.phone) conditions.push(eq(crmUsers.phone, currentUser.phone));
        if (currentUser.email) conditions.push(eq(crmUsers.email, currentUser.email));
        if (conditions.length > 0) {
          const matchingUsers = await db.select({ id: crmUsers.id }).from(crmUsers)
            .where(or(...conditions));
          allMyUserIds = [...new Set(matchingUsers.map(u => u.id))];
        }
      }

      const tickets = await db.select().from(supportTickets)
        .where(inArray(supportTickets.crmUserId, allMyUserIds))
        .orderBy(sql`${supportTickets.createdAt} DESC`);

      const enriched = await Promise.all(tickets.map(async (t) => {
        let assignedName = null;
        if (t.assignedSupportUserId) {
          const [su] = await db.select().from(supportUsers).where(eq(supportUsers.id, t.assignedSupportUserId));
          if (su) assignedName = su.name;
        }
        const commentCount = await pool.query(
          `SELECT COUNT(*) as cnt FROM support_ticket_comments WHERE ticket_id = $1 AND is_internal = false`,
          [t.id]
        );
        let hospitalName = null;
        if (t.crmUserId !== crmUserId) {
          const tenantResult = await pool.query(`SELECT t.name FROM tenants t JOIN crm_users u ON u.tenant_id = t.id WHERE u.id = $1`, [t.crmUserId]);
          if (tenantResult.rows[0]) hospitalName = tenantResult.rows[0].name;
        }
        return { ...t, assignedName, hospitalName, commentCount: parseInt(commentCount.rows[0].cnt) };
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // --- CRM User: Get ticket detail (cross-tenant for same person) ---
  app.get("/api/support-tickets/:id", isAuthenticated, async (req, res) => {
    try {
      const crmUserId = (req as any).session?.crmUserId;
      const ticketId = Number(req.params.id);
      const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });

      let hasAccess = ticket.crmUserId === crmUserId || isSupportAdmin(req);
      if (!hasAccess) {
        const [currentUser] = await db.select({ phone: crmUsers.phone, email: crmUsers.email })
          .from(crmUsers).where(eq(crmUsers.id, crmUserId));
        if (currentUser) {
          const [ticketCreator] = await db.select({ phone: crmUsers.phone, email: crmUsers.email })
            .from(crmUsers).where(eq(crmUsers.id, ticket.crmUserId));
          if (ticketCreator) {
            hasAccess = !!(currentUser.phone && currentUser.phone === ticketCreator.phone) ||
                        !!(currentUser.email && currentUser.email === ticketCreator.email);
          }
        }
      }
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const comments = await db.select().from(supportTicketComments)
        .where(and(
          eq(supportTicketComments.ticketId, ticketId),
          isSupportAdmin(req) ? sql`1=1` : eq(supportTicketComments.isInternal, false)
        ))
        .orderBy(sql`${supportTicketComments.createdAt} ASC`);

      let assignedName = null;
      if (ticket.assignedSupportUserId) {
        const [su] = await db.select().from(supportUsers).where(eq(supportUsers.id, ticket.assignedSupportUserId));
        if (su) assignedName = su.name;
      }

      let createdByName = null;
      if (ticket.crmUserId !== crmUserId) {
        const [u] = await db.select({ name: crmUsers.name }).from(crmUsers).where(eq(crmUsers.id, ticket.crmUserId));
        if (u) createdByName = u.name;
      }

      res.json({ ...ticket, assignedName, createdByName, comments });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // --- CRM User: Add comment to ticket ---
  app.post("/api/support-tickets/:id/comments", isAuthenticated, upload.array("screenshots", 3), async (req, res) => {
    try {
      const crmUserId = (req as any).session?.crmUserId;
      const ticketId = Number(req.params.id);
      const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.crmUserId !== crmUserId) return res.status(403).json({ message: "Access denied" });

      const attachmentUrls: string[] = [];
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          const mimeType = file.mimetype || "application/octet-stream";
          const dataUrl = `data:${mimeType};base64,${file.buffer.toString("base64")}`;
          attachmentUrls.push(dataUrl);
        }
      }

      const allCrmUsers = await storage.getCrmUsers(ticket.tenantId);
      const crmUser = allCrmUsers.find(u => u.id === crmUserId);

      const [comment] = await db.insert(supportTicketComments).values({
        ticketId,
        authorType: "crm_user",
        authorId: crmUserId,
        authorName: (crmUser as any)?.name || "User",
        message: req.body.message,
        attachments: attachmentUrls,
        isInternal: false,
      }).returning();

      await db.update(supportTickets).set({ updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));
      res.status(201).json(comment);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  // Note: Support ticket attachments are now stored as base64 data URLs in the database
  // No filesystem serving needed — data URLs are embedded directly in the response

  // =============================================
  // SUPPORT ADMIN PORTAL
  // =============================================

  // --- Support Admin: Login ---
  app.post("/api/support-admin/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

      const [user] = await db.select().from(supportUsers)
        .where(and(eq(supportUsers.email, email), eq(supportUsers.isActive, true)));
      if (!user) return res.status(401).json({ message: "Invalid credentials" });

      const bcrypt = await import("bcryptjs");
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });

      (req.session as any).supportUserId = user.id;
      (req.session as any).supportUserRole = user.role;
      await db.update(supportUsers).set({ lastLoginAt: new Date() }).where(eq(supportUsers.id, user.id));

      const { passwordHash: _, ...safeUser } = user;
      res.json({ success: true, user: safeUser });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // --- Support Admin: Get current user ---
  app.get("/api/support-admin/me", requireSupportAuth, async (req, res) => {
    try {
      const userId = (req.session as any).supportUserId;
      const [user] = await db.select().from(supportUsers).where(eq(supportUsers.id, userId));
      if (!user) return res.status(401).json({ message: "Session expired" });
      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // --- Support Admin: Logout ---
  app.post("/api/support-admin/logout", (req, res) => {
    delete (req.session as any).supportUserId;
    delete (req.session as any).supportUserRole;
    res.json({ success: true });
  });

  // --- Support Admin: List all tickets ---
  app.get("/api/support-admin/tickets", requireSupportAuth, async (req, res) => {
    try {
      const supportUserId = (req.session as any).supportUserId;
      const supportRole = (req.session as any).supportUserRole;

      let ticketsQuery;
      if (supportRole === "support_admin") {
        ticketsQuery = await db.select().from(supportTickets).orderBy(sql`${supportTickets.createdAt} DESC`);
      } else {
        ticketsQuery = await db.select().from(supportTickets)
          .where(eq(supportTickets.assignedSupportUserId, supportUserId))
          .orderBy(sql`${supportTickets.createdAt} DESC`);
      }

      const enriched = await Promise.all(ticketsQuery.map(async (t) => {
        let assignedName = null;
        if (t.assignedSupportUserId) {
          const [su] = await db.select().from(supportUsers).where(eq(supportUsers.id, t.assignedSupportUserId));
          if (su) assignedName = su.name;
        }
        let crmUserName = null;
        const allCrmUsers = await storage.getCrmUsers(t.tenantId);
        const crmUser = allCrmUsers.find(u => u.id === t.crmUserId);
        if (crmUser) crmUserName = (crmUser as any).name;

        let tenantName = null;
        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, t.tenantId));
        if (tenant) tenantName = tenant.displayName || tenant.name;

        const commentCount = await pool.query(
          `SELECT COUNT(*) as cnt FROM support_ticket_comments WHERE ticket_id = $1`,
          [t.id]
        );
        return { ...t, assignedName, crmUserName, tenantName, commentCount: parseInt(commentCount.rows[0].cnt) };
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // --- Support Admin: Get ticket detail ---
  app.get("/api/support-admin/tickets/:id", requireSupportAuth, async (req, res) => {
    try {
      const ticketId = Number(req.params.id);
      const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });

      const comments = await db.select().from(supportTicketComments)
        .where(eq(supportTicketComments.ticketId, ticketId))
        .orderBy(sql`${supportTicketComments.createdAt} ASC`);

      let assignedName = null;
      if (ticket.assignedSupportUserId) {
        const [su] = await db.select().from(supportUsers).where(eq(supportUsers.id, ticket.assignedSupportUserId));
        if (su) assignedName = su.name;
      }
      let crmUserName = null;
      const allCrmUsers = await storage.getCrmUsers(ticket.tenantId);
      const crmUser = allCrmUsers.find(u => u.id === ticket.crmUserId);
      if (crmUser) crmUserName = (crmUser as any).name;

      let tenantName = null;
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, ticket.tenantId));
      if (tenant) tenantName = tenant.displayName || tenant.name;

      res.json({ ...ticket, assignedName, crmUserName, tenantName, comments });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // --- Support Admin: Update ticket (assign, status, priority) ---
  app.patch("/api/support-admin/tickets/:id", requireSupportAuth, async (req, res) => {
    try {
      const ticketId = Number(req.params.id);
      const body = req.body;
      const updateData: any = { updatedAt: new Date() };

      if (body.assignedSupportUserId !== undefined) updateData.assignedSupportUserId = body.assignedSupportUserId || null;
      if (body.status) {
        updateData.status = body.status;
        if (body.status === "Closed" || body.status === "Resolved") {
          updateData.closedAt = new Date();
        }
      }
      if (body.adminPriority) updateData.adminPriority = body.adminPriority;
      if (body.priority) updateData.priority = body.priority;

      const [updated] = await db.update(supportTickets).set(updateData)
        .where(eq(supportTickets.id, ticketId)).returning();
      if (!updated) return res.status(404).json({ message: "Ticket not found" });

      if (body.status || body.assignedSupportUserId !== undefined) {
        const supportUserId = (req.session as any).supportUserId;
        const [su] = await db.select().from(supportUsers).where(eq(supportUsers.id, supportUserId));
        const actionParts = [];
        if (body.status) actionParts.push(`changed status to "${body.status}"`);
        if (body.assignedSupportUserId !== undefined) {
          if (body.assignedSupportUserId) {
            const [assignee] = await db.select().from(supportUsers).where(eq(supportUsers.id, body.assignedSupportUserId));
            actionParts.push(`assigned to ${assignee?.name || "a team member"}`);
          } else {
            actionParts.push("unassigned ticket");
          }
        }
        if (body.adminPriority) actionParts.push(`set priority to "${body.adminPriority}"`);

        if (actionParts.length > 0) {
          await db.insert(supportTicketComments).values({
            ticketId,
            authorType: "support_user",
            authorId: supportUserId,
            authorName: su?.name || "Support",
            message: `[System] ${su?.name || "Support"} ${actionParts.join(", ")}`,
            isInternal: false,
          });
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  // --- Support Admin: Add comment to ticket ---
  app.post("/api/support-admin/tickets/:id/comments", requireSupportAuth, upload.array("screenshots", 3), async (req, res) => {
    try {
      const ticketId = Number(req.params.id);
      const supportUserId = (req.session as any).supportUserId;
      const [su] = await db.select().from(supportUsers).where(eq(supportUsers.id, supportUserId));

      const attachmentUrls: string[] = [];
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          const mimeType = file.mimetype || "application/octet-stream";
          const dataUrl = `data:${mimeType};base64,${file.buffer.toString("base64")}`;
          attachmentUrls.push(dataUrl);
        }
      }

      const [comment] = await db.insert(supportTicketComments).values({
        ticketId,
        authorType: "support_user",
        authorId: supportUserId,
        authorName: su?.name || "Support",
        message: req.body.message,
        attachments: attachmentUrls,
        isInternal: req.body.isInternal === true || req.body.isInternal === "true",
      }).returning();

      await db.update(supportTickets).set({ updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));
      res.status(201).json(comment);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  // --- Support Admin: List support users ---
  app.get("/api/support-admin/users", requireSupportAuth, async (req, res) => {
    try {
      const role = (req.session as any).supportUserRole;
      if (role !== "support_admin") return res.status(403).json({ message: "Admin access required" });
      const users = await db.select().from(supportUsers).orderBy(sql`${supportUsers.createdAt} DESC`);
      res.json(users.map(u => { const { passwordHash: _, ...safe } = u; return safe; }));
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // --- Support Admin: Create support user ---
  app.post("/api/support-admin/users", requireSupportAuth, async (req, res) => {
    try {
      const role = (req.session as any).supportUserRole;
      if (role !== "support_admin") return res.status(403).json({ message: "Admin access required" });

      const { name, email, phone, password, userRole } = req.body;
      if (!name || !email || !password) return res.status(400).json({ message: "Name, email, and password are required" });

      const [existing] = await db.select().from(supportUsers).where(eq(supportUsers.email, email));
      if (existing) return res.status(400).json({ message: "A user with this email already exists" });

      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash(password, 10);

      const [user] = await db.insert(supportUsers).values({
        name,
        email,
        phone: phone || null,
        passwordHash: hash,
        role: userRole || "support_agent",
      }).returning();

      const { passwordHash: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  // --- Support Admin: Update support user ---
  app.patch("/api/support-admin/users/:id", requireSupportAuth, async (req, res) => {
    try {
      const role = (req.session as any).supportUserRole;
      if (role !== "support_admin") return res.status(403).json({ message: "Admin access required" });

      const id = Number(req.params.id);
      const updateData: any = {};
      if (req.body.name) updateData.name = req.body.name;
      if (req.body.email) updateData.email = req.body.email;
      if (req.body.phone !== undefined) updateData.phone = req.body.phone;
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
      if (req.body.role) updateData.role = req.body.role;
      if (req.body.password) {
        const bcrypt = await import("bcryptjs");
        updateData.passwordHash = await bcrypt.hash(req.body.password, 10);
      }

      const [user] = await db.update(supportUsers).set(updateData)
        .where(eq(supportUsers.id, id)).returning();
      if (!user) return res.status(404).json({ message: "User not found" });

      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err: any) {
      res.status(400).json({ message: humanizeError(err) });
    }
  });

  // --- Seed default support admin (always enforce password) ---
  try {
    const bcrypt = await import("bcryptjs");
    const adminHash = await bcrypt.hash("HCRM@admin123", 10);
    const [existingAdmin] = await db.select().from(supportUsers)
      .where(eq(supportUsers.email, "support@rgbindia.com"));
    if (!existingAdmin) {
      await db.insert(supportUsers).values({
        name: "RGB Support Admin",
        email: "support@rgbindia.com",
        phone: "+919033050100",
        passwordHash: adminHash,
        role: "support_admin",
      });
      console.log("[seed] Default support admin created: support@rgbindia.com / HCRM@admin123");
    } else {
      await db.update(supportUsers).set({ passwordHash: adminHash }).where(eq(supportUsers.email, "support@rgbindia.com"));
      console.log("[seed] Support admin password enforced: support@rgbindia.com / HCRM@admin123");
    }
  } catch (err: any) {
    console.error("[seed] Error seeding support admin:", err.message);
  }

  // ─── RBAC: Role Permissions CRUD ─────────────────────────────────────────
  app.get("/api/admin/role-permissions", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser || !["SYS_ADMIN", "ADMIN"].includes(crmUser.roleCode)) {
        return res.status(403).json({ message: "Only Admin users can manage role permissions" });
      }
      const rows = await db.select().from(rolePermissions).where(eq(rolePermissions.tenantId, tid));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.put("/api/admin/role-permissions/:roleCode/:module", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser || !["SYS_ADMIN", "ADMIN"].includes(crmUser.roleCode)) {
        return res.status(403).json({ message: "Only Admin users can manage role permissions" });
      }
      const { roleCode, module } = req.params;
      const { canView, canCreate, canEdit, canDelete } = req.body;
      const [existing] = await db.select({ id: rolePermissions.id })
        .from(rolePermissions)
        .where(and(eq(rolePermissions.tenantId, tid), eq(rolePermissions.roleCode, roleCode), eq(rolePermissions.module, module)));
      if (existing) {
        const [updated] = await db.update(rolePermissions)
          .set({ canView: !!canView, canCreate: !!canCreate, canEdit: !!canEdit, canDelete: !!canDelete })
          .where(eq(rolePermissions.id, existing.id))
          .returning();
        return res.json(updated);
      }
      const [created] = await db.insert(rolePermissions)
        .values({ tenantId: tid, roleCode, module, canView: !!canView, canCreate: !!canCreate, canEdit: !!canEdit, canDelete: !!canDelete })
        .returning();
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // ─── RBAC: User Permission Overrides ────────────────────────────────────
  app.get("/api/admin/user-permission-overrides/:crmUserId", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser || !["SYS_ADMIN", "ADMIN"].includes(crmUser.roleCode)) {
        return res.status(403).json({ message: "Only Admin users can view permission overrides" });
      }
      const targetUserId = Number(req.params.crmUserId);
      const rows = await db.select().from(userPermissionOverrides)
        .where(and(eq(userPermissionOverrides.tenantId, tid), eq(userPermissionOverrides.crmUserId, targetUserId)));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/admin/user-permission-overrides", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser || !["SYS_ADMIN", "ADMIN"].includes(crmUser.roleCode)) {
        return res.status(403).json({ message: "Only Admin users can set permission overrides" });
      }
      const { crmUserId, module, action, isGranted, expiresAt, reason } = req.body;
      if (!crmUserId || !module || !action) {
        return res.status(400).json({ message: "crmUserId, module, and action are required" });
      }
      const [existing] = await db.select({ id: userPermissionOverrides.id })
        .from(userPermissionOverrides)
        .where(and(
          eq(userPermissionOverrides.tenantId, tid),
          eq(userPermissionOverrides.crmUserId, Number(crmUserId)),
          eq(userPermissionOverrides.module, module),
          eq(userPermissionOverrides.action, action)
        ));
      if (existing) {
        const [updated] = await db.update(userPermissionOverrides)
          .set({ isGranted: !!isGranted, expiresAt: expiresAt ? new Date(expiresAt) : null, reason: reason || null, createdBy: crmUser.id })
          .where(eq(userPermissionOverrides.id, existing.id))
          .returning();
        return res.json(updated);
      }
      const [created] = await db.insert(userPermissionOverrides)
        .values({
          tenantId: tid, crmUserId: Number(crmUserId), module, action,
          isGranted: !!isGranted, expiresAt: expiresAt ? new Date(expiresAt) : null,
          reason: reason || null, createdBy: crmUser.id
        })
        .returning();
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.delete("/api/admin/user-permission-overrides/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser || !["SYS_ADMIN", "ADMIN"].includes(crmUser.roleCode)) {
        return res.status(403).json({ message: "Only Admin users can remove permission overrides" });
      }
      const id = Number(req.params.id);
      await db.delete(userPermissionOverrides)
        .where(and(eq(userPermissionOverrides.id, id), eq(userPermissionOverrides.tenantId, tid)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // ─── In-App Notifications ─────────────────────────────────────────────────
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser) return res.status(403).json({ message: "Not authorized" });
      const rows = await db.select().from(inAppNotifications)
        .where(and(
          eq(inAppNotifications.tenantId, tid),
          eq(inAppNotifications.crmUserId, crmUser.id)
        ))
        .orderBy(desc(inAppNotifications.createdAt))
        .limit(50);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser) return res.json({ count: 0 });
      const [row] = await db.select({ count: count() }).from(inAppNotifications)
        .where(and(
          eq(inAppNotifications.tenantId, tid),
          eq(inAppNotifications.crmUserId, crmUser.id),
          eq(inAppNotifications.isRead, false)
        ));
      res.json({ count: Number(row?.count || 0) });
    } catch (err: any) {
      res.json({ count: 0 });
    }
  });

  app.post("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser) return res.status(403).json({ message: "Not authorized" });
      await db.update(inAppNotifications)
        .set({ isRead: true })
        .where(and(
          eq(inAppNotifications.id, Number(req.params.id)),
          eq(inAppNotifications.tenantId, tid),
          eq(inAppNotifications.crmUserId, crmUser.id)
        ));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser) return res.status(403).json({ message: "Not authorized" });
      await db.update(inAppNotifications)
        .set({ isRead: true })
        .where(and(
          eq(inAppNotifications.tenantId, tid),
          eq(inAppNotifications.crmUserId, crmUser.id),
          eq(inAppNotifications.isRead, false)
        ));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // ─── Discount Approver Configuration ────────────────────────────────────
  app.get("/api/admin/discount-approvers", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser || !["SYS_ADMIN", "ADMIN"].includes(crmUser.roleCode)) {
        return res.status(403).json({ message: "Only Admin users can view discount approvers" });
      }
      const rows = await db.select({
        id: tenantDiscountApprovers.id,
        crmUserId: tenantDiscountApprovers.crmUserId,
        name: crmUsers.name,
        email: crmUsers.email,
        designation: crmUsers.designation,
      })
        .from(tenantDiscountApprovers)
        .leftJoin(crmUsers, eq(crmUsers.id, tenantDiscountApprovers.crmUserId))
        .where(eq(tenantDiscountApprovers.tenantId, tid));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.post("/api/admin/discount-approvers", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser || !["SYS_ADMIN", "ADMIN"].includes(crmUser.roleCode)) {
        return res.status(403).json({ message: "Only Admin users can configure discount approvers" });
      }
      const { crmUserId } = req.body;
      if (!crmUserId) return res.status(400).json({ message: "crmUserId is required" });
      const [existing] = await db.select({ id: tenantDiscountApprovers.id })
        .from(tenantDiscountApprovers)
        .where(and(eq(tenantDiscountApprovers.tenantId, tid), eq(tenantDiscountApprovers.crmUserId, Number(crmUserId))));
      if (existing) return res.status(409).json({ message: "User is already a discount approver" });
      const [created] = await db.insert(tenantDiscountApprovers)
        .values({ tenantId: tid, crmUserId: Number(crmUserId) })
        .returning();
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  app.delete("/api/admin/discount-approvers/:crmUserId", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser || !["SYS_ADMIN", "ADMIN"].includes(crmUser.roleCode)) {
        return res.status(403).json({ message: "Only Admin users can configure discount approvers" });
      }
      await db.delete(tenantDiscountApprovers)
        .where(and(eq(tenantDiscountApprovers.tenantId, tid), eq(tenantDiscountApprovers.crmUserId, Number(req.params.crmUserId))));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  // ─── My Effective Permissions (for frontend canViewPage checks) ──────────
  app.get("/api/my-permissions", isAuthenticated, async (req: any, res) => {
    try {
      const tid = await getDefaultTenantId(req);
      const crmUser = await getSessionCrmUserWithRole(req);
      if (!crmUser) return res.status(403).json({ message: "Not authorized" });

      const MODULES = ["dashboard", "leads", "episodes", "appointments", "campaigns", "transactions", "team", "masters", "connectors", "branding", "settings", "quotation", "insurance", "reports"];
      const PERM_KEYS: Array<["view" | "create" | "edit" | "delete", "canView" | "canCreate" | "canEdit" | "canDelete"]> = [
        ["view", "canView"], ["create", "canCreate"], ["edit", "canEdit"], ["delete", "canDelete"],
      ];

      const result: Record<string, Record<string, boolean>> = {};
      for (const mod of MODULES) {
        result[mod] = {};
        for (const [key, action] of PERM_KEYS) {
          result[mod][key] = await hasPermission(req, mod, action);
        }
      }
      res.json({ roleCode: crmUser.roleCode, permissions: result });
    } catch (err: any) {
      res.status(500).json({ message: humanizeError(err) });
    }
  });

  await seedDatabase();
  await ensurePatientsForConvertedLeads();
  await ensureSuperAdmin();
  await clearStaleConnectorMetrics();
  await fixPendingApprovalStatus();
  await ensureLeadSourcesExist();
  await ensureRoomTypesExist();
  await ensureCostHeadsExist();
  await ensureCrmTeamDepartments();
  await consolidateDuplicateTeams();
  await migrateAgentToPatientCoordinator();
  await ensureAllCanonicalRolesSeeded();
  return httpServer;
}

// 11 tenant-assignable roles — SYS_ADMIN is deliberately excluded (developer-team only)
const CANONICAL_ROLE_CODES = [
  "ADMIN", "MANAGER", "COUNSELLOR", "PATIENT_COORDINATOR", "TELECALLER",
  "RECEPTIONIST", "DOCTOR", "MEDICAL_ASSISTANT", "BILLING", "INSURANCE_DESK",
  "MIS_VIEWER",
];

const CANONICAL_ROLE_DEFS: { code: string; name: string; displayOrder: number }[] = [
  { code: "ADMIN", name: "Admin", displayOrder: 1 },
  { code: "MANAGER", name: "Manager", displayOrder: 2 },
  { code: "PATIENT_COORDINATOR", name: "Patient Coordinator", displayOrder: 3 },
  { code: "COUNSELLOR", name: "Counsellor", displayOrder: 4 },
  { code: "TELECALLER", name: "Telecaller", displayOrder: 5 },
  { code: "RECEPTIONIST", name: "Receptionist", displayOrder: 6 },
  { code: "BILLING", name: "Billing", displayOrder: 7 },
  { code: "INSURANCE_DESK", name: "Insurance Desk", displayOrder: 8 },
  { code: "DOCTOR", name: "Doctor", displayOrder: 9 },
  { code: "MEDICAL_ASSISTANT", name: "Medical Assistant", displayOrder: 10 },
  { code: "MIS_VIEWER", name: "MIS Viewer", displayOrder: 11 },
];

async function ensureAllCanonicalRolesSeeded() {
  try {
    const allTenants = await pool.query(`SELECT id FROM tenants ORDER BY id`);
    for (const t of allTenants.rows) {
      const tid = t.id;
      // Ensure SYS_ADMIN is always Inactive in tenant system_roles (developer-team only)
      await pool.query(
        `UPDATE system_roles SET status = 'Inactive' WHERE tenant_id = $1 AND code = 'SYS_ADMIN' AND status != 'Inactive'`,
        [tid]
      );
      const existing = await pool.query(`SELECT code FROM system_roles WHERE tenant_id = $1 AND code != 'SYS_ADMIN'`, [tid]);
      const existingCodes = new Set(existing.rows.map((r: any) => r.code));
      for (const def of CANONICAL_ROLE_DEFS) {
        if (!existingCodes.has(def.code)) {
          await pool.query(
            `INSERT INTO system_roles (tenant_id, code, name, status, display_order, approval_status) VALUES ($1,$2,$3,'Active',$4,'Approved')`,
            [tid, def.code, def.name, def.displayOrder]
          );
          console.log(`[Roles] Seeded missing role '${def.code}' for tenant ${tid}`);
        } else {
          // Ensure existing canonical roles are Active and Approved
          await pool.query(
            `UPDATE system_roles SET status = 'Active', approval_status = 'Approved', name = $3, display_order = $4
             WHERE tenant_id = $1 AND code = $2`,
            [tid, def.code, def.name, def.displayOrder]
          );
        }
      }
    }
    console.log("[Roles] Canonical roles verified for all tenants");
  } catch (err: any) {
    console.error("[Roles] Error in ensureAllCanonicalRolesSeeded:", err.message);
  }
}

async function migrateAgentToPatientCoordinator() {
  try {
    const allTenants = await pool.query(`SELECT id FROM tenants ORDER BY id`);
    for (const t of allTenants.rows) {
      const tid = t.id;

      // Ensure PATIENT_COORDINATOR role exists for this tenant
      const [existingPc] = (await pool.query(
        `SELECT id FROM system_roles WHERE tenant_id = $1 AND code = 'PATIENT_COORDINATOR'`,
        [tid]
      )).rows;
      let pcRoleId: number;
      if (existingPc) {
        pcRoleId = existingPc.id;
      } else {
        const [inserted] = (await pool.query(
          `INSERT INTO system_roles (tenant_id, code, name, status, display_order) VALUES ($1, 'PATIENT_COORDINATOR', 'Patient Coordinator', 'Active', 4) RETURNING id`,
          [tid]
        )).rows;
        pcRoleId = inserted.id;
        console.log(`[Migration] Created PATIENT_COORDINATOR role for tenant ${tid}`);
      }

      // Find AGENT role for this tenant
      const [agentRole] = (await pool.query(
        `SELECT id FROM system_roles WHERE tenant_id = $1 AND code = 'AGENT'`,
        [tid]
      )).rows;
      if (agentRole) {
        const agentRoleId = agentRole.id;
        // Move all users from AGENT to PATIENT_COORDINATOR
        const updated = await pool.query(
          `UPDATE crm_users SET system_role_id = $1 WHERE tenant_id = $2 AND system_role_id = $3`,
          [pcRoleId, tid, agentRoleId]
        );
        if (updated.rowCount && updated.rowCount > 0) {
          console.log(`[Migration] Migrated ${updated.rowCount} user(s) from AGENT to PATIENT_COORDINATOR for tenant ${tid}`);
        }
        // Delete AGENT role (no users left referencing it)
        await pool.query(`DELETE FROM system_roles WHERE id = $1`, [agentRoleId]);
        console.log(`[Migration] Deleted AGENT role for tenant ${tid}`);
      }

      // Remove any non-canonical roles that have no users
      const nonCanonical = (await pool.query(
        `SELECT sr.id, sr.code, COUNT(cu.id) as user_count
         FROM system_roles sr
         LEFT JOIN crm_users cu ON cu.system_role_id = sr.id AND cu.tenant_id = $1
         WHERE sr.tenant_id = $1 AND sr.code NOT IN (${CANONICAL_ROLE_CODES.map((_, i) => `$${i + 2}`).join(",")})
         GROUP BY sr.id, sr.code`,
        [tid, ...CANONICAL_ROLE_CODES]
      )).rows;

      for (const row of nonCanonical) {
        if (parseInt(row.user_count, 10) === 0) {
          await pool.query(`DELETE FROM system_roles WHERE id = $1`, [row.id]);
          console.log(`[Migration] Removed unused non-canonical role '${row.code}' for tenant ${tid}`);
        } else {
          console.warn(`[Migration] WARNING: Non-canonical role '${row.code}' (tenant ${tid}) still has ${row.user_count} user(s) — not deleted`);
        }
      }

      // Seed role permissions for PATIENT_COORDINATOR if not already seeded
      for (const module of ["dashboard", "leads", "episodes", "appointments", "campaigns", "transactions", "team", "masters", "connectors", "branding", "settings", "quotation", "insurance", "reports"]) {
        const p = DEFAULT_ROLE_PERMISSIONS["PATIENT_COORDINATOR"]?.[module] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
        await db.insert(rolePermissions)
          .values({ tenantId: tid, roleCode: "PATIENT_COORDINATOR", module, canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete })
          .onConflictDoNothing();
      }
      // Remove any AGENT role_permissions rows
      await pool.query(`DELETE FROM role_permissions WHERE tenant_id = $1 AND role_code = 'AGENT'`, [tid]);

      // Update any other tables storing 'AGENT' as a role_code string
      await pool.query(`UPDATE lead_merge_roles SET role_code = 'PATIENT_COORDINATOR' WHERE tenant_id = $1 AND role_code = 'AGENT'`, [tid]);
      await pool.query(`UPDATE clinical_notes_edit_roles SET role_code = 'PATIENT_COORDINATOR' WHERE tenant_id = $1 AND role_code = 'AGENT'`, [tid]);

      // Straggler check: verify no crm_users remain pointing to an AGENT system_role via system_role_id
      // Note: crm_users has no direct role_code column — role code is derived from the system_roles FK join
      const stragglers = (await pool.query(
        `SELECT COUNT(*) as cnt FROM crm_users cu
         JOIN system_roles sr ON cu.system_role_id = sr.id
         WHERE cu.tenant_id = $1 AND sr.code = 'AGENT'`,
        [tid]
      )).rows[0];
      if (parseInt(stragglers.cnt, 10) > 0) {
        console.warn(`[Migration] WARNING: ${stragglers.cnt} crm_user(s) in tenant ${tid} still reference an AGENT system_role via system_role_id`);
      } else {
        console.log(`[Migration] Verified: 0 crm_users in tenant ${tid} reference an AGENT system_role`);
      }

      // Count active users now correctly assigned to PATIENT_COORDINATOR (verification)
      const pcUserCount = (await pool.query(
        `SELECT COUNT(*) as cnt FROM crm_users cu
         JOIN system_roles sr ON cu.system_role_id = sr.id
         WHERE cu.tenant_id = $1 AND sr.code = 'PATIENT_COORDINATOR' AND cu.is_active = true`,
        [tid]
      )).rows[0];
      if (parseInt(pcUserCount.cnt, 10) > 0) {
        console.log(`[Migration] Tenant ${tid}: ${pcUserCount.cnt} active user(s) assigned to PATIENT_COORDINATOR`);
      }
    }
    console.log("[Migration] AGENT → PATIENT_COORDINATOR migration complete");
  } catch (err) {
    console.error("[Migration] Error during AGENT → PATIENT_COORDINATOR migration:", err);
  }
}

async function ensureSuperAdmin() {
  try {
    const { hashPassword } = await import("./replit_integrations/auth/replitAuth");
    const allTenantRows = await db.select().from(tenants);
    if (allTenantRows.length === 0) return;
    const virocRow = allTenantRows.find(t => t.id === 4);
    const tid = virocRow ? virocRow.id : allTenantRows[0].id;

    const virocTenant = allTenantRows.find(t => t.id === 4);
    if (virocTenant && virocTenant.name !== "Viroc Super Specialty Orthopaedic Hospital") {
      await db.update(tenants).set({ name: "Viroc Super Specialty Orthopaedic Hospital", displayName: "Viroc Super Specialty Orthopaedic Hospital" }).where(eq(tenants.id, 4));
      console.log("Renamed tenant #4 to Viroc Super Specialty Orthopaedic Hospital");
    }

    if (virocTenant) {
      const virocBranch = await db.select().from(branches).where(and(eq(branches.id, 1), eq(branches.tenantId, 4)));
      if (virocBranch.length > 0 && virocBranch[0].name !== "Viroc Main Branch") {
        await db.update(branches).set({ name: "Viroc Main Branch" }).where(eq(branches.id, 1));
      }
    }

    const demoUsers = [
      { code: "DEMO-ADM", name: "Dr. Anil Mehta", email: "admin@demohospital.com", phone: "+919876500001", roleCode: "ADMIN" },
      { code: "DEMO-MGR", name: "Neha Kapoor", email: "manager@demohospital.com", phone: "+919876500002", roleCode: "MANAGER" },
      { code: "DEMO-AGT", name: "Ravi Joshi", email: "agent@demohospital.com", phone: "+919876500003", roleCode: "PATIENT_COORDINATOR" },
      { code: "DEMO-CNS", name: "Priya Desai", email: "counsellor@demohospital.com", phone: "+919876500004", roleCode: "COUNSELLOR" },
      { code: "NEHA-S", name: "Neha Sharma", email: "neha.sharma@viroc.in", phone: "+919227473123", roleCode: "MANAGER" },
    ];
    if (virocTenant) {
      const virocRoles = await db.select().from(systemRoles).where(eq(systemRoles.tenantId, 4));
      const roleMap: Record<string, number> = {};
      for (const r of virocRoles) roleMap[(r as any).code] = r.id;
      const existingDemoUsers = await db.select().from(crmUsers).where(eq(crmUsers.tenantId, 4));
      for (const du of demoUsers) {
        const exists = existingDemoUsers.find(u => u.code === du.code || u.phone === du.phone);
        if (!exists && roleMap[du.roleCode]) {
          const hash = await hashPassword("RGBTech@123");
          await db.insert(crmUsers).values({
            tenantId: 4, code: du.code, name: du.name, email: du.email, phone: du.phone,
            systemRoleId: roleMap[du.roleCode], branchId: 1, isActive: true, status: "Active",
            accessScopeType: ["ADMIN", "MANAGER"].includes(du.roleCode) ? "All" : "Branch",
            phiAccessLevel: ["ADMIN"].includes(du.roleCode) ? "Full" : "Masked",
            passwordHash: hash, displayOrder: 0,
          });
          console.log(`Created demo user: ${du.name} (${du.roleCode})`);
        }
      }
    }

    const phone = "+919033050100";
    const adminEmail = "support@rgbindia.com";
    const defaultPassword = "Sys_Admin@RGBTech";

    // Find by phone first, then by email
    let existingUsers = await db.select().from(crmUsers).where(
      and(eq(crmUsers.phone, phone), eq(crmUsers.tenantId, tid))
    );
    if (existingUsers.length === 0) {
      existingUsers = await db.select().from(crmUsers).where(
        and(eq(crmUsers.email, adminEmail), eq(crmUsers.tenantId, tid))
      );
    }

    if (existingUsers.length > 0) {
      const updates: Record<string, any> = {};
      // Always enforce email and password
      if (existingUsers[0].email !== adminEmail) updates.email = adminEmail;
      updates.passwordHash = await hashPassword(defaultPassword);
      const sysAdminRole = await db.select().from(systemRoles).where(
        and(eq(systemRoles.code, "SYS_ADMIN"), eq(systemRoles.tenantId, tid))
      );
      if (sysAdminRole.length > 0 && existingUsers[0].systemRoleId !== sysAdminRole[0].id) {
        updates.systemRoleId = sysAdminRole[0].id;
      }
      await db.update(crmUsers).set(updates).where(eq(crmUsers.id, existingUsers[0].id));
      console.log(`[seed] Super Admin enforced: ${adminEmail} / ${defaultPassword}`);
    } else {
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
        email: adminEmail,
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
    }

    // --- Emergency: Unlock Neha Sharma + reset password ---
    try {
      const nehaNormalized = "+919227473123";
      const [nehaUser] = await db.select().from(crmUsers).where(
        and(eq(crmUsers.phone, nehaNormalized), eq(crmUsers.tenantId, 4))
      );
      if (nehaUser) {
        await db.update(crmUsers).set({
          failedLoginAttempts: 0,
          lockedUntil: null,
          isActive: true,
          status: "Active",
          passwordHash: await hashPassword("RGBTech@123"),
        }).where(eq(crmUsers.id, nehaUser.id));
        console.log(`[seed] Neha Sharma (id=${nehaUser.id}) unlocked & password reset to RGBTech@123`);
      }
    } catch (e) {
      console.error("[seed] Failed to unlock Neha Sharma:", e);
    }

    // --- Ensure all "All-scope" ADMIN users have a valid ADMIN systemRoleId ---
    try {
      const allTenantsList = await db.select().from(tenants);
      for (const tenant of allTenantsList) {
        const [adminRole] = await db.select().from(systemRoles).where(
          and(eq(systemRoles.tenantId, tenant.id), eq(systemRoles.code, "ADMIN"))
        );
        if (!adminRole) continue;
        // Find active users in this tenant who have accessScopeType "All" but no systemRoleId or wrong role
        const wideUsers = await db.select().from(crmUsers).where(
          and(eq(crmUsers.tenantId, tenant.id), eq(crmUsers.accessScopeType, "All"), eq(crmUsers.isActive, true))
        );
        for (const u of wideUsers) {
          if (u.systemRoleId !== adminRole.id) {
            // Skip SYS_ADMIN users — they have their own role
            if (u.systemRoleId) {
              const [existingRole] = await db.select().from(systemRoles).where(eq(systemRoles.id, u.systemRoleId));
              if (existingRole?.code === "SYS_ADMIN") continue;
            }
            await db.update(crmUsers).set({ systemRoleId: adminRole.id }).where(eq(crmUsers.id, u.id));
            console.log(`[seed] Assigned ADMIN role to ${u.name} (id=${u.id}, tenant=${tenant.id})`);
          }
        }
      }
    } catch (e) {
      console.error("[seed] Failed to assign ADMIN roles:", e);
    }

    const allUsers = await db.select().from(crmUsers).where(eq(crmUsers.status, "Active"));
    let fixedCount = 0;
    for (const user of allUsers) {
      const updates: Record<string, any> = {};
      if (user.phone && !user.phone.startsWith("+91") && user.phone.replace(/\D/g, "").length === 10) {
        updates.phone = "+91" + user.phone.replace(/\D/g, "");
      }
      if (Object.keys(updates).length > 0) {
        await db.update(crmUsers).set(updates).where(eq(crmUsers.id, user.id));
        fixedCount++;
      }
    }
    if (fixedCount > 0) console.log(`Fixed ${fixedCount} CRM user(s) (phone format)`);
  } catch (err) {
    console.error("Error ensuring super admin:", err);
  }
}

async function ensureLeadSourcesExist() {
  try {
    const allTenants = await db.select().from(tenants);
    const newSources = [
      { code: "DIRECT_CRM", name: "Direct (CRM Entry)" },
      { code: "WALK_IN", name: "Walk-In" },
    ];
    for (const tenant of allTenants) {
      for (const src of newSources) {
        const existing = await db.select().from(leadSources)
          .where(and(eq(leadSources.tenantId, tenant.id), eq(leadSources.code, src.code)));
        if (existing.length === 0) {
          await db.insert(leadSources).values({
            tenantId: tenant.id, code: src.code, name: src.name,
            status: "Active", displayOrder: 99, approvalStatus: "Approved",
          });
        }
      }
    }
  } catch (err) {
    console.error("Error ensuring lead sources:", err);
  }
}

async function ensureRoomTypesExist() {
  try {
    const allTenants = await db.select().from(tenants);
    const defaultRoomTypes = [
      { code: "GENERAL", name: "General", order: 1 },
      { code: "SEMI_SPL", name: "Semi-Special", order: 2 },
      { code: "SMALL_AC_SPL", name: "Small AC Special", order: 3 },
      { code: "AC_SPECIAL", name: "AC Special", order: 4 },
      { code: "DELUXE", name: "Deluxe", order: 5 },
      { code: "SUITE", name: "Suite", order: 6 },
    ];
    for (const tenant of allTenants) {
      for (const rt of defaultRoomTypes) {
        const existing = await db.select().from(roomTypes)
          .where(and(eq(roomTypes.tenantId, tenant.id), eq(roomTypes.code, rt.code)));
        if (existing.length === 0) {
          await db.insert(roomTypes).values({
            tenantId: tenant.id, code: rt.code, name: rt.name,
            status: "Active", displayOrder: rt.order, approvalStatus: "Approved",
          });
        }
      }
    }
  } catch (err) {
    console.error("Error ensuring room types:", err);
  }
}

async function ensureCostHeadsExist() {
  try {
    const allTenants = await db.select().from(tenants);
    const commonCostHeads = [
      { code: "HOSPITAL_BILL", name: "Hospital Bill", order: 1 },
      { code: "IMPLANT_BILL", name: "Implant Bill", order: 2 },
      { code: "MEDICINE", name: "Medicine", order: 3 },
      { code: "PRE_OP", name: "Pre-Op Investigation", order: 4 },
      { code: "PHYSIO", name: "Physiotherapy", order: 5 },
      { code: "EXTRA_MEDICAL", name: "Extra Medical Management", order: 6 },
      { code: "SURGEON_FEE", name: "Surgeon Fee", order: 7 },
      { code: "ANAESTHESIA", name: "Anaesthesia Charges", order: 8 },
      { code: "OT_CHARGES", name: "OT / Operation Theatre Charges", order: 9 },
      { code: "ICU_CHARGES", name: "ICU Charges", order: 10 },
      { code: "ROOM_RENT", name: "Room Rent", order: 11 },
      { code: "NURSING", name: "Nursing Charges", order: 12 },
      { code: "BLOOD_BANK", name: "Blood Bank Charges", order: 13 },
      { code: "CONSUMABLES", name: "Consumables & Disposables", order: 14 },
      { code: "DIAGNOSTIC", name: "Diagnostic / Imaging", order: 15 },
      { code: "LAB_CHARGES", name: "Laboratory Charges", order: 16 },
      { code: "CONSULTATION", name: "Consultation Fee", order: 17 },
      { code: "MISC", name: "Miscellaneous", order: 18 },
    ];
    for (const tenant of allTenants) {
      for (const ch of commonCostHeads) {
        const existing = await db.select().from(costHeads)
          .where(and(eq(costHeads.tenantId, tenant.id), eq(costHeads.code, ch.code)));
        if (existing.length === 0) {
          await db.insert(costHeads).values({
            tenantId: tenant.id, code: ch.code, name: ch.name,
            status: "Active", displayOrder: ch.order, approvalStatus: "Approved",
          });
        }
      }
    }

    const specialtyCostHeads: Record<string, { code: string; name: string; order: number }[]> = {
      "JOINT_REPL": [
        { code: "JR_PROSTHESIS", name: "Joint Prosthesis / Implant", order: 20 },
        { code: "JR_REHAB", name: "Post-Surgery Rehabilitation", order: 21 },
      ],
      "SPINE_SURG": [
        { code: "SP_CAGE_SCREWS", name: "Spine Cages & Pedicle Screws", order: 20 },
        { code: "SP_NEURO_MON", name: "Neuro Monitoring", order: 21 },
      ],
      "SPORTS_INJ": [
        { code: "SI_ARTHROSCOPY", name: "Arthroscopy Equipment", order: 20 },
        { code: "SI_SPORTS_REHAB", name: "Sports Rehabilitation", order: 21 },
      ],
      "TRAUMA": [
        { code: "TR_FIXATION", name: "Fracture Fixation Hardware", order: 20 },
        { code: "TR_CAST", name: "Cast / Splint Material", order: 21 },
      ],
      "PAIN_MGMT": [
        { code: "PM_INJECTION", name: "Pain Block / Injection", order: 20 },
        { code: "PM_THERAPY", name: "Pain Therapy Sessions", order: 21 },
      ],
      "FOOT_ANKLE": [
        { code: "FA_ORTHOTICS", name: "Custom Orthotics / Insoles", order: 20 },
      ],
      "CARDIO": [
        { code: "CD_STENT", name: "Stent / Cardiac Implant", order: 20 },
        { code: "CD_CATHLAB", name: "Cath Lab Charges", order: 21 },
      ],
      "NEURO": [
        { code: "NR_NEURO_IMG", name: "Neuro Imaging (MRI/CT)", order: 20 },
      ],
      "GEN_SURG": [
        { code: "GS_LAPAROSCOPY", name: "Laparoscopy Equipment", order: 20 },
      ],
      "INT_MED": [
        { code: "IM_IV_THERAPY", name: "IV Therapy / Infusion", order: 20 },
      ],
      "PAED": [
        { code: "PD_NICU", name: "NICU Charges", order: 20 },
      ],
      "DERM": [
        { code: "DR_PROCEDURE", name: "Derma Procedure Charges", order: 20 },
      ],
    };

    for (const tenant of allTenants) {
      const depts = await db.select().from(treatmentDepartments)
        .where(eq(treatmentDepartments.tenantId, tenant.id));
      for (const dept of depts) {
        const deptCostHeads = specialtyCostHeads[(dept as any).code];
        if (!deptCostHeads) continue;
        for (const ch of deptCostHeads) {
          const existing = await db.select().from(costHeads)
            .where(and(
              eq(costHeads.tenantId, tenant.id),
              eq(costHeads.code, ch.code),
            ));
          if (existing.length === 0) {
            await db.insert(costHeads).values({
              tenantId: tenant.id, code: ch.code, name: ch.name,
              treatmentDepartmentId: dept.id,
              status: "Active", displayOrder: ch.order, approvalStatus: "Approved",
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("Error ensuring cost heads:", err);
  }
}

async function ensureCrmTeamDepartments() {
  try {
    const allTenants = await db.select().from(tenants);
    const teamDepts = [
      { code: "TELECALLING", name: "Telecalling", displayOrder: 7 },
      { code: "FINANCIAL", name: "Financial Counselling", displayOrder: 8 },
      { code: "INSURANCE", name: "Insurance & TPA", displayOrder: 9 },
      { code: "OT_IP", name: "OT / IP Desk", displayOrder: 10 },
      { code: "POST_CARE", name: "Post Care", displayOrder: 11 },
      { code: "REFERRAL", name: "Referral Management", displayOrder: 12 },
      { code: "MGMT", name: "Management", displayOrder: 13 },
    ];
    for (const tenant of allTenants) {
      for (const dept of teamDepts) {
        const existing = await db.select().from(administrativeDepartments)
          .where(and(eq(administrativeDepartments.tenantId, tenant.id), eq(administrativeDepartments.code, dept.code)));
        if (existing.length === 0) {
          await db.insert(administrativeDepartments).values({
            tenantId: tenant.id, code: dept.code, name: dept.name,
            status: "Active", displayOrder: dept.displayOrder, approvalStatus: "Approved",
          });
        }
      }
    }
  } catch (err) {
    console.error("Error ensuring CRM team departments:", err);
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

async function consolidateDuplicateTeams() {
  try {
    const allTenants = await db.select().from(tenants);
    const nameMap: Record<string, string> = {
      "telecaller": "TELECALLING",
      "telecalling": "TELECALLING",
      "financial counselling": "FINANCIAL",
      "financial counseling": "FINANCIAL",
      "insurance & tpa": "INSURANCE",
      "insurance": "INSURANCE",
      "ot / ip desk": "OT_IP",
      "ot/ip desk": "OT_IP",
      "post care": "POST_CARE",
      "referral management": "REFERRAL",
      "management": "MGMT",
      "marketing": "MKT",
      "sales": "SALES",
      "hr": "HR",
      "it": "IT",
      "accounts": "ACCT",
      "front office": "FO",
      "opd": "FO",
    };

    for (const tenant of allTenants) {
      const allDepts = await db.select().from(administrativeDepartments)
        .where(eq(administrativeDepartments.tenantId, tenant.id));

      const adptEntries = allDepts.filter(d => d.code?.startsWith("ADPT-"));
      if (adptEntries.length === 0) continue;

      for (const oldEntry of adptEntries) {
        const normalizedName = (oldEntry.name || "").toLowerCase().trim();
        const targetCode = nameMap[normalizedName];
        if (!targetCode) continue;

        const targetEntry = allDepts.find(d => d.code === targetCode && d.id !== oldEntry.id);
        if (!targetEntry) continue;

        console.log(`[dedup] Tenant ${tenant.id}: Merging team "${oldEntry.name}" (${oldEntry.code}, id=${oldEntry.id}) → "${targetEntry.name}" (${targetEntry.code}, id=${targetEntry.id})`);

        await pool.query(`UPDATE crm_users SET department_id = $1 WHERE department_id = $2 AND tenant_id = $3`, [targetEntry.id, oldEntry.id, tenant.id]);
        await pool.query(`UPDATE doctors SET treatment_department_id = $1 WHERE treatment_department_id = $2 AND tenant_id = $3`, [targetEntry.id, oldEntry.id, tenant.id]);
        await pool.query(`UPDATE leads SET treatment_department_id = $1 WHERE treatment_department_id = $2 AND tenant_id = $3`, [targetEntry.id, oldEntry.id, tenant.id]);
        await pool.query(`UPDATE episodes SET treatment_department_id = $1 WHERE treatment_department_id = $2 AND tenant_id = $3`, [targetEntry.id, oldEntry.id, tenant.id]);

        await db.update(administrativeDepartments)
          .set({ status: "Inactive" })
          .where(eq(administrativeDepartments.id, oldEntry.id));
      }
    }
    console.log("Consolidated duplicate ADPT-* teams");
  } catch (err) {
    console.error("Error consolidating duplicate teams:", err);
  }
}

async function backfillMobileNormalized() {
  try {
    const result = await pool.query(`
      SELECT id, phone_e164 FROM leads 
      WHERE phone_e164 IS NOT NULL AND phone_e164 != '' 
      AND (mobile_normalized IS NULL OR mobile_normalized = '')
    `);
    if (result.rows.length === 0) return;
    
    let count = 0;
    for (const row of result.rows) {
      let cleaned = row.phone_e164.replace(/[\s\-\(\)\.]/g, "");
      if (cleaned.startsWith("00")) cleaned = "+" + cleaned.slice(2);
      if (!cleaned.startsWith("+")) {
        if (cleaned.length === 10) cleaned = "+91" + cleaned;
        else if (cleaned.startsWith("91") && cleaned.length === 12) cleaned = "+" + cleaned;
        else cleaned = "+91" + cleaned;
      }
      await pool.query(`UPDATE leads SET mobile_normalized = $1 WHERE id = $2`, [cleaned, row.id]);
      count++;
    }
    if (count > 0) console.log(`[backfill] Set mobile_normalized for ${count} leads`);
  } catch (err) {
    console.error("Error backfilling mobile_normalized:", err);
  }
}

async function backfillLeadOwnershipAndSource() {
  try {
    const tenantsResult = await pool.query(`SELECT id FROM tenants WHERE subscription_status = 'Active'`);
    for (const tenant of tenantsResult.rows) {
      const tid = tenant.id;

      const defaultAdmin = await pool.query(
        `SELECT cu.id, cu.name
         FROM crm_users cu 
         JOIN system_roles sr ON cu.system_role_id = sr.id
         WHERE cu.tenant_id = $1 AND cu.is_active = true AND sr.code IN ('ADMIN', 'SYS_ADMIN', 'MANAGER')
         ORDER BY CASE sr.code WHEN 'ADMIN' THEN 1 WHEN 'SYS_ADMIN' THEN 2 WHEN 'MANAGER' THEN 3 END
         LIMIT 1`,
        [tid]
      );
      const fallbackUser = defaultAdmin.rows[0] || null;

      if (fallbackUser) {
        const teamName = "Telecalling";
        const ownerResult = await pool.query(
          `UPDATE leads SET 
            assigned_crm_user_id = COALESCE(assigned_crm_user_id, $2),
            primary_owner_user_id = COALESCE(primary_owner_user_id, $2),
            owner_team = COALESCE(NULLIF(owner_team, ''), $3)
          WHERE tenant_id = $1 
            AND (assigned_crm_user_id IS NULL OR primary_owner_user_id IS NULL OR owner_team IS NULL OR owner_team = '')
            AND (merge_status IS NULL OR merge_status = 'ACTIVE')`,
          [tid, fallbackUser.id, teamName]
        );
        if (ownerResult.rowCount && ownerResult.rowCount > 0) {
          console.log(`[backfill] Set ownership for ${ownerResult.rowCount} leads in tenant ${tid} (fallback: ${fallbackUser.name})`);
        }
      }

      const callyzerSourceResult = await pool.query(
        `SELECT id FROM lead_sources WHERE tenant_id = $1 AND LOWER(name) = 'callyzer' LIMIT 1`, [tid]
      );
      const callyzerSourceId = callyzerSourceResult.rows[0]?.id;

      if (callyzerSourceId) {
        const callyzerUpdated = await pool.query(
          `UPDATE leads SET lead_source_id = $2
           WHERE tenant_id = $1 AND lead_source_id IS NULL
           AND (merge_status IS NULL OR merge_status = 'ACTIVE')
           AND (tags ILIKE '%callyzer%' OR id IN (
             SELECT DISTINCT lead_id FROM activities 
             WHERE tenant_id = $1 AND metadata::text ILIKE '%callyzer%' AND lead_id IS NOT NULL
           ))`,
          [tid, callyzerSourceId]
        );
        if (callyzerUpdated.rowCount && callyzerUpdated.rowCount > 0) {
          console.log(`[backfill] Set Callyzer source for ${callyzerUpdated.rowCount} leads in tenant ${tid}`);
        }
      }

      const directSourceResult = await pool.query(
        `SELECT id FROM lead_sources WHERE tenant_id = $1 AND code = 'DIRECT_CRM' LIMIT 1`, [tid]
      );
      const directSourceId = directSourceResult.rows[0]?.id;

      if (directSourceId) {
        const directUpdated = await pool.query(
          `UPDATE leads SET lead_source_id = $2
           WHERE tenant_id = $1 AND lead_source_id IS NULL
           AND (merge_status IS NULL OR merge_status = 'ACTIVE')`,
          [tid, directSourceId]
        );
        if (directUpdated.rowCount && directUpdated.rowCount > 0) {
          console.log(`[backfill] Set Direct CRM source for ${directUpdated.rowCount} remaining leads in tenant ${tid}`);
        }
      }
    }
  } catch (err: any) {
    console.error("[backfill] Error backfilling lead ownership/source:", err.message);
  }
}

export async function runDeferredStartupTasks() {
  try {
    await autoBulkMergeDuplicates();
    await backfillMobileNormalized();
    await backfillLeadOwnershipAndSource();
    await linkUnlinkedEpisodePatients();
    await seedConsultationOutcomes();
    await seedGovernanceMasterData();
    await seedDummyAppointments();
  } catch (err: any) {
    console.error("[deferred-startup] Error in deferred tasks:", err.message);
  }
}

async function linkUnlinkedEpisodePatients() {
  try {
    const unlinkedResult = await pool.query(`
      SELECT e.id AS episode_id, e.lead_id, e.tenant_id, e.patient_id AS ep_patient_id,
             l.patient_id AS lead_patient_id, l.name AS lead_name, l.phone_e164
      FROM episodes e
      JOIN leads l ON e.lead_id = l.id AND e.tenant_id = l.tenant_id
      WHERE e.patient_id IS NULL
    `);
    if (unlinkedResult.rows.length === 0) return;

    let linked = 0;
    let created = 0;
    for (const row of unlinkedResult.rows) {
      let patientId = row.lead_patient_id;

      if (!patientId) {
        const existingPatient = await pool.query(
          `SELECT id FROM patients WHERE primary_phone = $1 AND tenant_id = $2 LIMIT 1`,
          [row.phone_e164, row.tenant_id]
        );
        if (existingPatient.rows.length > 0) {
          patientId = existingPatient.rows[0].id;
        } else {
          const nameParts = (row.lead_name || "Patient").trim().split(/\s+/);
          const firstName = nameParts[0] || "Patient";
          const lastName = nameParts.slice(1).join(" ") || "";

          const lastPatient = await pool.query(
            `SELECT id FROM patients WHERE tenant_id = $1 ORDER BY id DESC LIMIT 1`, [row.tenant_id]
          );
          const nextNum = (lastPatient.rows[0]?.id || 0) + 1;
          const uhid = `PAT_${String(nextNum).padStart(4, "0")}`;

          const newPatient = await pool.query(
            `INSERT INTO patients (tenant_id, uhid, first_name, last_name, primary_phone, status, created_by)
             VALUES ($1, $2, $3, $4, $5, 'Active', 'system') RETURNING id`,
            [row.tenant_id, uhid, firstName, lastName || null, row.phone_e164]
          );
          patientId = newPatient.rows[0].id;
          created++;
        }

        await pool.query(`UPDATE leads SET patient_id = $1 WHERE id = $2`, [patientId, row.lead_id]);
      }

      await pool.query(`UPDATE episodes SET patient_id = $1 WHERE id = $2`, [patientId, row.episode_id]);
      linked++;
    }

    if (linked > 0) {
      console.log(`Linked ${linked} episodes to patients (${created} new patients created)`);
    }
  } catch (err: any) {
    console.error("Error linking unlinked episode patients:", err.message);
  }
}

async function autoBulkMergeDuplicates() {
  try {
    const tenantsResult = await pool.query(`SELECT DISTINCT tenant_id FROM leads WHERE merge_status = 'ACTIVE'`);
    for (const { tenant_id: tid } of tenantsResult.rows) {
      const dupeResult = await pool.query(
        `WITH dupe_phones AS (
           SELECT phone_e164, COUNT(*) as cnt
           FROM leads
           WHERE phone_e164 IS NOT NULL AND phone_e164 != ''
             AND tenant_id = $1
             AND merge_status = 'ACTIVE'
           GROUP BY phone_e164
           HAVING COUNT(*) > 1
         )
         SELECT l.id, l.name, l.phone_e164, l.status, l.created_at,
           (SELECT COUNT(*) FROM activities a WHERE a.lead_id = l.id
            AND a.type NOT IN ('status_change','temperature_change','lead_created')) as real_acts,
           (SELECT COUNT(*) FROM appointments ap WHERE ap.lead_id = l.id) as appts,
           (SELECT COUNT(*) FROM episodes e WHERE e.lead_id = l.id) as eps
         FROM leads l
         JOIN dupe_phones dp ON l.phone_e164 = dp.phone_e164
         WHERE l.tenant_id = $1 AND l.merge_status = 'ACTIVE'
         ORDER BY l.phone_e164, l.created_at ASC`,
        [tid]
      );

      if (dupeResult.rows.length === 0) continue;

      const groupedByPhone: Record<string, any[]> = {};
      for (const row of dupeResult.rows) {
        if (!groupedByPhone[row.phone_e164]) groupedByPhone[row.phone_e164] = [];
        groupedByPhone[row.phone_e164].push(row);
      }

      const STATUS_PRIORITY: Record<string, number> = {
        "Closed Won": 10, "Consultation Done": 9, "Reminder Running": 8,
        "Appointment Booked": 7, "Qualified": 6, "Contacted": 5,
        "Raw Lead Captured": 1, "Nurture": 3, "Closed Lost": 2, "Unqualified": 0,
      };

      let mergedCount = 0;
      for (const [phone, leads] of Object.entries(groupedByPhone)) {
        if (leads.length < 2) continue;

        const sorted = leads.sort((a: any, b: any) => {
          const aPri = (STATUS_PRIORITY[a.status] || 0);
          const bPri = (STATUS_PRIORITY[b.status] || 0);
          if (aPri !== bPri) return bPri - aPri;
          const aEng = Number(a.real_acts) + Number(a.appts) * 10 + Number(a.eps) * 20;
          const bEng = Number(b.real_acts) + Number(b.appts) * 10 + Number(b.eps) * 20;
          if (aEng !== bEng) return bEng - aEng;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        const primary = sorted[0];
        const toMerge = sorted.slice(1);
        const mergedIds = toMerge.map((l: any) => l.id);

        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          const directFkTables = [
            { name: "activities", col: "lead_id" },
            { name: "tasks", col: "lead_id" },
            { name: "episodes", col: "lead_id" },
            { name: "appointments", col: "lead_id" },
            { name: "temperature_logs", col: "lead_id" },
            { name: "callyzer_webhook_logs", col: "matched_lead_id" },
          ];

          for (const t of directFkTables) {
            await client.query(
              `UPDATE ${t.name} SET ${t.col} = $1 WHERE ${t.col} = ANY($2) AND tenant_id = $3`,
              [primary.id, mergedIds, tid]
            );
          }

          await client.query(
            `UPDATE handover_logs SET entity_id = $1 WHERE entity_type = 'Lead' AND entity_id = ANY($2) AND tenant_id = $3`,
            [primary.id, mergedIds, tid]
          );
          await client.query(
            `UPDATE audit_logs SET entity_id = $1 WHERE entity_type = 'lead' AND entity_id = ANY($2) AND tenant_id = $3`,
            [primary.id, mergedIds, tid]
          );

          await client.query(
            `UPDATE leads SET merge_status = 'MERGED', merged_into_lead_id = $1,
             merged_at = NOW(), merged_by = 'System (Auto-Merge)', updated_at = NOW()
             WHERE id = ANY($2) AND tenant_id = $3`,
            [primary.id, mergedIds, tid]
          );

          await client.query(
            `INSERT INTO lead_merge_audits (tenant_id, primary_lead_id, merged_lead_ids, merge_strategy,
             field_decisions, moved_record_counts, merged_by, notes)
             VALUES ($1, $2, $3, 'BULK_AUTO_STARTUP', '{}', '{}', 'System', $4)`,
            [tid, primary.id, JSON.stringify(mergedIds),
             `Auto-merge on startup: ${mergedIds.length} duplicate(s) merged into #${primary.id}`]
          );

          await client.query(
            `INSERT INTO activities (tenant_id, lead_id, type, description, created_by)
             VALUES ($1, $2, 'note', $3, $4)`,
            [tid, primary.id,
             `Auto-merge: ${mergedIds.length} duplicate lead(s) [${mergedIds.join(", ")}] merged into this lead.`,
             "System"]
          );

          await client.query("COMMIT");
          mergedCount += mergedIds.length;
        } catch (txErr: any) {
          await client.query("ROLLBACK");
          console.error(`[auto-merge] Error merging phone ${phone}:`, txErr.message);
        } finally {
          client.release();
        }
      }

      if (mergedCount > 0) {
        console.log(`[auto-merge] Tenant ${tid}: Merged ${mergedCount} duplicate leads across ${Object.keys(groupedByPhone).length} groups`);
      }
    }
  } catch (err: any) {
    console.error("[auto-merge] Error:", err.message);
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

async function seedConsultationOutcomes() {
  try {
    const existing = await pool.query(`SELECT COUNT(*) as cnt FROM consultation_outcomes`);
    if (parseInt(existing.rows[0].cnt, 10) > 0) return;

    const tenants = await pool.query(`SELECT id FROM tenants ORDER BY id`);
    for (const tenant of tenants.rows) {
      const tid = tenant.id;

      await pool.query(`
        INSERT INTO consultation_outcomes (tenant_id, code, name, closes_episode, closes_as, display_order)
        VALUES 
          ($1, 'TREATMENT_RECOMMENDED', 'Treatment Recommended', false, NULL, 1),
          ($1, 'FOLLOWUP_REQUIRED', 'Follow-up Required', false, NULL, 2),
          ($1, 'CONSERVATIVE_TREATMENT', 'Conservative Treatment', true, 'Closed Won', 3),
          ($1, 'REFERRED', 'Referred to Another Doctor', false, NULL, 4),
          ($1, 'NO_TREATMENT_REQUIRED', 'No Treatment Required', true, 'Closed Won', 5),
          ($1, 'PATIENT_DID_NOT_PROCEED', 'Patient Did Not Proceed', true, 'Closed Lost', 6)
        ON CONFLICT DO NOTHING
      `, [tid]);

      const remarksData = [
        ['TREATMENT_RECOMMENDED', 'TR_CONSIDERING', 'Treatment discussed, patient considering', 1],
        ['TREATMENT_RECOMMENDED', 'TR_ESTIMATE', 'Treatment plan explained, estimate to be shared', 2],
        ['TREATMENT_RECOMMENDED', 'TR_AGREED', 'Patient agreed, booking to be done', 3],
        ['TREATMENT_RECOMMENDED', 'TR_FAMILY', 'Patient wants family consultation first', 4],
        ['TREATMENT_RECOMMENDED', 'TR_COST_CONCERN', 'Cost concern, exploring insurance/payment options', 5],
        ['TREATMENT_RECOMMENDED', 'TR_SECOND_OPINION', 'Patient wants a second opinion', 6],
        ['FOLLOWUP_REQUIRED', 'FU_REPORTS', 'Awaiting investigation/test reports', 1],
        ['FOLLOWUP_REQUIRED', 'FU_MEDICATION', 'Review after medication course', 2],
        ['FOLLOWUP_REQUIRED', 'FU_POSTOP', 'Post-procedure/surgery follow-up', 3],
        ['FOLLOWUP_REQUIRED', 'FU_PROGRESS', 'Review to assess treatment progress', 4],
        ['FOLLOWUP_REQUIRED', 'FU_ADDITIONAL', 'Additional investigations needed', 5],
        ['CONSERVATIVE_TREATMENT', 'CT_MEDICATION', 'Medication prescribed, rest advised', 1],
        ['CONSERVATIVE_TREATMENT', 'CT_PHYSIO', 'Physiotherapy/rehabilitation recommended', 2],
        ['CONSERVATIVE_TREATMENT', 'CT_MANAGEMENT', 'Pain/symptom management plan given', 3],
        ['CONSERVATIVE_TREATMENT', 'CT_SUPPORT', 'Support/brace/aid advised', 4],
        ['CONSERVATIVE_TREATMENT', 'CT_LIFESTYLE', 'Lifestyle/diet changes recommended', 5],
        ['REFERRED', 'REF_SPECIALIST', 'Referred to specialist within hospital', 1],
        ['REFERRED', 'REF_EXTERNAL', 'Referred to external specialist/hospital', 2],
        ['REFERRED', 'REF_DIAGNOSTICS', 'Referred for advanced diagnostics', 3],
        ['NO_TREATMENT_REQUIRED', 'NTR_CLEAR', 'Routine check-up, all clear', 1],
        ['NO_TREATMENT_REQUIRED', 'NTR_MINOR', 'Minor issue, self-resolving', 2],
        ['NO_TREATMENT_REQUIRED', 'NTR_CONFIRMED', 'Second opinion — confirmed no intervention needed', 3],
        ['NO_TREATMENT_REQUIRED', 'NTR_RESOLVED', 'Previously treated condition fully resolved', 4],
        ['PATIENT_DID_NOT_PROCEED', 'DNP_DECLINED', 'Patient declined recommended treatment', 1],
        ['PATIENT_DID_NOT_PROCEED', 'DNP_COST', 'Unable to afford treatment', 2],
        ['PATIENT_DID_NOT_PROCEED', 'DNP_ELSEWHERE', 'Chose treatment at another facility', 3],
        ['PATIENT_DID_NOT_PROCEED', 'DNP_WALKAWAY', 'Patient left without decision', 4],
        ['PATIENT_DID_NOT_PROCEED', 'DNP_PERSONAL', 'Personal/family reasons', 5],
      ];

      for (const [outcomeCode, code, name, order] of remarksData) {
        await pool.query(`
          INSERT INTO consultation_outcome_remarks (tenant_id, outcome_code, code, name, display_order)
          VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING
        `, [tid, outcomeCode, code, name, order]);
      }
    }
    console.log("[seed] Consultation outcomes & remarks seeded for all tenants");
  } catch (err: any) {
    console.error("[seed] Error seeding consultation outcomes:", err.message);
  }
}

async function seedGovernanceMasterData() {
  try {
    const allTenants = await pool.query(`SELECT id FROM tenants ORDER BY id`);
    for (const t of allTenants.rows) {
      const tid = t.id;

      const existing = await pool.query(`SELECT COUNT(*) as cnt FROM sla_rules WHERE tenant_id = $1`, [tid]);
      if (parseInt(existing.rows[0].cnt, 10) > 0) continue;

      await db.insert(slaRules).values([
        { tenantId: tid, code: "SLA-LEAD-CONTACT", name: "Lead First Contact SLA", triggerEvent: "Lead Created → First Contact Attempt", timeLimitMinutes: 30, appliesToRole: "PATIENT_COORDINATOR", escalationRole: "MANAGER", status: "Active", displayOrder: 1 },
        { tenantId: tid, code: "SLA-LEAD-QUALIFY", name: "Lead Qualification SLA", triggerEvent: "Lead Contacted → Qualified", timeLimitMinutes: 1440, appliesToRole: "COUNSELLOR", escalationRole: "MANAGER", status: "Active", displayOrder: 2 },
        { tenantId: tid, code: "SLA-APPT-BOOK", name: "Appointment Booking SLA", triggerEvent: "Lead Qualified → Appointment Booked", timeLimitMinutes: 2880, appliesToRole: "COUNSELLOR", escalationRole: "MANAGER", status: "Active", displayOrder: 3 },
        { tenantId: tid, code: "SLA-HANDOVER-ACK", name: "Handover Acknowledgement SLA", triggerEvent: "Episode Handover → Acknowledged by Takeover Team", timeLimitMinutes: 120, appliesToRole: "All", escalationRole: "ADMIN", status: "Active", displayOrder: 4 },
        { tenantId: tid, code: "SLA-CONSULT-LOG", name: "Consultation Log SLA", triggerEvent: "Consultation Done → Log Submitted by Doctor", timeLimitMinutes: 480, appliesToRole: "All", escalationRole: "ADMIN", status: "Active", displayOrder: 5 },
        { tenantId: tid, code: "SLA-TREAT-PLAN", name: "Treatment Plan SLA", triggerEvent: "Consultation Done → Treatment Plan Created", timeLimitMinutes: 1440, appliesToRole: "COUNSELLOR", escalationRole: "MANAGER", status: "Active", displayOrder: 6 },
        { tenantId: tid, code: "SLA-NOSHOW-FOLLOW", name: "No-Show Follow-up SLA", triggerEvent: "Appointment No-Show → Follow-up Call", timeLimitMinutes: 240, appliesToRole: "PATIENT_COORDINATOR", escalationRole: "MANAGER", status: "Active", displayOrder: 7 },
        { tenantId: tid, code: "SLA-DORMANT-REACT", name: "Dormant Lead Reactivation SLA", triggerEvent: "Lead Marked Dormant → Reactivation Attempt", timeLimitMinutes: 10080, appliesToRole: "PATIENT_COORDINATOR", escalationRole: "MANAGER", status: "Active", displayOrder: 8 },
      ]);

      await db.insert(reminderPolicies).values([
        { tenantId: tid, code: "REM-APPT-24H", name: "Appointment Reminder – 24 Hours Before", offsetMinutes: 1440, channel: "WhatsApp", fallbackChannel: "SMS", status: "Active", displayOrder: 1 },
        { tenantId: tid, code: "REM-APPT-2H", name: "Appointment Reminder – 2 Hours Before", offsetMinutes: 120, channel: "SMS", fallbackChannel: "WhatsApp", status: "Active", displayOrder: 2 },
        { tenantId: tid, code: "REM-FOLLOWUP-48H", name: "Follow-up Reminder – 48 Hours Before", offsetMinutes: 2880, channel: "WhatsApp", fallbackChannel: "Email", status: "Active", displayOrder: 3 },
        { tenantId: tid, code: "REM-SURGERY-72H", name: "Surgery Prep Reminder – 72 Hours Before", offsetMinutes: 4320, channel: "WhatsApp", fallbackChannel: "SMS", status: "Active", displayOrder: 4 },
        { tenantId: tid, code: "REM-SURGERY-DAY", name: "Surgery Day Reminder – Morning", offsetMinutes: 180, channel: "SMS", fallbackChannel: "WhatsApp", status: "Active", displayOrder: 5 },
        { tenantId: tid, code: "REM-POSTCARE-7D", name: "Post-Care Check-in – 7 Days After", offsetMinutes: 10080, channel: "WhatsApp", fallbackChannel: "Email", status: "Active", displayOrder: 6 },
        { tenantId: tid, code: "REM-POSTCARE-30D", name: "Post-Care Follow-up – 30 Days After", offsetMinutes: 43200, channel: "Email", fallbackChannel: "WhatsApp", status: "Active", displayOrder: 7 },
      ]);

      await db.insert(dataRetentionPolicies).values([
        { tenantId: tid, code: "DRP-LEAD-36M", name: "Lead Data – 36 Months (DPDP Act)", entityType: "Lead", retentionMonths: 36, action: "anonymize", status: "Active", displayOrder: 1 },
        { tenantId: tid, code: "DRP-PATIENT-120M", name: "Patient Records – 10 Years (MCI Guidelines)", entityType: "Patient", retentionMonths: 120, action: "archive", status: "Active", displayOrder: 2 },
        { tenantId: tid, code: "DRP-EPISODE-120M", name: "Episode/Treatment Records – 10 Years", entityType: "Episode", retentionMonths: 120, action: "archive", status: "Active", displayOrder: 3 },
        { tenantId: tid, code: "DRP-ACTIVITY-24M", name: "Activity Logs – 24 Months", entityType: "Activity", retentionMonths: 24, action: "archive", status: "Active", displayOrder: 4 },
        { tenantId: tid, code: "DRP-TASK-12M", name: "Task Records – 12 Months", entityType: "Task", retentionMonths: 12, action: "delete", status: "Active", displayOrder: 5 },
        { tenantId: tid, code: "DRP-APPT-36M", name: "Appointment Records – 36 Months", entityType: "Appointment", retentionMonths: 36, action: "archive", status: "Active", displayOrder: 6 },
      ]);
    }
    console.log("[seed] Governance master data (SLA Rules, Reminder Policies, Data Retention) seeded for all tenants");
  } catch (err: any) {
    console.error("[seed] Error seeding governance data:", err.message);
  }
}

async function seedDummyAppointments() {
  try {
    const existingCheck = await pool.query(`
      SELECT COUNT(*) as cnt FROM appointments
      WHERE appointment_date >= CURRENT_DATE AND appointment_date < CURRENT_DATE + 7
    `);
    const existingCount = parseInt(existingCheck.rows[0].cnt, 10);
    if (existingCount >= 100) {
      return;
    }

    const tenants = await pool.query(`SELECT id FROM tenants ORDER BY id`);

    for (const tenant of tenants.rows) {
      const tid = tenant.id;

      const doctorSlots = await pool.query(`
        SELECT ot.doctor_id, d.name AS doctor_name, ot.day_of_week, ot.start_time, ot.end_time, ot.max_patients
        FROM opd_timings ot
        JOIN doctors d ON ot.doctor_id = d.id AND d.tenant_id = $1
        WHERE ot.status = 'Active' AND ot.tenant_id = $1 AND d.status = 'Active'
        ORDER BY ot.doctor_id, ot.start_time
      `, [tid]);

      if (doctorSlots.rows.length === 0) continue;

      const leadsResult = await pool.query(`
        SELECT id, name, phone_e164 FROM leads WHERE tenant_id = $1 ORDER BY id
      `, [tid]);

      let allLeadIds = leadsResult.rows.map((r: any) => r.id);

      const firstNames = ['Aarav','Vivaan','Aditya','Vihaan','Arjun','Sai','Reyansh','Ayaan','Krishna','Ishaan',
        'Ananya','Diya','Myra','Sara','Aanya','Riya','Priya','Meera','Nisha','Tara',
        'Rohan','Karan','Nikhil','Amit','Vikram','Anil','Sunil','Mohan','Ravi','Ajay',
        'Neeta','Seema','Rekha','Sonal','Hetal','Janvi','Swati','Preeti','Komal','Vaishali',
        'Bharat','Hardik','Chirag','Jayesh','Mehul','Nilesh','Paresh','Tushar','Umesh','Yogesh',
        'Divya','Gauri','Isha','Jaya','Lata','Manju','Nandini','Padma','Radha','Savita',
        'Alpesh','Bhavin','Dhruv','Gaurav','Hitesh','Jigar','Ketan','Lalit','Mukesh','Naresh',
        'Bharti','Chetna','Deepa','Ekta','Falguni','Gita','Harsha','Ila','Jigna','Kamini',
        'Ashwin','Biren','Chetan','Dinesh','Falgun','Girish','Hemant','Inder','Janak','Kamlesh',
        'Leena','Madhuri','Nirmala','Parul','Pushpa','Rupa','Shanti','Usha','Vandana','Yamuna',
        'Akash','Darshan','Eshan','Farhan','Gopal','Hari','Ishwar','Jagdish','Kishor','Sudhir',
        'Laxmi','Mamta','Nita','Pallavi','Rita','Sapna','Taruna','Uma','Vijaya','Anjana',
        'Ashok','Baldev','Chandresh','Devang','Firoz','Gautam','Harish','Ishan','Jiten','Kirit',
        'Ankur','Bimal','Dipak','Gagan','Hiren','Jayant','Kundan','Laxman','Manan','Nayan',
        'Om','Pravin','Rajat','Sachin','Tarun','Utpal','Varun','Yash','Arun','Bipin',
        'Chandra','Dev','Gorav','Hemang','Jai','Kuntal','Lakhan','Mayur','Naval','Ojas',
        'Prem','Ritesh','Sagar','Tejas','Uday','Mala','Nidhi','Pankaj','Rajni','Saroj',
        'Trupti','Urvi','Zarna','Alka','Bindu','Chhaya','Damini','Esha','Garima','Heena',
        'Indira','Juhi','Kruti','Latika','Mansi','Neha','Payal','Riddhi','Siddhi','Tanvi',
        'Urvashi','Vidya','Zeel','Aasha'];
      const lastNames = ['Patel','Shah','Mehta','Desai','Joshi','Parikh','Trivedi','Chauhan','Solanki','Modi',
        'Rathod','Vaghela','Parmar','Thakor','Pandya','Dave','Bhatt','Sharma','Thakkar','Amin',
        'Raval','Soni','Mistry','Gajjar','Kadia','Prajapati','Makwana','Dabhi','Barot','Nagar'];

      const neededLeads = 320;
      if (allLeadIds.length < neededLeads) {
        const toCreate = neededLeads - allLeadIds.length;
        for (let i = 0; i < toCreate; i++) {
          const fn = firstNames[i % firstNames.length];
          const ln = lastNames[(i * 7) % lastNames.length];
          const phone = `+91${7000000000 + i * 13 + (i % 97)}`;
          try {
            const insertResult = await pool.query(`
              INSERT INTO leads (tenant_id, name, phone_e164, mobile_normalized, status, created_at)
              VALUES ($1, $2, $3, $3, 'Appointment Booked', NOW() - ($4 || ' days')::interval)
              RETURNING id
            `, [tid, `${fn} ${ln}`, phone, (i % 30).toString()]);
            allLeadIds.push(insertResult.rows[0].id);
          } catch {
          }
        }
        console.log(`[seed] Created ${allLeadIds.length - leadsResult.rows.length} new leads for tenant ${tid}`);
      }

      const apptTypeResult = await pool.query(`
        SELECT id, name FROM appointment_types WHERE tenant_id = $1 AND status = 'Active' ORDER BY id LIMIT 5
      `, [tid]);
      const firstConsultId = apptTypeResult.rows.find((r: any) => r.name.includes('First'))?.id || apptTypeResult.rows[0]?.id;
      const followUpId = apptTypeResult.rows.find((r: any) => r.name.includes('Follow'))?.id || firstConsultId;

      const branchResult = await pool.query(`SELECT id FROM branches WHERE tenant_id = $1 AND status = 'Active' ORDER BY id LIMIT 1`, [tid]);
      const branchId = branchResult.rows[0]?.id || 1;

      const dayMap: Record<string, number> = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
      const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

      let leadIdx = 0;
      let totalCreated = 0;

      for (let d = 0; d < 7; d++) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + d);
        const dayName = dayNames[targetDate.getDay()];
        const dateStr = targetDate.toISOString().split('T')[0];

        const daySlots = doctorSlots.rows.filter((s: any) => s.day_of_week === dayName);
        for (const slot of daySlots) {
          const leaveCheck = await pool.query(`
            SELECT 1 FROM doctor_leave_exceptions
            WHERE doctor_id = $1 AND status = 'Active'
              AND leave_date <= $2::date AND (leave_end_date IS NULL OR leave_end_date >= $2::date)
            LIMIT 1
          `, [slot.doctor_id, dateStr]);
          if (leaveCheck.rows.length > 0) continue;

          const targetTokens = Math.max(1, Math.floor(slot.max_patients * 0.6));

          const startParts = slot.start_time.split(':');
          const endParts = slot.end_time.split(':');
          const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
          const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
          const slotDuration = endMinutes - startMinutes;
          const timeInterval = Math.max(5, Math.floor(slotDuration / targetTokens));

          for (let t = 0; t < targetTokens; t++) {
            leadIdx = (leadIdx + 1) % allLeadIds.length;
            const apptMinutes = startMinutes + t * timeInterval;
            const hours = Math.floor(apptMinutes / 60).toString().padStart(2, '0');
            const mins = (apptMinutes % 60).toString().padStart(2, '0');
            const startTime = `${hours}:${mins}`;
            const typeId = Math.random() < 0.7 ? firstConsultId : followUpId;

            try {
              await pool.query(`
                INSERT INTO appointments (tenant_id, lead_id, doctor_id, branch_id, appointment_type_id,
                  appointment_date, start_time, token_number, status, booked_by, created_at, notes)
                VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, 'Scheduled', 'system', NOW(),
                  $9)
              `, [tid, allLeadIds[leadIdx], slot.doctor_id, branchId, typeId,
                  dateStr, startTime, t + 1,
                  `Test appointment - ${slot.doctor_name}`]);
              totalCreated++;
            } catch {
            }
          }
        }
      }

      if (totalCreated > 0) {
        await pool.query(`
          UPDATE leads SET status = 'Appointment Booked', last_activity_at = NOW()
          WHERE id IN (
            SELECT DISTINCT lead_id FROM appointments
            WHERE tenant_id = $1 AND status = 'Scheduled'
              AND appointment_date >= CURRENT_DATE
          ) AND tenant_id = $1
          AND status NOT IN ('Appointment Booked', 'Consultation Done', 'Closed Won', 'Closed Lost')
        `, [tid]);

        const unlinked = await pool.query(`
          SELECT DISTINCT l.id, l.name, l.phone_e164
          FROM leads l
          JOIN appointments a ON a.lead_id = l.id AND a.tenant_id = l.tenant_id
          WHERE l.tenant_id = $1 AND l.patient_id IS NULL AND a.appointment_date >= CURRENT_DATE
        `, [tid]);

        for (const row of unlinked.rows) {
          try {
            let patientId: number | null = null;
            const existing = await pool.query(
              `SELECT id FROM patients WHERE primary_phone = $1 AND tenant_id = $2 LIMIT 1`,
              [row.phone_e164, tid]
            );
            if (existing.rows.length > 0) {
              patientId = existing.rows[0].id;
            } else {
              const nameParts = (row.name || 'Patient').trim().split(/\s+/);
              const lastPat = await pool.query(`SELECT id FROM patients WHERE tenant_id = $1 ORDER BY id DESC LIMIT 1`, [tid]);
              const nextNum = (lastPat.rows[0]?.id || 0) + 1;
              const uhid = `PAT_${String(nextNum).padStart(4, '0')}`;
              const insertPat = await pool.query(`
                INSERT INTO patients (tenant_id, uhid, first_name, last_name, primary_phone, status)
                VALUES ($1, $2, $3, $4, $5, 'Active') RETURNING id
              `, [tid, uhid, nameParts[0], nameParts.slice(1).join(' ') || '', row.phone_e164]);
              patientId = insertPat.rows[0].id;
            }
            await pool.query(`UPDATE leads SET patient_id = $1 WHERE id = $2`, [patientId, row.id]);
            await pool.query(`UPDATE appointments SET patient_id = $1 WHERE lead_id = $2 AND tenant_id = $3 AND patient_id IS NULL`,
              [patientId, row.id, tid]);
          } catch {
          }
        }

        console.log(`[seed] Created ${totalCreated} dummy appointments for tenant ${tid} (next 7 days, ~60% fill)`);
      }
    }
  } catch (err: any) {
    console.error("[seed] Error seeding dummy appointments:", err.message);
  }
}
