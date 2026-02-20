import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";

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
  role: text("role").notNull().default('agent'), // superadmin, admin, manager, agent
});

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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  leadId: integer("lead_id").notNull().references(() => leads.id),
  type: text("type").notNull(), // call, note, stage_change
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
  status: text("status").notNull().default("Pending"), // Pending, Completed
  isSlaTriggered: boolean("is_sla_triggered").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const tenantRelations = relations(tenants, ({ many }) => ({
  tenantUsers: many(tenantUsers),
  leads: many(leads),
  campaigns: many(campaigns),
}));

export const leadRelations = relations(leads, ({ one, many }) => ({
  tenant: one(tenants, { fields: [leads.tenantId], references: [tenants.id] }),
  campaign: one(campaigns, { fields: [leads.campaignId], references: [campaigns.id] }),
  assignedUser: one(users, { fields: [leads.assignedTo], references: [users.id] }),
  activities: many(activities),
  tasks: many(tasks),
}));

// Zod schemas
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, updatedAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true });

// Explicit types
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
