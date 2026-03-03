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

## External Dependencies
- **Replit Auth:** For user authentication leveraging OpenID Connect.
- **Google Sheets API:** For bulk lead import.
- **WhatsApp Business API:** For automated communication.
- **Meta Graph API v21.0:** For Facebook & Instagram ad campaign insights.
- **Callyzer:** Webhook-based integration for real-time call log capture and auto-lead creation.
- **SMTP Services:** For sending transactional emails and notifications.