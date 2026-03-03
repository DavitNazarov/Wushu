# Geo Wushu Competition System
## MVP Task Plan + UI/Logic/Security Spec (Updated) — 03 Mar 2026

You said: *Cursor writes code; I take care of UI/logic/security requirements.*  
Phase 0 is done. Everything below is the updated plan starting **Phase 1**.

---

## Non‑negotiables (Cursor must follow)
- **Ship bias:** smallest version that runs a real tournament (no Excel, no “which fight now?”).
- **Manual override:** every automation has an admin override path.
- **Single source of truth:** fight status + timer state live in DB; UI derives display only.
- **Auditability:** weigh‑in decisions, draw, scheduling overrides, results are traceable.
- **i18n from day one:** English + Georgian, **no hardcoded strings**.
- **Dark mode by default:** consistent tokens; no random colours.

---

## Working assumptions (verify early)
- Web stack: React/Next (or similar) + Node backend + **Postgres recommended**.
- Primary scope: **Sanda fight ops** (Taolu = Phase 2+ if needed).
- Rules follow **Georgia Wushu / IWUF** defaults unless event overrides.
- Devices: admin laptop/tablet, judge tablets, public TV/monitor for Mat Screen.

> Verification tasks are included in **P1‑01**.

---

# Global UI Design Spec (applies to ALL UI tasks)
**Style:** minimalistic, business‑reliable, high contrast, fast to read in noisy venues.

## Colour tokens (Light + Dark)
- **Primary (Geo Navy):** `#123B6B`
- **Accent (sparingly, Wushu Red):** `#C81D25`
- **Success:** `#16A34A`
- **Warning:** `#D97706`
- **Danger:** `#DC2626`
- **Text light:** `#0F172A`
- **Text dark:** `#E5E7EB`
- **BG light:** `#F8FAFC`
- **BG dark:** `#0B1220`
- **Surface light:** `#FFFFFF`
- **Surface dark:** `#111827`
- **Border:** `#CBD5E1` (light) / `#334155` (dark)

## Typography + spacing
- Font: **Inter** or system UI (fallback SF Pro/Segoe/Roboto).
- Base: **14px** (tables 13px), dense admin text 12px max.
- Headings: **24 / 20 / 16px** (H1/H2/H3).
- Button + input height: **44px** (touch friendly).
- Radius: **10px** cards/inputs, **12px** modals, **999px** pills.
- Spacing scale: **4/8/12/16/24/32px**.

## Layout rules
- Max content width: **1100px** (admin), **960px** (public site).
- Admin: **left sidebar** (icons + labels), top bar with event selector + user menu.
- Most admin screens: **table + filters + detail drawer**.
- Primary action **top-right**; destructive actions red + confirm modal.
- Accessibility: keyboard nav + visible focus ring; colour not the only indicator.

## Core components (MVP)
- AppShell (Sidebar + Topbar)
- DataTable (sortable, filterable)
- StatusPill (Draft/Open/Locked/Live/Completed)
- Drawer (right side details)
- Modal (confirm + edit forms)
- Toast notifications
- Mat Screen (full-screen, huge typography, high contrast)

---

# 🔒 Locked Technology Stack (No Deviations)

Backend:
- Runtime: **Node.js**
- Language: **TypeScript (strict mode = true)**
- Framework: **NestJS**
- Database: **PostgreSQL**
- ORM: **Prisma**
- Validation: **Zod**
- Auth: **JWT in httpOnly cookies**
- Realtime: **WebSocket (Socket.IO)**
- Logging: **Pino (structured logging)**

Frontend:
- React / Next.js (App Router preferred)
- Shared types with backend via generated Prisma types or shared DTO package

---

# Engineering Rules (Mandatory)

- No 1000-line files.
- Business logic lives in services, NOT controllers.
- UI components are dumb; no business logic inside them.
- DB is single source of truth for:
  - fight state
  - timer state
  - event lifecycle
- All critical actions logged in audit_log.
- All endpoints protected by capability guards.
- i18n enforced (English + Georgian).
- Dark mode default.
- No hardcoded strings.

Folder Structure (backend):

src/
 ├── modules/
 │    ├── auth/
 │    ├── events/
 │    ├── rulesets/
 │    ├── users/
 │    └── audit/
 ├── common/
 │    ├── guards/
 │    ├── decorators/
 │    ├── interceptors/
 │    └── utils/
 └── prisma/

---

# Phase 1 Goal

By the end of Phase 1 we must have:

- Secure authentication
- Capability-based permissions
- Event lifecycle engine
- Versioned rulesets
- Audit logging system
- Admin AppShell with bilingual support

Nothing else.

---

# ☑ P1-01 Ruleset System (Versioned Templates)

Goal:
Collect official Georgia Wushu / IWUF defaults and encode as versioned templates.

UI:
Admin page "Rulesets"
- DataTable
- Primary button: "New Ruleset"
- Status pill (Draft / Active)
- Detail drawer editor
- Max width 1100px
- 14px base font
- Primary buttons Geo Navy (#123B6B)

Logic:
- Rulesets stored as versioned JSON structures
- When event created → snapshot copied to event_ruleset_snapshot
- Cannot modify snapshot after event creation

Security:
- Only CAN_MANAGE_RULESETS capability
- All changes write before/after diff into audit_log

---

# ☑ P1-02 Authentication + Capabilities

Goal:
Secure login + capability-based access (NO role explosion).

UI:
Login screen:
- Centered card (max 420px)
- Dark background (#0B1220)
- Inputs height 44px
- Primary button Geo Navy

After login:
- Admin AppShell
- Sidebar + top event selector

Logic:
Capability examples:
- CAN_MANAGE_EVENT
- CAN_WEIGHIN
- CAN_RUN_DRAW
- CAN_SCHEDULE
- CAN_RUN_LIVE
- CAN_VIEW_PUBLIC

Server enforces permissions via NestJS Guards.

Security:
- JWT stored httpOnly
- Rate limit login
- Log sign-in attempts
- CSRF protection

---

# ☑ P1-03 Database Schema v1 + Audit Log

Goal:
Create core schema.

Tables:
- organisations
- users
- capabilities
- events
- rulesets
- event_ruleset_snapshot
- audit_log

Event lifecycle enum:
REG_OPEN
WEIGHIN
LOCKED
DRAWN
PUBLISHED
LIVE
COMPLETED

Logic:
- Lifecycle transitions validated via service
- No direct DB state mutation

Security:
- Row-level access control via organisation_id
- audit_log append-only

---

# ☑ P1-04 Admin AppShell + i18n

Goal:
Stable admin layout + bilingual foundation.

UI:
Sidebar items:
Dashboard
Events
Rulesets
Users
Settings

Topbar:
- Event selector dropdown
- Status pill
- Language switcher (EN / KA)

Design rules:
- Max width 1100px
- Inter font
- Base 14px
- Spacing 8/16/24px
- Radius 10px
- Dark mode default

Logic:
- Central translation keys
- No hardcoded text allowed

Security:
- Prevent XSS via translation sanitisation
- Enforce translation key existence via lint rule

---

# ☑ P1-05 Event Creation + Lifecycle Engine

Goal:
Admin creates event and advances through stages with strict gates.

UI:
Events DataTable
Event detail page:
- Header with event name
- Status pill
- Primary button: "Advance Stage"
- Confirmation modal required

Logic:
Stage gates:
- Cannot move to DRAWN unless LOCKED
- Cannot move to LIVE unless PUBLISHED
- Override requires reason (stored)

Security:
- Only CAN_MANAGE_EVENT can advance
- All transitions logged (who, when, from, to, reason)

Implementation rule:
Lifecycle service is single authority. No controller-level mutation.

---

# Definition of Done (Phase 1)

- Auth fully functional with capability guards
- Rulesets versioned and snapshotting works
- Event lifecycle transitions enforced
- Audit log capturing all critical actions
- Admin AppShell bilingual and consistent
- Strict TypeScript enabled
- No direct DB writes outside services

If Phase 1 is not stable, Phase 2 must NOT start.
"""

---

# Phase 2 — Public informational site (Geo Wushu business)
**Outcome:** public site + basic content publishing to build credibility and drive participation.

### ☑ P2-01 Public site pages (MVP)
- **Goal:** Home, About (Geo Wushu + federation), Clubs/Coaches directory, Events calendar, News, Rules/Documents, Contact.
- **UI:** max width 960px; H1 32px, body 16px; generous whitespace; sticky top nav; primary links Geo Navy; accent red only for highlights.
- **Logic:** events + clubs read-only from DB; news can start as Markdown entries.
- **Security:** public fetches **published only**; admin endpoints protected.
- **Cursor notes:** split routes: `/` public + `/admin` system; shared design tokens.

### ☑ P2-02 Content model + simple publishing workflow
- **Goal:** publish/update News posts, Documents (PDF links), federation contacts, club profiles.
- **UI:** Admin “Content” DataTable + editor drawer; markdown textarea + preview tab; publish toggle.
- **Logic:** `published_at`, drafts hidden, unique slug.
- **Security:** admin-only publish; sanitize markdown; restrict uploads to PDF; audit edits.
- **Cursor notes:** minimal now; version history later.

### ☑ P2-03 Contact + membership interest forms
- **Goal:** capture leads (messages + club membership interest).
- **UI:** single-column forms (max 600px), 44px inputs, clear labels, strong success state.
- **Logic:** store submissions with status (new/handled).
- **Security:** honeypot + rate limit (+ optional CAPTCHA). Restrict PII access.
- **Cursor notes:** admin inbox view with status pill and “mark handled”.

---

# Phase 3 — Registration + athlete management + weigh‑in
**Outcome:** clubs register, admins weigh-in fast, mistakes are hard to make.

### ☐ P3-01 Clubs + athlete directory (dedupe)
- **Goal:** create athletes, link to clubs, avoid duplicates/name collisions.
- **UI:** Athletes DataTable + search (name/DOB/doc id) + filters; detail drawer tabs (Profile/History).
- **Logic:** dedupe warnings (DOB + doc id); admin merge tool.
- **Security:** protect PII; audit merges.
- **Cursor notes:** merge preview + irreversible confirm.

### ☐ P3-02 Registration flow (club portal)
- **Goal:** clubs submit athletes during `REG_OPEN`; admin can add manually.
- **UI:** stepper (Athletes → Categories → Review), big “Add athlete”, inline validation.
- **Logic:** auto-assign category from ruleset; category change requests need admin approval.
- **Security:** clubs can only edit their athletes; rate limit.
- **Cursor notes:** club dashboard + event registration screen.

### ☐ P3-03 Weigh‑in station workflow
- **Goal:** station mode: search athlete, record weight, pass/reweigh/fail.
- **UI:** full-screen station mode; search top; big results; athlete card with name/category/target weight; buttons **PASS green / REWEIGH amber / FAIL red**.
- **Logic:** track attempts + timestamps; overweight rule supports reweigh window (configurable); override requires reason.
- **Security:** station accounts limited; log operator id, scale id, time, old/new weight.
- **Cursor notes:** station route; offline queue optional later.

### ☐ P3-04 Registration lock + integrity checks
- **Goal:** pre-lock checks: missing DOB, duplicates, missing docs, no category, unpaid fees (if used).
- **UI:** checklist screen with issue counts → opens filtered tables; block “Lock” until fixed or override reason.
- **Logic:** validators server-side; issue codes.
- **Security:** override lock admin-only; audit lock + reasons.
- **Cursor notes:** implement validator framework (machine-readable).

---

# Phase 4 — Draw + brackets (who meets who)
**Outcome:** one click brackets, printable, with controlled overrides.

### ☐ P4-01 Draw execution (seed + random)
- **Goal:** generate brackets; byes; optional same-club separation.
- **UI:** Brackets page with “Run draw” primary button; after draw: bracket view + PDF download; warnings panel.
- **Logic:** deterministic seed option; store seed + input snapshot.
- **Security:** admin-only; reset requires explicit permission + reason; audit.
- **Cursor notes:** draw service with tests (1 athlete, odd, byes, same-club).

### ☐ P4-02 Bracket viewer (admin + public + print)
- **Goal:** clear brackets for venue + web; public read-only.
- **UI:** bracket cards with names/club/status; print A4 minimal colour (navy headers).
- **Logic:** bracket progression links stored; bracket separate from schedule.
- **Security:** public shows only name/club (no sensitive PII). Publish gate.
- **Cursor notes:** include version stamp on print.

### ☐ P4-03 Edge cases: no-show, moved category, DQ
- **Goal:** controlled incident workflows with audit trail.
- **UI:** incident modal (No-show/Move/DQ) with consequence preview; reason required.
- **Logic:** update bracket + schedule; mark fights “needs review”.
- **Security:** head admin/jury only for DQ/move; audit + optional attachments.
- **Cursor notes:** incident engine produces patch + reversible log when possible.

---

# Phase 5 — Scheduling + mats (when they fight)
**Outcome:** schedule with rest constraints + Mat Screen kills “which fight now?”

### ☐ P5-01 Mat setup + schedule builder
- **Goal:** mats + sessions + schedule blocks; assign fights to mats/times.
- **UI:** grid (cols=mats, rows=time) drag/drop fight cards; inline conflict warnings.
- **Logic:** rest constraint default (same athlete cannot fight within X minutes/X fights).
- **Security:** scheduler permission; manual moves require reason stored.
- **Cursor notes:** validate endpoint returns conflicts.

### ☐ P5-02 Auto-schedule with rest constraints (MVP)
- **Goal:** one-click auto assignment + manual tune.
- **UI:** modal: start time, avg duration, rest minutes; shows estimated end time.
- **Logic:** greedy heuristic ok; deterministic seed option; schedule versioning.
- **Security:** log seed + settings; rollback supported; audit versions.
- **Cursor notes:** schedule_versions table + diff.

### ☐ P5-03 Mat Screen (public “which fight now?” killer)
- **Goal:** full-screen view per mat: NOW/NEXT/ON DECK + timers.
- **UI:** dark background; NOW title 48px, names 40px, next 28px; navy accents; red only for urgent. QR/link for mobile.
- **Logic:** realtime updates from DB; resilient to refresh/reconnect.
- **Security:** public read-only; no admin actions; rate limit.
- **Cursor notes:** `/mat/:id` with websocket/SSE + reconnection logic.

---

# Phase 6 — Competition live (fight ops)
**Outcome:** judges/timekeepers run fights without confusion.

### ☐ P6-01 Fight state machine + timer (DB truth)
- **Goal:** fight states `QUEUED -> ON_DECK -> IN_PROGRESS -> PAUSED -> COMPLETE -> CONFIRMED`.
- **UI:** Live console: big controls; timer 72px; show bout/names/mat.
- **Logic:** timer stored in DB (start_ts, paused_ms, state); UI computes display only.
- **Security:** only timekeeper/head judge controls timer; log every transition; prevent double-control.
- **Cursor notes:** transaction-safe transitions; multi-device conflict handling.

### ☐ P6-02 Result entry (MVP)
- **Goal:** record winner + method (points/KO/DQ/WO), round, notes.
- **UI:** result modal with radio buttons; required fields; “Confirm result”. Lock edits unless override.
- **Logic:** progress bracket + update schedule statuses.
- **Security:** confirm requires capability; edits require override + reason; amendment log.
- **Cursor notes:** immutable result record + amendments.

### ☐ P6-03 Judge console (minimal)
- **Goal:** simple scoring/decision depending on verified ruleset.
- **UI:** tablet-friendly; big buttons 64px; high contrast.
- **Logic:** server aggregates judge inputs; tie-break configurable.
- **Security:** judge auth per mat; prevent spoofing; rate limit; log.
- **Cursor notes:** gate behind P1‑01; start with decision vote if uncertain.

---

# Phase 7 — Results, publishing, exports
**Outcome:** instant results online + print/export for federation records.

### ☐ P7-01 Results tables + medals
- **Goal:** placements per bracket + medal tables per club/athlete.
- **UI:** Results page filters; medal cards + DataTable; print button.
- **Logic:** pure computation; handle bronze rules per format.
- **Security:** public read-only; regen action audit-logged.
- **Cursor notes:** build as pure function + tests.

### ☐ P7-02 Exports (PDF/CSV)
- **Goal:** export registrations, brackets, schedule, results.
- **UI:** export drawer with checkboxes + Generate; show last generated + download links.
- **Logic:** server-side generation with version stamps.
- **Security:** access controlled; PDFs must not leak hidden PII.
- **Cursor notes:** sync ok if fast; otherwise basic job runner.

### ☐ P7-03 Public event hub page
- **Goal:** one link per event: schedule + brackets + live + results.
- **UI:** event landing with tabs; minimal mobile friendly.
- **Logic:** published-only data.
- **Security:** protect endpoints; cache.
- **Cursor notes:** `/events/:slug` tied to publish stage.

---

# Phase 8 — Hardening + release
**Outcome:** stable for real tournament: backups, permission tests, venue resilience.

### ☐ P8-01 Permission test suite + security review
- **Goal:** automated tests prove access control is correct.
- **UI:** none (optional badge in Settings).
- **Logic:** integration tests across capability gates.
- **Security:** CSP + headers, validation, upload restrictions, dependency scanning.
- **Cursor notes:** CI checks + small threat-model doc.

### ☐ P8-02 Backups + restore drill
- **Goal:** daily backups + documented restore; simulate restore before first event.
- **UI:** Settings → Backups shows last backup timestamp.
- **Logic:** retention policy.
- **Security:** encrypt backups; limit access.
- **Cursor notes:** runbook + log restore drills.

### ☐ P8-03 Operational modes (venue resilience)
- **Goal:** handle bad Wi‑Fi; Mat Screen never goes blank.
- **UI:** “Reconnecting…” overlay + last update time.
- **Logic:** reconnect backoff; snapshot endpoint.
- **Security:** avoid leaking private data via caches.
- **Cursor notes:** heartbeat + load test (e.g., 200 viewers).

---

## Definition of Done (MVP)
- Club registers athletes; admins run weigh‑in; lock with integrity checks.
- Draw runs; brackets publish; schedule built with rest constraints + Mat Screens.
- Fights run with timer + results; results publish instantly.
- Public site has federation info + event hub + news + contact.
- Server-side permissions + audit log; bilingual UI; dark mode default.
