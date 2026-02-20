import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb, time } from "drizzle-orm/pg-core";
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
  primaryColor: text("primary_color").default('#005b9f'),
  secondaryColor: text("secondary_color").default('#f0f7fc'),
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
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const administrativeSubDepartments = pgTable("administrative_sub_departments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  departmentId: integer("department_id").notNull().references(() => administrativeDepartments.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
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
  branchId: integer("branch_id").references(() => branches.id),
  departmentId: integer("department_id").references(() => administrativeDepartments.id),
  designationId: integer("designation_id").references(() => designations.id),
  employmentTypeId: integer("employment_type_id").references(() => employmentTypes.id),
  systemRoleId: integer("system_role_id").references(() => systemRoles.id),
  reportingTo: integer("reporting_to"),
  accessScopeType: text("access_scope_type").notNull().default("Self"),
  phiAccessLevel: text("phi_access_level").notNull().default("None"),
  joiningDate: timestamp("joining_date"),
  isActive: boolean("is_active").notNull().default(true),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
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
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const treatmentSubDepartments = pgTable("treatment_sub_departments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  treatmentDepartmentId: integer("treatment_department_id").notNull().references(() => treatmentDepartments.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
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
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
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
  phone: text("phone"),
  email: text("email"),
  status: text("status").notNull().default("Active"),
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
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const surgeryWindows = pgTable("surgery_windows", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  branchId: integer("branch_id").references(() => branches.id),
  dayOfWeek: text("day_of_week").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const doctorLeaveExceptions = pgTable("doctor_leave_exceptions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  leaveDate: timestamp("leave_date").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("Active"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

export const doctorSpecialityMappings = pgTable("doctor_speciality_mappings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  treatmentSubDepartmentId: integer("treatment_sub_department_id").notNull().references(() => treatmentSubDepartments.id),
  isPrimary: boolean("is_primary").default(false),
  status: text("status").notNull().default("Active"),
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
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
  modifiedAt: timestamp("modified_at").defaultNow(),
  modifiedBy: varchar("modified_by"),
});

// =============================================
// TRANSACTIONAL TABLES (Leads, Activities, Tasks, Campaigns)
// =============================================
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  platform: text("platform"),
  channel: text("channel"),
  budget: integer("budget"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
});

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  phoneE164: text("phone_e164").notNull(),
  email: text("email"),
  status: text("status").notNull().default("Raw Lead Captured"),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  hmsPatientId: text("hms_patient_id"),
  branchId: integer("branch_id").references(() => branches.id),
  leadSourceId: integer("lead_source_id").references(() => leadSources.id),
  doctorId: integer("doctor_id").references(() => doctors.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  leadId: integer("lead_id").notNull().references(() => leads.id),
  type: text("type").notNull(),
  description: text("description").notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  leadId: integer("lead_id").notNull().references(() => leads.id),
  title: text("title").notNull(),
  dueDate: timestamp("due_date").notNull(),
  assignedTo: varchar("assigned_to").references(() => users.id),
  status: text("status").notNull().default("Pending"),
  isSlaTriggered: boolean("is_sla_triggered").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// =============================================
// ZOD SCHEMAS
// =============================================
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, updatedAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true });

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
});

// =============================================
// TYPES
// =============================================
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
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

// Generic master record type
export interface MasterRecord {
  id: number;
  tenantId: number;
  code: string;
  name: string;
  status: string;
  displayOrder: number | null;
  createdAt: Date | null;
  createdBy: string | null;
  modifiedAt: Date | null;
  modifiedBy: string | null;
  [key: string]: any;
}

// Master table registry mapping names to drizzle table references
export const MASTER_TABLE_REGISTRY: Record<string, string> = {
  countries: "countries",
  states: "states",
  cities: "cities",
  areas: "areas",
  branchServiceability: "branch_serviceability",
  organisations: "organisations",
  branches: "branches",
  administrativeDepartments: "administrative_departments",
  administrativeSubDepartments: "administrative_sub_departments",
  designations: "designations",
  employmentTypes: "employment_types",
  systemRoles: "system_roles",
  crmUsers: "crm_users",
  callingLines: "calling_lines",
  userLineAssignments: "user_line_assignments",
  treatmentDepartments: "treatment_departments",
  treatmentSubDepartments: "treatment_sub_departments",
  consultationTypes: "consultation_types",
  doctors: "doctors",
  opdTimings: "opd_timings",
  surgeryWindows: "surgery_windows",
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
  doctorSpecialityMappings: "doctor_speciality_mappings",
  slaRules: "sla_rules",
  reminderPolicies: "reminder_policies",
  dataRetentionPolicies: "data_retention_policies",
};
