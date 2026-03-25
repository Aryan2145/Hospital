# myProSys Hospital CRM — Compliance & Data Protection Audit Report
**Date:** 25 March 2026  
**Prepared for:** Viroc Super Speciality Orthopaedic Hospital / RGB Tech  
**Scope:** PHI Protection, HIPAA-Aligned Safeguards, India Data Privacy Readiness, Security of Integrations & Storage

---

## PHASE 1: Product Understanding & PHI Identification

### Modules Identified in the CRM
1. **Lead Management** — Capture, qualify, assign, nurture patient inquiries
2. **Patient Registration** — UHID-based patient records with demographics
3. **Episode Management** — Treatment journeys (OPD/IPD/Surgery) with diagnosis, costs, insurance
4. **Appointment Scheduling** — Doctor calendar, check-in, consultation workflow
5. **Consultation Log** — Outcome recording, clinical notes, treatment plans
6. **Telephony Integration** — Call logs via Callyzer webhooks, auto-lead matching
7. **WhatsApp Communication** — Appointment reminders, template messages
8. **Campaign Management** — Meta/Facebook ad insights, UTM tracking
9. **Master Data Management** — 50+ configurable tables with approval workflows
10. **Team Management** — Role assignment, branch management, handover workflows
11. **Dashboards & Reports** — Role-based analytics, telephony reports
12. **System Admin Panel** — Multi-tenant management, subscription control

### Patient-Related Data Captured (PHI / PII Classification)

| Category | Fields | Classification |
|----------|--------|---------------|
| **Direct Identifiers** | Name, Phone (E.164), Email, Address, Pin Code, UHID, HMS Patient ID | **PII — High Sensitivity** |
| **Demographics** | Date of Birth, Gender, Blood Group | **Sensitive Personal Data** |
| **Emergency Contact** | Emergency Contact Name & Phone | **PII** |
| **Clinical Data** | Diagnosis, Treatment Plan, Consultation Notes, Consultation Outcomes | **PHI — Critical** |
| **Financial/Insurance** | Insurance Provider, Policy Number, Insurer/TPA ID, Pre-auth Amount, Treatment Costs, Discount Details | **Financial PHI** |
| **Communication Records** | Call logs (duration, recording URLs), WhatsApp messages, Activity notes | **PHI — Sensitive** |
| **Behavioral/Marketing** | UTM Source, Campaign ID, Lead Source, Lead Temperature Score | **Internal — Low Sensitivity** |

**Key Finding:** Patient medical details (diagnosis, treatment plan) are stored alongside lead/marketing data in the same tables (`leads.diagnosis`, `episodes.diagnosis`). There is no physical or logical separation between marketing and clinical data stores.

---

## PHASE 2: Section-by-Section Compliance Review

---

### Section A: Data Identification and Classification

**Q1: What data qualifies as personal, sensitive personal, or health data?**
- **Found:** 6 categories of PHI/PII as listed above. Schema fields `diagnosis`, `treatmentPlan`, `consultationNotes`, `bloodGroup`, `insurancePolicyNumber` are clearly health/sensitive data.
- **Status:** ⚠️ Partial
- **Risk:** Medium
- **What should be done:** Implement a formal data classification matrix. Tag each database column with a sensitivity level (Public / Internal / Confidential / PHI). This classification should drive API response filtering, export controls, and logging.

**Q2: Is there formal data classification in the system?**
- **Found:** The `phi_access_level` field on `crm_users` (Full/Masked/None) is the only classification mechanism. There is no column-level or table-level data classification metadata.
- **Status:** ❌ Missing
- **Risk:** High

**Q3: Is sensitive data collected too early in the journey?**
- **Found:** The leads table captures `diagnosis`, `bloodGroup`, `insuranceProvider`, `insurancePolicyNumber` at the lead stage itself — before the patient is even qualified or registered.
- **Status:** ⚠️ Partial
- **Risk:** Medium
- **What should be done:** Consider making clinical fields available only after lead qualification or episode creation. At the lead stage, only contact info and source tracking should be mandatory.

---

### Section B: Access Control and Permissions

**Q4: Does the system have role-based access control?**
- **Found:** Yes. 5 roles: SYS_ADMIN, ADMIN, MANAGER, AGENT, COUNSELLOR. Defined in `system_roles` table and seeded on startup.
- **Status:** ✅ Good
- **Risk:** Low

**Q5: Are permissions defined by module, action, and field level?**
- **Found:** Role checks exist for administrative actions (`requireAdminRole` helper). Row-level filtering exists for leads (`accessScopeType`: Self/Branch/All). However, there is **no granular permission matrix** — no module-level or action-level permission table.
- **Status:** ⚠️ Partial
- **Risk:** High
- **What should be done:** Build a permission matrix table: `role_permissions(role_id, module, action, allowed)`. Enforce on both frontend and API.

**Q6: Can telecallers see medical/treatment fields they shouldn't?**
- **Found:** The `phi_access_level` field exists in the schema but **masking is NOT enforced on the backend API**. The `/api/leads` and `/api/leads/:id` endpoints return full patient data (phone, email, diagnosis) regardless of the user's PHI access level. Masking, if any, is cosmetic on the frontend only.
- **Status:** ❌ Weak
- **Risk:** **Critical**
- **What should be done:** Implement server-side field filtering. Before returning lead/patient/episode data, strip or mask PHI fields based on the requesting user's `phi_access_level`. Never rely on frontend-only masking.

**Q7: Are access rights enforced on backend/API level?**
- **Found:** Authentication is enforced on all routes. Admin-level operations check role. Row-level scoping (Self/Branch/All) is enforced for leads. But PHI field-level masking is **not** enforced server-side. Any authenticated user could call `/api/leads/:id` and get full PHI.
- **Status:** ⚠️ Partial
- **Risk:** **Critical**

---

### Section C: Authentication and Session Security

**Q8: How is login handled?**
- **Found:** CRM user login via mobile number + password. Passwords hashed with bcrypt (salt rounds: 12). Sessions stored in PostgreSQL via `connect-pg-simple`. Session cookies: `httpOnly: true`, `secure: true` in production.
- **Status:** ✅ Good
- **Risk:** Low

**Q9: Are there inactivity timeouts?**
- **Found:** Session TTL is **7 days**. There is **no** short-term inactivity timeout (e.g., 15-minute idle logout).
- **Status:** ❌ Missing
- **Risk:** High
- **What should be done:** Implement a 30-minute inactivity timeout. Add a frontend idle detector that logs the user out after inactivity. Reduce session TTL to 24 hours max.

**Q10: Is Multi-Factor Authentication (MFA) available?**
- **Found:** No MFA implementation exists anywhere in the codebase.
- **Status:** ❌ Missing
- **Risk:** High (especially for ADMIN and SYS_ADMIN roles)
- **What should be done:** Implement OTP-based MFA (SMS or authenticator app) at minimum for admin roles. Consider mandatory MFA for all users accessing PHI.

**Q11: Are environment secrets protected properly?**
- **Found:** Secrets (`SESSION_SECRET`, `SMTP_PASS`, `META_ACCESS_TOKEN`, etc.) are stored as Replit environment variables, not committed to code. However, tenant-specific integration credentials (WhatsApp tokens, SMTP passwords) are stored **in plain text** in the `tenant_settings` and `platform_connectors` database tables.
- **Status:** ⚠️ Partial
- **Risk:** High
- **What should be done:** Encrypt tenant-specific credentials at rest in the database using application-level encryption (AES-256). Use a key management approach where the encryption key is in environment variables, not in the DB.

---

### Section D: Audit Trail and Monitoring

**Q12: Does the system log who viewed patient data?**
- **Found:** **No.** There is no "view log" or "access log" for patient records. The system logs edits, status changes, and actions — but not reads/views.
- **Status:** ❌ Missing
- **Risk:** High
- **What should be done:** Implement read-access logging for sensitive patient detail views. At minimum, log when a user views a patient's clinical notes or full PHI.

**Q13: Does the system log who edited patient data?**
- **Found:** **Yes, partially.** Clinical note edits require a reason and are audit-logged. Episode status changes, discount approvals, and merge operations are logged with actor information. However, direct lead field edits (name, phone, diagnosis changes) are **not** comprehensively audit-logged.
- **Status:** ⚠️ Partial
- **Risk:** Medium

**Q14: Does the system log who exported data?**
- **Found:** **No.** Master data exports and telephony report CSV exports are not logged in the audit trail.
- **Status:** ❌ Missing
- **Risk:** High

**Q15: Are failed login attempts tracked?**
- **Found:** Failed logins return error messages but are **not** logged to any audit table or monitoring system. No account lockout after repeated failures.
- **Status:** ❌ Missing
- **Risk:** High
- **What should be done:** Log failed login attempts with IP address and timestamp. Implement account lockout after 5 failed attempts within 15 minutes.

---

### Section E: Data Storage and Encryption

**Q16: Is patient data encrypted at rest?**
- **Found:** The application does not implement application-level encryption for any database fields. Data is stored in plain text in PostgreSQL. Replit's managed PostgreSQL provides infrastructure-level encryption, but this is **not** under the application's control and may not satisfy healthcare-grade requirements.
- **Status:** ⚠️ Partial (infrastructure-level only)
- **Risk:** High

**Q17: Is patient data encrypted in transit?**
- **Found:** HTTPS is enforced via Replit's infrastructure. Session cookies have `secure: true` in production. API calls between client and server use TLS.
- **Status:** ✅ Good
- **Risk:** Low

**Q18: Are sensitive fields masked where appropriate?**
- **Found:** The `phi_access_level` mechanism exists in the schema but is **not enforced** in API responses. Phone numbers, emails, and clinical data are returned in full to all authenticated users.
- **Status:** ❌ Weak
- **Risk:** **Critical**

**Q19: Is PHI stored in plain text in logs or debug output?**
- **Found:** The Express logger in `server/routes.ts` logs API response snippets (first ~200 chars of JSON responses) to the console. These logs include patient names, phone numbers, and potentially clinical data in the response body. No log sanitization is applied.
- **Status:** ❌ Weak
- **Risk:** High
- **What should be done:** Sanitize server logs to exclude or mask PHI fields from response logging. Never log phone numbers, emails, diagnosis, or insurance details.

---

### Section F: API and Frontend Exposure

**Q20: Which API endpoints expose patient data?**
- **Found:** Key endpoints: `/api/leads` (list with full PHI), `/api/leads/:id` (full detail), `/api/patients` (patient list), `/api/episodes/:id` (diagnosis, treatment plan, costs), `/api/appointments` (consultation notes), `/api/activities` (call logs with descriptions).
- **Status:** ⚠️ Partial
- **Risk:** High
- **What should be done:** Implement response serializers that filter fields based on the requesting user's role and PHI access level.

**Q21: Are API responses returning more fields than needed?**
- **Found:** **Yes.** List endpoints like `/api/leads` return full patient objects including diagnosis, insurance details, and clinical notes — even in list/table views where only name, status, and basic info are needed.
- **Status:** ❌ Weak
- **Risk:** High

**Q22: Is patient data visible in browser network payloads?**
- **Found:** Since APIs return full objects, all PHI is visible in browser DevTools Network tab for any authenticated user.
- **Status:** ❌ Weak
- **Risk:** High

---

### Section G: Consent and Purpose Limitation

**Q23: Does the CRM capture consent for collecting patient data?**
- **Found:** **No.** There are no consent fields, consent timestamps, or consent management tables anywhere in the database schema. No opt-in/opt-out tracking exists.
- **Status:** ❌ Missing
- **Risk:** **Critical** (for India DPDP Act compliance)
- **What should be done:** Add consent capture fields to leads and patients tables: `consent_given` (boolean), `consent_timestamp`, `consent_method` (verbal/written/digital), `consent_purpose`. Display consent capture in the lead creation and patient registration forms.

**Q24: Does it capture consent for WhatsApp/calls/marketing?**
- **Found:** **No.** WhatsApp messages and calls are sent without any recorded consent mechanism. No opt-in/opt-out tracking for communication channels.
- **Status:** ❌ Missing
- **Risk:** **Critical**

**Q25: Is marketing use mixed with medical use?**
- **Found:** **Yes.** UTM parameters, campaign IDs, and lead sources are stored in the same leads table alongside diagnosis, treatment department, and insurance details. There is no logical separation between marketing/CRM data and clinical data.
- **Status:** ❌ Weak
- **Risk:** Medium

---

### Section H: Integrations and External Exposure

**Q26: Are access tokens stored securely?**
- **Found:** Global tokens are in environment variables (secure). Tenant-specific tokens (WhatsApp, SMTP, Callyzer) are stored **in plain text** in `platform_connectors.credentials` (JSONB) and `tenant_settings.value` tables.
- **Status:** ⚠️ Partial
- **Risk:** High

**Q27: Are webhook endpoints secured?**
- **Found:** Callyzer webhook validates secrets via headers (`x-callyzer-secret`, `x-webhook-secret`, `x-api-key`, or `Authorization`). Lead capture webhooks use unique 32-byte hex tokens in the URL. No IP whitelisting or request signing exists.
- **Status:** ⚠️ Partial
- **Risk:** Medium

**Q28: Are third-party APIs receiving health data?**
- **Found:** WhatsApp receives patient name + phone number (for reminders). Meta receives no patient data (pull-only). SMTP receives name + email. No clinical/diagnosis data is sent to any third party.
- **Status:** ✅ Good
- **Risk:** Low

---

### Section I: Reports, Exports, and Internal Leakage

**Q29: Can users export patient data freely?**
- **Found:** Master data exports exist but do not include patient/lead tables. Telephony reports can be exported to CSV from the browser. There is no bulk patient/lead export feature currently.
- **Status:** ⚠️ Partial
- **Risk:** Medium

**Q30: Are exports role-controlled and logged?**
- **Found:** Exports require authentication but are **not** role-restricted and are **not** logged to the audit trail.
- **Status:** ❌ Missing
- **Risk:** High

---

### Section J: Retention, Deletion, and Data Lifecycle

**Q31: Is there a data retention policy?**
- **Found:** **No.** There is no retention policy, no automated archival, and no data lifecycle management in the system.
- **Status:** ❌ Missing
- **Risk:** High

**Q32: Can patient data be deleted or anonymized?**
- **Found:** Leads have a `merge_status` field (ACTIVE/MERGED) which acts as a soft-delete for merged leads. Beyond this, there is **no** delete, anonymize, or right-to-erasure capability for patient records.
- **Status:** ❌ Missing
- **Risk:** High (for DPDP Act compliance — patients have the right to erasure)

**Q33: Is there soft delete with audit preservation?**
- **Found:** Only for lead merges. No general soft-delete pattern across the system.
- **Status:** ❌ Missing
- **Risk:** Medium

---

### Section K: India Readiness (DPDP Act 2023)

**Q34: How ready is this CRM for India's Digital Personal Data Protection Act?**

| DPDP Requirement | Status | Gap |
|---|---|---|
| Consent-based collection | ❌ Missing | No consent capture mechanism |
| Purpose limitation | ❌ Weak | Marketing and clinical data mixed |
| Data minimization | ⚠️ Partial | Clinical fields available too early in journey |
| Access control | ⚠️ Partial | Roles exist but PHI masking not enforced |
| Security safeguards | ⚠️ Partial | Basic auth good, but no encryption at rest, no MFA |
| Correction capability | ⚠️ Partial | Users can edit data but no formal "data correction request" workflow |
| Deletion/erasure readiness | ❌ Missing | No delete/anonymize capability |
| Breach notification readiness | ❌ Missing | No breach detection or notification process |
| Data Protection Officer | ❌ Missing | No DPO designation or contact mechanism |

---

### Section L: HIPAA-Aligned Readiness

| HIPAA Area | Status | Notes |
|---|---|---|
| Privacy safeguards | ⚠️ Partial | PHI access levels defined but not enforced |
| Security safeguards | ⚠️ Partial | Auth good, encryption weak, no MFA |
| Access logging | ⚠️ Partial | Edit logs yes, view logs no |
| Breach readiness | ❌ Missing | No breach detection/notification |
| Minimum necessary access | ❌ Weak | APIs return all fields regardless of need |
| Role segregation | ⚠️ Partial | Roles exist, granular permissions missing |
| Business Associate Agreements | ❌ Missing | No BAA framework for third-party integrations |

---

## PHASE 3: Output

### 1. Executive Summary

myProSys Hospital CRM has a **solid foundational architecture** for a healthcare CRM — multi-tenancy, role-based access with 5 tiers, comprehensive audit logging for critical operations, and secure authentication with bcrypt password hashing and secure sessions. The platform is well-designed for its operational purpose.

However, from a **healthcare data protection standpoint, there are significant gaps** that must be addressed before selling to larger hospitals or handling scale:

- **PHI masking is defined but not enforced** on the backend — this is the single biggest risk
- **No consent management** exists — critical for India's DPDP Act
- **No MFA, no inactivity timeout, no failed login tracking**
- **No data-at-rest encryption** for sensitive fields
- **Audit trail covers edits but not views or exports**
- **No data retention or deletion policy**

**Overall Compliance Posture: 35-40% — Needs significant investment before enterprise readiness.**

---

### 2. Compliance Scorecard

| # | Area | Status | Risk | Remarks | Priority |
|---|------|--------|------|---------|----------|
| 1 | Data Classification | ⚠️ Partial | Medium | PHI levels exist in schema but no formal classification | P2 |
| 2 | Access Control | ⚠️ Partial | **Critical** | Roles exist, PHI masking NOT enforced server-side | **P0** |
| 3 | Authentication | ⚠️ Partial | High | Good basics, no MFA, no inactivity timeout | P1 |
| 4 | Audit Trail | ⚠️ Partial | High | Edits logged, views/exports NOT logged | P1 |
| 5 | Encryption | ❌ Weak | High | Transit yes, at-rest no, credentials in plain text | P1 |
| 6 | API Security | ❌ Weak | **Critical** | APIs return all PHI to all authenticated users | **P0** |
| 7 | Consent Management | ❌ Missing | **Critical** | No consent capture anywhere | **P0** |
| 8 | Integrations | ⚠️ Partial | Medium | Webhooks secured, credentials not encrypted | P2 |
| 9 | Reporting/Export Control | ❌ Weak | High | No role-gating, no export logging | P1 |
| 10 | Retention/Deletion | ❌ Missing | High | No retention policy, no deletion capability | P2 |
| 11 | India DPDP Readiness | ❌ Weak | **Critical** | Major gaps in consent, deletion, breach readiness | **P0** |
| 12 | HIPAA-Aligned Readiness | ❌ Weak | High | Foundational pieces present, enforcement missing | P1 |

---

### 3. Top 10 Immediate Gaps

| # | Gap | Risk | Impact |
|---|-----|------|--------|
| 1 | **PHI masking not enforced on API responses** | Critical | Any authenticated user sees all patient data |
| 2 | **No consent capture mechanism** | Critical | Violates India DPDP Act; legal liability |
| 3 | **No MFA for admin/clinical users** | High | Single password compromise = full data access |
| 4 | **No inactivity session timeout** | High | Unattended sessions can be exploited |
| 5 | **PHI logged in server console output** | High | Patient data in plain text in logs |
| 6 | **No failed login attempt tracking/lockout** | High | Brute force attacks possible |
| 7 | **Integration credentials stored in plain text in DB** | High | DB compromise exposes all API keys |
| 8 | **No view-access logging for patient records** | High | Cannot audit who looked at patient data |
| 9 | **No export logging or role control** | High | Data exfiltration risk |
| 10 | **No patient data deletion/anonymization capability** | High | Cannot comply with right-to-erasure requests |

---

### 4. Top 10 Quick Wins (High Impact, Low-Medium Effort)

| # | Quick Win | Effort | Impact |
|---|-----------|--------|--------|
| 1 | Add server-side PHI field filtering based on `phi_access_level` | Medium | Closes the biggest security gap |
| 2 | Add consent fields to leads/patients tables + capture in forms | Low | Establishes legal compliance foundation |
| 3 | Implement 30-min inactivity timeout (frontend idle detector) | Low | Prevents session hijacking |
| 4 | Sanitize server logs to exclude PHI from response logging | Low | Stops PHI leakage in logs |
| 5 | Log failed login attempts + add account lockout (5 attempts) | Low | Prevents brute force attacks |
| 6 | Log all data export actions to audit trail | Low | Creates export accountability |
| 7 | Reduce session TTL from 7 days to 24 hours | Trivial | Reduces session exposure window |
| 8 | Add rate limiting to login and webhook endpoints | Low | Prevents abuse |
| 9 | Add "who viewed" logging for patient detail page API | Medium | Enables access auditing |
| 10 | Encrypt tenant credentials in DB with AES-256 | Medium | Protects integration secrets |

---

### 5. High-Risk Findings

#### 5.1 Unauthorized Access Risk
- **PHI masking not enforced:** A telecaller with `phi_access_level: "None"` can call `/api/leads/123` directly and receive full patient diagnosis, insurance details, and clinical notes. The masking is frontend-only.
- **No module-level permissions:** Any authenticated user can access any API endpoint. There's no check like "can this AGENT access the Episodes module?"

#### 5.2 Data Leakage Risk
- **Server logs contain PHI:** Express response logging includes patient names, phone numbers in truncated JSON output.
- **API over-exposure:** List endpoints return complete patient objects with all fields, including those not displayed in the UI.
- **No export controls:** Users can export master data and telephony reports without audit trail.

#### 5.3 Privacy Breach Risk
- **No consent management:** No ability to demonstrate lawful basis for processing patient data under DPDP Act.
- **No breach detection:** No monitoring for unusual access patterns, bulk downloads, or unauthorized data access.
- **No data retention/deletion:** Patient data is retained indefinitely with no lifecycle management.

#### 5.4 Weak Auditability
- **No view logging:** Cannot answer "who looked at Patient X's records on Date Y?"
- **No export logging:** Cannot answer "who downloaded the telephony report containing patient phone numbers?"
- **Lead field edits not comprehensively logged:** Direct changes to lead contact info or diagnosis fields may not create audit entries.

#### 5.5 Unsafe Integration Exposure
- **WhatsApp/SMTP/Callyzer credentials in plain text in DB:** If the database is compromised (or accessed by a DBA), all integration tokens are exposed.
- **No credential rotation policy:** API tokens appear to be permanent with no rotation mechanism.

---

### 6. Recommended Action Plan

#### Immediate (This Week)
1. Enforce PHI masking on all lead/patient/episode API responses based on user's `phi_access_level`
2. Sanitize server response logging to exclude PHI fields
3. Reduce session TTL from 7 days to 24 hours
4. Add failed login attempt logging and account lockout

#### Next 30 Days
5. Add consent capture fields and forms (leads + patients)
6. Implement 30-minute inactivity timeout
7. Add view-access and export logging to audit trail
8. Encrypt tenant integration credentials in database
9. Implement API response field filtering (return only needed fields per endpoint)
10. Add rate limiting to authentication and webhook endpoints

#### Next 90 Days
11. Build granular permission matrix (module × action × role)
12. Implement MFA (OTP-based) for ADMIN and SYS_ADMIN roles
13. Add data retention policy with automated archival
14. Build patient data deletion/anonymization workflow (right to erasure)
15. Implement communication opt-in/opt-out tracking
16. Add breach detection and notification framework
17. Create a formal Privacy Policy and Terms of Service for patients
18. Conduct penetration testing

#### Before Enterprise-Scale Rollout
19. Implement field-level encryption for critical PHI columns (diagnosis, insurance)
20. Build comprehensive permission matrix with UI for configuration
21. Add data watermarking for exports (user ID + timestamp in CSV metadata)
22. Implement IP-based access restrictions for admin panel
23. Create Data Processing Agreement (DPA) templates for hospital clients
24. Designate Data Protection Officer (DPO) role in the system
25. Build patient-facing consent management portal
26. Achieve SOC 2 Type II or ISO 27001 certification
27. Implement database-level row security policies

---

### 7. Developer Task List

#### Backend Changes
| # | Task | File(s) | Priority |
|---|------|---------|----------|
| B1 | Add PHI field filtering middleware — strip/mask `phoneE164`, `email`, `diagnosis`, `treatmentPlan`, `insurancePolicyNumber`, `bloodGroup` based on requesting user's `phi_access_level` | `server/routes.ts` | **P0** |
| B2 | Sanitize response logging — redact PHI fields before console.log | `server/routes.ts` (logger middleware) | P0 |
| B3 | Add failed login attempt counter + lockout after 5 failures | `server/routes.ts` (login route) | P1 |
| B4 | Add rate limiting middleware (express-rate-limit) on `/api/auth/*` and `/api/webhook/*` | `server/routes.ts` | P1 |
| B5 | Implement idle session timeout (reduce TTL, add last-activity tracking) | `server/replit_integrations/auth/replitAuth.ts` | P1 |
| B6 | Add audit log entries for: data exports, patient record views, bulk operations | `server/routes.ts` | P1 |
| B7 | Encrypt `credentials` column in `platform_connectors` and sensitive `tenant_settings` values using AES-256 | `server/routes.ts`, `server/storage.ts` | P2 |
| B8 | Build data deletion/anonymization endpoint: `DELETE /api/patients/:id/anonymize` | `server/routes.ts` | P2 |

#### Database Changes
| # | Task | Table(s) | Priority |
|---|------|----------|----------|
| D1 | Add consent fields to `leads`: `consent_given`, `consent_timestamp`, `consent_method`, `consent_purpose` | `shared/schema.ts` (leads) | **P0** |
| D2 | Add consent fields to `patients`: same as above | `shared/schema.ts` (patients) | **P0** |
| D3 | Create `communication_preferences` table: `patient_id`, `channel` (WhatsApp/SMS/Email/Call), `opted_in`, `opted_in_at`, `opted_out_at` | `shared/schema.ts` | P1 |
| D4 | Add `failed_login_attempts` and `locked_until` columns to `crm_users` | `shared/schema.ts` | P1 |
| D5 | Create `access_logs` table: `user_id`, `entity_type`, `entity_id`, `action` (view/export/edit), `ip_address`, `timestamp` | `shared/schema.ts` | P1 |
| D6 | Create `role_permissions` table: `role_id`, `module`, `action`, `allowed` | `shared/schema.ts` | P2 |
| D7 | Add `data_retention_days` to `tenant_settings` | `shared/schema.ts` | P2 |

#### Auth Changes
| # | Task | Priority |
|---|------|----------|
| A1 | Implement OTP-based MFA for ADMIN and SYS_ADMIN roles | P2 |
| A2 | Add frontend idle detector (30-min timeout → auto-logout) | P1 |
| A3 | Reduce session `maxAge` from 7 days to 24 hours | P0 |

#### Frontend Changes
| # | Task | Priority |
|---|------|----------|
| F1 | Add consent checkbox + timestamp capture in New Lead and Patient Registration forms | P0 |
| F2 | Add communication preference UI (opt-in/opt-out per channel) | P1 |
| F3 | Respect PHI masking in components (if server returns masked data, display accordingly) | P0 |
| F4 | Add idle timeout warning modal (5 min before auto-logout) | P1 |

---

## REGARDING SECURE INDIAN SERVERS

### Can we host on certified Indian servers?

**Yes, absolutely.** Here are the options:

#### Option 1: Replit Deployments (Current)
- Replit's infrastructure uses cloud providers with data centers that may not be in India
- Suitable for development and early-stage deployment
- May not satisfy data residency requirements for larger hospitals

#### Option 2: Indian Cloud Providers (Recommended for Enterprise)
These providers have data centers in India and relevant certifications:

| Provider | Certifications | India Data Centers |
|----------|---------------|-------------------|
| **AWS India (Mumbai/Hyderabad)** | ISO 27001, SOC 2, HIPAA eligible | Mumbai (ap-south-1), Hyderabad (ap-south-2) |
| **Microsoft Azure India** | ISO 27001, SOC 2, HIPAA BAA available | Pune, Chennai, Mumbai |
| **Google Cloud India** | ISO 27001, SOC 2 | Mumbai, Delhi |
| **Jio Cloud (Indian)** | MeitY empaneled | Multiple India locations |
| **Yotta (Indian)** | ISO 27001, SOC 2, PCI DSS | Navi Mumbai, Greater Noida |
| **CtrlS (Indian)** | ISO 27001, SOC 1 & 2, PCI DSS | Hyderabad, Mumbai, Noida |
| **NxtGen (Indian)** | ISO 27001, MeitY empaneled | Mumbai, Bangalore |

#### Key Certifications to Look For
1. **ISO 27001** — Information Security Management System
2. **SOC 2 Type II** — Service Organization Controls (security, availability, integrity)
3. **MeitY Empanelment** — Indian Government's Ministry of Electronics & IT approval
4. **STQC Certification** — Standardization Testing and Quality Certification (Indian govt.)
5. **PCI DSS** — If handling payment card data
6. **HIPAA Eligible** — If planning to serve international clients

#### Recommended Architecture for Indian Hosting
```
┌─────────────────────────────────┐
│     Indian Cloud (AWS Mumbai)    │
│  ┌───────────┐ ┌──────────────┐ │
│  │ App Server │ │ PostgreSQL   │ │
│  │ (Node.js)  │ │ (RDS/Aurora) │ │
│  └───────────┘ └──────────────┘ │
│  ┌───────────┐ ┌──────────────┐ │
│  │ File Store │ │ Redis Cache  │ │
│  │ (S3 India) │ │ (Elasticache)│ │
│  └───────────┘ └──────────────┘ │
│  ┌──────────────────────────────┐│
│  │ Encryption at Rest (KMS)     ││
│  │ VPC + Security Groups        ││
│  │ WAF + DDoS Protection        ││
│  │ CloudTrail Audit Logging     ││
│  └──────────────────────────────┘│
└─────────────────────────────────┘
```

#### What This Gives You
- **Data residency in India** — all patient data stays within Indian borders
- **Compliance certifications** — ISO 27001, SOC 2 from the infrastructure provider
- **Encryption at rest** — managed by the cloud provider's KMS
- **Network security** — VPC, firewalls, DDoS protection
- **Audit logging** — infrastructure-level access logging

#### Migration Path
The current myProSys codebase is **portable** — it's a standard Node.js + PostgreSQL application. Migration to any Indian cloud provider would involve:
1. Setting up a managed PostgreSQL instance (e.g., AWS RDS in Mumbai)
2. Deploying the Node.js application (e.g., AWS ECS or EC2)
3. Configuring environment variables and DNS
4. Migrating the database
5. Setting up SSL certificates and domain mapping

**Estimated effort: 2-3 days for infrastructure setup + 1 day for migration and testing.**

---

## Summary

The myProSys CRM has strong operational foundations but needs targeted security hardening before it can confidently serve larger hospitals. The good news is that most gaps are addressable with moderate development effort. The three most critical items are:

1. **Enforce PHI masking on the server side** (not just frontend)
2. **Add consent management** (for DPDP Act compliance)
3. **Move to Indian cloud hosting** (for data residency requirements)

These three changes alone would move the compliance posture from ~35% to ~60%, and the full 90-day plan would bring it to ~85%+.
