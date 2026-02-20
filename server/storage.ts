import { db, pool } from "./db";
import {
  tenants, leads, tasks, activities, campaigns,
  type Tenant, type InsertTenant,
  type Lead, type InsertLead, type UpdateLeadRequest,
  type Task, type InsertTask, type UpdateTaskRequest,
  type Activity, type InsertActivity,
  type Campaign, type InsertCampaign,
  type MasterRecord,
  MASTER_TABLE_REGISTRY,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Tenant
  getTenant(id: number): Promise<Tenant | undefined>;
  // Leads
  getLeads(tenantId: number): Promise<Lead[]>;
  getLead(id: number): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, updates: UpdateLeadRequest): Promise<Lead>;
  // Tasks
  getTasks(tenantId: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, updates: UpdateTaskRequest): Promise<Task>;
  // Activities
  getActivities(leadId: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
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

  // --- Activities ---
  async getActivities(leadId: number): Promise<Activity[]> {
    return await db.select().from(activities).where(eq(activities.leadId, leadId));
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db.insert(activities).values(activity).returning();
    return newActivity;
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
