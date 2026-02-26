# myProSys Hospital CRM Platform

## Overview
myProSys Hospital CRM is a multi-tenant platform designed to manage the patient (Lead) and treatment journey (Episode) lifecycle for hospitals. It functions as a white-labeled solution, allowing each hospital to customize branding elements like logos, favicons, display names, and color schemes. The platform includes features such as SLA tracking, telephony integration support, role-based access control, and a master data approval workflow. Its core purpose is to streamline the Lead→Episode→Conversion process, enhancing efficiency in patient management and treatment opportunities.

## User Preferences
I prefer iterative development with a focus on clear, modular code. I appreciate detailed explanations for complex architectural decisions. Before making any major structural changes or adding new external dependencies, please ask for my approval. I expect the agent to prioritize security and data privacy, especially concerning patient health information (PHI). Do not make changes to files related to deployment configurations or sensitive API keys without explicit instruction.

## System Architecture
The platform is built with a modern web stack:
- **Frontend:** React with Vite, styled using Tailwind CSS and shadcn/ui for a clean, medical-professional UI/UX. The design emphasizes a light background with Viroc Blue (#0f4c81) as primary and Orange (#ff8c00) as accent colors.
- **Backend:** Express.js and Node.js.
- **Database:** PostgreSQL, accessed via Drizzle ORM.
- **Authentication:** Replit Auth (OpenID Connect).
- **Multi-Tenancy:** Implemented with `tenantId` in all core tables to ensure strict data isolation per hospital.

**Key Features & Design Patterns:**
- **Lead and Episode Management:** The system distinguishes between a 'Lead' (patient, managing pre-consultation funnel statuses) and an 'Episode' (treatment opportunity, managing post-consultation funnel statuses).
- **Master Data Management:** Over 50 master data tables across 9 categories, featuring an approval workflow for new entries and bulk import/export capabilities.
- **Role-Based Access Control (RBAC):** A 4-tier role hierarchy (SYS_ADMIN, ADMIN, MANAGER, AGENT/COUNSELLOR) with granular access scoping (All/Branch/Department/Self) and PHI access levels (Full/Masked/None).
- **Kanban Workspace:** Drag-and-drop interface for managing lead statuses.
- **Responsive Design:** Fully responsive across desktop, tablet, and mobile, with adaptive layouts and navigation.
- **API Structure:** Follows a RESTful approach, with generic CRUD endpoints for master data and specific endpoints for core entities like Leads, Episodes, Patients, and CRM Users.
- **Branding:** Dynamic per-tenant branding configuration for logo, favicon, display name, and color scheme.

### System Admin Panel (Feb 2026)
- **Separate admin panel** at `/admin/*` routes, completely invisible to CRM users
- **Dark sidebar** (slate-900) with orange accent, distinct from CRM's blue theme
- **AdminLayout** component with its own navigation, "Back to CRM" link
- **Only SYS_ADMIN** users can access; a discreet "Admin Panel" button appears in CRM sidebar footer
- **Pages:** Platform Overview (dashboard stats), Hospital Management, Subscription Plans, Subscriptions, Payment Records
- **Subscription & Billing:** Manual payment tracking (MVP), Razorpay/PayU integration planned for later
  - `subscription_plans` table: Plan name, code, billing cycle, price, feature limits (users, leads, branches)
  - `tenant_subscriptions` table: Tenant-plan assignment with start/end dates, grace period, auto-renewal, suspension
  - `subscription_payments` table: Manual payment recording with method, transaction ref, invoice number, period
- **Tenant Suspension:** When tenant is suspended (payment overdue), CRM users see "Service Temporarily Suspended" screen. SYS_ADMIN can still access admin panel.
- **Tenant fields added:** `subscriptionStatus`, `onboardedAt`, `contactPerson`, `contactEmail`, `contactPhone`

### Meta Ads Integration (Feb 2026)
- **Real Meta Graph API v21.0** integration in `server/services/metaAds.ts`
- Uses environment secrets: `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_APP_ID`
- **Endpoints:**
  - `POST /api/connectors/:id/test` — Tests Meta connection and fetches 30-day insights
  - `POST /api/connectors/:id/sync` — Syncs latest 30-day metrics from Meta API
  - `GET /api/connectors/meta/insights?datePreset=last_30d` — Account-level insights
  - `GET /api/connectors/meta/campaigns?datePreset=last_30d` — Per-campaign breakdowns
  - `GET /api/connectors/meta/daily-insights?days=7` — Daily time-series data
- **Metrics pulled:** impressions, clicks, spend, CTR, CPC, reach, conversions (lead actions)
- Metrics cached in `platform_connectors.metrics_cache` for connector card display

## External Dependencies
- **Replit Auth:** For user authentication leveraging OpenID Connect.
- **Google Sheets API:** Integration for bulk lead import.
- **WhatsApp Business API:** For automated communication such as appointment confirmations.
- **Meta Graph API v21.0:** Real-time Facebook & Instagram ad campaign insights (impressions, clicks, spend, CTR, CPC, conversions).
- **Callyzer:** Webhook-based call tracking integration for real-time call log capture.
- **SMTP Services:** For sending transactional emails like password resets and notifications.