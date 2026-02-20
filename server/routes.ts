import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { db } from "./db";
import { tenants, leads } from "@shared/schema";
import { eq } from "drizzle-orm";

async function seedDatabase() {
  try {
    // Check if tenant exists
    const existingTenants = await db.select().from(tenants);
    if (existingTenants.length === 0) {
      const [tenant] = await db.insert(tenants).values({
        name: "VIROC Hospital",
        subdomain: "viroc",
        primaryColor: "#005b9f",
      }).returning();

      // Create some initial leads
      await storage.createLead({
        tenantId: tenant.id,
        name: "John Doe",
        phoneE164: "+919876543210",
        email: "john.doe@example.com",
        status: "Raw Lead Captured",
      });

      await storage.createLead({
        tenantId: tenant.id,
        name: "Jane Smith",
        phoneE164: "+919876543211",
        email: "jane.smith@example.com",
        status: "Qualified",
      });

      await storage.createLead({
        tenantId: tenant.id,
        name: "Rahul Verma",
        phoneE164: "+919876543212",
        email: "rahul.v@example.com",
        status: "Appointment Booked",
      });
    }
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Set up authentication before registering other routes
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get(api.tenants.get.path, isAuthenticated, async (req, res) => {
    // For now, return the first tenant as default
    const allTenants = await db.select().from(tenants);
    if (allTenants.length > 0) {
      res.json(allTenants[0]);
    } else {
      res.status(404).json({ message: "No tenant found" });
    }
  });

  app.get(api.leads.list.path, isAuthenticated, async (req, res) => {
    // Assuming tenantId = 1 for MVP
    const allLeads = await storage.getLeads(1);
    res.json(allLeads);
  });

  app.get(api.leads.get.path, isAuthenticated, async (req, res) => {
    const lead = await storage.getLead(Number(req.params.id));
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }
    res.json(lead);
  });

  app.post(api.leads.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.leads.create.input.parse(req.body);
      const lead = await storage.createLead(input);
      res.status(201).json(lead);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
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
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

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
        return res.status(400).json({
          message: err.errors[0].message,
        });
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
        return res.status(400).json({
          message: err.errors[0].message,
        });
      }
      throw err;
    }
  });

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
        return res.status(400).json({
          message: err.errors[0].message,
        });
      }
      throw err;
    }
  });

  // Call the seed function
  await seedDatabase();

  return httpServer;
}
