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
- Lead Import: `POST /api/leads/import` (CSV bulk import with dedup), `GET /api/leads/import-logs|import-fields|import-template`
- Lead Capture Rules: `GET/POST/PATCH/DELETE /api/lead-capture-rules`
- Lead Webhook: `POST /api/webhook/lead-capture/:token` (external auto-import)
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
- `/lead-import` - Bulk Lead Import (CSV upload, column mapping, dedup strategy, import history)
- `/appointments` - Appointment scheduling and management
- `/campaigns` - Campaign management (create, edit, track marketing campaigns)
- `/transactions` - Consultation Episodes — track patient consultation journey from first visit through treatment to completion
- `/connectors` - Platform Connectors + Lead Capture Rules (Meta, Google, Callyzer, Google Forms integration) [System Admin only]
- `/email-settings` - Email/SMTP Configuration for password reset & notifications [System Admin only]
- `/whatsapp-settings` - WhatsApp Business API integration for appointment confirmations [System Admin only]
- `/team` - Team Management (CRM Users, org hierarchy, access scoping)
- `/masters` - Master Data Management (all 9 categories, 50+ tables)
- `/testing` - Testing Interface [System Admin only]

## Role Hierarchy
- **SYS_ADMIN (System Admin)**: Technical admin - full access to everything including connectors, email settings, WhatsApp, testing
- **ADMIN (CRM Admin)**: Business admin - dashboard, leads, appointments, campaigns, transactions, team, masters
- **MANAGER**: Team manager - dashboard, leads, appointments, campaigns, transactions, team
- **AGENT / COUNSELLOR**: Frontline - dashboard, leads, appointments, transactions

## Sidebar Structure
Navigation organized into 4 sections following the lead lifecycle flow:
1. **Reports & Dashboards**: Dashboard
2. **Transactions** (full lifecycle): Campaigns → Leads → Appointments
3. **Masters**: Master Data
4. **Configurations**: Team (CRM Admin+), Connectors (System Admin), Email Settings (System Admin), WhatsApp (System Admin), Testing (System Admin)

Note: Lead Import is accessible via "Bulk Import" button on the Leads page (not a separate sidebar item).

## Roadmap / Planned Features (Notes from team feedback - NOT yet built)

### Priority 1 — Must Build
- **Unified Communication Timeline**: Single view on lead/patient detail page showing WhatsApp messages, calls, and emails together
- **Post-Care Follow-up Scheduler**: Configurable automated follow-up sequences (day 1, 7, 30 post-consultation). VIROC already practices post-care follow-ups (enquiring patient health, next steps). Includes physiotherapy home session scheduling. All interactions logged in patient timeline.
- **Handover Enhancements** (simplified): Auto-escalation if not accepted in X hours, handover reason capture (dropdown/text), handover history view on lead, notification to receiving counsellor

### Priority 2 — Need to Develop
- Churn prediction / dormant patient detection
- Win-back campaign automation
- Loyalty program
- Re-appointment scheduling triggers

### Priority 3 — Basic Level Implementation
- Patient satisfaction rating (post-consultation)
- Doctor-wise feedback tracking
- Complaint resolution workflow
- Google/Practo/JustDial review monitoring
- CSAT/NPS dashboards

### Phase 2 Dashboard — Forecasting & Pipeline Analytics (build after 2-3 months of data)
- Win rate forecasting, revenue projections (monthly/quarterly)
- Lead-to-conversion probability by source
- Doctor appointment utilization & availability forecast
- Churn probability model, peak season prediction
- Start simple: conversion rate by source, avg days-to-conversion, doctor utilization rate

### Multi-Location Enhancements (foundation already exists — tenantId, branches, access scoping)
- Cross-location appointment scheduling UI
- Consolidated dashboard with branch drill-down
- Multi-branch lead auto-routing (patient pincode → nearest branch)
- Cross-location doctor availability view

### RBAC Enhancements (current: 4-tier roles + access scoping + PHI levels)
- Field-level permissions beyond PHI (hide doctor notes, financials from certain roles)
- Edit-own-leads restriction (agents can only modify their assigned leads)
- Time-based access restrictions (later phase)
- IP-based access control (enterprise feature, later phase)

### Third-Party Integrations (scoped to CRM lifecycle only)
- HMS/HMIS OPD consultation sync (push or pull) — auto-update lead status when consultation happens in HMS
- Google Calendar sync for doctor schedules (nice-to-have, manual management already works)
- Teleconsultation as appointment type (low effort — add meeting link field to existing appointment infrastructure) — NOT currently practiced at VIROC, park for later
- Out of CRM scope: Payment processing, inventory, pharmacy, accounting, PACS — these belong in HMS

### Low-Hanging Fruit — Quick Wins
- Lead temperature indicator (hot/warm/cold based on days since last activity)
- Dormant lead auto-detection alerts

## Recent Changes
- 2026-02-22: Google Sheets Lead Extraction - Connect Google Sheet via API key, auto-detect columns, map to CRM fields, preview data, import leads with dedup/auto-assign. Multi-sheet tab support with header re-fetch on tab switch. Route: /google-sheets-import
- 2026-02-22: Kanban board fix - Added missing columns for Reminder Running, Unqualified, Nurture statuses; fixed orphaned "Converted" leads migrated to "Closed Won"
- 2026-02-22: Auto-status on episode creation - Creating consultation episode auto-updates lead status to "Consultation Done"
- 2026-02-22: WhatsApp Business API integration - Settings page for configuration, auto-send appointment confirmation messages, test connection/message, activity logging for sent messages
- 2026-02-22: Zero Lead Leakage Phase A - Lead temperature indicator (Hot/Warm/Cold based on lastContactAt), dormant lead detection API with access-scope filtering, dormant alerts + today's tasks dashboard widgets, handover reason capture with history, unified communication timeline with channel-specific colors/icons (WhatsApp/Call/Email/SMS)
- 2026-02-22: Enhanced Campaign Management - Dropdown-based auto-generated campaign names (Company_Platform_Objective_Year_Month_AdNumber), auto-generated UTM parameters, campaign detail view, funnel stage, target audience tracking, budget in INR
- 2026-02-21: Proper case enforcement - All master data, lead names, and CRM user names auto-converted to title case (e.g., "ramesh modi" → "Ramesh Modi")
- 2026-02-21: Bulk Lead Import page - CSV upload with column mapping, phone normalization, dedup strategies (Skip/UpdateBlank/Overwrite), import history logs
- 2026-02-21: Lead Capture Rules - Configurable field mapping per connector for auto-importing leads from Meta, Google Forms, Callyzer, etc. with assignment strategies, dedup handling, webhook endpoints
- 2026-02-21: All dropdowns replaced with SearchableSelect component (Popover + search input with substring matching)
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
