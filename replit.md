# myProSys Hospital CRM Platform

## Overview
myProSys Hospital CRM is a multi-tenant, white-labeled platform designed to streamline the patient (Lead) and treatment journey (Episode) lifecycle for hospitals. It manages the entire Lead→Episode→Conversion process, offering features like SLA tracking, telephony integration, role-based access control, and a master data approval workflow. The platform aims to enhance efficiency in patient management and treatment opportunities, with each hospital able to customize branding elements.

## User Preferences
I prefer iterative development with a focus on clear, modular code. I appreciate detailed explanations for complex architectural decisions. Before making any major structural changes or adding new external dependencies, please ask for my approval. I expect the agent to prioritize security and data privacy, especially concerning patient health information (PHI). Do not make changes to files related to deployment configurations or sensitive API keys without explicit instruction.

## System Architecture
The platform is built with a modern web stack:
- **Frontend:** React with Vite, styled using Tailwind CSS and shadcn/ui. The UI/UX emphasizes a clean, medical-professional aesthetic with a light background, Viroc Blue (#0f4c81) as primary, and Orange (#ff8c00) as accent colors.
- **Backend:** Express.js and Node.js.
- **Database:** PostgreSQL, accessed via Drizzle ORM.
- **Authentication:** Replit Auth (OpenID Connect).
- **Multi-Tenancy:** Implemented with `tenantId` in all core tables for strict data isolation.

**Key Features & Design Patterns:**
- **Lead and Episode Management:** Differentiates 'Lead' (pre-consultation funnel) from 'Episode' (post-consultation treatment opportunity).
- **Master Data Management:** Over 50 master data tables with an approval workflow for new entries and bulk import/export.
- **Role-Based Access Control (RBAC):** 4-tier hierarchy (SYS_ADMIN, ADMIN, MANAGER, AGENT/COUNSELLOR) with granular access scoping and PHI access levels (Full/Masked/None).
- **Kanban Workspace:** Drag-and-drop interface for managing lead statuses.
- **Responsive Design:** Fully responsive across all device types.
- **API Structure:** RESTful approach with generic CRUD endpoints for master data and specific endpoints for core entities.
- **Branding:** Dynamic per-tenant branding for logos, favicons, display names, and color schemes.
- **System Admin Panel:** Separate `/admin/*` routes for SYS_ADMINs with distinct dark theme, managing hospitals, subscription plans, payments, and tenant suspension.
- **Check-In & Front Office:** Integrated into the Appointments page, allowing check-in, patient record creation from lead data, and tracking appointment statuses.
- **Doctor Availability Calendar:** Embedded as a modal overlay within the Appointments page (no separate sidebar menu item). Accessible via "Availability Calendar" button in page header and "Check Availability" link in the booking dialog. Supports Month/Day/Week views with leave display and slot selection that prefills the booking form. Route `/doctor-availability` redirects to `/appointments`.
- **Episode Intelligence Layer:**
    - **Temperature Engine:** 7-level lead temperature tracking, auto-computed on trigger events.
    - **Auto-Handover Engine:** Stage-based team assignment.
    - **Revenue Probability:** Configurable stage-to-probability mapping for episode revenue forecasting.
- **Lead List View Redesign:** Enhanced layout with new columns (Name, Stage, Temperature, Owner, Ageing, Next Action, Source) and a quick filter bar.
- **Duplicate Lead Validation:** Server-side and frontend validation based on normalized mobile numbers, preventing duplicate lead creation.
- **Episode Clinical Notes with Audit:** Allows editing clinical notes for specific roles with mandatory reason and audit logging.
- **Negotiation Discount Approval Workflow:** Manages discount submission, approval, and revocation for episodes, with audit logging and role-based access.
- **Per-Tenant SMTP & Password Reset:** Configurable SMTP settings per tenant for sending branded emails, including password resets, with fallback to global settings.
- **Duplicate Lead Validation:** `mobileNormalized` field on leads, `GET /api/leads/check-duplicate?mobile=X` endpoint, server-side 409 on duplicate creation, frontend phone-blur check with warning banner.
- **Episode Clinical Notes Edit with Audit:** `PUT /api/episodes/:id/clinical-notes` with mandatory editReason, role-gated via configurable `clinical_notes_edit_roles` table (per-tenant, fallback to SYS_ADMIN/ADMIN/MANAGER). Config endpoints: `GET/POST /api/episodes/clinical-notes-edit-roles/config`. Frontend query checks allowed roles dynamically. Audit logs written on every edit.
- **Negotiation Discount Approval Workflow:** `originalQuotedAmount`, `discountPercent`, `discountAmount`, `discountNotes`, `discountStatus` fields. Endpoints: `POST /api/episodes/:id/discount`, `POST /api/episodes/:id/discount/approve`, `POST /api/episodes/:id/discount/revoke`. All with audit logging.
- **Desktop Wireframe Upgrades:** Leads list redesign (Stage/Temperature/Owner/Ageing/Source columns), quick filter bar (All/My Leads/Hot/Dormant/Overdue/team filters), Intelligence Strip on Lead Detail, Ownership Card in sidebar, Insurance badges on episode cards.
- **Lead Merge:** `mergedIntoLeadId`, `mergeStatus`, `mergedAt`, `mergedBy` fields on leads; `lead_merge_audits` table; `lead_merge_roles` config table. Endpoints: `GET /api/leads/duplicates` (duplicate groups), `GET /api/leads/:id/merge-preview?with=X,Y` (field comparison + record counts), `POST /api/leads/merge` (transactional merge with FK re-linking), `GET /api/leads/merge-roles` (config). Frontend: duplicate groups banner on Leads Workspace, 4-step merge modal (select primary → select duplicates → review fields → confirm), merged lead banner on Lead Detail with redirect.
- **Full Patient Journey View:** `GET /api/leads/:id/journey` aggregation endpoint returning leadSummary, episodes, unifiedTimeline (merged lead events + appointments + episode audit logs + tasks). Frontend: Journey Snapshot strip (lead stage, episode stage, episode count, probability, expected revenue, team), Treatment Journey Timeline (episode cards with expand/collapse audit events), Unified Journey Timeline with filter chips (All/Lead/Appointment/Episode/Post Care/Task) and quick-log activity form.
- **Episode Model Freeze (Level 1):** Simplified episode data model answering 5 CRM questions: (1) Case Owner → `doctorId`, (2) Surgery Doctor → `surgeryDoctorId` (nullable), (3) Post-Care Owner → `postCareOwnerId` (nullable, references crmUsers), (4) Quote → `initialQuote` / `approvedDiscount` / `finalQuote` (auto-calculated), (5) Billing → `actualBill` / `variance` (auto-calculated). Episode Detail Page rewritten with 4-tab layout: Clinical (details + case ownership + clinical notes), Financial (quote & billing + discount request + revenue), Insurance (toggle + insurer/TPA/preauth), Family Status (family discussion, second opinion, decision status/notes). Old columns remain in DB for backward compat. Discount approval/revoke endpoints sync both new simplified fields and legacy fields.
- **Episode Stage Transition Remarks:** All episode status changes (forward and backward) require mandatory remarks (min 5 characters) via a dialog. Remarks stored in audit log `newValues.stageRemarks`. Backend validates before allowing status update. Remarks displayed in Journey Timeline with italic quote styling.

## External Dependencies
- **Replit Auth:** For user authentication leveraging OpenID Connect.
- **Google Sheets API:** For bulk lead import.
- **WhatsApp Business API:** For automated communication.
- **Meta Graph API v21.0:** For Facebook & Instagram ad campaign insights.
- **Callyzer:** Webhook-based integration for real-time call log capture and auto-lead creation. Rich call card display in Lead Detail timeline (employee, notes, status, recording). Last Call column in Lead Workspace list view. Callyzer Reports page with SQL-aggregated stats (date-filtered), default date range: yesterday→today.
- **SMTP Services:** For sending transactional emails and notifications.