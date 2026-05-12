# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hospital CRM — a multi-tenant, white-labeled web platform for hospitals to manage the full patient journey: lead generation → appointment → consultation → episode (treatment) → conversion. Deployed at `hcrm.rgbindia.com`.

## Commands

```bash
npm run dev       # Start dev server (tsx server/index.ts, NODE_ENV=development)
npm run build     # Production build — Vite (client) + esbuild (server)
npm start         # Run production build (node dist/index.cjs)
npm run check     # TypeScript type check (tsc)
npm run db:push   # Push Drizzle schema changes to PostgreSQL
```

No test runner is configured. No linter beyond TypeScript strict mode.

## Architecture

### Stack
- **Frontend:** React 18, wouter (router), React Query, shadcn/ui (Radix + Tailwind), Vite
- **Backend:** Node.js, Express, Drizzle ORM, PostgreSQL
- **Auth:** Replit OpenID Connect (Passport.js), sessions stored in `sessions` PostgreSQL table
- **Build:** Vite bundles `client/` → `dist/public/`; esbuild bundles `server/index.ts` → `dist/index.cjs`

### Monorepo Layout
```
client/src/       React app — pages, components, hooks, lib
server/           Express server — routes, services, integrations
shared/           Types shared by both — schema.ts (Drizzle tables), routes.ts (Zod schemas)
script/build.ts   Build orchestrator
```

### Path Aliases (tsconfig + vite.config)
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`

### API
All routes are RESTful, defined in `server/routes.ts`. Request/response shapes are Zod schemas in `shared/routes.ts`. Every route reads `req.tenantId` (set by auth middleware) and appends it to every query — multi-tenant isolation is query-level, not schema-level.

### Database
`shared/schema.ts` contains 100+ Drizzle ORM table definitions. Every table has a `tenantId` column. Approval workflow fields (`approvalStatus`: Pending/Approved/Rejected) and audit fields (`createdAt`, `createdBy`, `modifiedAt`, `modifiedBy`) appear on most tables.

### Multi-Tenancy
- Single database, `tenantId` on every row
- Login page calls `GET /api/tenants/list` (public, no auth) to populate the hospital selector
- After login, `tenantId` is stored in session and injected into every query

### RBAC
12 roles: `SYS_ADMIN`, `ADMIN`, `MANAGER`, `COUNSELLOR`, `AGENT`, `TELECALLER`, `RECEPTIONIST`, `BILLING`, `INSURANCE_DESK`, `DOCTOR`, `MEDICAL_ASSISTANT`, `MIS_VIEWER`. Role permissions are defined in `DEFAULT_ROLE_PERMISSIONS` in `server/routes.ts` and can be overridden per user via `user_permission_overrides`. Frontend role gates live in `App.tsx` using `useCurrentUser()`.

### PHI Masking
Server-side middleware in `server/index.ts` intercepts all `/api/*` responses and masks phone, email, diagnosis, and other PHI fields based on the user's `phiAccessLevel` ("Full" | "Masked" | "None"). Never bypass or weaken this middleware.

### Key Business Services (`server/services/`)
| File | Purpose |
|---|---|
| `temperatureEngine.ts` | Lead scoring algorithm |
| `nurtureEngine.ts` | Automated task chains for lead nurturing |
| `handoverEngine.ts` | Auto-assigns team based on episode stage |
| `backgroundScheduler.ts` | Cron-like scheduled jobs |
| `preopAssessment.ts` | Pre-operative checklist and clearance workflow |
| `metaAds.ts` | Facebook/Instagram campaign insight sync |

### External Integrations
- **WhatsApp:** WATI (primary) + Meta Cloud API v21.0 (fallback) — `server/wati.ts`, `server/whatsapp.ts`
- **Telephony:** Callyzer webhook receiver
- **Google Sheets:** Bulk lead import
- **Email:** nodemailer, per-tenant SMTP config from DB
- **Encryption:** AES-256-GCM in `server/crypto.ts` for stored credentials

## Key Conventions

- **Never skip `tenantId`** in any new DB query. All data is tenant-scoped.
- **Zod validation first:** Add request/response schemas to `shared/routes.ts` before wiring routes.
- **Approval workflows:** Master data tables (doctors, branches, etc.) go through Pending → Approved before appearing in production selectors.
- **Before adding external dependencies or making structural changes, ask for approval** — this is a production system with real patient data.
- **PHI fields** (phone, email, NHI numbers, diagnoses) must pass through the masking middleware and must never be logged raw.

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `NODE_ENV` — `development` | `production`
- Additional per-tenant secrets (SMTP, WhatsApp tokens) are stored encrypted in the DB, not in env files.
