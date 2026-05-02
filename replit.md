# RGB Hospital CRM Platform

## Overview
RGB Hospital CRM is a multi-tenant, white-labeled platform designed to streamline the patient (Lead) and treatment journey (Episode) lifecycle for hospitals. It manages the entire Lead→Episode→Conversion process, offering features like SLA tracking, telephony integration, role-based access control, and master data approval workflows. The platform aims to enhance efficiency in patient management and treatment opportunities. Each hospital can customize branding elements, supporting a comprehensive business vision to revolutionize healthcare patient management.

## User Preferences
I prefer iterative development with a focus on clear, modular code. I appreciate detailed explanations for complex architectural decisions. Before making any major structural changes or adding new external dependencies, please ask for my approval. I expect the agent to prioritize security and data privacy, especially concerning patient health information (PHI). Do not make changes to files related to deployment configurations or sensitive API keys without explicit instruction.

## System Architecture
The platform is built with a modern web stack:
- **Frontend:** React with Vite, styled using Tailwind CSS and shadcn/ui. UI/UX emphasizes a clean, medical-professional aesthetic with a light background, Viroc Blue (#0f4c81) as primary, and Orange (#ff8c00) as accent colors. Dates are formatted as DD/MM/YYYY.
- **Backend:** Express.js and Node.js.
- **Database:** PostgreSQL, accessed via Drizzle ORM.
- **Authentication:** Replit Auth (OpenID Connect).
- **Multi-Tenancy:** Implemented with `tenantId` for strict data isolation, including tenant-specific SMTP configurations and master data provisioning.

**Key Features & Design Patterns:**
- **Patient Journey Management:** Distinct workflows for Leads (pre-consultation) and Episodes (post-consultation treatment). Includes a unified 12-stage funnel display.
- **Master Data Management:** Over 50 tables with approval workflows and bulk import/export. Includes configurable consultation outcomes, post-care protocols, room types, and cost heads.
- **Role-Based Access Control (RBAC):** Full 12-role system: SYS_ADMIN, ADMIN, MANAGER, COUNSELLOR, AGENT (Patient Coordinator), TELECALLER, RECEPTIONIST, BILLING, INSURANCE_DESK, DOCTOR, MEDICAL_ASSISTANT, MIS_VIEWER. Permissions stored in `role_permissions` table (per tenant, per role, per module). User-level overrides in `user_permission_overrides` (with optional expiry). Frontend `canViewPage()` and `canViewEpisodeTab()` hooks enforce role-based visibility. Access Control page at `/access-control` (Admin+ only). Episode tabs filtered per role (BILLING sees clinical+financial, DOCTOR sees clinical+family, etc.).
- **Intuitive UI:** Kanban workspace, responsive design, and a System Admin Panel for managing hospitals and subscriptions.
- **Dynamic Branding:** Per-tenant customization of logos, favicons, display names, and color schemes.
- **Intelligent Automation:**
    - **Episode Intelligence Layer:** "Temperature Engine" for lead scoring, "Auto-Handover Engine" for stage-based team assignment, and "Revenue Probability" for forecasting.
    - **Automated Nurture Engine:** Manages lead nurturing with task chains, escalations, and automated status updates.
- **Consultation Log (Episode):** Configurable consultation outcomes with per-outcome remark chips and automated episode closure for certain outcomes.
- **Post-Care Follow-Up Protocols:** Configurable step-based task chains triggered by episode status.
- **Multi-Contact Person Model:** `contact_persons` table stores reusable contact entities (name, phone, WhatsApp, email). `lead_contact_persons` mapping table links contacts to leads with 5 role flags: isPrimary, isBillingContact, isEmergencyContact, isWhatsAppConsentHolder, isAppointmentCoordinator. `leads.phoneE164` is now nullable with `phoneOwnerRelationship` field. Global Contact Directory page at `/contact-directory`. Callyzer webhook now also matches calls against contact person phones. ContactPersonsPanel added to Lead Detail page right sidebar.
- **Referral Management:** Tracks patient referrals, allows lead creation from referrals, and includes configurable reward rules based on episode stages.
- **Help Ticketing System:** In-app bug reporting and feature requests for CRM users with a dedicated Support Admin Portal for ticket management, assignment, and team management.
- **Event Management:** Tracks events (webinars, health camps) and registrations, allowing attendee management and conversion to leads. Includes resource links for creative assets.
- **Campaign & Event Resource Links:** Polymorphic `resource_links` table supporting Google Drive URLs for campaign/event creatives (Poster, Reel, Video, Landing Page, Registration Form, Creative, Other). Accessible via "Resources" tab in Campaign detail dialog and Resource Links card on Event detail page. Server-side URL validation enforces http/https only.
- **Quotation Builder:** Itemized quotation system within episodes, integrated with cost heads and discount workflows.
- **Room Allocation:** Tracks room type and number for episodes.
- **Insurance Pre-Auth Enhancement:** Includes fields for initial and final approval amounts.
- **Discount Calculation:** Simplified logic ensuring consistent application of approved discounts.
- **In-App Notifications:** `in_app_notifications` table stores per-user notifications (type, title, body, link). Notification bell in sidebar header with unread count badge. Triggered when discount requests are submitted — notifies all configured `tenant_discount_approvers`. Email alert also sent via `sendDiscountApprovalEmail()`. APIs: GET /api/notifications, GET /api/notifications/unread-count, POST /api/notifications/:id/read, POST /api/notifications/read-all.
- **Lead & Episode Enhancements:** Duplicate validation, clinical notes with audit trails, negotiation discount approval, and lead merge.
- **Workflows:** Check-in integration, doctor availability, and detailed patient journey timelines.
- **Dashboards:** 3-Tier Role-based dashboards provide tailored analytics, including "My Today's Tasks," "My Overdue Tasks," "Team Overdue Tasks," "Call Performance," "Lead Sources," "Episode Progress," "Revenue Pipeline," and "Conversion Funnel." Also includes Treatment Planned→Surgery Scheduled % and Surgery Scheduled→Surgery Done % conversion ratios.
- **Unified Patient Journey Funnel:** Compact horizontal bar design showing 5 (lead-only) or 12 (lead with episode) stages with visual cues for past, current, and future stages.
- **Episode Status Flow:** Defined status transitions for episodes, starting from "Consultation In Progress" and moving through various treatment stages to "Completed" or "Discontinued."
- **Surgery Scheduling Enhancement:** Rich dialog for scheduling surgeries, assigning alerts, and prominently displaying details on the episode page. Auto-creates high-priority tasks.
- **Surgery Calendar:** Calendar view showing future scheduled surgeries, filterable by branch, doctor, and treatment department.
- **Pre-op Assessment Stage:** Formal "Pre-op Assessment" stage sits between "Surgery Scheduled" and "Surgery Done". Includes: structured 8-item readiness checklist, readiness status field, per-episode assigned staff, manager clearance grant, amber banner on EpisodeDetailPage, Surgery Done hard block (422) requiring clearance or manager override, automated task + in-app notifications on entry, 48-hour escalation ladder via background scheduler (tasks + manager notifications), and a PreopCasesWidget on Manager/Admin/MIS dashboards. Tables: `episode_preop_assessments`, `preop_reminder_log`. New episode fields: `preop_assigned_user_id`, `preop_readiness_status`, `preop_clearance_given`, `preop_clearance_override_by`, `preop_clearance_override_at`, `preop_entered_at`.
- **Security & Compliance Hardening:**
    - **PHI Masking:** Server-side middleware for masking sensitive data based on user access levels.
    - **Failed Login Tracking:** Tracks failed login attempts, implements account locking, and uses generic error messages for admin login.
    - **Session Security:** 24-hour session TTL, PHI sanitization from logs, and IP-based rate limiting.
    - **Inactivity Timeout:** Frontend idle detection with warning modal.
    - **Audit Access Logging:** Records lead/patient views and data exports.
    - **Encryption:** AES-256-GCM for sensitive credentials.
    - **Communication Preferences:** Per-lead/patient opt-in/opt-out for communication channels (WhatsApp, SMS, Email, Phone Call).
    - **Consent Capture:** Captures and tracks patient consent.

## External Dependencies
- **Replit Auth:** For user authentication.
- **Google Sheets API:** For bulk lead import.
- **WhatsApp Business API:** For automated communication.
- **Meta Graph API v21.0:** For Facebook & Instagram ad campaign insights.
- **Telephony (Callyzer):** Webhook-based integration for call log capture and auto-lead creation.
- **SMTP Services:** For transactional emails and notifications.