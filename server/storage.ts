import { db, pool } from "./db";
import {
  tenants, leads, tasks, activities, campaigns, crmUsers, systemRoles,
  patients, contacts, patientContactLinks, appointments, episodes, auditLogs,
  opdTimings, doctorLeaveExceptions, doctors, platformConnectors, branches,
  type Tenant, type InsertTenant,
  type Patient, type InsertPatient,
  type Contact, type InsertContact,
  type PatientContactLink, type InsertPatientContactLink,
  type Lead, type InsertLead, type UpdateLeadRequest,
  type Task, type InsertTask, type UpdateTaskRequest,
  type Activity, type InsertActivity,
  type Campaign, type InsertCampaign,
  type CrmUser, type InsertCrmUser,
  type Appointment, type InsertAppointment,
  type Episode, type InsertEpisode,
  type AuditLog, type InsertAuditLog,
  type PlatformConnector, type InsertPlatformConnector,
  type MasterRecord,
  MASTER_TABLE_REGISTRY,
} from "@shared/schema";
import { eq, and, desc, gte, lte, sql, ne, count } from "drizzle-orm";

export interface IStorage {
  // Tenant
  getTenant(id: number): Promise<Tenant | undefined>;
  // Leads
  getLeads(tenantId: number): Promise<Lead[]>;
  getLead(id: number): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, updates: UpdateLeadRequest): Promise<Lead>;
  // Tasks
  getTasks(tenantId: number, leadId?: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, updates: UpdateTaskRequest): Promise<Task>;
  // Activities
  getActivities(leadId: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  // Patients
  getPatients(tenantId: number): Promise<Patient[]>;
  getPatient(id: number, tenantId: number): Promise<Patient | undefined>;
  createPatient(data: InsertPatient): Promise<Patient>;
  updatePatient(id: number, tenantId: number, data: Partial<InsertPatient>): Promise<Patient>;
  // Contacts
  getContactsForPatient(patientId: number, tenantId: number): Promise<Contact[]>;
  createContact(data: InsertContact): Promise<Contact>;
  updateContact(id: number, tenantId: number, data: Partial<InsertContact>): Promise<Contact>;
  deleteContact(id: number, tenantId: number): Promise<void>;
  linkPatientContact(data: InsertPatientContactLink): Promise<PatientContactLink>;
  unlinkPatientContact(patientId: number, contactId: number, tenantId: number): Promise<void>;
  // CRM Users
  getCrmUsers(tenantId: number): Promise<CrmUser[]>;
  getCrmUser(id: number, tenantId: number): Promise<CrmUser | undefined>;
  getCrmUserByAuthId(authUserId: string, tenantId: number): Promise<CrmUser | undefined>;
  getCrmUserByEmail(email: string, tenantId: number): Promise<CrmUser | undefined>;
  getCrmUserCount(tenantId: number): Promise<number>;
  getSystemRoleByCode(code: string, tenantId: number): Promise<{ id: number; code: string; name: string } | undefined>;
  createCrmUser(data: InsertCrmUser): Promise<CrmUser>;
  updateCrmUser(id: number, tenantId: number, data: Partial<InsertCrmUser>): Promise<CrmUser>;
  deleteCrmUser(id: number, tenantId: number): Promise<void>;
  getCrmUserDirectReports(managerId: number, tenantId: number): Promise<CrmUser[]>;
  // Appointments
  getAppointments(tenantId: number, filters?: Record<string, any>): Promise<Appointment[]>;
  getAppointment(id: number, tenantId: number): Promise<Appointment | undefined>;
  createAppointment(data: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, tenantId: number, data: Partial<InsertAppointment>): Promise<Appointment>;
  getDoctorOpdTimings(doctorId: number, tenantId: number): Promise<any[]>;
  getDoctorLeaveExceptions(doctorId: number, tenantId: number, date: string): Promise<any[]>;
  getAppointmentsForDoctorOnDate(doctorId: number, tenantId: number, date: string): Promise<Appointment[]>;
  getNextTokenNumber(doctorId: number, tenantId: number, date: string): Promise<number>;
  getDoctors(tenantId: number): Promise<any[]>;
  // Episodes
  getEpisodes(tenantId: number, patientId?: number): Promise<Episode[]>;
  getEpisode(id: number, tenantId: number): Promise<Episode | undefined>;
  createEpisode(data: InsertEpisode): Promise<Episode>;
  updateEpisode(id: number, tenantId: number, data: Partial<InsertEpisode>): Promise<Episode>;
  // Campaigns
  getCampaigns(tenantId: number): Promise<Campaign[]>;
  getCampaign(id: number, tenantId: number): Promise<Campaign | undefined>;
  createCampaign(data: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, tenantId: number, data: Partial<InsertCampaign>): Promise<Campaign>;
  // Audit Logs
  getAuditLogs(tenantId: number, entityType?: string, entityId?: number): Promise<AuditLog[]>;
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;
  // Lead Handover & Intake
  findLeadByPhone(tenantId: number, phoneE164: string): Promise<Lead | undefined>;
  findLeadByEmail(tenantId: number, email: string): Promise<Lead | undefined>;
  getNextAssignableCrmUser(tenantId: number, branchId?: number, departmentId?: number): Promise<CrmUser | undefined>;
  // Platform Connectors
  getPlatformConnectors(tenantId: number): Promise<PlatformConnector[]>;
  getPlatformConnector(id: number, tenantId: number): Promise<PlatformConnector | undefined>;
  createPlatformConnector(data: InsertPlatformConnector): Promise<PlatformConnector>;
  updatePlatformConnector(id: number, tenantId: number, data: Partial<InsertPlatformConnector>): Promise<PlatformConnector>;
  deletePlatformConnector(id: number, tenantId: number): Promise<void>;
  // Generic Master CRUD
  getMasterRecords(tableName: string, tenantId: number): Promise<MasterRecord[]>;
  getMasterRecord(tableName: string, id: number): Promise<MasterRecord | undefined>;
  createMasterRecord(tableName: string, data: Record<string, any>): Promise<MasterRecord>;
  updateMasterRecord(tableName: string, id: number, data: Record<string, any>): Promise<MasterRecord>;
  deleteMasterRecord(tableName: string, id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // --- Tenant ---
  async getTenant(id: number): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  // --- Leads ---
  async getLeads(tenantId: number): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.tenantId, tenantId));
  }

  async getLead(id: number): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db.insert(leads).values(lead).returning();
    return newLead;
  }

  async updateLead(id: number, updates: UpdateLeadRequest): Promise<Lead> {
    const [updatedLead] = await db.update(leads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return updatedLead;
  }

  // --- Tasks ---
  async getTasks(tenantId: number, leadId?: number): Promise<Task[]> {
    const conditions = [eq(tasks.tenantId, tenantId)];
    if (leadId) conditions.push(eq(tasks.leadId, leadId));
    return await db.select().from(tasks).where(and(...conditions));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: number, updates: UpdateTaskRequest): Promise<Task> {
    const [updatedTask] = await db.update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();
    return updatedTask;
  }

  // --- Activities ---
  async getActivities(leadId: number): Promise<Activity[]> {
    return await db.select().from(activities).where(eq(activities.leadId, leadId));
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db.insert(activities).values(activity).returning();
    return newActivity;
  }

  // --- Patients ---
  async getPatients(tenantId: number): Promise<Patient[]> {
    return await db.select().from(patients).where(eq(patients.tenantId, tenantId));
  }

  async getPatient(id: number, tenantId: number): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients)
      .where(and(eq(patients.id, id), eq(patients.tenantId, tenantId)));
    return patient;
  }

  async createPatient(data: InsertPatient): Promise<Patient> {
    const [patient] = await db.insert(patients).values(data).returning();
    return patient;
  }

  async updatePatient(id: number, tenantId: number, data: Partial<InsertPatient>): Promise<Patient> {
    const [patient] = await db.update(patients)
      .set({ ...data, modifiedAt: new Date() })
      .where(and(eq(patients.id, id), eq(patients.tenantId, tenantId)))
      .returning();
    if (!patient) throw new Error("Patient not found");
    return patient;
  }

  // --- Contacts ---
  async getContactsForPatient(patientId: number, tenantId: number): Promise<Contact[]> {
    const links = await db.select().from(patientContactLinks)
      .where(and(eq(patientContactLinks.patientId, patientId), eq(patientContactLinks.tenantId, tenantId)));
    if (links.length === 0) return [];
    const contactIds = links.map(l => l.contactId);
    const result: Contact[] = [];
    for (const cid of contactIds) {
      const [c] = await db.select().from(contacts)
        .where(and(eq(contacts.id, cid), eq(contacts.tenantId, tenantId)));
      if (c) result.push(c);
    }
    return result;
  }

  async createContact(data: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(data).returning();
    return contact;
  }

  async updateContact(id: number, tenantId: number, data: Partial<InsertContact>): Promise<Contact> {
    const [contact] = await db.update(contacts)
      .set({ ...data, modifiedAt: new Date() })
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)))
      .returning();
    if (!contact) throw new Error("Contact not found");
    return contact;
  }

  async deleteContact(id: number, tenantId: number): Promise<void> {
    await db.delete(patientContactLinks)
      .where(and(eq(patientContactLinks.contactId, id), eq(patientContactLinks.tenantId, tenantId)));
    await db.delete(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)));
  }

  async linkPatientContact(data: InsertPatientContactLink): Promise<PatientContactLink> {
    const [link] = await db.insert(patientContactLinks).values(data).returning();
    return link;
  }

  async unlinkPatientContact(patientId: number, contactId: number, tenantId: number): Promise<void> {
    await db.delete(patientContactLinks)
      .where(and(
        eq(patientContactLinks.patientId, patientId),
        eq(patientContactLinks.contactId, contactId),
        eq(patientContactLinks.tenantId, tenantId)
      ));
  }

  // --- CRM Users ---
  async getCrmUsers(tenantId: number): Promise<CrmUser[]> {
    return await db.select().from(crmUsers).where(eq(crmUsers.tenantId, tenantId));
  }

  async getCrmUser(id: number, tenantId: number): Promise<CrmUser | undefined> {
    const [user] = await db.select().from(crmUsers)
      .where(and(eq(crmUsers.id, id), eq(crmUsers.tenantId, tenantId)));
    return user;
  }

  async getCrmUserByAuthId(authUserId: string, tenantId: number): Promise<CrmUser | undefined> {
    const [user] = await db.select().from(crmUsers)
      .where(and(eq(crmUsers.userId, authUserId), eq(crmUsers.tenantId, tenantId)));
    return user;
  }

  async getCrmUserByEmail(email: string, tenantId: number): Promise<CrmUser | undefined> {
    const [user] = await db.select().from(crmUsers)
      .where(and(eq(crmUsers.email, email), eq(crmUsers.tenantId, tenantId)));
    return user;
  }

  async getCrmUserCount(tenantId: number): Promise<number> {
    const [result] = await db.select({ cnt: count() }).from(crmUsers)
      .where(eq(crmUsers.tenantId, tenantId));
    return result?.cnt ?? 0;
  }

  async getSystemRoleByCode(code: string, tenantId: number): Promise<{ id: number; code: string; name: string } | undefined> {
    const [role] = await db.select({ id: systemRoles.id, code: systemRoles.code, name: systemRoles.name })
      .from(systemRoles)
      .where(and(eq(systemRoles.code, code), eq(systemRoles.tenantId, tenantId)));
    return role;
  }

  async createCrmUser(data: InsertCrmUser): Promise<CrmUser> {
    const [user] = await db.insert(crmUsers).values(data).returning();
    return user;
  }

  async updateCrmUser(id: number, tenantId: number, data: Partial<InsertCrmUser>): Promise<CrmUser> {
    const [user] = await db.update(crmUsers)
      .set({ ...data, modifiedAt: new Date() })
      .where(and(eq(crmUsers.id, id), eq(crmUsers.tenantId, tenantId)))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async deleteCrmUser(id: number, tenantId: number): Promise<void> {
    await db.delete(crmUsers)
      .where(and(eq(crmUsers.id, id), eq(crmUsers.tenantId, tenantId)));
  }

  async getCrmUserDirectReports(managerId: number, tenantId: number): Promise<CrmUser[]> {
    return await db.select().from(crmUsers)
      .where(and(eq(crmUsers.reportingTo, managerId), eq(crmUsers.tenantId, tenantId)));
  }

  // --- Appointments ---
  async getAppointments(tenantId: number, filters?: Record<string, any>): Promise<Appointment[]> {
    const conditions = [eq(appointments.tenantId, tenantId)];
    if (filters?.leadId) conditions.push(eq(appointments.leadId, filters.leadId));
    if (filters?.patientId) conditions.push(eq(appointments.patientId, filters.patientId));
    if (filters?.doctorId) conditions.push(eq(appointments.doctorId, filters.doctorId));
    if (filters?.branchId) conditions.push(eq(appointments.branchId, filters.branchId));
    if (filters?.status) conditions.push(eq(appointments.status, filters.status));
    if (filters?.dateFrom) conditions.push(gte(appointments.appointmentDate, new Date(filters.dateFrom)));
    if (filters?.dateTo) conditions.push(lte(appointments.appointmentDate, new Date(filters.dateTo + "T23:59:59.999Z")));
    return await db.select().from(appointments).where(and(...conditions)).orderBy(desc(appointments.appointmentDate));
  }

  async getAppointmentsEnriched(tenantId: number, filters?: Record<string, any>): Promise<any[]> {
    const conditions: ReturnType<typeof sql>[] = [sql`a.tenant_id = ${tenantId}`];
    if (filters?.leadId) conditions.push(sql`a.lead_id = ${Number(filters.leadId)}`);
    if (filters?.patientId) conditions.push(sql`a.patient_id = ${Number(filters.patientId)}`);
    if (filters?.doctorId) conditions.push(sql`a.doctor_id = ${Number(filters.doctorId)}`);
    if (filters?.branchId) conditions.push(sql`a.branch_id = ${Number(filters.branchId)}`);
    if (filters?.status) conditions.push(sql`a.status = ${String(filters.status)}`);
    if (filters?.dateFrom) conditions.push(sql`a.appointment_date >= ${new Date(filters.dateFrom + "T00:00:00.000Z")}`);
    if (filters?.dateTo) conditions.push(sql`a.appointment_date <= ${new Date(filters.dateTo + "T23:59:59.999Z")}`);

    const whereClause = conditions.reduce((acc, cond, i) => i === 0 ? cond : sql`${acc} AND ${cond}`);

    const result = await db.execute(sql`
      SELECT a.id, a.tenant_id AS "tenantId", a.lead_id AS "leadId", a.patient_id AS "patientId",
        a.doctor_id AS "doctorId", a.branch_id AS "branchId", a.appointment_type_id AS "appointmentTypeId",
        a.appointment_date AS "appointmentDate", a.start_time AS "startTime", a.end_time AS "endTime",
        a.token_number AS "tokenNumber", a.status, a.reschedule_count AS "rescheduleCount",
        a.cancel_reason AS "cancelReason", a.consultation_notes AS "consultationNotes",
        a.notes, a.created_at AS "createdAt",
        d.name AS "doctorName",
        l.name AS "leadName", l.phone_e164 AS "leadPhone",
        p.first_name AS "patientFirstName", p.last_name AS "patientLastName", p.primary_phone AS "patientPhone",
        b.name AS "branchName"
      FROM appointments a
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN leads l ON a.lead_id = l.id
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN branches b ON a.branch_id = b.id
      WHERE ${whereClause}
      ORDER BY a.appointment_date, a.start_time
    `);

    const rows = (result as any).rows || result;
    return rows.map((r: any) => ({
      ...r,
      patientName: r.patientFirstName && r.patientLastName
        ? `${r.patientFirstName} ${r.patientLastName}`
        : r.patientFirstName || r.patientLastName || null,
    }));
  }

  async getAppointment(id: number, tenantId: number): Promise<Appointment | undefined> {
    const [appt] = await db.select().from(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId)));
    return appt;
  }

  async createAppointment(data: InsertAppointment): Promise<Appointment> {
    const [appt] = await db.insert(appointments).values(data).returning();
    return appt;
  }

  async updateAppointment(id: number, tenantId: number, data: Partial<InsertAppointment>): Promise<Appointment> {
    const [appt] = await db.update(appointments)
      .set({ ...data, modifiedAt: new Date() })
      .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId)))
      .returning();
    if (!appt) throw new Error("Appointment not found");
    return appt;
  }

  async getDoctorOpdTimings(doctorId: number, tenantId: number): Promise<any[]> {
    return await db.select().from(opdTimings)
      .where(and(eq(opdTimings.doctorId, doctorId), eq(opdTimings.tenantId, tenantId), eq(opdTimings.status, "Active")));
  }

  async getDoctorLeaveExceptions(doctorId: number, tenantId: number, date: string): Promise<any[]> {
    const dayStart = new Date(date + "T00:00:00.000Z");
    const dayEnd = new Date(date + "T23:59:59.999Z");
    return await db.select().from(doctorLeaveExceptions)
      .where(and(
        eq(doctorLeaveExceptions.doctorId, doctorId),
        eq(doctorLeaveExceptions.tenantId, tenantId),
        gte(doctorLeaveExceptions.leaveDate, dayStart),
        lte(doctorLeaveExceptions.leaveDate, dayEnd),
      ));
  }

  async getAppointmentsForDoctorOnDate(doctorId: number, tenantId: number, date: string): Promise<Appointment[]> {
    const dayStart = new Date(date + "T00:00:00.000Z");
    const dayEnd = new Date(date + "T23:59:59.999Z");
    return await db.select().from(appointments)
      .where(and(
        eq(appointments.doctorId, doctorId),
        eq(appointments.tenantId, tenantId),
        gte(appointments.appointmentDate, dayStart),
        lte(appointments.appointmentDate, dayEnd),
        ne(appointments.status, "Cancelled"),
      ));
  }

  async getNextTokenNumber(doctorId: number, tenantId: number, date: string): Promise<number> {
    const dayStart = new Date(date + "T00:00:00.000Z");
    const dayEnd = new Date(date + "T23:59:59.999Z");
    const result = await db.select({ maxToken: sql<number>`COALESCE(MAX(${appointments.tokenNumber}), 0)` })
      .from(appointments)
      .where(and(
        eq(appointments.doctorId, doctorId),
        eq(appointments.tenantId, tenantId),
        gte(appointments.appointmentDate, dayStart),
        lte(appointments.appointmentDate, dayEnd),
        ne(appointments.status, "Cancelled"),
      ));
    return (result[0]?.maxToken || 0) + 1;
  }

  async getDoctors(tenantId: number): Promise<any[]> {
    return await db.select().from(doctors)
      .where(and(eq(doctors.tenantId, tenantId), eq(doctors.status, "Active")));
  }

  // --- Episodes ---
  async getEpisodes(tenantId: number, patientId?: number): Promise<Episode[]> {
    if (patientId) {
      return await db.select().from(episodes)
        .where(and(eq(episodes.tenantId, tenantId), eq(episodes.patientId, patientId)));
    }
    return await db.select().from(episodes).where(eq(episodes.tenantId, tenantId));
  }

  async getEpisode(id: number, tenantId: number): Promise<Episode | undefined> {
    const [ep] = await db.select().from(episodes)
      .where(and(eq(episodes.id, id), eq(episodes.tenantId, tenantId)));
    return ep;
  }

  async createEpisode(data: InsertEpisode): Promise<Episode> {
    const [ep] = await db.insert(episodes).values(data).returning();
    return ep;
  }

  async updateEpisode(id: number, tenantId: number, data: Partial<InsertEpisode>): Promise<Episode> {
    const [ep] = await db.update(episodes)
      .set({ ...data, modifiedAt: new Date() })
      .where(and(eq(episodes.id, id), eq(episodes.tenantId, tenantId)))
      .returning();
    if (!ep) throw new Error("Episode not found");
    return ep;
  }

  // --- Campaigns ---
  async getCampaigns(tenantId: number): Promise<Campaign[]> {
    return await db.select().from(campaigns).where(eq(campaigns.tenantId, tenantId));
  }

  async getCampaign(id: number, tenantId: number): Promise<Campaign | undefined> {
    const [c] = await db.select().from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)));
    return c;
  }

  async createCampaign(data: InsertCampaign): Promise<Campaign> {
    const [c] = await db.insert(campaigns).values(data).returning();
    return c;
  }

  async updateCampaign(id: number, tenantId: number, data: Partial<InsertCampaign>): Promise<Campaign> {
    const [c] = await db.update(campaigns)
      .set(data)
      .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
      .returning();
    if (!c) throw new Error("Campaign not found");
    return c;
  }

  // --- Platform Connectors ---
  async getPlatformConnectors(tenantId: number): Promise<PlatformConnector[]> {
    return await db.select().from(platformConnectors)
      .where(eq(platformConnectors.tenantId, tenantId))
      .orderBy(platformConnectors.platform);
  }

  async getPlatformConnector(id: number, tenantId: number): Promise<PlatformConnector | undefined> {
    const [c] = await db.select().from(platformConnectors)
      .where(and(eq(platformConnectors.id, id), eq(platformConnectors.tenantId, tenantId)));
    return c;
  }

  async createPlatformConnector(data: InsertPlatformConnector): Promise<PlatformConnector> {
    const [c] = await db.insert(platformConnectors).values(data).returning();
    return c;
  }

  async updatePlatformConnector(id: number, tenantId: number, data: Partial<InsertPlatformConnector>): Promise<PlatformConnector> {
    const [c] = await db.update(platformConnectors)
      .set({ ...data, modifiedAt: new Date() })
      .where(and(eq(platformConnectors.id, id), eq(platformConnectors.tenantId, tenantId)))
      .returning();
    if (!c) throw new Error("Connector not found");
    return c;
  }

  async deletePlatformConnector(id: number, tenantId: number): Promise<void> {
    await db.delete(platformConnectors)
      .where(and(eq(platformConnectors.id, id), eq(platformConnectors.tenantId, tenantId)));
  }

  // --- Audit Logs ---
  async getAuditLogs(tenantId: number, entityType?: string, entityId?: number): Promise<AuditLog[]> {
    if (entityType && entityId) {
      return await db.select().from(auditLogs)
        .where(and(
          eq(auditLogs.tenantId, tenantId),
          eq(auditLogs.entityType, entityType),
          eq(auditLogs.entityId, entityId)
        ))
        .orderBy(desc(auditLogs.createdAt));
    }
    if (entityType) {
      return await db.select().from(auditLogs)
        .where(and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.entityType, entityType)))
        .orderBy(desc(auditLogs.createdAt));
    }
    return await db.select().from(auditLogs)
      .where(eq(auditLogs.tenantId, tenantId))
      .orderBy(desc(auditLogs.createdAt));
  }

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(data).returning();
    return log;
  }

  // --- Lead Handover & Intake ---
  async findLeadByPhone(tenantId: number, phoneE164: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads)
      .where(and(eq(leads.tenantId, tenantId), eq(leads.phoneE164, phoneE164)));
    return lead;
  }

  async findLeadByEmail(tenantId: number, email: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads)
      .where(and(eq(leads.tenantId, tenantId), eq(leads.email, email)));
    return lead;
  }

  async getNextAssignableCrmUser(tenantId: number, branchId?: number, departmentId?: number): Promise<CrmUser | undefined> {
    const conditions = [eq(crmUsers.tenantId, tenantId), eq(crmUsers.isActive, true)];
    if (branchId) conditions.push(eq(crmUsers.branchId, branchId));
    if (departmentId) conditions.push(eq(crmUsers.departmentId, departmentId));

    const availableUsers = await db.select().from(crmUsers).where(and(...conditions));
    if (availableUsers.length === 0) {
      if (branchId || departmentId) {
        return this.getNextAssignableCrmUser(tenantId);
      }
      return undefined;
    }

    const lastAssigned = await db.select({ assignedCrmUserId: leads.assignedCrmUserId })
      .from(leads)
      .where(eq(leads.tenantId, tenantId))
      .orderBy(desc(leads.createdAt))
      .limit(1);

    const lastId = lastAssigned[0]?.assignedCrmUserId;
    if (!lastId) return availableUsers[0];

    const lastIndex = availableUsers.findIndex(u => u.id === lastId);
    const nextIndex = (lastIndex + 1) % availableUsers.length;
    return availableUsers[nextIndex];
  }

  // --- Generic Master CRUD ---
  private resolveTableName(key: string): string {
    const pgTableName = MASTER_TABLE_REGISTRY[key];
    if (!pgTableName) {
      throw new Error(`Unknown master table: ${key}`);
    }
    return pgTableName;
  }

  async getMasterRecords(tableName: string, tenantId: number): Promise<MasterRecord[]> {
    const pgTable = this.resolveTableName(tableName);
    const result = await pool.query(
      `SELECT * FROM "${pgTable}" WHERE tenant_id = $1 ORDER BY display_order ASC, id ASC`,
      [tenantId]
    );
    return result.rows.map((row: any) => this.mapRowToMaster(row));
  }

  async getMasterRecord(tableName: string, id: number, tenantId?: number): Promise<MasterRecord | undefined> {
    const pgTable = this.resolveTableName(tableName);
    let query = `SELECT * FROM "${pgTable}" WHERE id = $1`;
    const params: any[] = [id];
    if (tenantId !== undefined) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return undefined;
    return this.mapRowToMaster(result.rows[0]);
  }

  async createMasterRecord(tableName: string, data: Record<string, any>): Promise<MasterRecord> {
    const pgTable = this.resolveTableName(tableName);
    const now = new Date();
    data.created_at = now;
    data.modified_at = now;

    // Convert camelCase keys to snake_case for DB
    const snakeData = this.toSnakeCase(data);

    const keys = Object.keys(snakeData);
    const values = Object.values(snakeData);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const columns = keys.map(k => `"${k}"`).join(", ");

    const result = await pool.query(
      `INSERT INTO "${pgTable}" (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    return this.mapRowToMaster(result.rows[0]);
  }

  async updateMasterRecord(tableName: string, id: number, data: Record<string, any>, tenantId?: number): Promise<MasterRecord> {
    const pgTable = this.resolveTableName(tableName);
    data.modified_at = new Date();

    const snakeData = this.toSnakeCase(data);
    delete snakeData.id;
    delete snakeData.created_at;

    const keys = Object.keys(snakeData);
    const values = Object.values(snakeData);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");

    let whereClause = `id = $${keys.length + 1}`;
    const params = [...values, id];
    if (tenantId !== undefined) {
      whereClause += ` AND tenant_id = $${keys.length + 2}`;
      params.push(tenantId);
    }

    const result = await pool.query(
      `UPDATE "${pgTable}" SET ${setClause} WHERE ${whereClause} RETURNING *`,
      params
    );
    if (result.rows.length === 0) throw new Error("Record not found");
    return this.mapRowToMaster(result.rows[0]);
  }

  async deleteMasterRecord(tableName: string, id: number, tenantId?: number): Promise<void> {
    const pgTable = this.resolveTableName(tableName);
    let query = `DELETE FROM "${pgTable}" WHERE id = $1`;
    const params: any[] = [id];
    if (tenantId !== undefined) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    await pool.query(query, params);
  }

  private mapRowToMaster(row: any): MasterRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      code: row.code,
      name: row.name,
      status: row.status,
      displayOrder: row.display_order,
      createdAt: row.created_at,
      createdBy: row.created_by,
      modifiedAt: row.modified_at,
      modifiedBy: row.modified_by,
      ...this.toCamelCase(row),
    };
  }

  private toSnakeCase(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      result[snakeKey] = value;
    }
    return result;
  }

  private toCamelCase(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = value;
    }
    return result;
  }
}

export const storage = new DatabaseStorage();
