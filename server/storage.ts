import { db } from "./db";
import {
  tenants, leads, tasks, activities, campaigns,
  type Tenant, type InsertTenant,
  type Lead, type InsertLead, type UpdateLeadRequest,
  type Task, type InsertTask, type UpdateTaskRequest,
  type Activity, type InsertActivity,
  type Campaign, type InsertCampaign
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getTenant(id: number): Promise<Tenant | undefined>;
  getLeads(tenantId: number): Promise<Lead[]>;
  getLead(id: number): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, updates: UpdateLeadRequest): Promise<Lead>;
  getTasks(tenantId: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, updates: UpdateTaskRequest): Promise<Task>;
  getActivities(leadId: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
}

export class DatabaseStorage implements IStorage {
  async getTenant(id: number): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

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

  async getTasks(tenantId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.tenantId, tenantId));
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

  async getActivities(leadId: number): Promise<Activity[]> {
    return await db.select().from(activities).where(eq(activities.leadId, leadId));
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db.insert(activities).values(activity).returning();
    return newActivity;
  }
}

export const storage = new DatabaseStorage();
