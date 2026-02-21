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
- `/leads/:id` - Lead Detail with activity timeline, next action, tasks, quick actions, handover banner
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
- Patients: `GET/POST/PATCH /api/patients`, `GET /api/patients/:id/contacts`
- Contacts: `POST/PATCH/DELETE /api/contacts`
- Patient-Contact Links: `POST/DELETE /api/patient-contact-links`
- Appointments: `GET/POST/PATCH /api/appointments` (filter by leadId/patientId/doctorId)
- Episodes: `GET/POST/PATCH /api/episodes` (filter by patientId)
- Audit Logs: `GET/POST /api/audit-logs` (filter by entityType/entityId)
- Leads: `GET/POST/PATCH /api/leads`
- Lead Handover: `PATCH /api/leads/:id/handover` (accept/reject)
- Lead Assignment: `POST /api/leads/:id/assign` (transfer with SLA)
- Lead Intake: `POST /api/leads/intake` (external sources, auto-dedup, auto-assign)
- Tasks: `GET/POST/PATCH /api/tasks`
- Activities: `GET/POST /api/leads/:leadId/activities`
- Active CRM Users: `GET /api/crm-users/active`
- Master Categories: `GET /api/masters-categories`
- Platform Connectors: `GET/POST/PATCH/DELETE /api/connectors`, `POST /api/connectors/:id/test`, `POST /api/connectors/:id/sync`

## CRM User Management
- Enhanced schema: reportingTo (self-ref hierarchy), accessScopeType (All/Branch/Department/Self), phiAccessLevel (Full/Masked/None)
- List view with search, sortable table
- Org Tree view with expandable hierarchy
- CRUD via storage interface with Zod validation

## Color Scheme
- Primary: #0f4c81 (Viroc Blue)
- Accent: #ff8c00 (Orange)
- Background: Light with medical-professional feel

## Key Pages
- `/` - Dashboard (authenticated) or Landing (unauthenticated)
- `/leads` - Lead Kanban Workspace with drag-and-drop
- `/leads/:id` - Lead Detail with activity timeline, next action, tasks, quick actions, handover banner
- `/appointments` - Appointment scheduling and management
- `/campaigns` - Campaign management (create, edit, track marketing campaigns)
- `/transactions` - Treatment episode/transaction tracking
- `/connectors` - Platform Connectors (Meta, Google, LinkedIn, X, Bing integration) [System Admin only]
- `/email-settings` - Email/SMTP Configuration for password reset & notifications [System Admin only]
- `/team` - Team Management (CRM Users, org hierarchy, access scoping)
- `/masters` - Master Data Management (all 9 categories, 50+ tables)
- `/testing` - Testing Interface [System Admin only]

## Role Hierarchy
- **SYS_ADMIN (System Admin)**: Technical admin - full access to everything including connectors, email settings, testing
- **ADMIN (CRM Admin)**: Business admin - dashboard, leads, appointments, campaigns, transactions, team, masters
- **MANAGER**: Team manager - dashboard, leads, appointments, campaigns, transactions, team
- **AGENT / COUNSELLOR**: Frontline - dashboard, leads, appointments, transactions

## Sidebar Structure
Navigation organized into 4 sections:
1. **Reports & Dashboards**: Dashboard
2. **Transactions**: Leads, Appointments, Campaigns, Transactions
3. **Masters**: Master Data
4. **Configurations**: Team (CRM Admin+), Connectors (System Admin), Email Settings (System Admin), Testing (System Admin)

## Recent Changes
- 2026-02-21: Role split - SYS_ADMIN (System Admin) vs ADMIN (CRM Admin); Connectors, Email Settings, Testing restricted to System Admin only
- 2026-02-21: Email Settings page - SMTP configuration UI for password reset emails (stored in tenant_settings table)
- 2026-02-20: Sidebar restructured into 4 sections (Reports & Dashboards, Transactions, Masters, Configurations); Connectors moved under Configurations
- 2026-02-20: Platform Connectors page - Connect Meta, Google Ads, LinkedIn, X, Microsoft Ads with credential config, test connection, sync, and live insights
- 2026-02-20: Phase 4B - Handover acceptance (accept/reject with SLA), lead assignment/transfer, lead intake API with auto-dedup and round-robin auto-assign
- 2026-02-20: Phase 4A - Lead detail page with activity timeline, status guardrails, quick actions (log call, create task, book appointment)
- 2026-02-20: Phase 3 - Core transaction tables: Patient, Contact, PatientContactLink, enhanced Lead/Activity/Task, Appointment, Episode, AuditLog with full CRUD APIs
- 2026-02-20: Phase 2 - Team Management page with CRM user CRUD, org tree, access scoping
- 2026-02-20: Phase 1B - Bulk CSV import/export for master data, import logs
- 2026-02-20: Phase 1A - Governance masters, tenant settings, pin codes, doctor speciality mappings
- 2026-02-20: Initial build with all 45+ master tables, Lead Kanban, Dashboard, Master Data UI
