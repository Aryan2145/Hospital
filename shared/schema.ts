import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb, time, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";

// =============================================
// TENANTS
// =============================================
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subdomain: text("subdomain").notNull().unique(),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  displayName: text("display_name"),
  primaryColor: text("primary_color").default('#005b9f'),
  secondaryColor: text("secondary_color").default('#f0f7fc'),
  subscriptionStatus: text("subscription_status").notNull().default("Active"),
  onboardedAt: timestamp("onboarded_at").defaultNow(),
  contactPerson: text("contact_person"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tenantUsers = pgTable("tenant_users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default('agent'),
});

export const tenantSettings = pgTable("tenant_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  settingKey: text("setting_key").notNull(),
  settingValue: text("setting_value"),
  settingType: text("setting_type").default("string"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  modifiedAt: timestamp("modified_at").defaultNow(),
});

export const tenantDomains = pgTable("tenant_domains", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  domain: text("domain").notNull().unique(),
  isPrimary: boolean("is_primary").default(false),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =============================================
// CATEGORY 1: LOCATION MASTERS
// =============================================
export const countries = pgTable("countries", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const states = pgTable("states", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  countryId: integer("country_id").notNull().references(() => countries.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  stateId: integer("state_id").notNull().references(() => states.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const pinCodes = pgTable("pin_codes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  cityId: integer("city_id").notNull().references(() => cities.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const areas = pgTable("areas", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  cityId: integer("city_id").notNull().references(() => cities.id),
  pinCodeId: integer("pin_code_id").references(() => pinCodes.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  pinCode: text("pin_code"),
  serviceable: boolean("serviceable").default(true),
  defaultNearestBranchId: integer("default_nearest_branch_id").references(() => branches.id),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const branchServiceability = pgTable("branch_serviceability", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  branchId: integer("branch_id"),
  areaId: integer("area_id").references(() => areas.id),
  priority: integer("priority").default(1),
  serviceType: text("service_type"),
  pinCodeId: integer("pin_code_id").references(() => pinCodes.id),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

// =============================================
// CATEGORY 2: ORGANISATION MASTERS
// =============================================
export const organisations = pgTable("organisations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  organisationId: integer("organisation_id").references(() => organisations.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  cityId: integer("city_id").references(() => cities.id),
  address: text("address"),
  phone: text("phone"),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const administrativeDepartments = pgTable("administrative_departments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});


export const designations = pgTable("designations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const employmentTypes = pgTable("employment_types", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const systemRoles = pgTable("system_roles", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const crmUsers = pgTable("crm_users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  passwordHash: text("password_hash"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  branchId: integer("branch_id").references(() => branches.id),
  departmentId: integer("department_id").references(() => administrativeDepartments.id),
  designationId: integer("designation_id").references(() => designations.id),
  employmentTypeId: integer("employment_type_id").references(() => employmentTypes.id),
  systemRoleId: integer("system_role_id").references(() => systemRoles.id),
  reportingTo: integer("reporting_to"),
  accessScopeType: text("access_scope_type").notNull().default("Self"),
  phiAccessLevel: text("phi_access_level").notNull().default("None"),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lockedUntil: timestamp("locked_until"),
  lastLoginAt: timestamp("last_login_at"),
  joiningDate: timestamp("joining_date"),
  isActive: boolean("is_active").notNull().default(true),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const callingLines = pgTable("calling_lines", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  phoneNumber: text("phone_number"),
  provider: text("provider"),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const userLineAssignments = pgTable("user_line_assignments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  crmUserId: integer("crm_user_id").notNull().references(() => crmUsers.id),
  callingLineId: integer("calling_line_id").notNull().references(() => callingLines.id),
  isPrimary: boolean("is_primary").default(false),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Pending"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

// =============================================
// CATEGORY 3: TREATMENT MASTERS
// =============================================
export const treatmentDepartments = pgTable("treatment_departments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});


export const consultationTypes = pgTable("consultation_types", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  treatmentDepartmentId: integer("treatment_department_id").references(() => treatmentDepartments.id),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

// =============================================
// CATEGORY 4: DOCTORS MASTERS
// =============================================
export const doctors = pgTable("doctors", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  qualification: text("qualification"),
  specialization: text("specialization"),
  branchId: integer("branch_id").references(() => branches.id),
  treatmentDepartmentId: integer("treatment_department_id").references(() => treatmentDepartments.id),
  consultationTypeId: integer("consultation_type_id").references(() => consultationTypes.id),
  phone: text("phone"),
  email: text("email"),
  status: text("status").notNull().default("Active"),
  approvalStatus: text("approval_status").default("Approved"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const opdTimings = pgTable("opd_timings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  branchId: integer("branch_id").references(() => branches.id),
  dayOfWeek: text("day_of_week").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  maxPatients: integer("max_patients"),
  slotDuration: integer("slot_duration"),
  status: text("status").notNull().default("Active"),
  approvalStatus: text("approval_status").default("Approved"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const doctorLeaveExceptions = pgTable("doctor_leave_exceptions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: varchar("code").notNull().default(""),
  name: varchar("name").notNull().default(""),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  leaveDate: timestamp("leave_date").notNull(),
  leaveEndDate: timestamp("leave_end_date"),
  reason: text("reason"),
  status: text("status").notNull().default("Active"),
  approvalStatus: text("approval_status").default("Approved"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});


// =============================================
// CATEGORY 5: LEAD GENERATION MASTERS
// =============================================
export const leadSourceCategories = pgTable("lead_source_categories", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const leadSources = pgTable("lead_sources", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  categoryId: integer("category_id").references(() => leadSourceCategories.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const campaignChannels = pgTable("campaign_channels", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const utmSources = pgTable("utm_sources", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const utmMediums = pgTable("utm_mediums", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const utmCampaigns = pgTable("utm_campaigns", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const utmTerms = pgTable("utm_terms", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const utmContents = pgTable("utm_contents", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const referrers = pgTable("referrers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: text("type"),
  phone: text("phone"),
  email: text("email"),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const corporateInsurances = pgTable("corporate_insurances", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: text("type"),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const leadCreationChannels = pgTable("lead_creation_channels", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

// =============================================
// CATEGORY 6: CONSULTATION MASTERS
// =============================================
export const appointmentTypes = pgTable("appointment_types", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const conversionStages = pgTable("conversion_stages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  sequence: integer("sequence").default(0),
  isTerminal: boolean("is_terminal").default(false),
  isBusinessAchieved: boolean("is_business_achieved").default(false),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const lostReasons = pgTable("lost_reasons", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const noShowReasons = pgTable("no_show_reasons", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

// =============================================
// CATEGORY 7: ACTIVITY MASTERS
// =============================================
export const activityTypes = pgTable("activity_types", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const nextActionTypes = pgTable("next_action_types", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const taskCategories = pgTable("task_categories", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const leadStatuses = pgTable("lead_statuses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  sequence: integer("sequence").default(0),
  isTerminal: boolean("is_terminal").default(false),
  isBusinessAchieved: boolean("is_business_achieved").default(false),
  requiresNextTask: boolean("requires_next_task").default(true),
  allowNurtureOption: boolean("allow_nurture_option").default(false),
  defaultOwnerRole: text("default_owner_role"),
  requiredFieldsJson: jsonb("required_fields_json"),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const appointmentStatuses = pgTable("appointment_statuses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const referralStatuses = pgTable("referral_statuses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const callStatuses = pgTable("call_statuses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const callDirections = pgTable("call_directions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

// =============================================
// CATEGORY 8: COMMUNICATION MASTERS
// =============================================
export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  channel: text("channel"),
  subject: text("subject"),
  body: text("body"),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const holidays = pgTable("holidays", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  holidayDate: timestamp("holiday_date"),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  color: text("color"),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

// =============================================
// CATEGORY 9: GOVERNANCE MASTERS
// =============================================
export const slaRules = pgTable("sla_rules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  triggerEvent: text("trigger_event").notNull(),
  timeLimitMinutes: integer("time_limit_minutes").notNull(),
  appliesToRole: text("applies_to_role"),
  escalationRole: text("escalation_role"),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const reminderPolicies = pgTable("reminder_policies", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  offsetMinutes: integer("offset_minutes").notNull(),
  channel: text("channel"),
  fallbackChannel: text("fallback_channel"),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const dataRetentionPolicies = pgTable("data_retention_policies", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  entityType: text("entity_type").notNull(),
  retentionMonths: integer("retention_months").notNull(),
  action: text("action").notNull().default("archive"),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

// =============================================
// TRANSACTIONAL TABLES
// =============================================

// --- Patients ---
export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  uhid: text("uhid"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  dateOfBirth: timestamp("date_of_birth"),
  gender: text("gender"),
  bloodGroup: text("blood_group"),
  primaryPhone: text("primary_phone"),
  secondaryPhone: text("secondary_phone"),
  email: text("email"),
  address: text("address"),
  cityId: integer("city_id").references(() => cities.id),
  stateId: integer("state_id").references(() => states.id),
  pinCode: text("pin_code"),
  areaId: integer("area_id").references(() => areas.id),
  insuranceProvider: text("insurance_provider"),
  insurancePolicyNumber: text("insurance_policy_number"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  hmsPatientId: text("hms_patient_id"),
  notes: text("notes"),
  status: text("status").notNull().default("Active"),
  consentGiven: boolean("consent_given").default(false),
  consentTimestamp: timestamp("consent_timestamp"),
  consentMethod: text("consent_method"),
  consentPurpose: text("consent_purpose"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

// --- Contact Persons (people who can be linked to multiple leads/patients) ---
export const contactPersons = pgTable("contact_persons", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  phoneE164: text("phone_e164"),
  whatsappNumber: text("whatsapp_number"),
  email: text("email"),
  gender: text("gender"),
  relationship: text("relationship"),
  notes: text("notes"),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").defaultNow(),
  modifiedAt: timestamp("modified_at").defaultNow(),
});

// --- Lead-Contact Person Mapping ---
export const leadContactPersons = pgTable("lead_contact_persons", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  leadId: integer("lead_id").notNull().references(() => leads.id),
  contactPersonId: integer("contact_person_id").notNull().references(() => contactPersons.id),
  relationship: text("relationship").default("Other"),
  isPrimary: boolean("is_primary").default(false),
  isBillingContact: boolean("is_billing_contact").default(false),
  isEmergencyContact: boolean("is_emergency_contact").default(false),
  isWhatsAppConsentHolder: boolean("is_whatsapp_consent_holder").default(false),
  isAppointmentCoordinator: boolean("is_appointment_coordinator").default(false),
  notes: text("notes"),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Contacts (phone/email/address records) ---
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  contactType: text("contact_type").notNull().default("Phone"),
  contactValue: text("contact_value").notNull(),
  label: text("label"),
  isPrimary: boolean("is_primary").default(false),
  isVerified: boolean("is_verified").default(false),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

// --- Patient-Contact Link ---
export const patientContactLinks = pgTable("patient_contact_links", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  contactId: integer("contact_id").references(() => contacts.id),
  contactPersonId: integer("contact_person_id").references(() => contactPersons.id),
  relationship: text("relationship").default("Self"),
  isPrimary: boolean("is_primary").default(false),
  isBillingContact: boolean("is_billing_contact").default(false),
  isEmergencyContact: boolean("is_emergency_contact").default(false),
  isWhatsAppConsentHolder: boolean("is_whatsapp_consent_holder").default(false),
  isAppointmentCoordinator: boolean("is_appointment_coordinator").default(false),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Campaigns ---
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  companyPrefix: text("company_prefix"),
  platform: text("platform"),
  objective: text("objective"),
  year: text("year"),
  month: text("month"),
  adNumber: text("ad_number"),
  funnelStage: text("funnel_stage"),
  channel: text("channel"),
  targetAudience: text("target_audience"),
  description: text("description"),
  budget: integer("budget"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  connectorId: integer("connector_id").references(() => platformConnectors.id),
  metaCampaignId: text("meta_campaign_id"),
  metaCampaignName: text("meta_campaign_name"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Platform Connectors ---
export const platformConnectors = pgTable("platform_connectors", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  platform: text("platform").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status").notNull().default("disconnected"),
  credentials: jsonb("credentials"),
  config: jsonb("config"),
  lastSyncAt: timestamp("last_sync_at"),
  syncStatus: text("sync_status"),
  metricsCache: jsonb("metrics_cache"),
  metricsCachedAt: timestamp("metrics_cached_at"),
  createdAt: timestamp("created_at").defaultNow(),
  modifiedAt: timestamp("modified_at").defaultNow(),
});

export const insertPlatformConnectorSchema = createInsertSchema(platformConnectors).omit({ id: true, createdAt: true, modifiedAt: true });
export type InsertPlatformConnector = z.infer<typeof insertPlatformConnectorSchema>;
export type PlatformConnector = typeof platformConnectors.$inferSelect;

// --- Enhanced Leads ---
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  phoneE164: text("phone_e164"),
  phoneOwnerRelationship: text("phone_owner_relationship").default("Self"),
  mobileNormalized: text("mobile_normalized"),
  email: text("email"),
  status: text("status").notNull().default("Raw Lead Captured"),
  patientId: integer("patient_id").references(() => patients.id),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  assignedTo: varchar("assigned_to"),
  assignedCrmUserId: integer("assigned_crm_user_id").references(() => crmUsers.id),
  hmsPatientId: text("hms_patient_id"),
  branchId: integer("branch_id").references(() => branches.id),
  leadSourceId: integer("lead_source_id").references(() => leadSources.id),
  leadSourceCategoryId: integer("lead_source_category_id").references(() => leadSourceCategories.id),
  doctorId: integer("doctor_id").references(() => doctors.id),
  treatmentDepartmentId: integer("treatment_department_id").references(() => treatmentDepartments.id),
  consultationTypeId: integer("consultation_type_id").references(() => consultationTypes.id),
  priority: text("priority").default("Normal"),
  leadScore: integer("lead_score").default(0),
  conversionStageId: integer("conversion_stage_id").references(() => conversionStages.id),
  lostReasonId: integer("lost_reason_id").references(() => lostReasons.id),
  lostNotes: text("lost_notes"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  referrerId: integer("referrer_id").references(() => referrers.id),
  corporateInsuranceId: integer("corporate_insurance_id").references(() => corporateInsurances.id),
  nextActionTypeId: integer("next_action_type_id").references(() => nextActionTypes.id),
  nextActionDate: timestamp("next_action_date"),
  nextActionNotes: text("next_action_notes"),
  nextActionAssignedTo: integer("next_action_assigned_to").references(() => crmUsers.id),
  handoverFromUserId: integer("handover_from_user_id").references(() => crmUsers.id),
  handoverToUserId: integer("handover_to_user_id").references(() => crmUsers.id),
  handoverStatus: text("handover_status"),
  handoverAt: timestamp("handover_at"),
  handoverAcceptedAt: timestamp("handover_accepted_at"),
  handoverRejectedAt: timestamp("handover_rejected_at"),
  handoverRejectionReason: text("handover_rejection_reason"),
  handoverReason: text("handover_reason"),
  slaBreached: boolean("sla_breached").default(false),
  slaDeadline: timestamp("sla_deadline"),
  firstContactAt: timestamp("first_contact_at"),
  lastContactAt: timestamp("last_contact_at"),
  totalCallAttempts: integer("total_call_attempts").default(0),
  totalCallDuration: integer("total_call_duration_seconds").default(0),
  tags: text("tags"),
  notes: text("notes"),
  dateOfBirth: timestamp("date_of_birth"),
  gender: text("gender"),
  bloodGroup: text("blood_group"),
  secondaryPhone: text("secondary_phone"),
  address: text("address"),
  cityId: integer("city_id").references(() => cities.id),
  stateId: integer("state_id").references(() => states.id),
  pinCode: text("pin_code"),
  areaId: integer("area_id").references(() => areas.id),
  insuranceProvider: text("insurance_provider"),
  insurancePolicyNumber: text("insurance_policy_number"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  uhid: text("uhid"),
  leadTemperature: text("lead_temperature").default("Cold"),
  leadAgeingDays: integer("lead_ageing_days").default(0),
  firstResponseTimeMinutes: integer("first_response_time_minutes"),
  appointmentConversionFlag: boolean("appointment_conversion_flag").default(false),
  noShowCount: integer("no_show_count").default(0),
  rescheduleCount: integer("reschedule_count").default(0),
  lastActivityAt: timestamp("last_activity_at"),
  temperatureLastUpdatedAt: timestamp("temperature_last_updated_at"),
  primaryOwnerUserId: integer("primary_owner_user_id").references(() => crmUsers.id),
  ownerTeam: text("owner_team"),
  lastHandoverAt: timestamp("last_handover_at"),
  referralId: integer("referral_id"),
  referralSourceFlag: boolean("referral_source_flag").default(false),
  mergedIntoLeadId: integer("merged_into_lead_id"),
  mergeStatus: text("merge_status").default("ACTIVE"),
  mergedAt: timestamp("merged_at"),
  mergedBy: varchar("merged_by"),
  consentGiven: boolean("consent_given").default(false),
  consentTimestamp: timestamp("consent_timestamp"),
  consentMethod: text("consent_method"),
  consentPurpose: text("consent_purpose"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// --- Lead Merge Audits ---
export const leadMergeAudits = pgTable("lead_merge_audits", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  primaryLeadId: integer("primary_lead_id").notNull().references(() => leads.id),
  mergedLeadIds: jsonb("merged_lead_ids").notNull(),
  mergeStrategy: text("merge_strategy").notNull().default("KEEP_PRIMARY"),
  fieldDecisions: jsonb("field_decisions"),
  movedRecordCounts: jsonb("moved_record_counts"),
  mergedBy: varchar("merged_by").notNull(),
  mergedByCrmUserId: integer("merged_by_crm_user_id").references(() => crmUsers.id),
  notes: text("notes"),
  mergedAt: timestamp("merged_at").defaultNow(),
});

// --- Lead Merge Roles Config ---
export const leadMergeRoles = pgTable("lead_merge_roles", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  roleCode: text("role_code").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Enhanced Activities ---
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  leadId: integer("lead_id").notNull().references(() => leads.id),
  type: text("type").notNull(),
  activityTypeId: integer("activity_type_id").references(() => activityTypes.id),
  description: text("description").notNull(),
  outcome: text("outcome"),
  callDirection: text("call_direction"),
  callDurationSeconds: integer("call_duration_seconds"),
  callStatus: text("call_status"),
  callingLineId: integer("calling_line_id").references(() => callingLines.id),
  nextActionTypeId: integer("next_action_type_id").references(() => nextActionTypes.id),
  nextActionDate: timestamp("next_action_date"),
  nextActionNotes: text("next_action_notes"),
  oldStatus: text("old_status"),
  newStatus: text("new_status"),
  metadata: jsonb("metadata"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Enhanced Tasks ---
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  leadId: integer("lead_id").notNull().references(() => leads.id),
  title: text("title").notNull(),
  description: text("description"),
  taskCategoryId: integer("task_category_id").references(() => taskCategories.id),
  priority: text("priority").default("Normal"),
  dueDate: timestamp("due_date").notNull(),
  assignedTo: varchar("assigned_to"),
  assignedCrmUserId: integer("assigned_crm_user_id").references(() => crmUsers.id),
  status: text("status").notNull().default("Pending"),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by"),
  isSlaTriggered: boolean("is_sla_triggered").default(false),
  slaRuleId: integer("sla_rule_id").references(() => slaRules.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
});

// --- Appointments ---
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  leadId: integer("lead_id").references(() => leads.id),
  patientId: integer("patient_id").references(() => patients.id),
  episodeId: integer("episode_id").references(() => episodes.id),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  branchId: integer("branch_id").references(() => branches.id),
  appointmentTypeId: integer("appointment_type_id").references(() => appointmentTypes.id),
  consultationTypeId: integer("consultation_type_id").references(() => consultationTypes.id),
  serviceLocation: text("service_location").default("At Hospital"),
  serviceAddress: text("service_address"),
  appointmentDate: timestamp("appointment_date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  tokenNumber: integer("token_number"),
  status: text("status").notNull().default("Scheduled"),
  appointmentStatusId: integer("appointment_status_id").references(() => appointmentStatuses.id),
  noShowReasonId: integer("no_show_reason_id").references(() => noShowReasons.id),
  rescheduleCount: integer("reschedule_count").default(0),
  cancelReason: text("cancel_reason"),
  consultationNotes: text("consultation_notes"),
  consultationDoneAt: timestamp("consultation_done_at"),
  consultationDoneBy: varchar("consultation_done_by"),
  reminderSent: boolean("reminder_sent").default(false),
  reminderSentAt: timestamp("reminder_sent_at"),
  bookedBy: varchar("booked_by"),
  bookedByCrmUserId: integer("booked_by_crm_user_id").references(() => crmUsers.id),
  notes: text("notes"),
  checkedInAt: timestamp("checked_in_at"),
  checkedInBy: varchar("checked_in_by"),
  checkedInByCrmUserId: integer("checked_in_by_crm_user_id").references(() => crmUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

// --- Episodes (Treatment Opportunities) ---
export const episodes = pgTable("episodes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  leadId: integer("lead_id").notNull().references(() => leads.id),
  patientId: integer("patient_id").references(() => patients.id),
  episodeName: text("episode_name").notNull(),
  treatmentDepartmentId: integer("treatment_department_id").references(() => treatmentDepartments.id),
  consultationTypeId: integer("consultation_type_id").references(() => consultationTypes.id),
  doctorId: integer("doctor_id").references(() => doctors.id),
  branchId: integer("branch_id").references(() => branches.id),
  episodeType: text("episode_type").default("OPD"),
  visitType: text("visit_type").default("New"),
  parentEpisodeId: integer("parent_episode_id"),
  visitNumber: integer("visit_number").default(1),
  status: text("status").notNull().default("Consultation Done"),
  priority: text("priority").default("Normal"),
  assignedCrmUserId: integer("assigned_crm_user_id").references(() => crmUsers.id),
  conversionStageId: integer("conversion_stage_id").references(() => conversionStages.id),
  lostReasonId: integer("lost_reason_id").references(() => lostReasons.id),
  lostNotes: text("lost_notes"),
  slaBreached: boolean("sla_breached").default(false),
  slaDeadline: timestamp("sla_deadline"),
  nextActionTypeId: integer("next_action_type_id").references(() => nextActionTypes.id),
  nextActionDate: timestamp("next_action_date"),
  nextActionNotes: text("next_action_notes"),
  nextActionAssignedTo: integer("next_action_assigned_to").references(() => crmUsers.id),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  diagnosis: text("diagnosis"),
  treatmentPlan: text("treatment_plan"),
  estimatedCost: integer("estimated_cost"),
  actualCost: integer("actual_cost"),
  insuranceClaimed: boolean("insurance_claimed").default(false),
  notes: text("notes"),
  estimateShared: boolean("estimate_shared").default(false),
  estimateSharedAt: timestamp("estimate_shared_at"),
  negotiationStatus: text("negotiation_status").default("None"),
  originalQuotedAmount: integer("original_quoted_amount"),
  discountApplied: boolean("discount_applied").default(false),
  discountType: text("discount_type"),
  discountPercent: integer("discount_percent"),
  discountAmount: integer("discount_amount"),
  discountValue: integer("discount_value"),
  discountNotes: text("discount_notes"),
  discountStatus: text("discount_status").default("Draft"),
  discountApprovedBy: varchar("discount_approved_by"),
  discountApprovedAt: timestamp("discount_approved_at"),
  discountApproverRemark: text("discount_approver_remark"),
  discountRequestedAt: timestamp("discount_requested_at"),
  discountEscalatedAt: timestamp("discount_escalated_at"),
  finalEstimatedAmount: integer("final_estimated_amount"),
  advanceReceivedAmount: integer("advance_received_amount"),
  paymentMode: text("payment_mode"),
  paymentNotes: text("payment_notes"),
  insuranceApplicable: boolean("insurance_applicable").default(false),
  insurerId: integer("insurer_id"),
  tpaId: integer("tpa_id"),
  policyTypeId: integer("policy_type_id"),
  preauthStatusId: integer("preauth_status_id"),
  preauthSubmittedAt: timestamp("preauth_submitted_at"),
  preauthApprovedAmount: integer("preauth_approved_amount"),
  rejectionReasonId: integer("rejection_reason_id"),
  familyDiscussionDone: boolean("family_discussion_done").default(false),
  secondOpinionTaken: boolean("second_opinion_taken").default(false),
  decisionStatus: text("decision_status").default("Pending"),
  decisionNotes: text("decision_notes"),
  surgeryDoctorId: integer("surgery_doctor_id").references(() => doctors.id),
  surgeryDate: timestamp("surgery_date"),
  surgeryAlertUserId: integer("surgery_alert_user_id").references(() => crmUsers.id),
  postCareOwnerId: integer("post_care_owner_id").references(() => doctors.id),
  postCareProtocolId: integer("post_care_protocol_id"),
  referralReady: boolean("referral_ready").default(false),
  referralReadyAt: timestamp("referral_ready_at"),
  initialQuote: integer("initial_quote"),
  approvedDiscount: integer("approved_discount").default(0),
  finalQuote: integer("final_quote"),
  actualBill: integer("actual_bill"),
  variance: integer("variance"),
  initialApprovalAmount: integer("initial_approval_amount"),
  roomTypeId: integer("room_type_id"),
  roomNumber: text("room_number"),
  revenueProbability: integer("revenue_probability"),
  expectedRevenueAmount: integer("expected_revenue_amount"),
  lostAtStage: text("lost_at_stage"),
  lostValue: integer("lost_value"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const consultationOutcomes = pgTable("consultation_outcomes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  closesEpisode: boolean("closes_episode").default(false),
  closesAs: text("closes_as"),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const consultationOutcomeRemarks = pgTable("consultation_outcome_remarks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  outcomeCode: text("outcome_code").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

// --- Clinical Notes Edit Roles Config ---
export const clinicalNotesEditRoles = pgTable("clinical_notes_edit_roles", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  roleCode: text("role_code").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Audit Log ---
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  changedFields: text("changed_fields"),
  performedBy: varchar("performed_by"),
  performedByCrmUserId: integer("performed_by_crm_user_id").references(() => crmUsers.id),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Lead Import Logs ---
export const leadImportLogs = pgTable("lead_import_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  fileName: text("file_name").notNull(),
  source: text("source").notNull().default("csv"),
  totalRows: integer("total_rows").default(0),
  successCount: integer("success_count").default(0),
  duplicateCount: integer("duplicate_count").default(0),
  updatedCount: integer("updated_count").default(0),
  failureCount: integer("failure_count").default(0),
  duplicateStrategy: text("duplicate_strategy").notNull().default("skip"),
  status: text("status").notNull().default("Processing"),
  errorDetails: jsonb("error_details"),
  columnMapping: jsonb("column_mapping"),
  importedBy: varchar("imported_by"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// --- Lead Capture Rules (per connector) ---
export const leadCaptureRules = pgTable("lead_capture_rules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  connectorId: integer("connector_id").references(() => platformConnectors.id),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(),
  sourcePage: text("source_page"),
  sourceForm: text("source_form"),
  isActive: boolean("is_active").notNull().default(true),
  assignmentStrategy: text("assignment_strategy").notNull().default("round_robin"),
  assignToEmployeeIds: jsonb("assign_to_employee_ids"),
  duplicatePhoneAction: text("duplicate_phone_action").notNull().default("ignore"),
  duplicateLeadOption: text("duplicate_lead_option").notNull().default("skip"),
  duplicateTagsOption: text("duplicate_tags_option").notNull().default("ignore"),
  defaultLeadStatus: text("default_lead_status").notNull().default("Raw Lead Captured"),
  defaultTags: text("default_tags"),
  fieldMapping: jsonb("field_mapping"),
  webhookToken: text("webhook_token"),
  mapCallLogs: boolean("map_call_logs").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  modifiedAt: timestamp("modified_at").defaultNow(),
});

export const insertLeadCaptureRuleSchema = createInsertSchema(leadCaptureRules).omit({ id: true, createdAt: true, modifiedAt: true });
export type InsertLeadCaptureRule = z.infer<typeof insertLeadCaptureRuleSchema>;
export type LeadCaptureRule = typeof leadCaptureRules.$inferSelect;

// --- Meta Lead Capture Logs ---
export const metaLeadCaptureLogs = pgTable("meta_lead_capture_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  ruleId: integer("rule_id").references(() => leadCaptureRules.id),
  ruleName: text("rule_name"),
  leadId: integer("lead_id").references(() => leads.id),
  formId: text("form_id"),
  adId: text("ad_id"),
  leadgenId: text("leadgen_id"),
  rawPayload: jsonb("raw_payload"),
  leadgenPayload: jsonb("leadgen_payload"),
  leadName: text("lead_name"),
  leadPhone: text("lead_phone"),
  processingStatus: text("processing_status").notNull().default("received"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMetaLeadCaptureLogSchema = createInsertSchema(metaLeadCaptureLogs).omit({ id: true, createdAt: true });
export type InsertMetaLeadCaptureLog = z.infer<typeof insertMetaLeadCaptureLogSchema>;
export type MetaLeadCaptureLog = typeof metaLeadCaptureLogs.$inferSelect;

// --- Callyzer Employees ---
export const callyzerEmployees = pgTable("callyzer_employees", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  connectorId: integer("connector_id").notNull().references(() => platformConnectors.id),
  empCode: text("emp_code"),
  empName: text("emp_name").notNull(),
  empNumber: text("emp_number").notNull(),
  empCountryCode: text("emp_country_code").default("91"),
  empTags: jsonb("emp_tags"),
  mappedCrmUserId: integer("mapped_crm_user_id").references(() => crmUsers.id),
  totalCalls: integer("total_calls").default(0),
  totalIncoming: integer("total_incoming").default(0),
  totalOutgoing: integer("total_outgoing").default(0),
  totalMissed: integer("total_missed").default(0),
  totalDurationSeconds: integer("total_duration_seconds").default(0),
  lastCallAt: timestamp("last_call_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  modifiedAt: timestamp("modified_at").defaultNow(),
});

export const insertCallyzerEmployeeSchema = createInsertSchema(callyzerEmployees).omit({ id: true, createdAt: true, modifiedAt: true });
export type InsertCallyzerEmployee = z.infer<typeof insertCallyzerEmployeeSchema>;
export type CallyzerEmployee = typeof callyzerEmployees.$inferSelect;

// --- Callyzer Webhook Logs ---
export const callyzerWebhookLogs = pgTable("callyzer_webhook_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  connectorId: integer("connector_id").notNull().references(() => platformConnectors.id),
  rawPayload: jsonb("raw_payload").notNull(),
  clientNumber: text("client_number"),
  employeeNumber: text("employee_number"),
  callType: text("call_type"),
  callDuration: integer("call_duration"),
  matchedLeadId: integer("matched_lead_id").references(() => leads.id),
  matchedCrmUserId: integer("matched_crm_user_id").references(() => crmUsers.id),
  matchedCallyzerEmployeeId: integer("matched_callyzer_employee_id").references(() => callyzerEmployees.id),
  activityId: integer("activity_id").references(() => activities.id),
  processingStatus: text("processing_status").notNull().default("received"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCallyzerWebhookLogSchema = createInsertSchema(callyzerWebhookLogs).omit({ id: true, createdAt: true });
export type InsertCallyzerWebhookLog = z.infer<typeof insertCallyzerWebhookLogSchema>;
export type CallyzerWebhookLog = typeof callyzerWebhookLogs.$inferSelect;

// =============================================
// EPISODE INTELLIGENCE V2 — NEW TABLES
// =============================================

// --- Handover Logs ---
export const handoverLogs = pgTable("handover_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  fromUserId: integer("from_user_id").references(() => crmUsers.id),
  toUserId: integer("to_user_id").references(() => crmUsers.id),
  fromTeam: text("from_team"),
  toTeam: text("to_team"),
  triggerEvent: text("trigger_event").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Reschedule History ---
export const rescheduleHistory = pgTable("reschedule_history", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  appointmentId: integer("appointment_id").notNull().references(() => appointments.id),
  oldDate: timestamp("old_date"),
  newDate: timestamp("new_date"),
  oldStartTime: text("old_start_time"),
  newStartTime: text("new_start_time"),
  reason: text("reason"),
  rescheduledBy: varchar("rescheduled_by"),
  daysBetween: integer("days_between"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Temperature Change Logs ---
export const temperatureLogs = pgTable("temperature_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  leadId: integer("lead_id").notNull().references(() => leads.id),
  previousTemperature: text("previous_temperature"),
  newTemperature: text("new_temperature").notNull(),
  triggerEvent: text("trigger_event").notNull(),
  referenceId: integer("reference_id"),
  referenceType: text("reference_type"),
  changedBy: varchar("changed_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Insurance Master Tables ---
export const insurers = pgTable("insurers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const tpas = pgTable("tpas", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const policyTypes = pgTable("policy_types", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const preauthStatuses = pgTable("preauth_statuses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const rejectionReasons = pgTable("rejection_reasons", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

// --- Revenue Probability Configuration ---
export const revenueProbabilityConfig = pgTable("revenue_probability_config", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  stageName: text("stage_name").notNull(),
  probability: integer("probability").notNull(),
  displayOrder: integer("display_order").default(0),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").defaultNow(),
  modifiedAt: timestamp("modified_at").defaultNow(),
});

// =============================================
// ZOD SCHEMAS
// =============================================
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });
export const insertPatientSchema = createInsertSchema(patients).omit({ id: true, createdAt: true, modifiedAt: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true, modifiedAt: true });
export const insertPatientContactLinkSchema = createInsertSchema(patientContactLinks).omit({ id: true, createdAt: true });
export const insertContactPersonSchema = createInsertSchema(contactPersons).omit({ id: true, createdAt: true, modifiedAt: true });
export const insertLeadContactPersonSchema = createInsertSchema(leadContactPersons).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, updatedAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true, modifiedAt: true });
export const insertEpisodeSchema = createInsertSchema(episodes).omit({ id: true, createdAt: true, modifiedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertHandoverLogSchema = createInsertSchema(handoverLogs).omit({ id: true, createdAt: true });
export const insertRescheduleHistorySchema = createInsertSchema(rescheduleHistory).omit({ id: true, createdAt: true });
export const insertTemperatureLogSchema = createInsertSchema(temperatureLogs).omit({ id: true, createdAt: true });
export const insertRevenueProbabilityConfigSchema = createInsertSchema(revenueProbabilityConfig).omit({ id: true, createdAt: true, modifiedAt: true });

// =============================================
// SUBSCRIPTION & BILLING (System Admin)
// =============================================
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  price: integer("price").notNull().default(0),
  currency: text("currency").notNull().default("INR"),
  maxUsers: integer("max_users").default(0),
  maxLeadsPerMonth: integer("max_leads_per_month").default(0),
  maxBranches: integer("max_branches").default(0),
  features: jsonb("features"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  modifiedAt: timestamp("modified_at").defaultNow(),
});

export const tenantSubscriptions = pgTable("tenant_subscriptions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  planId: integer("plan_id").notNull().references(() => subscriptionPlans.id),
  status: text("status").notNull().default("Active"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  amount: integer("amount").notNull().default(0),
  currency: text("currency").notNull().default("INR"),
  gracePeriodDays: integer("grace_period_days").notNull().default(7),
  autoRenew: boolean("auto_renew").notNull().default(true),
  suspendedAt: timestamp("suspended_at"),
  suspendedReason: text("suspended_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  modifiedAt: timestamp("modified_at").defaultNow(),
});

export const subscriptionPayments = pgTable("subscription_payments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  subscriptionId: integer("subscription_id").notNull().references(() => tenantSubscriptions.id),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("INR"),
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: text("payment_method"),
  transactionRef: text("transaction_ref"),
  invoiceNumber: text("invoice_number"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  status: text("status").notNull().default("Completed"),
  notes: text("notes"),
  recordedBy: varchar("recorded_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ id: true, createdAt: true, modifiedAt: true });
export const insertTenantSubscriptionSchema = createInsertSchema(tenantSubscriptions).omit({ id: true, createdAt: true, modifiedAt: true });
export const insertSubscriptionPaymentSchema = createInsertSchema(subscriptionPayments).omit({ id: true, createdAt: true });

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type TenantSubscription = typeof tenantSubscriptions.$inferSelect;
export type InsertTenantSubscription = z.infer<typeof insertTenantSubscriptionSchema>;
export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;
export type InsertSubscriptionPayment = z.infer<typeof insertSubscriptionPaymentSchema>;

// =============================================
// CUSTOM FIELD SUGGESTIONS (for "Other" options pending admin review)
// =============================================
export const customFieldSuggestions = pgTable("custom_field_suggestions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  fieldName: text("field_name").notNull(),
  suggestedValue: text("suggested_value").notNull(),
  targetTable: text("target_table"),
  status: text("status").notNull().default("Pending"),
  suggestedBy: varchar("suggested_by"),
  reviewedBy: varchar("reviewed_by"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const insertCustomFieldSuggestionSchema = createInsertSchema(customFieldSuggestions).omit({ id: true, createdAt: true, reviewedAt: true });
export type CustomFieldSuggestion = typeof customFieldSuggestions.$inferSelect;
export type InsertCustomFieldSuggestion = z.infer<typeof insertCustomFieldSuggestionSchema>;

// =============================================
// BULK IMPORT LOG
// =============================================
export const bulkImportLogs = pgTable("bulk_import_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  tableName: text("table_name").notNull(),
  fileName: text("file_name").notNull(),
  totalRows: integer("total_rows").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  duplicateCount: integer("duplicate_count").notNull().default(0),
  status: text("status").notNull().default("Processing"),
  errorDetails: jsonb("error_details"),
  importedBy: varchar("imported_by"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type BulkImportLog = typeof bulkImportLogs.$inferSelect;

// CRM User insert schema
export const insertCrmUserSchema = createInsertSchema(crmUsers).omit({
  id: true,
  createdAt: true,
  modifiedAt: true,
});

// Generic master insert schema (used for all simple master tables)
export const insertMasterSchema = z.object({
  tenantId: z.number(),
  code: z.string().min(1),
  name: z.string().min(1),
  status: z.string().default("Active"),
  displayOrder: z.number().default(0),
  approvalStatus: z.string().default("Approved"),
});

// =============================================
// TYPES
// =============================================
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Patient = typeof patients.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type PatientContactLink = typeof patientContactLinks.$inferSelect;
export type InsertPatientContactLink = z.infer<typeof insertPatientContactLinkSchema>;
export type ContactPerson = typeof contactPersons.$inferSelect;
export type InsertContactPerson = z.infer<typeof insertContactPersonSchema>;
export type LeadContactPerson = typeof leadContactPersons.$inferSelect;
export type InsertLeadContactPerson = z.infer<typeof insertLeadContactPersonSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type UpdateLeadRequest = Partial<InsertLead>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTaskRequest = Partial<InsertTask>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type CrmUser = typeof crmUsers.$inferSelect;
export type InsertCrmUser = z.infer<typeof insertCrmUserSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Episode = typeof episodes.$inferSelect;
export type InsertEpisode = z.infer<typeof insertEpisodeSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type HandoverLog = typeof handoverLogs.$inferSelect;
export type InsertHandoverLog = z.infer<typeof insertHandoverLogSchema>;
export type RescheduleHistoryRecord = typeof rescheduleHistory.$inferSelect;
export type InsertRescheduleHistory = z.infer<typeof insertRescheduleHistorySchema>;
export type TemperatureLog = typeof temperatureLogs.$inferSelect;
export type InsertTemperatureLog = z.infer<typeof insertTemperatureLogSchema>;
export type RevenueProbabilityConfigRecord = typeof revenueProbabilityConfig.$inferSelect;
export type InsertRevenueProbabilityConfig = z.infer<typeof insertRevenueProbabilityConfigSchema>;
export type PostCareProtocol = typeof postCareProtocols.$inferSelect;
export type InsertPostCareProtocol = z.infer<typeof insertPostCareProtocolSchema>;
export type PostCareProtocolStep = typeof postCareProtocolSteps.$inferSelect;
export type InsertPostCareProtocolStep = z.infer<typeof insertPostCareProtocolStepSchema>;
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type EventRegistration = typeof eventRegistrations.$inferSelect;
export type InsertEventRegistration = z.infer<typeof insertEventRegistrationSchema>;

// Generic master record type
export interface MasterRecord {
  id: number;
  tenantId: number;
  code: string;
  name: string;
  status: string;
  displayOrder: number | null;
  approvalStatus: string | null;
  createdAt: Date | null;
  createdBy: string | null;
  modifiedAt: Date | null;
  modifiedBy: string | null;
  [key: string]: any;
}

// Master table registry mapping names to drizzle table references
// =============================================
// FINANCIALS MASTERS
// =============================================
export const roomTypes = pgTable("room_types", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const costHeads = pgTable("cost_heads", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  treatmentDepartmentId: integer("treatment_department_id").references(() => treatmentDepartments.id),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  approvalStatus: text("approval_status").default("Approved"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const episodeQuoteItems = pgTable("episode_quote_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  episodeId: integer("episode_id").notNull().references(() => episodes.id),
  costHeadId: integer("cost_head_id").notNull().references(() => costHeads.id),
  amount: integer("amount").notNull().default(0),
  remarks: text("remarks"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
});

export const MASTER_TABLE_REGISTRY: Record<string, string> = {
  countries: "countries",
  states: "states",
  cities: "cities",
  areas: "areas",
  branchServiceability: "branch_serviceability",
  organisations: "organisations",
  branches: "branches",
  administrativeDepartments: "administrative_departments",
  designations: "designations",
  employmentTypes: "employment_types",
  systemRoles: "system_roles",
  crmUsers: "crm_users",
  callingLines: "calling_lines",
  userLineAssignments: "user_line_assignments",
  treatmentDepartments: "treatment_departments",
  consultationTypes: "consultation_types",
  doctors: "doctors",
  opdTimings: "opd_timings",
  doctorLeaveExceptions: "doctor_leave_exceptions",
  leadSourceCategories: "lead_source_categories",
  leadSources: "lead_sources",
  campaignChannels: "campaign_channels",
  utmSources: "utm_sources",
  utmMediums: "utm_mediums",
  utmCampaigns: "utm_campaigns",
  utmTerms: "utm_terms",
  utmContents: "utm_contents",
  referrers: "referrers",
  corporateInsurances: "corporate_insurances",
  leadCreationChannels: "lead_creation_channels",
  appointmentTypes: "appointment_types",
  conversionStages: "conversion_stages",
  lostReasons: "lost_reasons",
  noShowReasons: "no_show_reasons",
  activityTypes: "activity_types",
  nextActionTypes: "next_action_types",
  taskCategories: "task_categories",
  leadStatuses: "lead_statuses",
  appointmentStatuses: "appointment_statuses",
  referralStatuses: "referral_statuses",
  callStatuses: "call_statuses",
  callDirections: "call_directions",
  templates: "templates",
  holidays: "holidays",
  tags: "tags",
  pinCodes: "pin_codes",
  slaRules: "sla_rules",
  reminderPolicies: "reminder_policies",
  dataRetentionPolicies: "data_retention_policies",
  callyzerEmployees: "callyzer_employees",
  insurers: "insurers",
  tpas: "tpas",
  policyTypes: "policy_types",
  preauthStatuses: "preauth_statuses",
  rejectionReasons: "rejection_reasons",
  consultationOutcomes: "consultation_outcomes",
  consultationOutcomeRemarks: "consultation_outcome_remarks",
  roomTypes: "room_types",
  costHeads: "cost_heads",
};

// =============================================
// POST-CARE FOLLOW-UP PROTOCOLS
// =============================================
export const postCareProtocols = pgTable("post_care_protocols", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  triggerOn: text("trigger_on").notNull().default("Post Care"),
  isDefault: boolean("is_default").default(false),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const postCareProtocolSteps = pgTable("post_care_protocol_steps", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  protocolId: integer("protocol_id").notNull().references(() => postCareProtocols.id),
  stepNumber: integer("step_number").notNull(),
  daysAfterDischarge: integer("days_after_discharge").notNull(),
  taskTitle: text("task_title").notNull(),
  taskDescription: text("task_description"),
  assigneeType: text("assignee_type").notNull().default("PostCareOwner"),
  assigneeRoleCode: text("assignee_role_code"),
  priority: text("priority").notNull().default("Normal"),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPostCareProtocolSchema = createInsertSchema(postCareProtocols).omit({ id: true, createdAt: true, modifiedAt: true });
export const insertPostCareProtocolStepSchema = createInsertSchema(postCareProtocolSteps).omit({ id: true, createdAt: true });

// =============================================
// REFERRAL MANAGEMENT
// =============================================
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  referrerId: integer("referrer_id").references(() => referrers.id),
  referrerPatientId: integer("referrer_patient_id").references(() => patients.id),
  referrerLeadId: integer("referrer_lead_id").references(() => leads.id),
  referrerEpisodeId: integer("referrer_episode_id").references(() => episodes.id),
  referrerExternalName: text("referrer_external_name"),
  referrerExternalPhone: text("referrer_external_phone"),
  referredName: text("referred_name").notNull(),
  referredPhone: text("referred_phone").notNull(),
  referredEmail: text("referred_email"),
  referralChannel: text("referral_channel").notNull().default("Word of Mouth"),
  referralDate: timestamp("referral_date").defaultNow(),
  referralNotes: text("referral_notes"),
  resultingLeadId: integer("resulting_lead_id").references(() => leads.id),
  outcome: text("outcome").notNull().default("Pending"),
  outcomeDate: timestamp("outcome_date"),
  outcomeNotes: text("outcome_notes"),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const insertReferralSchema = createInsertSchema(referrals).omit({ id: true, createdAt: true, modifiedAt: true });

// =============================================
// EVENT MANAGEMENT (Webinars / Seminars / Health Camps)
// =============================================
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("Health Camp"),
  description: text("description"),
  venue: text("venue"),
  location: text("location"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  maxCapacity: integer("max_capacity"),
  registeredCount: integer("registered_count").default(0),
  attendedCount: integer("attended_count").default(0),
  convertedCount: integer("converted_count").default(0),
  status: text("status").notNull().default("Draft"),
  organizer: text("organizer"),
  budget: integer("budget"),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  modifiedBy: varchar("modified_by"),
  createdAt: timestamp("created_at").defaultNow(),
  modifiedAt: timestamp("modified_at").defaultNow(),
});

export const eventRegistrations = pgTable("event_registrations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  eventId: integer("event_id").notNull().references(() => events.id),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  source: text("source").default("Walk-in"),
  registrationDate: timestamp("registration_date").defaultNow(),
  attendanceStatus: text("attendance_status").notNull().default("Registered"),
  checkedInAt: timestamp("checked_in_at"),
  resultingLeadId: integer("resulting_lead_id").references(() => leads.id),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  modifiedBy: varchar("modified_by"),
  createdAt: timestamp("created_at").defaultNow(),
  modifiedAt: timestamp("modified_at").defaultNow(),
});

export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true, modifiedAt: true });
export const insertEventRegistrationSchema = createInsertSchema(eventRegistrations).omit({ id: true, createdAt: true, modifiedAt: true });

export const accessLogs = pgTable("access_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  crmUserId: integer("crm_user_id").notNull().references(() => crmUsers.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  details: text("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const communicationPreferences = pgTable("communication_preferences", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  leadId: integer("lead_id").references(() => leads.id),
  patientId: integer("patient_id").references(() => patients.id),
  channel: text("channel").notNull(),
  optedIn: boolean("opted_in").notNull().default(true),
  optedInAt: timestamp("opted_in_at"),
  optedOutAt: timestamp("opted_out_at"),
  updatedBy: integer("updated_by").references(() => crmUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// =============================================
// REFERRAL CONFIGURATION
// =============================================
export const referralConfig = pgTable("referral_config", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  autoCreateLead: boolean("auto_create_lead").notNull().default(true),
  defaultLeadStatus: text("default_lead_status").notNull().default("Raw Lead Captured"),
  assignmentStrategy: text("assignment_strategy").notNull().default("round_robin"),
  assignToUserIds: jsonb("assign_to_user_ids").default([]),
  assignToBranchId: integer("assign_to_branch_id").references(() => branches.id),
  trackReferralLeads: boolean("track_referral_leads").notNull().default(true),
  trackedFunnelStages: jsonb("tracked_funnel_stages").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const insertReferralConfigSchema = createInsertSchema(referralConfig).omit({ id: true, createdAt: true, modifiedAt: true });

export const referralRewardRules = pgTable("referral_reward_rules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  triggerStage: text("trigger_stage").notNull(),
  referrerTypeFilter: text("referrer_type_filter"),
  rewardType: text("reward_type").notNull().default("Recognition"),
  rewardLabel: text("reward_label"),
  rewardValue: text("reward_value"),
  notifyReferrer: boolean("notify_referrer").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const insertReferralRewardRuleSchema = createInsertSchema(referralRewardRules).omit({ id: true, createdAt: true, modifiedAt: true });

// =============================================
// SUPPORT TICKETING SYSTEM
// =============================================

export const supportUsers = pgTable("support_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("support_agent"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSupportUserSchema = createInsertSchema(supportUsers).omit({ id: true, createdAt: true, lastLoginAt: true });
export type SupportUser = typeof supportUsers.$inferSelect;

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: text("ticket_number").notNull().unique(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  crmUserId: integer("crm_user_id").notNull(),
  category: text("category").notNull(),
  priority: text("priority").notNull().default("Medium"),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  attachments: jsonb("attachments").default([]),
  status: text("status").notNull().default("Open"),
  assignedSupportUserId: integer("assigned_support_user_id").references(() => supportUsers.id),
  adminPriority: text("admin_priority"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({ id: true, createdAt: true, updatedAt: true, closedAt: true });
export type SupportTicket = typeof supportTickets.$inferSelect;

export const supportTicketComments = pgTable("support_ticket_comments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => supportTickets.id),
  authorType: text("author_type").notNull(),
  authorId: integer("author_id").notNull(),
  authorName: text("author_name"),
  message: text("message").notNull(),
  attachments: jsonb("attachments").default([]),
  isInternal: boolean("is_internal").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSupportTicketCommentSchema = createInsertSchema(supportTicketComments).omit({ id: true, createdAt: true });
export type SupportTicketComment = typeof supportTicketComments.$inferSelect;

export const resourceLinks = pgTable("resource_links", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  linkType: text("link_type").notNull(),
  label: text("label"),
  url: text("url").notNull(),
  displayOrder: integer("display_order").default(0),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertResourceLinkSchema = createInsertSchema(resourceLinks).omit({ id: true, createdAt: true });
export type InsertResourceLink = z.infer<typeof insertResourceLinkSchema>;
export type ResourceLink = typeof resourceLinks.$inferSelect;

// =============================================
// TENANT DISCOUNT APPROVERS
// =============================================
export const tenantDiscountApprovers = pgTable("tenant_discount_approvers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  crmUserId: integer("crm_user_id").notNull().references(() => crmUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
}, (table) => ({
  uniqueApprover: uniqueIndex("tenant_discount_approvers_tenant_user_unique").on(table.tenantId, table.crmUserId),
}));

export const insertTenantDiscountApproverSchema = createInsertSchema(tenantDiscountApprovers).omit({ id: true, createdAt: true });
export type InsertTenantDiscountApprover = z.infer<typeof insertTenantDiscountApproverSchema>;
export type TenantDiscountApprover = typeof tenantDiscountApprovers.$inferSelect;

// =============================================
// ROLE PERMISSIONS
// =============================================
export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  roleCode: text("role_code").notNull(),
  module: text("module").notNull(),
  canView: boolean("can_view").notNull().default(false),
  canCreate: boolean("can_create").notNull().default(false),
  canEdit: boolean("can_edit").notNull().default(false),
  canDelete: boolean("can_delete").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueRolePerm: uniqueIndex("role_permissions_tenant_role_module_unique").on(table.tenantId, table.roleCode, table.module),
}));

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({ id: true, createdAt: true });
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;

// =============================================
// USER PERMISSION OVERRIDES
// =============================================
export const userPermissionOverrides = pgTable("user_permission_overrides", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  crmUserId: integer("crm_user_id").notNull().references(() => crmUsers.id),
  module: text("module").notNull(),
  action: text("action").notNull(),
  isGranted: boolean("is_granted").notNull(),
  reason: text("reason"),
  expiresAt: timestamp("expires_at"),
  createdBy: integer("created_by").references(() => crmUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserPermissionOverrideSchema = createInsertSchema(userPermissionOverrides).omit({ id: true, createdAt: true });
export type InsertUserPermissionOverride = z.infer<typeof insertUserPermissionOverrideSchema>;
export type UserPermissionOverride = typeof userPermissionOverrides.$inferSelect;

// =============================================
// IN-APP NOTIFICATIONS
// =============================================
export const inAppNotifications = pgTable("in_app_notifications", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  crmUserId: integer("crm_user_id").notNull().references(() => crmUsers.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInAppNotificationSchema = createInsertSchema(inAppNotifications).omit({ id: true, createdAt: true });
export type InsertInAppNotification = z.infer<typeof insertInAppNotificationSchema>;
export type InAppNotification = typeof inAppNotifications.$inferSelect;

// =============================================
// SYSTEM ERROR / AUDIT LOG
// =============================================
export const systemErrorLogs = pgTable("system_error_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  crmUserId: integer("crm_user_id"),
  userName: text("user_name"),
  userPhone: text("user_phone"),
  roleCode: text("role_code"),
  method: text("method"),
  endpoint: text("endpoint"),
  statusCode: integer("status_code"),
  errorMessage: text("error_message"),
  errorDetails: text("error_details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type SystemErrorLog = typeof systemErrorLogs.$inferSelect;

// =============================================
export const referralRewardLogs = pgTable("referral_reward_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  rewardRuleId: integer("reward_rule_id").notNull().references(() => referralRewardRules.id),
  referralId: integer("referral_id").notNull().references(() => referrals.id),
  referrerId: integer("referrer_id").references(() => referrers.id),
  leadId: integer("lead_id").references(() => leads.id),
  episodeId: integer("episode_id").references(() => episodes.id),
  triggerStage: text("trigger_stage").notNull(),
  rewardType: text("reward_type").notNull(),
  rewardLabel: text("reward_label"),
  rewardValue: text("reward_value"),
  status: text("status").notNull().default("Pending"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Google Sheets Auto-Sync Configs ---
export const googleSheetsSyncConfigs = pgTable("google_sheets_sync_configs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  spreadsheetId: text("spreadsheet_id").notNull(),
  apiKeyEncrypted: text("api_key_encrypted"),
  sheetGid: text("sheet_gid"),
  sheetName: text("sheet_name").notNull().default("Sheet1"),
  columnMapping: jsonb("column_mapping").notNull().$type<Record<string, string>>(),
  duplicateStrategy: text("duplicate_strategy").notNull().default("skip"),
  defaultLeadStatus: text("default_lead_status").notNull().default("Raw Lead Captured"),
  defaultTags: text("default_tags"),
  isActive: boolean("is_active").notNull().default(true),
  lastSyncedRow: integer("last_synced_row").default(1),
  lastSyncedAt: timestamp("last_synced_at"),
  lastSyncStatus: text("last_sync_status"),
  lastSyncLeadsCreated: integer("last_sync_leads_created").default(0),
  lastSyncLeadsSkipped: integer("last_sync_leads_skipped").default(0),
  lastSyncMessage: text("last_sync_message"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
});

export type GoogleSheetsSyncConfig = typeof googleSheetsSyncConfigs.$inferSelect;
export const insertGoogleSheetsSyncConfigSchema = createInsertSchema(googleSheetsSyncConfigs).omit({
  id: true, createdAt: true, modifiedAt: true,
  lastSyncedRow: true, lastSyncedAt: true, lastSyncStatus: true,
  lastSyncLeadsCreated: true, lastSyncLeadsSkipped: true, lastSyncMessage: true,
});
