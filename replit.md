# myProSys Hospital CRM Platform

## Overview
myProSys Hospital CRM is a multi-tenant, white-labeled platform designed to streamline the patient (Lead) and treatment journey (Episode) lifecycle for hospitals. It manages the entire Lead→Episode→Conversion process, offering features like SLA tracking, telephony integration, role-based access control, and master data approval workflows. The platform aims to enhance efficiency in patient management and treatment opportunities, with each hospital able to customize branding elements.

## User Preferences
I prefer iterative development with a focus on clear, modular code. I appreciate detailed explanations for complex architectural decisions. Before making any major structural changes or adding new external dependencies, please ask for my approval. I expect the agent to prioritize security and data privacy, especially concerning patient health information (PHI). Do not make changes to files related to deployment configurations or sensitive API keys without explicit instruction.

## System Architecture
The platform is built with a modern web stack:
- **Frontend:** React with Vite, styled using Tailwind CSS and shadcn/ui. The UI/UX emphasizes a clean, medical-professional aesthetic with a light background, Viroc Blue (#0f4c81) as primary, and Orange (#ff8c00) as accent colors. Dates are formatted as DD/MM/YYYY.
- **Backend:** Express.js and Node.js.
- **Database:** PostgreSQL, accessed via Drizzle ORM.
- **Authentication:** Replit Auth (OpenID Connect).
- **Multi-Tenancy:** Implemented with `tenantId` in all core tables for strict data isolation, including tenant-specific SMTP configurations and master data provisioning.

**Key Features & Design Patterns:**
- **Patient Journey Management:** Distinct workflows for Leads (pre-consultation) and Episodes (post-consultation treatment).
- **Master Data Management:** Over 50 master data tables with approval workflows and bulk import/export.
- **Role-Based Access Control (RBAC):** 4-tier hierarchy (SYS_ADMIN, ADMIN, MANAGER, AGENT/COUNSELLOR) with granular PHI access levels (Full/Masked/None).
- **Intuitive UI:** Kanban workspace for lead statuses, responsive design, and a dedicated System Admin Panel for managing hospitals and subscriptions.
- **Dynamic Branding:** Per-tenant customization of logos, favicons, display names, and color schemes.
- **Intelligent Automation:**
    - **Episode Intelligence Layer:** Features a "Temperature Engine" for lead scoring, "Auto-Handover Engine" for stage-based team assignment, and "Revenue Probability" for forecasting.
    - **Automated Nurture Engine:** Manages lead nurturing with task chains, escalations, and automated status updates (e.g., auto no-show). Dormant detection excludes leads with active engagement statuses (Appointment Booked, Reminder Running, Consultation Done, Nurture) and leads with future scheduled appointments.
- **Consultation Log (Episode):** Redesigned from generic CRM activity logging to hospital-specific consultation outcome workflow. Features configurable consultation outcomes (Treatment Recommended, Follow-up Required, Conservative Treatment, Referred, No Treatment Required, Patient Did Not Proceed) with per-outcome remark chips from `consultation_outcome_remarks` master table. Outcomes that close episodes (e.g., No Treatment Required, Patient Did Not Proceed) auto-close the episode. Non-closing outcomes show the Next Action panel for follow-up scheduling. All outcomes and remarks are configurable per-tenant via Master Data.
- **Lead & Episode Enhancements:** Includes duplicate lead validation, clinical notes with audit trails, negotiation discount approval workflows, and lead merge functionality.
- **Workflows:** Check-in and front office integration, doctor availability calendar, and detailed patient journey views including unified timelines.
- **Dashboards:** 3-Tier Role-based dashboards provide tailored analytics for SYS_ADMIN, ADMIN, MANAGER, and AGENT/COUNSELLOR roles.
- **Team Management:** Renamed from "Administrative Departments" to "Teams" with pre-loaded categories and a migration process for consolidation.
- **Next Actions:** Delegatable next actions for both leads and episodes, enhancing task assignment and follow-up.
- **Unified Patient Journey Funnel:** The funnel strip across Lead Workspace, Lead Detail, and Kanban cards shows the complete journey from lead capture through episode completion. Leads with episodes show the full unified path (Raw → Contacted → Qualified → Appt → Consult → Treatment Planning → Surgery → Post Care → Completed). Episode-phase stages are highlighted in violet. The `/api/leads` endpoint enriches each lead with `latestEpisodeStatus`, `latestConversionStage`, and `latestEpisodeId`.

## External Dependencies
- **Replit Auth:** For user authentication leveraging OpenID Connect.
- **Google Sheets API:** For bulk lead import.
- **WhatsApp Business API:** For automated communication.
- **Meta Graph API v21.0:** For Facebook & Instagram ad campaign insights.
- **Telephony (Callyzer):** Webhook-based integration for real-time call log capture, auto-lead creation, and call reporting. UI labels show "Telephony" (not "Callyzer") to remain vendor-agnostic. Internal code/tags still use "CALLYZER" for backward compatibility.
- **SMTP Services:** For sending transactional emails and notifications, configurable per tenant.