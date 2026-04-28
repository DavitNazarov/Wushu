# Geo Wushu Competition System — CLAUDE.md

Tournament management system for the Georgian Wushu Federation. Handles athlete registration, weight-in verification, bracket drawing, fight scheduling, live scoring, and results for Wushu (Chinese martial arts) competitions.

---

## Monorepo Layout

```
/
├── frontend/          Next.js 16 app          (port 3000)
├── backend/           NestJS + Prisma API      (port 4000)
├── package.json       npm workspaces root
├── docker-compose.yml PostgreSQL container
└── server.js          Production entry point
```

---

## Dev Commands

All run from the repo root:

```bash
npm install          # Install everything (workspaces)
npm run dev          # Start backend + frontend + Prisma Studio concurrently
npm run dev:backend  # NestJS only
npm run dev:frontend # Next.js only
npm run build        # backend (prisma generate + nest build) then frontend
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

Key vars:
- `DATABASE_URL` — PostgreSQL connection string  
- `JWT_SECRET` — ≥32-char random string  
- `FRONTEND_URL` — CORS origin (default `http://localhost:3000`)  
- `NEXT_PUBLIC_API_URL` — Backend URL (default `http://localhost:4000`)

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
- **auth** — JWT login/refresh/logout, `/api/auth/me`, capabilities, guards
- **users** — Admin user management (create/update/DQ), role assignments
- **athletes** — Athlete profiles, documentId uniqueness, bilingual names
- **clubs** — Club management (name + nameKa)
- **events** — Event lifecycle, registration windows, policies
- **registrations** — Athlete-to-event registration workflow
- **weighin** — Weight-in verification with status machine
- **draw** — Bracket drawing algorithm
- **fights** — Fight creation, scoring, win method
- **schedule** — Session-based fight scheduling
- **results** — Result compilation
- **public** — Unauthenticated public endpoints
- **category-templates** — Reusable rulesets

### Auth Pattern

All endpoints require `@AuthGuard` (JWT from httpOnly cookie) + `@Capabilities(...)` decorator.  
`POST /api/auth/bootstrap-admin` — creates first admin (protected by `BOOTSTRAP_SECRET`).  
Refresh token rotation: `POST /api/auth/refresh`.

### API Conventions

- Global prefix: `/api`
- Request body validated with Zod via `ZodValidationPipe`
- Errors returned as `{ message, code }` — `code` is a snake_case string (e.g. `DOCUMENT_ID_ALREADY_EXISTS`)
- Body size limit: 100 KB

---

## Frontend Architecture

### Routing

`/[locale]/` — every route is under a dynamic locale segment (`en` or `ka`).

Main route groups:
```
/[locale]/
  admin/               Admin dashboard + sub-pages
    events/[eventId]/  Event-scoped sub-pages (overview, registrations, weighin, brackets, schedule, results, live)
    athletes/          Athlete management
    clubs/             Club management
    users/             User management
    category-templates/
    weighin/           Weight-in UI
    registrations/     Registration management
  coach/               Coach portal
    athletes/          Coach's athletes
    events/            Event listing + registration
  athletes/[athleteId] Public athlete profile
  clubs/[clubId]       Public club profile
  events/              Public event listing + detail
  mat/[slug]/[mat]     TV/scoreboard display
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
| Club | `name` + `nameKa` (shown in forms only when `country === 'GE'`) |

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

The lifecycle controls what actions are allowed. Guards enforce this server-side via `EventPhaseGate`.

### Key Entities

| Entity | Description |
|---|---|
| **Organisation** | Tenant — all data is org-scoped |
| **User** | System user (admin, coach, judge, timekeeper). Coaches have `clubId` + optional `nationality` ("GE" or null) |
| **Club** | Sports club with bilingual name (`name` EN + `nameKa` KA) |
| **Athlete** | Competitor — `documentId` required + unique per org, bilingual names (`firstName`/`firstNameKa`, `lastName`/`lastNameKa`) |
| **Event** | Competition — has lifecycle, registration windows, policies, bilingual name |
| **Registration** | Athlete entry — status: PENDING → SUBMITTED → APPROVED/REJECTED/WITHDRAWN |
| **WeighInAttempt** | Weight verification attempt per registration |
| **Bracket** | Per-category draw containing Fight records |
| **Fight** | Head-to-head match with timer, scoring, win method |
| **Mat** | Physical ring where fights are assigned |
| **ScheduleSession** | Time-slot grouping of fights |

### User Roles

- **admin** — Full access
- **coach** — Manages own club's athletes + registrations
- **judge / timekeeper** — Fight operations (scoring, timer)
- **athlete** — (future) self-service

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
