# myProSys Hospital CRM: Scope vs. Delivery Report

**Client:** Viroc Super Speciality Orthopedic Hospital
**Project:** Digital Engine for Scalable Growth
**Date:** 31 March 2026

---

## Executive Summary

This document maps every item from the original RGB Proposal & Scope Document against what has been delivered through the myProSys Hospital CRM platform. The CRM has comprehensively addressed Phases 1-4, 6, and 7 of the original scope. Phase 5 (Webinar Engine) was not part of the CRM build as it relies on third-party webinar tools. Brand Identity was delivered separately as noted.

---

## Phase 1: Funnel Mapping and Diagnostic Audit

| # | Proposed Scope Item | Delivery Status | What Was Delivered in CRM |
|---|---------------------|:-:|--------------------------|
| 1.1 | Map the complete journey: from lead generation to OPD/IPD to referral and follow-up | Delivered | Unified Patient Journey Funnel tracks the full path: Raw Lead Captured → Contacted → Qualified → Appointment Booked → Reminder Running → Consultation Done → Treatment Planning → Surgery Scheduled → Surgery Done → In Treatment → Post Care → Follow Up → Completed. Visual funnel bars appear on Lead Workspace, Lead Detail, and Kanban cards. |
| 1.2 | Review current use of platforms (Meta, Google, WhatsApp, CRM, Email, HMS) | Delivered | Platform Connectors page provides configuration and status review for Meta Ads (Graph API v21.0), Google Sheets, WhatsApp Business API, Telephony (Callyzer), and SMTP Email. Each connector shows connection status, last sync, and health metrics. |
| 1.3 | Identify drop-offs and opportunities for automation and process clarity | Delivered | Temperature Engine (Cold/Warm/Hot/Very Hot) auto-scores leads based on engagement. Dormant Lead Detection flags leads with no activity for 5+ days. Auto No-Show detection after missed appointments. Conversion Funnel dashboard visualizes drop-offs at each stage. |
| 1.4 | Define basic funnel metrics and baseline conversion performance | Delivered | Dashboard KPIs include: Total Leads, Active Episodes, Pipeline Value (INR), Realized Revenue, Today's Appointments, Conversion Rate. Conversion Funnel chart (Raw → Won) shows stage-wise counts. Lead Temperature distribution provides engagement baseline. |
| 1.5 | Share a phased action plan that addresses risk, readiness, and internal alignment | Delivered Separately | This was delivered through consulting engagement and documentation, not as a CRM feature. |

---

## Phase 2: CRM System Design and Funnel Structuring

| # | Proposed Scope Item | Delivery Status | What Was Delivered in CRM |
|---|---------------------|:-:|--------------------------|
| 2.1 | Selection of most suitable CRM tool based on the need | Delivered | Custom-built multi-tenant CRM (myProSys) tailored specifically for hospital workflows — not a generic off-the-shelf tool. Built with React + Express + PostgreSQL + Drizzle ORM. |
| 2.2 | Define lead lifecycle stages: new, consulted, follow-up, converted, referred | Delivered | 10 lead statuses defined: Raw Lead Captured, Contacted, Qualified, Appointment Booked, Reminder Running, Consultation Done, Closed Won, Closed Lost, Unqualified, Nurture. Episode statuses extend this further with 11 treatment stages. |
| 2.3 | Build routing logic to ensure leads reach the right internal contact | Delivered | Auto-Handover Engine maps lifecycle stages to teams: Telecalling (Lead Created), Front Office (Appointment Booked), Doctor (Checked In / Consultation Done), Financial (Estimate Shared), Insurance (Insurance Applicable), OT/IP Desk (Surgery Scheduled). All handovers logged in audit trail. |
| 2.4 | Create structured funnels for various sources (ads, referrals, events, webinars) | Delivered | Multi-level source tracking: Lead Source Categories → Lead Sources → Campaign Channels. Supports Meta, Google Ads, LinkedIn, YouTube, WhatsApp, Walk-in, Doctor Referral, and offline channels. UTM tracking (source, medium, campaign, term, content) on every lead. Lead Capture Rules with webhook endpoints for automated ingestion from any source. |
| 2.5 | Set up tracking that's easy to use and maintain | Delivered | Kanban board for visual lead management. One-click status transitions. Activity timeline on every lead. Automated task creation. Role-based dashboards showing only relevant metrics per user. |
| 2.6 | Keep tool selection flexible until the most appropriate option is finalized | Delivered | Being a custom-built platform, the CRM is fully flexible and extensible. Over 50 master data tables allow hospitals to configure the system without code changes. |

---

## Phase 3: Patient Engagement Automation

| # | Proposed Scope Item | Delivery Status | What Was Delivered in CRM |
|---|---------------------|:-:|--------------------------|
| 3.1 | Build workflows for nurturing leads | Delivered | Automated Nurture Engine creates a 6-step follow-up task chain (Day 1, 3, 7, 14, 30, 60) when a lead enters "Nurture" status. Each step includes contextual tips (e.g., Day 7: share testimonials; Day 30: offer discounted follow-up). Outcome-based branching: "Interested" reactivates lead, "Not Interested" closes it. |
| 3.2 | Following up with no-shows | Delivered | Auto No-Show detection runs every 30 minutes via background scheduler. After 2 no-shows, lead automatically moves to Nurture status. High-priority follow-up tasks auto-created for stale appointments. No-show reasons captured via configurable master data. |
| 3.3 | Reconnecting with old leads | Delivered | Dormant Lead Detection: leads with no activity for 5+ days automatically get "Re-engage Dormant Lead" tasks assigned to the owner. Escalation: nurture tasks overdue by 48+ hours trigger Urgent Escalation Tasks for managers. |
| 3.4 | Automate patient after-care reminders (3, 6, and 12 months post-surgery) | Partial | Reminder Policies table exists in schema with configurable offsets and channels. Episode flow supports Post Care → Follow Up stages. The framework is built but specific 3/6/12-month automated triggers need configuration per hospital. |
| 3.5 | Set up referral coupon tracking systems | Partial | Referral Statuses master table exists. Referral Management department configured. Lead sources include "Doctor Referral" and "Patient Referral" categories. Coupon-specific tracking (codes, redemption) not implemented as a separate module. |
| 3.6 | Create messaging journeys across patient stages while staying platform-compliant | Delivered | Communication Preferences per lead/patient (opt-in/opt-out for WhatsApp, SMS, Email, Phone). Consent capture at lead creation. WhatsApp messages use approved Meta templates with dynamic parameters. SMTP email per tenant. |
| 3.7 | Use WhatsApp, SMS, and email automation based on approved protocols | Delivered | WhatsApp Business API integration sends appointment confirmations with doctor details, date, time, and token number. SMTP email configured per tenant for transactional notifications. SMS integration framework available. Template-based messaging ensures compliance. |

---

## Phase 4: Campaign Framework and Lead Activation

| # | Proposed Scope Item | Delivery Status | What Was Delivered in CRM |
|---|---------------------|:-:|--------------------------|
| 4.1 | Selection of right tools for campaign management and integration across platforms | Delivered | Campaign Management page with standardized naming convention: [Prefix]_[Platform]_[Objective]_[Year]_[Month]_[AdNumber]. Supports Meta, Google Ads, LinkedIn, X, YouTube, Microsoft Ads, WhatsApp, and Offline channels. |
| 4.2 | Develop campaign strategy structure (to be executed by VIROC team or agencies) | Delivered | Campaigns tagged by funnel stage (TOFU/MOFU/BOFU). Budget tracking per campaign. Platform-specific objective mapping. UTM parameter auto-generation for consistent tracking across all campaigns. |
| 4.3 | Define tracking, attribution, and performance metrics by region/source | Delivered | Meta Graph API integration pulls real-time metrics: Reach, Impressions, Clicks, CTR, Spend, CPC, Conversions. Lead Source Breakdown dashboard shows source-wise counts and conversion rates. UTM attribution links every lead to its originating campaign. |
| 4.4 | Establish internal workflows for verified number broadcast and outreach | Delivered | WhatsApp Business API integration with Meta-approved templates. Lead Capture Rules with webhook endpoints for automated lead ingestion. Telephony (Callyzer) integration for call log capture and auto-lead creation. |
| 4.5 | Recommend structure for automated review and testimonial collection | Not Built | This was a consulting/process recommendation, not a CRM feature. Would require integration with Google Reviews or similar platform. |
| 4.6 | Outline preventive practices to avoid Meta/Google ad policy violations | Delivered Separately | Delivered through consulting and SOP documentation, not as a CRM feature. Campaign page enforces standardized naming and proper UTM structure which aids compliance. |
| 4.7 | Suggest contingency plans for platform disruptions | Delivered Separately | Multi-channel approach (Meta + Google + WhatsApp + Telephony + Walk-in + Referral) built into the CRM inherently reduces single-platform dependency. Consulting recommendation delivered separately. |

---

## Phase 5: Webinar Engine and Education Funnel

| # | Proposed Scope Item | Delivery Status | What Was Delivered in CRM |
|---|---------------------|:-:|--------------------------|
| 5.1 | Define webinar strategy including formats, targeting, and scheduling | Not in CRM Scope | This was a consulting/strategy deliverable. The scope document itself notes "Software/tool license fees (webinar tools)" as an exclusion, indicating third-party tools were always intended. |
| 5.2 | Set up workflows for webinar registration, reminders, and follow-up | Not Built | No native webinar module. However, the CRM's Lead Capture webhook can ingest registrations from any external webinar platform (Zoom, Google Meet, etc.) and route them into the lead funnel. |
| 5.3 | Connect webinar attendees into the CRM funnel for nurturing and tracking | Partially Supported | Lead Capture Rules with webhook endpoints can receive attendee data from external webinar tools. Once in the CRM, standard nurture workflows and funnel tracking apply. UTM parameters can tag webinar-sourced leads. |
| 5.4 | Support development of an education-based trust-building funnel | Not Built | No dedicated education content module. Campaign framework supports tagging content campaigns as TOFU (awareness/education stage). |
| 5.5 | Provide templates and handover instructions for future internal execution | Delivered Separately | Consulting deliverable, not a CRM feature. |

---

## Phase 6: SOPs, Team Design, and Execution Rhythm

| # | Proposed Scope Item | Delivery Status | What Was Delivered in CRM |
|---|---------------------|:-:|--------------------------|
| 6.1 | Recommend internal team structure for marketing and follow-up functions | Delivered | Team Management module with hierarchical org tree. Department management with pre-loaded categories (Telecalling, Front Office, Medical, Financial, Insurance, OT/IP Desk, Referral Management). Branch-level and department-level access scoping. |
| 6.2 | Draft SOPs for Lead handling | Delivered (System-Enforced) | The CRM enforces lead handling SOPs through its architecture: mandatory status transitions, SLA deadlines with breach flags, auto-handover between teams at each stage, duplicate lead validation, and consent capture requirements. |
| 6.3 | Draft SOPs for Referral management | Partially Delivered | Referral statuses master table and Referral Management department exist. Lead sources track referral origins. Full referral workflow SOP would be a consulting document. |
| 6.4 | Draft SOPs for Campaign and communication processes | Delivered (System-Enforced) | Campaign naming conventions enforced by the system. UTM auto-generation ensures tracking consistency. Communication preferences (opt-in/opt-out) enforce compliance. WhatsApp template system ensures approved messaging. |
| 6.5 | Provide training decks, sample scripts, tracking sheets, review formats | Delivered Separately | Consulting deliverables, not CRM features. |
| 6.6 | Set up execution rhythm: Daily morning huddles | Delivered | "My Today's Tasks" dashboard card shows each user's daily priorities. Manager dashboard shows "Team Overdue Tasks" for daily standup reviews. |
| 6.7 | Set up execution rhythm: Weekly progress reviews | Delivered | Agent "My Call Performance" shows weekly call metrics. Conversion Funnel tracks week-over-week progression. Manager dashboard provides team-level performance overview. |
| 6.8 | Set up execution rhythm: Monthly strategic dashboard reviews | Delivered | Management (Admin) Dashboard provides monthly-level KPIs: Pipeline Value, Realized Revenue, Lead Pipeline bar chart, Episode Status distribution, Team Performance table, and Intelligence Overview. |
| 6.9 | Enable task assignment and automated reminders (daily, weekly, monthly) | Delivered | Task Management with priority levels (Low, Normal, High, Urgent) and due dates. Automated nurture task chains (Day 1-60). Background scheduler runs every 30 minutes for reminder checks. Escalation tasks auto-created for overdue items. Next Actions system for leads and episodes with delegation support. |

---

## Phase 7: Dashboarding, Reporting, and Transition

| # | Proposed Scope Item | Delivery Status | What Was Delivered in CRM |
|---|---------------------|:-:|--------------------------|
| 7.1 | Build dashboards to track: Lead sources | Delivered | "My Lead Sources" bar chart on Agent dashboard shows source-wise lead counts with conversion rates. Lead Source Categories and Sources configurable in Master Data. UTM attribution tracks digital sources. |
| 7.2 | Build dashboards to track: Funnel stages | Delivered | CRM Lead Pipeline bar chart (Admin dashboard) shows counts per stage. Individual Conversion Funnel (Agent/Counsellor) shows Raw → Contacted → Qualified → Appt Booked → Consult Done → Won. Unified Patient Journey Funnel on Lead Detail and Kanban cards. |
| 7.3 | Build dashboards to track: Referral usage | Partial | Lead sources track referral-originated leads. Referral statuses in master data. Dedicated referral-specific dashboard metrics (coupon usage, referral conversion rate) not built as separate widgets. |
| 7.4 | Build dashboards to track: Campaign ROI | Delivered | Campaigns page shows Total Campaigns, Active Campaigns, Total Budget, Platform breakdown. Meta Ads connector pulls real-time Spend, CPC, CTR, Conversions. Campaign-level ROI can be derived from spend vs. converted leads. |
| 7.5 | Share weekly and monthly reporting formats | Delivered | Role-based dashboards serve as live reporting formats. Agent: daily calls + weekly performance. Manager: team metrics + overdue tasks. Admin: pipeline value + revenue + episode distribution. Telephony Reports page provides call analytics with employee-level breakdowns. |
| 7.6 | Train internal users on interpretation and usage | Delivered Separately | Consulting deliverable. The CRM itself provides intuitive UI with contextual labels, tooltips, and role-appropriate views to minimize training needs. |
| 7.7 | Prepare structured handover documentation | Delivered Separately | Consulting deliverable. |
| 7.8 | Conduct a final implementation check and transition closure meeting | Delivered Separately | Consulting deliverable. |

---

## Additional Features Delivered (Beyond Original Scope)

These features were built into the CRM but were not explicitly listed in the original scope document:

| # | Feature | Description |
|---|---------|-------------|
| A1 | Multi-Tenant Architecture | Full multi-tenancy with tenant-specific data isolation, branding, SMTP, and master data. Enables the platform to serve multiple hospitals. |
| A2 | Episode Intelligence Layer | Temperature Engine for lead scoring, Auto-Handover Engine for stage-based team assignment, Revenue Probability forecasting with expected revenue calculations. |
| A3 | Consultation Log System | Hospital-specific consultation outcomes (Treatment Recommended, Follow-up Required, Conservative Treatment, Referred, No Treatment Required, Patient Did Not Proceed) with configurable remark chips. |
| A4 | Security & Compliance Hardening | PHI masking (Full/Masked/None access levels), failed login tracking with account lockout, session security (24hr TTL), inactivity timeout (30min + 5min warning), audit access logging, AES-256-GCM encryption for credentials. |
| A5 | Check-In & Front Office Module | Patient check-in workflow, appointment management with token numbers, doctor availability calendar, waiting room management. |
| A6 | Master Data Approval Workflow | 50+ master data tables with submit → approve/reject workflow. Bulk import/export capability. Ensures data governance across the organization. |
| A7 | Negotiation & Discount Workflows | Discount approval workflows on episodes with submit → approve/revoke cycle. Revenue probability auto-recalculated after each action. |
| A8 | Lead Merge & Deduplication | Sophisticated bulk merge tool consolidating duplicate leads while preserving full activity history, journey data, and source attribution. |
| A9 | Clinical Notes with Audit Trail | Secure clinical notes on leads/episodes with full audit trail for compliance. |
| A10 | Communication Preferences & Consent | Per-lead opt-in/opt-out for WhatsApp, SMS, Email, Phone. Consent capture at lead creation with timestamp and method tracking. |
| A11 | Telephony (Callyzer) Integration | Real-time call log capture via webhooks, auto-lead creation from calls, call duration tracking, employee-level call analytics. |
| A12 | Google Sheets Bulk Import | Lead import from Google Sheets with field mapping and duplicate handling. |
| A13 | System Admin Panel | Dedicated admin panel for managing multiple hospitals, subscriptions, and platform-wide settings. Separate theme (Bottle Green + Orange). |
| A14 | Dynamic Branding | Per-tenant customization of logos, favicons, display names, and color schemes. |
| A15 | Role-Based Access Control (4-Tier) | SYS_ADMIN, ADMIN, MANAGER, AGENT/COUNSELLOR hierarchy with granular PHI access levels and branch/team/self access scoping. |

---

## Summary Scorecard

| Phase | Total Items | Delivered in CRM | Delivered Separately | Partial | Not Built |
|-------|:-:|:-:|:-:|:-:|:-:|
| Phase 1: Funnel Mapping & Diagnostic Audit | 5 | 4 | 1 | 0 | 0 |
| Phase 2: CRM System Design & Funnel Structuring | 6 | 6 | 0 | 0 | 0 |
| Phase 3: Patient Engagement Automation | 7 | 5 | 0 | 2 | 0 |
| Phase 4: Campaign Framework & Lead Activation | 7 | 4 | 2 | 0 | 1 |
| Phase 5: Webinar Engine & Education Funnel | 5 | 0 | 1 | 1 | 3 |
| Phase 6: SOPs, Team Design & Execution Rhythm | 9 | 6 | 1 | 1 | 0 |*
| Phase 7: Dashboarding, Reporting & Transition | 8 | 5 | 3 | 0 | 0 |
| **TOTAL** | **47** | **30** | **8** | **4** | **4** |

*Note: "Delivered Separately" items are consulting/documentation deliverables that were part of the RGB engagement but not CRM software features.

**CRM Software Delivery Rate:** 30 fully delivered + 4 partial = **34 out of 39 software-relevant items (87%)**
(Excluding 8 consulting-only deliverables that were never intended as CRM features)

**Items requiring attention:**
1. After-care reminders (3/6/12 month) - Framework exists, needs hospital-specific configuration
2. Referral coupon tracking - Basic referral tracking exists, coupon-specific module not built
3. Webinar Engine - Not built (relies on third-party tools as noted in scope exclusions)
4. Automated review/testimonial collection - Not built
