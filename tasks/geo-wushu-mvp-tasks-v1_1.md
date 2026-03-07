# Geo Wushu Competition System — Tournament MVP (Backend → Frontend)
## Cursor Master Build Prompt (Source of Truth)

You (Cursor) write code. I (human) will review.  
Non-negotiables: ship bias, manual override everywhere, DB is truth for fight/timer, audit for critical actions, i18n EN+KA (no hardcoded strings), dark mode default, strict TS.

Tech (locked):
- Backend: NestJS + TS strict + Postgres + Prisma + Zod + JWT httpOnly cookies + Socket.IO + Pino
- Frontend: Next.js (App Router) + TS + Tailwind + i18n (EN/KA)

Engineering rules:
- No 1000-line files. Split controllers/services/dtos/schemas.
- UI components dumb; business logic in services.
- Every query scoped by organisationId (multi-tenant).
- Critical writes append audit_log with before/after + reason when override.

---

# 0) Canonical API List (MVP)
Keep already-made endpoints, and ADD only what’s needed for real tournament ops.

## Auth (/api/auth)
- GET  /api/auth/me
- POST /api/auth/login               { email, password } -> sets gw_auth cookie
- POST /api/auth/signup              (cap: ATHLETES_MANAGE) { email, password, displayName, role: 'coach'|'athlete'|'judge'|'timekeeper' }
- POST /api/auth/bootstrap-admin      one-time bootstrap

## Events (/api/events) (cap: EVENTS_MANAGE)
- GET  /api/events
- POST /api/events                   { name, slug, location, timezone?, dates:{ registrationStartDate, registrationEndDate, weighInStartDate?, weighInEndDate?, competitionStartDate, competitionEndDate } }
- GET  /api/events/:id
- POST /api/events/:id/lifecycle     { to, override?: boolean, reason?: string }

## Rulesets (/api/rulesets) (cap: RULESETS_MANAGE)
- GET  /api/rulesets
- POST /api/rulesets                 { name, definition }  // versioned
- POST /api/rulesets/:id/activate    // set active for org (audit)

## Clubs (/api/clubs) (cap: ATHLETES_MANAGE)
- GET  /api/clubs
- POST /api/clubs                    { id?, name, city?, country? }

## Athletes (/api/athletes) (cap: ATHLETES_MANAGE)
- GET  /api/athletes                 filters: search, clubId, dateOfBirth, documentId
- POST /api/athletes                 { id?, clubId?, firstName, lastName, dateOfBirth, documentId?, sex? }
- POST /api/athletes/merge           { primaryId, secondaryId, reason }

## Registration (/api/registrations) (cap: ATHLETES_MANAGE; coaches limited to their club)
- GET  /api/registrations?eventId=&clubId=&status=
- POST /api/registrations            { eventId, athleteId, categoryCode, notes? }  // upsert by (eventId, athleteId)
- POST /api/registrations/:id/status { status:'SUBMITTED'|'APPROVED'|'REJECTED'|'WITHDRAWN', override?, reason? }

## Weigh-in (/api/weighin) (cap: WEIGHIN_RUN)
- GET  /api/weighin?eventId=&q=      // station search (name/docId)
- POST /api/weighin                  { registrationId, weightKg, decision:'PASS'|'REWEIGH'|'FAIL', override?, reason? }

## Event Integrity (/api/integrity) (cap: EVENTS_MANAGE)
- GET  /api/integrity?eventId=       // returns machine-readable issues before LOCK
- POST /api/integrity/lock           { eventId, override?, reason? }  // sets lifecycle LOCKED if pass/override

## Draw + Brackets (/api/draw, /api/brackets) (cap: DRAW_RUN)
- POST /api/draw                     { eventId, seed?: number, sameClubSeparation?: boolean, override?, reason? }
- POST /api/draw/reset               { eventId, override:true, reason } // destructive
- GET  /api/brackets?eventId=
- GET  /api/brackets/:id

## Mats + Schedule (/api/mats, /api/schedule) (cap: SCHEDULE_MANAGE)
- GET  /api/mats?eventId=
- POST /api/mats                     { eventId, id?, name, order }
- GET  /api/schedule?eventId=&matId=
- POST /api/schedule/auto            { eventId, startTimeIso, avgBoutSeconds, bufferSeconds, restMinutes, seed?: number, override?, reason? }
- POST /api/schedule/move            { fightId, toMatId, toOrder, override?, reason? }

## Live Fight Ops (/api/fights) (cap: LIVE_RUN)
- GET  /api/fights?eventId=&matId=&status=
- GET  /api/fights/:id
- POST /api/fights/:id/state         { to:'ON_DECK'|'IN_PROGRESS'|'PAUSED'|'COMPLETE'|'CONFIRMED', override?, reason? }
- POST /api/fights/:id/timer         { action:'START'|'PAUSE'|'RESUME'|'RESET', round?: number }
- POST /api/fights/:id/result        { winner:'RED'|'BLUE', method:'POINTS'|'KO'|'DQ'|'WO', notes?, override?, reason? }

## Results + Exports (/api/results, /api/exports) (cap: RESULTS_MANAGE / EXPORTS_MANAGE)
- GET  /api/results?eventId=
- POST /api/exports                  { eventId, types:['registrations','brackets','schedule','results'] } -> returns links

## Content: News (/api/admin/news) (cap: CONTENT_MANAGE)
- GET  /api/admin/news
- POST /api/admin/news               { id?, title, slug, body, published }

## Public (/api/public)
- GET  /api/public/events
- GET  /api/public/events/:slug
- GET  /api/public/news
- GET  /api/public/news/:slug
- GET  /api/public/clubs
- GET  /api/public/brackets?eventSlug=
- GET  /api/public/schedule?eventSlug=
- GET  /api/public/mat?eventSlug=&mat=   // NOW/NEXT/ONDECK read-only

## Forms (/api/forms)
- POST /api/forms/contact            { name, email, message, clubName?, type:'contact'|'membership', website? }

## Realtime (Socket.IO)
Namespaces/rooms:
- room: event:{eventId}
- room: mat:{matId}
Emit on: fight state change, timer change, schedule updates.

---

# 1) Backend Build Order (Do exactly in this sequence)

## 1.1 Project foundation
- Create Nest app with modules folder structure.
- Add Pino logger (request id, actor id, org id when present).
- Add Zod validation pipe.
- Add Throttler for /login + /forms/contact.
- JWT cookie auth: gw_auth httpOnly, SameSite=Lax, Secure in prod.

## 1.2 Prisma schema v1 (multi-tenant)
Models (minimum fields + indexes):
- Organisation(id, name, createdAt)
- User(id, organisationId, email unique per org, passwordHash, displayName, role enum, clubId?, createdAt)
- Capability(code PK, description)
- UserCapability(userId, capabilityCode) composite PK
- AuditLog(id, organisationId, actorUserId?, action, entityType, entityId, beforeJson, afterJson, reason?, override:boolean, createdAt, ip?, userAgent?)
- Club(id, organisationId, name, city?, country?, createdAt)
- Athlete(id, organisationId, clubId?, firstName, lastName, dateOfBirth, documentId?, sex?, createdAt)
- AthleteMerge(id, organisationId, primaryAthleteId, secondaryAthleteId, reason, mergedByUserId, createdAt)
- Ruleset(id, organisationId, name, version:int, status:'DRAFT'|'ACTIVE', definitionJson, createdAt)
- Event(id, organisationId, name, slug, location, timezone default 'Asia/Tbilisi',
  registrationStartDate, registrationEndDate, weighInStartDate?, weighInEndDate?,
  competitionStartDate, competitionEndDate,
  lifecycle enum: REG_OPEN|WEIGHIN|LOCKED|DRAWN|PUBLISHED|LIVE|COMPLETED,
  published boolean default false,
  createdAt)
- EventRulesetSnapshot(id, eventId unique, rulesetId, snapshotJson, createdAt)
- Registration(id, organisationId, eventId, athleteId, clubId?, categoryCode, status enum, notes?, createdAt, updatedAt, UNIQUE(eventId, athleteId))
- WeighInAttempt(id, organisationId, eventId, registrationId, attemptNo, weightKg, decision, operatorUserId, override:boolean, reason?, createdAt)
- Mat(id, organisationId, eventId, name, order)
- Bracket(id, organisationId, eventId, categoryCode, seed?, createdAt)
- Fight(id, organisationId, eventId, bracketId?, categoryCode, round:int, boutNo:int,
  redAthleteId?, blueAthleteId?, status enum,
  matId?, orderInMat?, scheduledStartTime?,
  winnerAthleteId?, winMethod?, notes?,
  confirmedByUserId?, confirmedAt?,
  createdAt)
- TimerState(fightId PK, organisationId, state enum, round:int, startedAt?, pausedAt?, pausedMs:int default 0, updatedAt, updatedByUserId)

- NewsPost(id, organisationId, title, slug unique per org, body, published boolean, publishedAt?, updatedAt)
- FormSubmission(id, type, name, email, message, clubName?, status:'NEW'|'HANDLED', createdAt)

Migrations + seed:
- Seed capabilities + one organisation + bootstrap admin.

## 1.3 Auth module
- bootstrap-admin: creates org + admin if none exists.
- login: verify password, issue JWT with userId + organisationId + role + caps.
- me: returns safe user info.
- signup: only with ATHLETES_MANAGE; creates user.
- Guards:
  - AuthGuard (cookie JWT)
  - CapsGuard (@RequireCaps('EVENTS_MANAGE'))
  - OrgScope helper ensures Prisma queries include organisationId.
- Audit log: login attempts (success/fail) minimal (no passwords).

## 1.4 Audit module (append-only)
- Service to write audit entries for:
  - lifecycle transitions
  - ruleset activate
  - athlete merge
  - draw/reset
  - schedule auto/move
  - fight state/timer/result
  - content publish
Store before/after JSON. If override, require reason.

## 1.5 Events module (business-correct dates)
POST /api/events uses body: { name, slug, location, timezone?, dates:{registrationStartDate,registrationEndDate,weighInStartDate?,weighInEndDate?,competitionStartDate,competitionEndDate}}
Validation gates:
- slug kebab-case
- registrationStartDate <= registrationEndDate <= competitionStartDate
- weighIn optional: weighInStart <= weighInEnd <= competitionStartDate
- competitionStartDate <= competitionEndDate
On create:
- attach ACTIVE ruleset snapshot into EventRulesetSnapshot (copy definition + version + timestamp).
- lifecycle default REG_OPEN
Audit: EVENT_CREATE.

Lifecycle endpoint:
- enforce allowed transitions:
  REG_OPEN -> WEIGHIN -> LOCKED -> DRAWN -> PUBLISHED -> LIVE -> COMPLETED
- gate by dates:
  - cannot WEIGHIN before registrationEndDate unless override
  - cannot LIVE before competitionStartDate unless override
- override requires reason, audit always.

## 1.6 Rulesets module (versioned + snapshot)
- Create ruleset as DRAFT with version auto-increment per org.
- Activate endpoint: sets one ACTIVE, others to DRAFT (audit).
- Event create always snapshots ACTIVE ruleset into EventRulesetSnapshot.

## 1.7 Clubs + Athletes modules
- Upsert endpoints (id?).
- Athlete merge:
  - move registrations/weigh-ins/fights references from secondary -> primary
  - mark secondary as merged (or delete, but keep merge record)
  - audit with reason (required)

## 1.8 Registration module (minimum to run tournament)
Rules:
- Coaches can only create registrations for athletes in their club (enforce).
- Status transitions controlled; APPROVED only before LOCKED unless override.
- Duplicate prevention via UNIQUE(eventId, athleteId).

## 1.9 Weigh-in module (station workflow)
Rules:
- Only allowed during WEIGHIN lifecycle unless override.
- attemptNo auto increments per registration.
- decision PASS/REWEIGH/FAIL stored; allow override with reason.
Audit: WEIGHIN_DECISION with before/after.

## 1.10 Integrity module (pre-lock checks)
GET issues for eventId returns list like:
[{ code:'MISSING_DOB', count, sampleIds:[...] }, ...]
Checks:
- registration missing category
- athlete missing DOB
- duplicates by (firstName,lastName,dateOfBirth) within event
- FAIL weigh-in present but status not handled
POST lock:
- if issues exist -> block unless override+reason
- sets lifecycle LOCKED and audit.

## 1.11 Draw + Brackets (small but real)
POST /api/draw:
- only allowed when LOCKED unless override
- groups registrations by categoryCode
- generate single-elim bracket with byes
- optional sameClubSeparation best-effort (don’t over-engineer)
- create Bracket + Fight rows (QUEUED) with red/blue assignments
- store seed used
- set lifecycle DRAWN
Audit: DRAW_EXECUTED (store seed + counts)

Reset:
- destructive: deletes brackets/fights/schedule/timer for event (transaction)
- requires override=true + reason
Audit: DRAW_RESET

## 1.12 Mats + Schedule
- Mats CRUD minimal: name + order
Auto schedule:
- assign fights to mats in order, respecting restMinutes (simple greedy)
- store matId + orderInMat + scheduledStartTime (optional if provided)
- create schedule “version” via audit meta (MVP: store settings in audit)
Move fight:
- update fight mat/order (transaction), reason if override
- emit websocket updates

## 1.13 Live fight ops + Timer (DB truth)
Fight state machine enforced in service.
TimerState:
- actions START/PAUSE/RESUME/RESET update DB only; UI derives remaining.
- conflict safety: use updatedAt optimistic check; reject stale updates.
- emit websocket updates to mat rooms.
Result:
- winner + method + notes
- CONFIRMED locks unless override+reason
- audit amendments.

## 1.14 Public endpoints
- Only published events/news.
- Public event by slug returns: competition dates, location, lifecycle, published.
- Public schedule/brackets/mat feed read-only (no PII beyond name + club).

## 1.15 Tests (minimum)
- Guards + org scoping tests
- lifecycle transition tests
- draw edge cases: 1 athlete, odd count, byes
- timer concurrency test

Deliverable backend DoD:
- All endpoints above implemented + validated + audited.
- Websocket emits for mat screen + live ops.
- Prisma migrations + seed script work.

---

# 2) Frontend Build Order (After backend DoD)

## 2.1 Global UI system
Design tokens (Tailwind config):
Primary Navy #123B6B, Accent Red #C81D25, BG dark #0B1220, Surface dark #111827, Text dark #E5E7EB, Border dark #334155.
Dark mode default.
Typography: Inter, base 14px; H1 24, H2 20, H3 16.
Inputs/buttons height 44px, radius 10px, modals radius 12px.
Max widths: admin 1100px, public 960px.

AppShell (admin):
- Left sidebar width 240px (collapsed 72px optional later)
- Topbar height 56px
- Content area max 1100px centered with 24px padding
- Sidebar items (icons + labels):
  - Dashboard
  - Events
  - Registrations
  - Weigh-in
  - Draw & Brackets
  - Schedule
  - Live
  - Results
  - Clubs
  - Athletes
  - Rulesets
  - News
  - Inbox
  - Settings
Topbar:
- Event selector dropdown (left)
- Lifecycle StatusPill next to it
- Language switch (EN/KA) right
- User menu (logout)

Core components:
- DataTable (sticky header, sortable columns, row hover)
- FilterBar (search left, filters middle, primary action right)
- Drawer (right side 420px)
- ConfirmModal (danger requires typing “CONFIRM” for destructive)
- StatusPill colours:
  - Draft/Reg Open: navy outline
  - Weigh-in: amber
  - Locked: slate
  - Drawn: purple (optional) else navy
  - Published: green outline
  - Live: red outline (sparingly)
  - Completed: green solid
- Toasts (top-right)

i18n:
- Use keys only. Provide en.json + ka.json.
- Microcopy style: short, “luxury” (clean, confident, no shouting).

## 2.2 Pages (admin) — pixel-level specs

### /admin/login
- Fullscreen background: #0B1220
- Center card: 420px width, padding 24px, radius 12px, bg #111827, border #334155
- Title 20px: t('auth.signIn')
- Inputs 44px height
- Primary button full width: bg #123B6B, text white
- Error text 13px, red #DC2626

### /admin/events
Layout:
- Header row: left H1 24px “Events”, right primary button “New event”
- FilterBar: search by name/slug, filter by lifecycle, published toggle
DataTable columns:
- Name, Slug, Competition dates, Registration window, Lifecycle, Published
Row click -> Event detail page

New Event modal (max 560px):
Fields:
- Name
- Slug (auto from name, editable)
- Location (single string)
- Timezone (default Asia/Tbilisi)
- Registration start/end (datetime)
- Weigh-in start/end (optional)
- Competition start/end (datetime)
Validation inline (red helper text)
Primary: “Create event”

### /admin/events/[id]
- Top: H1 (event name) + StatusPill
- Subline: location + competition dates (small 13px, text #94A3B8)
- Right: primary button “Advance stage”
- Secondary: “Publish” toggle (only if DRAWN and ready)
Advance modal:
- Shows current -> next
- If override: requires reason textarea (min 10 chars)
- Confirm button label changes: “Advance” / “Advance with override”

Tabs (minimal):
- Overview (dates)
- Audit (read-only list of last 50 actions for event)

### /admin/rulesets
Table columns: Name, Version, Status, Updated
Drawer editor:
- JSON textarea + basic validation
- Activate button (only one active)
- Audit on activate

### /admin/clubs
Table: Name, City, Country
Drawer: edit fields
Primary: “New club”

### /admin/athletes
Filters: search, club, DOB, documentId
Table: Name, Club, DOB, Document ID
Drawer: profile + registrations history
Merge tool:
- Two athlete selectors
- Preview: what will move
- Confirm requires reason + typing “MERGE”

### /admin/registrations?eventId=
Table: Athlete, Club, Category, Status, Notes
Actions per row: Approve / Reject / Withdraw
Bulk actions: Approve selected (confirm)
Coach view: only their club; admin sees all

### /admin/weighin?eventId=
Full-screen “station mode” option:
- Top fixed search bar (height 56px)
- Results list big cards
Selected athlete panel:
- Name 24px
- Category + target (if known) 16px
- Input weight (numeric) 56px height
Buttons row (big 56px):
- PASS (green #16A34A)
- REWEIGH (amber #D97706)
- FAIL (red #DC2626)
Override: small link “Override” opens reason textarea
Show attempt history list under (12–13px)

### /admin/integrity?eventId=
Checklist cards:
- Each issue card shows count + “View” button
- Lock button top-right disabled until zero issues OR override reason
Lock modal: lists issues summary, requires reason if override

### /admin/draw?eventId=
Panel:
- Seed (optional)
- Toggle same-club separation
- Primary: “Run draw”
After draw:
- Brackets list per category + “View”
Reset draw: danger button bottom, requires typing CONFIRM + reason

### /admin/brackets?eventId=
Bracket viewer:
- Simple rounds columns
- Fight cards show Red vs Blue (names 14–16px)
- Status dot + bout number
Print button (A4 minimal)

### /admin/schedule?eventId=
Mats sidebar left (200px)
Main grid list (MVP):
- Per mat column with ordered fight cards
Auto schedule modal:
- Start time
- Avg bout seconds
- Buffer
- Rest minutes
- Seed
Move fight: drag/drop optional later; MVP uses “Move” modal (to mat + position) with reason when override

### /admin/live?eventId=&matId=
Live console:
- Very large timer 72px
- Now fight card: names 32–40px
Controls:
- Start/Pause/Resume/Reset
- State: On deck / In progress / Complete / Confirmed
Result button opens modal:
- Winner (Red/Blue)
- Method (Points/KO/DQ/WO)
- Notes optional
Confirm locks unless override reason

### /admin/results?eventId=
Tabs:
- Placements
- Medal table
Export drawer: checkboxes + Generate

### /admin/news
Table: Title, Slug, Published
Drawer editor: markdown textarea + preview tab
Publish toggle

### /admin/inbox (forms)
Table: Type, Name, Email, Created, Status
Drawer: message + “Mark handled”

## 2.3 Public site (minimal, credible)
Routes:
- / (hero + upcoming events + news)
- /events, /events/[slug]
- /clubs
- /news, /news/[slug]
- /contact
Public design:
- max width 960px
- H1 32px, body 16px
- Navy links, red only for highlights
Public event page includes:
- registration dates, competition dates, location
- brackets/schedule tabs if published

## 2.4 Mat Screen (public “which fight now?” killer)
Route: /mat/[eventSlug]/[matName]
UI:
- Fullscreen dark bg #0B1220
- NOW label 48px, names 40px, NEXT 28px
- High contrast, minimal chrome
Realtime:
- Socket room mat:{matId}
Fallback:
- if disconnected show overlay “Reconnecting…” + last update time

Deliverable frontend DoD:
- Admin can run full flow: create event -> registrations -> weigh-in -> integrity lock -> draw -> schedule -> live -> results -> publish.
- Public can view published event + mat screen.

---

# 3) i18n Keys (minimum)
Create en.json + ka.json with these keys (KA can be simple; keep keys identical):

auth.signIn
auth.email
auth.password
auth.login

nav.dashboard
nav.events
nav.registrations
nav.weighin
nav.draw
nav.brackets
nav.schedule
nav.live
nav.results
nav.clubs
nav.athletes
nav.rulesets
nav.news
nav.inbox
nav.settings

common.search
common.new
common.create
common.save
common.cancel
common.close
common.reasonRequired
common.override
common.confirm
common.publish
common.unpublish

event.newEvent
event.location
event.timezone
event.registrationWindow
event.weighinWindow
event.competitionWindow
event.advanceStage
event.lockRegistration

status.regOpen
status.weighin
status.locked
status.drawn
status.published
status.live
status.completed

weighin.pass
weighin.reweigh
weighin.fail

---

# 4) Professional Mock Event (must work with POST /api/events)
{
  "name": "Geo Wushu Open 2026",
  "slug": "geo-wushu-open-2026",
  "location": "Olympic Palace, Tbilisi, Georgia",
  "timezone": "Asia/Tbilisi",
  "dates": {
    "registrationStartDate": "2026-03-15T09:00:00+04:00",
    "registrationEndDate":   "2026-05-05T23:59:00+04:00",
    "weighInStartDate":      "2026-05-09T18:00:00+04:00",
    "weighInEndDate":        "2026-05-09T20:00:00+04:00",
    "competitionStartDate":  "2026-05-10T10:00:00+04:00",
    "competitionEndDate":    "2026-05-11T19:00:00+04:00"
  }
}

---

# 5) Stop Conditions (no moving on unless green)
Backend stop:
- All endpoints compile + pass tests + seed works + swagger (optional) reflects contracts.
Frontend stop:
- Admin flow can run a toy event end-to-end with mock data and realtime mat screen.

Do not implement Phase-2 nice-to-haves until the full tournament loop is stable.