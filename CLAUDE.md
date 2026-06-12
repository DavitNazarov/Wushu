# Geo Wushu Competition System — CLAUDE.md

Tournament management system for the Georgian Wushu Federation. Handles athlete registration, weight-in verification, bracket drawing, fight scheduling, live scoring, and results for Wushu (Chinese martial arts) competitions.

---

## Monorepo Layout

```
/
├── frontend/          Next.js 16 app          (port 3000)
├── backend/           NestJS + Prisma API      (port 4000)
├── package.json       npm workspaces root
├── docker-compose.yml PostgreSQL container (local dev)
├── deploy/hetzner/    Production Docker/compose/nginx stack (deploy target)
├── docs/DEPLOYMENT.md Full deployment runbook
└── server.js          Production entry point
```

**Production deployment:** `server.js` runs a **single combined Node/Express process** — Next.js serves everything, and `/api/*` is mounted into the NestJS app via `ExpressAdapter` (`globalPrefix: false`, Nest's `createApp` from `backend/dist/src/main`). Frontend + backend ship as **one server on one port** (default 4000). **Prod target is a self-hosted Hetzner VPS** running `deploy/hetzner/docker-compose.prod.yml`: `nginx` (TLS + reverse proxy) → `app` (combined process) → `postgres 16`, plus a one-shot `migrate` job (`npm run db:deploy` = repair-schema + lock-free migrate-deploy). **Node 22 LTS** (`.nvmrc`, baked into the Dockerfile). Health checks: `/api/health` (liveness, constant) + `/api/ready` (readiness, `SELECT 1`, 503 when DB is down). Full runbook in `docs/DEPLOYMENT.md`. **Single instance only** — schedulers, socket.io rooms, the rate limiter, and exports are all in-process (scaling out needs a Redis adapter + distributed cron locks first).

**External services:** PostgreSQL is the only **required** external dependency. The frontend also has **optional Sentry** error/performance monitoring (`frontend/src/instrumentation*.ts` + `sentry.*.config.ts`, wired through `next.config.ts`); it is gated on `NEXT_PUBLIC_SENTRY_DSN` and is a complete no-op when that var is unset, so it stays out of the way in dev/self-host. Beyond that there is **no** email provider, payment processor, cloud storage, or Redis/queue — contact forms write to the `ContactSubmission` table, and exports write JSON to local `/tmp/wushu-exports`. PDF exports (results protocols, schedule, weigh-in lists) are rendered server-side with **Puppeteer** — the prod Docker image installs system Chromium + Noto fonts (Georgian glyphs) for this. Background work is four in-process schedulers (`@nestjs/schedule`): hourly event stage auto-advance (`0 5 * * * *`), daily refresh-token cleanup (03:00), daily export TTL sweep (03:30 — prunes `/tmp/wushu-exports` + stale `DocumentLink` rows after 72h), and a 1s fight-timer automation interval. Optional backend **Sentry** error aggregation is gated on `SENTRY_DSN` (no-op when unset); nightly DB backups run via `deploy/hetzner/backup.sh` (host cron, see DEPLOYMENT.md §8).

---

## Dev Commands

All run from the repo root:

```bash
npm install          # Install everything (workspaces)
npm run dev          # Start backend + frontend + Prisma Studio concurrently
npm run dev:backend  # NestJS only
npm run dev:frontend # Next.js only
npm run build        # backend (prisma generate + nest build) then frontend
npm run lint         # frontend lint; `npm run lint:backend` for backend
npm test             # backend unit tests (jest)
npm run knip         # dead-code / unused-export / unused-dependency report (config: knip.json)
```

**Never start the preview/dev server yourself** — the user runs it manually.  
**Never run `npm run build` or `tsc` unless the user explicitly asks.** It's slow and not needed for code review.

### Database

```bash
docker compose up -d db                     # Start PostgreSQL (persists across reboots)
cd backend && npm run prisma:migrate        # Create + apply a new migration (dev)
cd backend && npm run prisma:migrate:deploy # Apply migrations (production)
cd backend && npm run prisma:seed           # Seed test data
```

### Environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Key vars (backend — validated at boot by `src/config/validate-env.ts`, fails fast in prod):
- `DATABASE_URL` — PostgreSQL connection string (pooled in prod)  
- `DIRECT_URL` — direct (non-pooled) connection for migrations/DDL — **never route DDL through a pooler** (historical schema-drift root cause)  
- `JWT_SECRET` — ≥32-char random string (boot rejects shorter)  
- `FRONTEND_URL` / `CORS_ALLOWED_ORIGINS` — CORS allow-list (default `http://localhost:3000`)  
- `PUBLIC_ORG_SLUG` — pins the org served on public pages (required in prod)  
- `BOOTSTRAP_SECRET` — guards `POST /api/auth/bootstrap-admin`  
- `SENTRY_DSN` — optional backend error aggregation (SDK dormant when unset)

Frontend vars: `API_URL` (server-side rewrite target for `/api/*`, default `http://localhost:4000`), optional `NEXT_PUBLIC_SOCKET_URL` (socket origin override; defaults to same-origin), optional `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN`. There is **no** `NEXT_PUBLIC_API_URL` — client code calls same-origin `/api/...` paths.

---

## Tech Stack

### Frontend
| Concern | Library |
|---|---|
| Framework | Next.js 16 (React 19, App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 + CSS custom properties |
| UI primitives | Radix UI (Dialog, Select, Checkbox…) |
| Data fetching | TanStack React Query 5 |
| Real-time | socket.io-client 4 |
| Animations | Framer Motion 11 |
| Icons | Lucide React |
| i18n | next-intl 4 (English + Georgian) |
| Forms | Controlled React state (no form library) |

### Backend
| Concern | Library |
|---|---|
| Framework | NestJS 11 |
| Language | TypeScript 5 |
| ORM | Prisma 7 + PostgreSQL |
| Auth | JWT (jsonwebtoken) + bcryptjs, cookie-based |
| Validation | Zod 4 (ZodValidationPipe) |
| WebSockets | socket.io 4 |
| Logging | Pino 9 |
| Rate limiting | ThrottlerModule (120 req/min + 10 req/10s short) |
| Security | Helmet 8 |
| Testing | Jest 30 + supertest (e2e) |

---

## Backend Architecture

### NestJS Module Structure

Feature-per-folder. Every module has `*.module.ts`, `*.controller.ts`, `*.service.ts`, and often `*.schemas.ts` (Zod) and `*.types.ts`.

Key modules:
- **auth** — JWT login/refresh/logout, `/api/auth/me`, capabilities, guards, refresh-token cleanup cron
- **users** — Admin user management (create/update/DQ), role assignments (`/api/admin/users`)
- **athletes** — Athlete profiles, documentId uniqueness, bilingual names, merge
- **clubs** — Club management (name + nameKa) + public club details
- **geography** — Country → Region hierarchy (org-scoped; clubs/athletes/users link into it)
- **events** — Event lifecycle, registration windows, policies, stage automation cron
- **event-policies** — Policy option listings (weigh-in / bronze / rest / publish-timing)
- **registrations** — Athlete-to-event registration workflow (+ bulk status ops)
- **weighin** — Weight-in verification with status machine + preview/reconcile
- **draw** — Readiness validation + bracket drawing (single-elim / round-robin), category review sign-off
- **fights** — Live fight state machine, timers, round results, live boards; **socket.io gateway** (`fights.gateway.ts`)
- **schedule** — Mats, sessions, auto-scheduling, fight ordering, rest-violation checks
- **results** — Result compilation
- **exports** — JSON exports (`/tmp/wushu-exports`) + Puppeteer PDFs (results/schedule/weigh-in)
- **signature-templates** — Head-judge signature blocks embedded in protocol PDFs
- **content** — News posts (`/api/admin/news`)
- **forms** — Public contact form → `ContactSubmission` + admin inbox
- **integrity** — Data consistency check + lock
- **public** — Unauthenticated public endpoints (two controllers, CDN `Cache-Control` tiers)
- **category-templates** — Reusable rulesets

### Auth Pattern

Protected endpoints use `@UseGuards(AuthGuard, CapabilityGuard)` + the `@RequireCapability('CODE')` decorator (defined in `auth/capability.decorator.ts`). `AuthGuard` reads the JWT from the `gw_auth` httpOnly cookie (or `Authorization: Bearer`) and **re-validates the user against the DB on every request** (rejects archived/disabled/DQ-suspended users) — it does not blindly trust the JWT.  
Cookies: `gw_auth` (access, 15 min) + `gw_refresh` (refresh, 7 days), both httpOnly. Refresh tokens are DB-backed (SHA-256 hashed in `RefreshToken`) with **rotation + reuse/theft detection** (reusing a revoked token revokes all of that user's sessions).  
`POST /api/auth/bootstrap-admin` — creates first admin (timing-safe `BOOTSTRAP_SECRET` check; **refused in every non-development environment** when the secret is unset, not just production).  
Refresh token rotation: `POST /api/auth/refresh`. `GET /api/auth/me` is soft-auth (returns null fields instead of throwing) and skips both throttle buckets.  
**Sockets**: the socket.io handshake mirrors `AuthGuard` (cookie or Bearer) **and requires `LIVE_RUN`**; open sockets are re-validated against the DB every 60s. There is no anonymous socket — public pages poll the cached `/api/public/*` endpoints instead (mat board every 30s with `no-store`; live/schedule feeds every 20s via `refetchInterval`). Public components gate `useRealtimeQuerySync` on the `LIVE_RUN` capability (`useCanUseLiveSocket`), so anonymous viewers never attempt a socket handshake (the old C1 rejected-handshake retry loop is gone). CSRF posture: same-origin deployment + `SameSite=lax` httpOnly cookies + CORS allow-list — there is **no** token-based CSRF defense.  
Throttling: global default 120 req/min + short 10 req/10s; per-endpoint login 5/min, refresh 20/min, bootstrap 3/min (all tunable via `THROTTLE_*` env vars; public controllers skip the short bucket).

Capability codes (`auth/capabilities.ts`): `EVENTS_MANAGE`, `RULESETS_MANAGE`, `ATHLETES_MANAGE`, `WEIGHIN_RUN`, `DRAW_RUN`, `SCHEDULE_MANAGE`, `LIVE_RUN`, `RESULTS_MANAGE`, `EXPORTS_MANAGE`, `CONTENT_MANAGE` (defined but unused). Role→capability defaults: admin = all; coach = `ATHLETES_MANAGE`; judge/timekeeper = `LIVE_RUN`; athlete = none. Effective capabilities = role defaults ∪ any `UserCapability` DB rows (note: no admin API currently writes `UserCapability` rows).

### API Conventions

- Global prefix: `/api`
- Request body validated with Zod via `ZodValidationPipe`
- Errors returned as `{ message, code }` — `code` is a SCREAMING_SNAKE_CASE string (e.g. `DOCUMENT_ID_ALREADY_EXISTS`)
- Body size limit: 100 KB
- List endpoints are row-capped server-side (athletes 500, registrations 1000) with optional `limit`/`offset` query params
- State-changing requests carrying an `Origin` header must match the CORS allow-list (`OriginCheckMiddleware`, CSRF defense-in-depth)

---

## Frontend Architecture

### Routing

`/[locale]/` — every route is under a dynamic locale segment (`en` or `ka`).

Main route groups:
```
/[locale]/
  admin/                    Admin dashboard + sub-pages
    events/[eventId]/       Event-scoped sub-pages: (overview at index), registrations,
                            weigh-in, weighin-results, brackets, schedule, results, live
    athletes/  clubs/  users/  countries/        Registry management
    category-templates/  category-options/  rulesets/
    weighin/  weighin-results/  registrations/  brackets/  schedule/  live/  results/
    news/  content/  inbox/  integrity/  signatures/  settings/
  coach/                    Coach portal (own club only)
    athletes/               Coach's athletes
    events/                 Event listing + registration
    events/[eventSlug]/     registrations, brackets, schedule, live (read views)
    me/                     Coach profile
  athlete/                  Athlete portal (placeholder, under development)
  athletes/[athleteId]      Public athlete profile
  clubs/  clubs/[clubId]    Public club listing + profile
  countries/ + [countryId]  Public geography pages
  events/  events/[slug]/   Public event detail + brackets, schedule, live, results
  news/  rules/  contact/  about/   Public content
  mat/[eventSlug]/[matName] Public TV/scoreboard (polls /api/public/mat, no-store)
  display/[eventId]         Admin full-screen TV display (authed API + socket)
  login/  auth/refresh/  no-access/  dashboard/
```

### Data Flow

- **React Query** for all server state — mutations invalidate queries on success
- **apiGet / apiPost** (`src/lib/api/client.ts`) — fetch wrappers that auto-refresh on 401
- Real-time fight/schedule updates via `useRealtimeQuerySync` (socket.io → query invalidation)

### Component Layers

```
src/
  app/[locale]/        Route pages (thin — delegate to features/components)
  features/            Self-contained feature slices (admin-events, brackets, weighin, live…)
  components/          Shared components grouped by domain (admin/, athlete-profile/, club-profile/, event/, ui/)
  hooks/               Custom React hooks (useCurrentUser, usePagination, useAdminUsers…)
  lib/                 Pure utilities (api/, bilingual, realtime, weighin, pagination)
  types/               TypeScript interfaces (api.ts, clubs.ts, weighin.ts, live.ts)
  messages/            i18n JSON (en.json, ka.json)
```

### Import Alias

`@/` → `src/` (configured in `frontend/tsconfig.json`)

---

## Styling Conventions

- **Tailwind CSS 4** utility classes — no CSS modules
- **CSS custom properties** for all design tokens: `var(--color-primary)`, `var(--color-surface)`, `var(--color-border)`, `var(--radius-card)`, etc. — never hardcode colors
- **Dark mode** via `data-theme="dark"` on `<html>`
- Avoid inline `style={{}}` except for dynamic non-color values (widths, transforms)
- Hover animations are CSS-only (`transition`, `hover:` variants) — no JS-driven show/hide for simple UI states
- Consistent component heights: inputs/buttons use `h-10`

---

## i18n (Bilingual)

The app serves both English (`/en/`) and Georgian (`/ka/`) locales.

### Utility Functions (`src/lib/bilingual.ts`)

```typescript
// Returns Georgian name when locale is 'ka' and ka is non-null, else English
localizedName(en: string, ka: string | null | undefined, locale: string): string

// Returns Georgian full name when locale is 'ka' and both KA fields are non-null
localizedFullName(firstName, lastName, firstNameKa, lastNameKa, locale): string
```

**Always use these helpers** when rendering any athlete name, event name, or club name — never render raw `.name`, `.firstName`, `.lastName` in JSX output.

### Bilingual Fields on Entities

All name-bearing entities carry optional KA fields:

| Entity | Fields |
|---|---|
| Athlete | `firstName`/`lastName` + `firstNameKa`/`lastNameKa` |
| Event | `name` + `nameKa` |
| Club | `name` + `nameKa` (KA field shown in forms only when the club's `Country.code === 'GE'`) |
| Country / Region | `name` + `nameKa` |

### Schedule / Live Display Names

The schedule and live endpoints return pre-computed string fields `redDisplayName` / `blueDisplayName` (to handle "Winner of X" / "TBD" placeholders). Parallel `redDisplayNameKa` / `blueDisplayNameKa` fields carry the Georgian equivalent (or `null` when no KA name exists). Always use `localizedName(fight.redDisplayName, fight.redDisplayNameKa, locale)` — never render the raw EN field directly.

### Prisma Select Rule

Prisma only returns fields that are explicitly listed in a `select` block. When adding a new field to the schema, **update every `select` in every service that reads that model** or the field will silently be `undefined` at runtime. KA fields are already included in all read paths.

### Client vs Server Components

- **Client components** (`'use client'`): `const locale = useLocale()` from `next-intl`
- **Server components** (RSC): `const locale = await getLocale()` from `next-intl/server`

### Translation Keys

```typescript
const t = useTranslations('admin.users');   // Scoped namespace
t('fieldEmail')                              // → looks up admin.users.fieldEmail
```

Messages live in `frontend/src/messages/en.json` and `ka.json`.

---

## Domain Model

### Event Lifecycle

```
REG_OPEN → LOCKED → WEIGHIN → WEIGH_IN_COMPLETED → DRAWN → PUBLISHED → LIVE → COMPLETED
```

The lifecycle controls what actions are allowed. There is **no backend `EventPhaseGate` guard** — enforcement is via pure helper functions in `backend/src/events/lifecycle-rules.ts` (`isRegistrationMutableLifecycle`, `canManageSchedule`, `canRunLiveCompetition`, `isWeighInStage`, `isEventReadOnly`) plus per-service assertion methods (`assertScheduleMutable`, `assertLiveStage`, `assertEventAllowsRegistrationChanges`, …). The **draw** is *not* gated by a single lifecycle helper: `DrawService.executeDraw` enforces readiness via the `EVENT_NOT_LOCKED` / `WEIGHIN_NOT_COMPLETED_FOR_DRAW` critical codes and `isWeighInCompletedForDraw` (`draw/draw.readiness.helpers.ts`), which also permits overridden re-draws past `WEIGH_IN_COMPLETED`. Manual transitions go through `EventOpsService.transitionLifecycle()` (forward/backward along the ordered chain; skips/reverts need `allowOverride` + `reason`). An hourly cron (`EventStageAutomationService`, `0 5 * * * *`) plus opportunistic checks on event reads auto-advance stages when date/weigh-in conditions are met. (`EventPhaseGate` does exist as a **frontend** component at `frontend/src/components/admin/EventPhaseGate.tsx`.)

### Key Entities

| Entity | Description |
|---|---|
| **Organisation** | Tenant — all data is org-scoped |
| **User** | System user (admin, coach, judge, timekeeper). Coaches have `clubId` + optional `nationality` ("GE" or null) |
| **Country / Region** | Geography hierarchy (Country → Region → Club); `Country.code` is ISO alpha-2 — `"GE"` drives Georgian-only UI behaviour |
| **Club** | Sports club with bilingual name; belongs to a Region + Country |
| **Athlete** | Competitor — `documentId` required + unique per org, bilingual names, `sex`, optional club/region/country links |
| **Event** | Competition — has lifecycle, registration windows (`registrationOpensAt`/`ClosesAt`), policies, bilingual name, `weighInResultsPublic` toggle (public weights page) |
| **Registration** | Athlete entry — status: PENDING → SUBMITTED → APPROVED/REJECTED/WITHDRAWN. Carries **two** category FKs: `registeredEventWeightCategoryId` (initial pick) vs `eventWeightCategoryId` (final, after weigh-in move-ups) |
| **WeighInAttempt** | Weight verification attempt per registration |
| **Bracket** | Per-category draw containing Fight records. `format` (DIRECT_FINAL ≤2 athletes / ROUND_ROBIN =3 / SINGLE_ELIMINATION 4+) is persisted at draw time and drives results placement logic — round-robin medals come from standings (`competition.logic.ts`), never from a "final fight" |
| **Fight** | Head-to-head match with timer (`TimerState` 1:1), scoring, win method, winner propagation (`nextFightId`/`nextFightSlot`) |
| **Mat** | Physical ring where fights are assigned |
| **ScheduleSession** | Time-slot grouping of fights |
| **ProtocolSignatureTemplate** | Reusable head-judge signature block for results-protocol PDFs |

### User Roles

- **admin** — Full access
- **coach** — Manages own club's athletes + registrations
- **athlete** — (future) self-service

3 roles total. The `UserRole` enum also defines leftover `judge`/`timekeeper` values, but they are **unused** — the main judge/admin does scoring & timing from the admin pages. Don't model features around separate judge/timekeeper logins.

### Document IDs

Every athlete requires a `documentId` (unique per organisation):
- Georgian coach → 11-digit national ID (`/^\d{11}$/`) — validated client-side
- International coach → free-text passport number (any non-empty string)

The backend enforces uniqueness via `@@unique([organisationId, documentId])`. Duplicate submissions return error code `DOCUMENT_ID_ALREADY_EXISTS`. Existing athletes whose `documentId` was NULL were backfilled with `LEGACY_<id>` during migration.

### Coach Nationality

Coaches have an optional `nationality` field (`"GE"` for Georgian, `null` for international). This drives form behaviour on the **coach athlete page**:

| nationality | Document ID label | Validation | Athlete name fields |
|---|---|---|---|
| `"GE"` | "National ID" | exactly 11 digits | EN + KA required |
| `null` | "Passport Number" | any non-empty string | EN only |

The nationality toggle is set in `CreateUserModal` / `UserEditForm` (admin only) and returned from `/api/auth/me` so the coach portal can read it from the auth context.

---

## Common Patterns

### API Error Handling (Frontend)

```typescript
try {
  await apiPost(...)
} catch (e) {
  if (e instanceof ApiError) {
    if (e.code === 'SOME_CODE') { /* specific handling */ }
    if (e.status === 403) { toast('Forbidden', 'error'); }
  }
  toast(getCompactErrorMessage(e, tCommon('saveFailed')), 'error');
}
```

### React Query Mutation Pattern

```typescript
const mutation = useMutation({
  mutationFn: (payload) => apiPost('/api/...', payload),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['...'] });
    toast(tCommon('saveSuccess'));
  },
  onError: (e) => { /* ApiError handling */ },
});
```

### Backend Service Pattern

Services receive `organisationId` (from JWT) as the first argument for all tenant-scoped queries.

```typescript
async findAll(organisationId: string, filters: ...) {
  return this.prisma.athlete.findMany({ where: { organisationId, ...filters } });
}
```

---

## Workflow Rules

- **Never start the dev server** — the user runs it separately
- **Never run build or type-check** unless explicitly asked
- **Bundle related changes into a single commit** with a versioned tag when asked to commit
- When adding new i18n keys, add to **both** `en.json` and `ka.json`
- When adding new entity fields that display text: add `nameKa`/`firstNameKa`/`lastNameKa` variants, update **every** Prisma `select` that reads those models, and use `localizedName`/`localizedFullName` in all display components
- CSS color values go through CSS variables only — no raw hex/rgb in Tailwind classes
