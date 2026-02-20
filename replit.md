# VIROC Hospital CRM Platform

## Overview
Multi-tenant Hospital CRM platform designed for VIROC Hospital. Manages the Lead-to-Consultation-to-Conversion lifecycle with SLA tracking, telephony integration support, and role-based access.

## Architecture
- **Frontend:** React + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Express.js + Node.js
- **Database:** PostgreSQL with Drizzle ORM
- **Auth:** Replit Auth (OpenID Connect)
- **Multi-Tenant:** All tables include `tenantId`, data isolated per tenant

## Key Pages
- `/` - Dashboard (authenticated) or Landing (unauthenticated)
- `/leads` - Lead Kanban Workspace with drag-and-drop
- `/team` - Team Management (CRM Users, org hierarchy, access scoping)
- `/masters` - Master Data Management (all 9 categories, 50+ tables)

## Master Data Categories
1. Location (Country, State, City, Area, PinCode, BranchServiceability)
2. Organisation (Organisation, Branch, Department, Designation, CRM Users, Calling Lines)
3. Treatment (TreatmentDepartment, SubDepartment, ConsultationType)
4. Doctors (Doctor, OPD Timing, Surgery Window, Leave Exceptions, Doctor Speciality Mapping)
5. Lead Generation (LeadSourceCategory, LeadSource, Campaign Channels, UTM fields, Referrers)
6. Consultation (AppointmentType, ConversionStage, LostReason, NoShowReason)
7. Activity & Workflow (ActivityType, NextActionType, TaskCategory, LeadStatus, etc.)
8. Communication (Template, Holiday, Tag)
9. Governance (SLA Rules, Reminder Policies, Data Retention Policies)

## API Structure
- Generic Master CRUD: `GET/POST/PATCH/DELETE /api/masters/:tableName`
- CSV Bulk Import/Export: `GET/POST /api/masters/:tableName/export|import|template|import-logs`
- CRM Users: `GET/POST/PATCH/DELETE /api/crm-users`, `GET /api/crm-users/:id/team`
- Leads: `GET/POST/PATCH /api/leads`
- Tasks: `GET/POST/PATCH /api/tasks`
- Activities: `GET/POST /api/leads/:leadId/activities`
- Master Categories: `GET /api/masters-categories`

## CRM User Management
- Enhanced schema: reportingTo (self-ref hierarchy), accessScopeType (All/Branch/Department/Self), phiAccessLevel (Full/Masked/None)
- List view with search, sortable table
- Org Tree view with expandable hierarchy
- CRUD via storage interface with Zod validation

## Color Scheme
- Primary: #0f4c81 (Viroc Blue)
- Accent: #ff8c00 (Orange)
- Background: Light with medical-professional feel

## Recent Changes
- 2026-02-20: Phase 2 - Team Management page with CRM user CRUD, org tree, access scoping
- 2026-02-20: Phase 1B - Bulk CSV import/export for master data, import logs
- 2026-02-20: Phase 1A - Governance masters, tenant settings, pin codes, doctor speciality mappings
- 2026-02-20: Initial build with all 45+ master tables, Lead Kanban, Dashboard, Master Data UI
