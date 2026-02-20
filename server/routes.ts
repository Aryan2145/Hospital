import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, MASTER_CATEGORIES } from "@shared/routes";
import { MASTER_TABLE_REGISTRY, bulkImportLogs } from "@shared/schema";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { db } from "./db";
import { tenants, leads, leadStatuses, activityTypes, nextActionTypes, taskCategories, callStatuses, callDirections, appointmentStatuses, referralStatuses, leadSourceCategories, leadSources, campaignChannels, appointmentTypes, conversionStages, lostReasons, noShowReasons, consultationTypes, countries, states, cities, designations, employmentTypes, systemRoles, organisations } from "@shared/schema";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { desc, eq, and } from "drizzle-orm";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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

  // Helper: get the default tenant ID
  async function getDefaultTenantId(): Promise<number> {
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
      const tid = await getDefaultTenantId();
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
      const tid = await getDefaultTenantId();
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
      const tid = await getDefaultTenantId();
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

    const tenantId = await getDefaultTenantId();
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
    const tid = await getDefaultTenantId();
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
      const tid = await getDefaultTenantId();
      const record = await storage.createMasterRecord(tableName, { ...req.body, tenantId: tid });
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
      const tid = await getDefaultTenantId();
      const record = await storage.updateMasterRecord(tableName, Number(id), req.body, tid);
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
      const tid = await getDefaultTenantId();
      await storage.deleteMasterRecord(tableName, Number(id), tid);
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Seed the database
  await seedDatabase();

  return httpServer;
}
