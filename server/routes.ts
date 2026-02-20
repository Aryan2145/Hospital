import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, MASTER_CATEGORIES } from "@shared/routes";
import { MASTER_TABLE_REGISTRY } from "@shared/schema";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { db } from "./db";
import { tenants, leads, leadStatuses, activityTypes, nextActionTypes, taskCategories, callStatuses, callDirections, appointmentStatuses, referralStatuses, leadSourceCategories, leadSources, campaignChannels, appointmentTypes, conversionStages, lostReasons, noShowReasons, consultationTypes, countries, states, cities, designations, employmentTypes, systemRoles, organisations } from "@shared/schema";

async function seedDatabase() {
  try {
    const existingTenants = await db.select().from(tenants);
    if (existingTenants.length > 0) return;

    const [tenant] = await db.insert(tenants).values({
      name: "VIROC Hospital",
      subdomain: "viroc",
      primaryColor: "#005b9f",
    }).returning();

    const tid = tenant.id;

    // Seed leads
    await storage.createLead({ tenantId: tid, name: "Amit Patel", phoneE164: "+919876543210", email: "amit.patel@example.com", status: "Raw Lead Captured" });
    await storage.createLead({ tenantId: tid, name: "Priya Sharma", phoneE164: "+919876543211", email: "priya.sharma@example.com", status: "Qualified" });
    await storage.createLead({ tenantId: tid, name: "Rahul Verma", phoneE164: "+919876543212", status: "Contacted" });
    await storage.createLead({ tenantId: tid, name: "Sunita Mehta", phoneE164: "+919876543213", email: "sunita.m@example.com", status: "Appointment Booked" });
    await storage.createLead({ tenantId: tid, name: "Deepak Singh", phoneE164: "+919876543214", status: "Consultation Done" });

    // Seed Lead Statuses (Category 7)
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

    // Seed Activity Types
    for (const a of [
      { code: "CALL", name: "Phone Call" },
      { code: "NOTE", name: "Note" },
      { code: "EMAIL", name: "Email" },
      { code: "WHATSAPP", name: "WhatsApp" },
      { code: "STAGE_CHANGE", name: "Stage Change" },
      { code: "MEETING", name: "Meeting" },
    ]) {
      await db.insert(activityTypes).values({ tenantId: tid, ...a, status: "Active", displayOrder: 0 });
    }

    // Seed Next Action Types
    for (const n of [
      { code: "CALLBACK", name: "Call Back" },
      { code: "SEND_INFO", name: "Send Information" },
      { code: "SCHEDULE_APPT", name: "Schedule Appointment" },
      { code: "FOLLOW_UP", name: "Follow Up" },
    ]) {
      await db.insert(nextActionTypes).values({ tenantId: tid, ...n, status: "Active", displayOrder: 0 });
    }

    // Seed Task Categories
    for (const t of [
      { code: "SLA", name: "SLA Task" },
      { code: "FOLLOW_UP", name: "Follow Up" },
      { code: "REMINDER", name: "Appointment Reminder" },
    ]) {
      await db.insert(taskCategories).values({ tenantId: tid, ...t, status: "Active", displayOrder: 0 });
    }

    // Seed Call Statuses & Directions
    for (const c of [
      { code: "ANSWERED", name: "Answered" },
      { code: "NO_ANSWER", name: "No Answer" },
      { code: "BUSY", name: "Busy" },
      { code: "VOICEMAIL", name: "Voicemail" },
    ]) {
      await db.insert(callStatuses).values({ tenantId: tid, ...c, status: "Active", displayOrder: 0 });
    }
    for (const d of [
      { code: "INBOUND", name: "Inbound" },
      { code: "OUTBOUND", name: "Outbound" },
    ]) {
      await db.insert(callDirections).values({ tenantId: tid, ...d, status: "Active", displayOrder: 0 });
    }

    // Seed Appointment Statuses
    for (const a of [
      { code: "SCHEDULED", name: "Scheduled" },
      { code: "CONFIRMED", name: "Confirmed" },
      { code: "CHECKED_IN", name: "Checked In" },
      { code: "COMPLETED", name: "Completed" },
      { code: "NO_SHOW", name: "No Show" },
      { code: "CANCELLED", name: "Cancelled" },
    ]) {
      await db.insert(appointmentStatuses).values({ tenantId: tid, ...a, status: "Active", displayOrder: 0 });
    }

    // Seed Referral Statuses
    for (const r of [
      { code: "PENDING", name: "Pending" },
      { code: "ACCEPTED", name: "Accepted" },
      { code: "COMPLETED", name: "Completed" },
    ]) {
      await db.insert(referralStatuses).values({ tenantId: tid, ...r, status: "Active", displayOrder: 0 });
    }

    // Seed Lead Source Categories & Sources
    for (const lsc of [
      { code: "DIGITAL", name: "Digital Marketing" },
      { code: "OFFLINE", name: "Offline / Walk-in" },
      { code: "REFERRAL", name: "Referral" },
    ]) {
      await db.insert(leadSourceCategories).values({ tenantId: tid, ...lsc, status: "Active", displayOrder: 0 });
    }
    for (const ls of [
      { code: "META", name: "Meta (Facebook/Instagram)" },
      { code: "GOOGLE", name: "Google Ads" },
      { code: "WEBSITE", name: "Website Form" },
      { code: "WALKIN", name: "Walk-in" },
      { code: "CAMP", name: "Health Camp" },
      { code: "TELEPHONY", name: "Telephony Inbound" },
    ]) {
      await db.insert(leadSources).values({ tenantId: tid, ...ls, status: "Active", displayOrder: 0 });
    }

    // Seed Campaign Channels
    for (const cc of [
      { code: "FACEBOOK", name: "Facebook" },
      { code: "INSTAGRAM", name: "Instagram" },
      { code: "GOOGLE_SEARCH", name: "Google Search" },
      { code: "GOOGLE_DISPLAY", name: "Google Display" },
    ]) {
      await db.insert(campaignChannels).values({ tenantId: tid, ...cc, status: "Active", displayOrder: 0 });
    }

    // Seed Consultation Masters
    for (const at of [
      { code: "FIRST_VISIT", name: "First Visit" },
      { code: "FOLLOW_UP", name: "Follow Up" },
      { code: "PRE_OP", name: "Pre-Operative" },
      { code: "POST_OP", name: "Post-Operative" },
    ]) {
      await db.insert(appointmentTypes).values({ tenantId: tid, ...at, status: "Active", displayOrder: 0 });
    }
    for (const cs of [
      { code: "ENQUIRY", name: "Enquiry", sequence: 1 },
      { code: "CONSULTATION", name: "Consultation Booked", sequence: 2 },
      { code: "SURGERY_PLANNED", name: "Surgery Planned", sequence: 3 },
      { code: "CONVERTED", name: "Converted", sequence: 4, isTerminal: true, isBusinessAchieved: true },
    ]) {
      await db.insert(conversionStages).values({ tenantId: tid, ...cs, status: "Active", displayOrder: cs.sequence });
    }
    for (const lr of [
      { code: "PRICE", name: "Price Concern" },
      { code: "TRUST", name: "Trust / Confidence Issue" },
      { code: "COMPETITOR", name: "Chose Competitor" },
      { code: "NOT_READY", name: "Not Ready for Treatment" },
    ]) {
      await db.insert(lostReasons).values({ tenantId: tid, ...lr, status: "Active", displayOrder: 0 });
    }
    for (const ns of [
      { code: "FORGOT", name: "Forgot" },
      { code: "EMERGENCY", name: "Emergency" },
      { code: "TRAVEL", name: "Travel Issue" },
    ]) {
      await db.insert(noShowReasons).values({ tenantId: tid, ...ns, status: "Active", displayOrder: 0 });
    }

    // Seed Treatment
    for (const td of [
      { code: "ORTHO", name: "Orthopaedics" },
      { code: "SPINE", name: "Spine" },
      { code: "PAIN", name: "Pain Management" },
    ]) {
      await db.insert(consultationTypes).values({ tenantId: tid, ...td, status: "Active", displayOrder: 0 });
    }

    // Seed Location: Country, State, City
    const [india] = await db.insert(countries).values({ tenantId: tid, code: "IN", name: "India", status: "Active", displayOrder: 1 }).returning();
    const [gujarat] = await db.insert(states).values({ tenantId: tid, countryId: india.id, code: "GJ", name: "Gujarat", status: "Active", displayOrder: 1 }).returning();
    await db.insert(cities).values({ tenantId: tid, stateId: gujarat.id, code: "AHD", name: "Ahmedabad", status: "Active", displayOrder: 1 });

    // Seed Organisation masters
    await db.insert(designations).values({ tenantId: tid, code: "MGR", name: "Manager", status: "Active", displayOrder: 1 });
    await db.insert(designations).values({ tenantId: tid, code: "EXEC", name: "Executive", status: "Active", displayOrder: 2 });
    await db.insert(employmentTypes).values({ tenantId: tid, code: "FT", name: "Full Time", status: "Active", displayOrder: 1 });
    await db.insert(employmentTypes).values({ tenantId: tid, code: "PT", name: "Part Time", status: "Active", displayOrder: 2 });
    await db.insert(systemRoles).values({ tenantId: tid, code: "ADMIN", name: "Admin", status: "Active", displayOrder: 1 });
    await db.insert(systemRoles).values({ tenantId: tid, code: "AGENT", name: "Agent", status: "Active", displayOrder: 2 });
    await db.insert(systemRoles).values({ tenantId: tid, code: "MANAGER", name: "Manager", status: "Active", displayOrder: 3 });
    const [org] = await db.insert(organisations).values({ tenantId: tid, code: "VIROC", name: "VIROC Hospital", status: "Active", displayOrder: 1 }).returning();

    console.log("Database seeded successfully with all master data");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await setupAuth(app);
  registerAuthRoutes(app);

  // --- Tenant ---
  app.get(api.tenants.get.path, isAuthenticated, async (req, res) => {
    const allTenants = await db.select().from(tenants);
    if (allTenants.length > 0) {
      res.json(allTenants[0]);
    } else {
      res.status(404).json({ message: "No tenant found" });
    }
  });

  // --- Leads ---
  app.get(api.leads.list.path, isAuthenticated, async (req, res) => {
    const allLeads = await storage.getLeads(1);
    res.json(allLeads);
  });

  app.get(api.leads.get.path, isAuthenticated, async (req, res) => {
    const lead = await storage.getLead(Number(req.params.id));
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json(lead);
  });

  app.post(api.leads.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.leads.create.input.parse(req.body);
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
      const input = api.leads.update.input.parse(req.body);
      const lead = await storage.updateLead(Number(req.params.id), input);
      res.json(lead);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  // --- Tasks ---
  app.get(api.tasks.list.path, isAuthenticated, async (req, res) => {
    const allTasks = await storage.getTasks(1);
    res.json(allTasks);
  });

  app.post(api.tasks.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.tasks.create.input.parse(req.body);
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
      const input = api.activities.create.input.parse(req.body);
      const activity = await storage.createActivity(input);
      res.status(201).json(activity);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // --- Generic Master CRUD ---
  app.get(api.masters.categories.path, isAuthenticated, async (_req, res) => {
    res.json(MASTER_CATEGORIES);
  });

  app.get(api.masters.list.path, isAuthenticated, async (req, res) => {
    const { tableName } = req.params;
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }
    try {
      const records = await storage.getMasterRecords(tableName, 1);
      res.json(records);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get(api.masters.get.path, isAuthenticated, async (req, res) => {
    const { tableName, id } = req.params;
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }
    const record = await storage.getMasterRecord(tableName, Number(id), 1);
    if (!record) return res.status(404).json({ message: "Record not found" });
    res.json(record);
  });

  app.post(api.masters.create.path, isAuthenticated, async (req, res) => {
    const { tableName } = req.params;
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }
    try {
      const record = await storage.createMasterRecord(tableName, { ...req.body, tenantId: 1 });
      res.status(201).json(record);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch(api.masters.update.path, isAuthenticated, async (req, res) => {
    const { tableName, id } = req.params;
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }
    try {
      const record = await storage.updateMasterRecord(tableName, Number(id), req.body, 1);
      res.json(record);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete(api.masters.delete.path, isAuthenticated, async (req, res) => {
    const { tableName, id } = req.params;
    if (!MASTER_TABLE_REGISTRY[tableName]) {
      return res.status(400).json({ message: `Unknown master table: ${tableName}` });
    }
    try {
      await storage.deleteMasterRecord(tableName, Number(id), 1);
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Seed the database
  await seedDatabase();

  return httpServer;
}
