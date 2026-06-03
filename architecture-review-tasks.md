# Geo Wushu — Architecture Review Findings & Fix Tasks

> **Prompt for Claude Code.** This document captures the verified results of a production-readiness review (Phase 1: system understanding, Phase 2: architecture review) of the Geo Wushu competition system. Use it as the source of truth for the remediation work described in the **Tasks** section.
>
> **How to use this file:** Work the tasks in priority order (C → H → M → L). Each task lists the problem, affected files, acceptance criteria, and constraints. Do **not** start the dev server or run `npm run build` / `tsc` unless explicitly asked. Add i18n keys to both `en.json` and `ka.json`. Keep changes surgical and follow existing conventions in `CLAUDE.md`.

---

## Part 1 — System Understanding (context)

**Business idea:** Tournament management system for the Georgian Wushu Federation. Runs a Wushu (Sanda) competition end-to-end: coaches register athletes → admins verify weigh-ins → system draws brackets → fights are scheduled across mats/sessions → judges/timekeepers score live fights on a round-based timer → results/medals publish → public + venue-TV screens follow along. Bilingual (English + Georgian). Version `3.0.1`.

**Architecture:**
- **Monorepo** (npm workspaces): `frontend/` (Next.js 16, React 19, App Router) + `backend/` (NestJS 11, Prisma 7).
- **Production deployment:** `server.js` runs a **single combined Node/Express process** — Next.js serves all routes; `/api/*` is mounted into the NestJS app via `ExpressAdapter`. One server, one port (default 4000). Prod DB = Neon; dev DB = docker-compose Postgres 16.
- **External services:** PostgreSQL is the **only** external dependency. No email, no payments, no cloud storage, no Redis/queue.
- **Background work:** three in-process schedulers — hourly event stage auto-advance (`EventStageAutomationService`), daily refresh-token cleanup (`RefreshTokenCleanupService`), and a 1s fight-timer automation interval (`FightTimerAutomationService`).

**Auth & permissions:**
- Cookie-based JWT: `gw_auth` (access, 15 min) + `gw_refresh` (refresh, 7 days), both httpOnly.
- Refresh tokens are DB-backed (SHA-256 hashed in `RefreshToken`) with rotation + reuse/theft detection.
- `@UseGuards(AuthGuard, CapabilityGuard)` + `@RequireCapability('CODE')`. `AuthGuard` re-validates the user against the DB on every request.
- Capability codes: `EVENTS_MANAGE`, `RULESETS_MANAGE`, `ATHLETES_MANAGE`, `WEIGHIN_RUN`, `DRAW_RUN`, `SCHEDULE_MANAGE`, `LIVE_RUN`, `RESULTS_MANAGE`, `EXPORTS_MANAGE`, `CONTENT_MANAGE` (unused).
- Roles: admin (all), coach (`ATHLETES_MANAGE`, club-scoped), judge/timekeeper (`LIVE_RUN`), athlete (none, placeholder).

**Event lifecycle** (no backend `EventPhaseGate` guard — enforced by `backend/src/events/lifecycle-rules.ts` helpers + per-service assertions):
```
REG_OPEN → LOCKED → WEIGHIN → WEIGH_IN_COMPLETED → DRAWN → PUBLISHED → LIVE → COMPLETED
```

**Realtime:** one `FightsGateway` (socket.io, path `/api/socket.io`). Rooms `event:{id}` / `mat:{id}`. Events `fight:update`, `timer:update`, `schedule:update` → React Query invalidation via `useRealtimeQuerySync` (mat TV page polls REST directly).

---

## Part 2 — Architecture Findings (verified)

Severity legend: **CRITICAL** (deployment landmine) · **HIGH** (scaling ceiling / god object) · **MEDIUM** (maintainability/correctness) · **LOW** (cleanup).

| ID | Severity | Summary | Primary location |
|----|----------|---------|------------------|
| C1 | CRITICAL | `repairSchema()` runs hardcoded DDL on every boot, bypassing migrations; migration history is not the source of truth | `backend/src/prisma/prisma.service.ts`, `backend/scripts/repair-schema.mjs` |
| H1 | HIGH | `FightsService` is a god object (1,751 lines, ~13 public methods, multiple responsibilities) | `backend/src/fights/fights.service.ts` |
| H2 | HIGH | Single-instance coupling: in-memory `liveBoardCache` + 1s timer `@Interval` block horizontal scaling | `backend/src/fights/fights.service.ts`, `backend/src/fights/fight-timer.automation.service.ts` |
| H3 | HIGH | SSR + API share one event loop (combined `server.js` process) | `server.js` |
| M1 | MEDIUM | Stringly-typed control flow: ~250 `throw new Error('CODE')` with no type safety | backend services (all) |
| M2 | MEDIUM | Duplicated frontend auth-fetch logic with separate module-level refresh state | `frontend/src/lib/api/client.ts`, `frontend/src/lib/fetchWithAuth.ts` |
| M3 | MEDIUM | Oversized files: `types/api.ts` (1,045 lines), `UserDetailsDrawer.tsx` (661) | `frontend/src/types/api.ts`, `frontend/src/components/admin/users/UserDetailsDrawer.tsx` |
| L1 | LOW | Half-built capability system: no write API, `Capability` never seeded, `CONTENT_MANAGE` unused | `backend/src/auth/capabilities.ts`, `backend/src/users/*` |
| L2 | LOW | Direct `jsonwebtoken` (vs `@nestjs/jwt`) + `bcryptjs` (vs `bcrypt`) | `backend/src/auth/*` |
| L3 | LOW | Some modules rely on `@Global` PrismaModule implicitly instead of importing it | `backend/src/**/*.module.ts` |

**Confirmed healthy (do not "fix"):** no circular dependencies (zero `forwardRef`), clean module DAG, pure logic extracted into `*.logic.ts` + `*.spec.ts`, lean/modern dependencies, consistent `organisationId` tenant scoping.

---

## Tasks

> Work top-down. Each task is self-contained. Prefer small PRs per task. Confirm acceptance criteria before moving on.

### TASK C1 — Make migrations the single source of truth (remove schema-drift hack)
**Severity: CRITICAL**

**Problem.** `backend/src/prisma/prisma.service.ts#repairSchema()` runs ~90 lines of raw `CREATE TYPE` / `ALTER TABLE ADD COLUMN IF NOT EXISTS` / `ADD CONSTRAINT` DDL on `onModuleInit`. `prestart:prod` also runs `scripts/repair-schema.mjs` and `scripts/migrate-deploy.mjs`. Every schema change must be hand-mirrored in three places, and a failed `DO $$` block throws and takes down API startup.

**Do this:**
1. Verify that the columns/types/tables created by `repairSchema()` (`TimerPhaseEnum`, `FightSlot`, `TimerState.*`, `Fight.eventWeightCategoryId/roundDurationSeconds/sessionId`, `ScheduleSession` + its FKs/index) are all represented by committed Prisma migrations in `backend/prisma/migrations/`.
2. If any are missing, generate a proper migration so `prisma migrate deploy` fully reproduces the schema on a clean DB.
3. Investigate the root cause noted in the comment ("PgBouncer drops uncommitted DDL on Neon"): ensure `DIRECT_URL` (non-pooled) is used for `migrate deploy` so DDL is never routed through the pooler. Document `DATABASE_URL` (pooled, runtime) vs `DIRECT_URL` (direct, migrations) in `backend/.env.example`.
4. Once migrations are authoritative, **remove** the `repairSchema()` call from `onModuleInit` and delete/retire `scripts/repair-schema.mjs`. Keep only `migrate-deploy` in `prestart:prod`.
5. Make startup fail-soft: a DB connection error should log clearly, not crash with an opaque DDL stack trace.

**Acceptance criteria:**
- `prisma migrate reset` + `migrate deploy` on an empty DB produces a schema identical to current prod (no repair step needed).
- `repairSchema()` is gone; boot no longer issues DDL.
- `.env.example` documents pooled vs direct URLs.

**Constraints:** Do not drop or rewrite existing data. Do not run migrations against any live DB without explicit instruction — produce the migration files and instructions only.

---

### TASK H1 — Split the `FightsService` god object
**Severity: HIGH**

**Problem.** `backend/src/fights/fights.service.ts` (1,751 lines) owns fight reads/lists, the live-queue board + its cache, the fight state machine, timer-expiry automation, round-result recording, result setting, and winner propagation.

**Do this:** Split into cohesive services while preserving the public API used by `fights.controller.ts`, `fights.gateway.ts`, `fight-timer.automation.service.ts`, and the `public` module. Suggested decomposition:
- `FightStateService` — status transitions (`FIGHT_STATE_TRANSITIONS`, `setState`, `startFight`, `finishFight`).
- `FightTimerService` — `timerAction`, `recordRoundResult`, `advanceExpiredTimers`.
- `LiveBoardService` — `getLiveQueueBoard`, `getLiveCategoryBoard`, board cache (see H2).
- `FightResultService` — `setResult`, finalize, winner propagation.
- Keep `FightsService` as a thin facade only if needed for backward compatibility.

**Acceptance criteria:**
- No single fights service file exceeds ~500 lines.
- All existing `*.spec.ts` pass unchanged; add tests for any newly extracted seams.
- No behavior change; controller/gateway signatures preserved.

**Constraints:** Pure logic already lives in `fight-timer.logic.ts` / `live-queue.logic.ts` / `result-safeguards.ts` — reuse it, don't duplicate. Keep the `competition/competition.logic.ts` dependency intact.

---

### TASK H2 — Decide & document the scaling model; remove single-instance hazards OR guard them
**Severity: HIGH**

**Problem.** Two pieces of process-local state make the app unsafe to run as >1 instance:
- `liveBoardCache` Map in `FightsService` — `invalidateLiveBoardCache()` only clears the local process; other replicas serve stale boards.
- `FightTimerAutomationService` runs `@Interval(1000)` — multiple replicas double-fire timer advancement and emit duplicate socket events.

**Do this — pick ONE path and implement it:**

*Path A (recommended for now — single instance):*
1. Document explicitly in `CLAUDE.md` and deployment docs that the system runs as a **single instance** and why.
2. Add a startup guard / env assertion (e.g. `INSTANCE_COUNT`/replica check) or a comment block at each hazard site so future maintainers don't silently scale and break live scoring.

*Path B (enable horizontal scale):*
1. Move `liveBoardCache` to a shared store (Redis) or drop it (rely on socket invalidation + short React Query staleTime).
2. Make timer automation a singleton via a DB advisory lock / leader election so only one replica advances timers.
3. Move socket.io to a Redis adapter so emits fan out across instances.

**Acceptance criteria:**
- A clear, documented decision exists.
- If Path A: a guardrail prevents accidental multi-instance deployment.
- If Path B: two instances can run with correct live boards, single timer firing, and cross-instance socket delivery.

**Constraints:** Do not introduce Redis unless choosing Path B. Default to Path A unless told otherwise.

---

### TASK H3 — Evaluate process isolation between SSR and API
**Severity: HIGH (analysis + decision)**

**Problem.** `server.js` runs Next SSR and the Nest API on one event loop; a heavy render or slow backend op degrades both surfaces.

**Do this:**
1. Write a short decision note (in deployment docs) on whether to split frontend and backend into separate processes/containers for launch, with the tradeoffs.
2. If staying combined: identify and document any synchronous/CPU-heavy paths on the hot route (live scoring, draw generation, schedule auto-gen) that could block the loop, and confirm they're async/non-blocking.

**Acceptance criteria:** A documented decision + a list of any blocking hot-path operations (or confirmation there are none).

**Constraints:** Analysis/decision task — no large refactor required unless a blocking operation is found.

---

### TASK M1 — Introduce typed domain errors
**Severity: MEDIUM**

**Problem.** ~250 `throw new Error('SOME_CODE')` across services. Codes are untyped magic strings; a typo becomes a silent generic 500.

**Do this:**
1. Add a `DomainError` class (carrying a `code` and optional HTTP status) and a union/enum of valid error codes.
2. Migrate service throws to `throw new DomainError(ErrorCode.X)`. Start with the highest-traffic modules: `fights`, `registrations`, `schedule`, `weighin`, `events`.
3. Ensure `GlobalExceptionFilter` maps `DomainError` to the existing `{ code, message }` response shape — no change to the wire format.

**Acceptance criteria:**
- New code references are compile-time checked (no raw string literals for known codes).
- Existing API error responses (`{ code, message }`) are unchanged; frontend `ApiError.code` handling still works.
- Existing tests pass.

**Constraints:** Migrate incrementally module-by-module; do not change the JSON error contract.

---

### TASK M2 — Unify the two frontend auth-fetch wrappers
**Severity: MEDIUM**

**Problem.** `frontend/src/lib/api/client.ts` and `frontend/src/lib/fetchWithAuth.ts` each implement their own 401→refresh→retry with **separate** module-level `refreshPromise` / `loginRedirectDone`. On a burst of 401s both can call `/api/auth/refresh`, defeating the "single refresh" guarantee.

**Do this:**
1. Consolidate to one low-level authed-fetch primitive with a single shared `refreshPromise` and login-redirect guard.
2. Have `apiGet/apiPost/apiPatch/apiDelete` in `client.ts` build on that primitive; keep `fetchWithAuth` as a thin re-export (or migrate callers).
3. Verify all current callers of both modules still work.

**Acceptance criteria:**
- Exactly one module owns the refresh singleton + redirect guard.
- Concurrent 401s trigger at most one `/api/auth/refresh`.
- No caller of either wrapper breaks.

---

### TASK M3 — Break up oversized frontend files
**Severity: MEDIUM**

**Problem.** `frontend/src/types/api.ts` (1,045 lines) and `frontend/src/components/admin/users/UserDetailsDrawer.tsx` (661) are maintainability hotspots.

**Do this:**
1. Split `types/api.ts` into domain-grouped type modules (e.g. `types/api/events.ts`, `athletes.ts`, `fights.ts`, …) and re-export from `types/api.ts` for backward compatibility.
2. Extract sub-components/hooks from `UserDetailsDrawer.tsx` (e.g. activity list, capability panel, edit form) into colocated files.

**Acceptance criteria:** No type/component regression; imports elsewhere continue to resolve; each new file is focused (<~300 lines).

---

### TASK L1 — Finish or remove the capability-grant scaffolding
**Severity: LOW**

**Problem.** `UserCapability` is read at auth time but has **no write API**; the `Capability` table is **never seeded**; `CONTENT_MANAGE` is defined/granted but unused; the users inspection endpoint compares capability **codes** against capability **UUIDs** (likely a bug).

**Do this — pick ONE:**
- *Finish it:* seed `Capability`, add an admin API to grant/revoke `UserCapability`, fix the code-vs-UUID comparison in the inspection endpoint, and wire `CONTENT_MANAGE` to the content controller (or drop it).
- *Remove it:* delete the unused per-user grant path and `CONTENT_MANAGE` so the model reflects reality (role-based only).

**Acceptance criteria:** The capability system either fully works (grants persist & take effect) or is cleanly removed with no dead references.

**Constraints:** Default to *remove* unless per-user grants are a near-term product need.

---

### TASK L2 — (Optional) Align auth libs with NestJS idiom
**Severity: LOW**

**Do this (only if low-risk):** Consider `@nestjs/jwt` over direct `jsonwebtoken`, and evaluate `bcrypt` vs `bcryptjs` for hashing throughput under login bursts. Skip if it risks destabilizing the verified auth flow.

**Acceptance criteria:** No auth behavior change; tests pass. This is discretionary.

---

### TASK L3 — Make PrismaModule dependency explicit
**Severity: LOW**

**Do this:** Add `PrismaModule` to the `imports` of modules that use Prisma but currently rely on `@Global` (e.g. `results`, `event-policies`). Improves readability of module dependencies.

**Acceptance criteria:** All modules that inject `PrismaService` list `PrismaModule` in imports; app still boots.

---

---

## Part 3 — Business Flow Findings (verified)

End-to-end trace of every user journey (auth, registration, weigh-in, draw, schedule, live scoring, profile, public/results). Severity reflects business/security impact.

Severity legend: **CRITICAL** (data leak / corruption) · **HIGH** (race/permission gap affecting live ops or money-equivalent integrity) · **MEDIUM** (correctness/UX with workaround) · **LOW** (cosmetic / dead UX).

### Findings table

| ID | Severity | Class | Summary | Primary location |
|----|----------|-------|---------|------------------|
| BF1 | CRITICAL | Permission gap / data leak | Coach with `clubId = null` reads **all org athletes & registrations** (GET ignores club filter when `effectiveClubId` is undefined; POST is correctly blocked) | `backend/src/athletes/athletes.controller.ts:76-78`, `athletes.service.ts:43-47`, `registrations.controller.ts:108-111` |
| BF2 | HIGH | Race condition | `setResult` / `finishFight` have **no optimistic lock on the fight row** — two judges submitting different winners = last-writer-wins, silent overwrite | `backend/src/fights/fights.service.ts` (`setResult`, `finishFight`) |
| BF3 | HIGH | Race condition / corruption | `propagateWinnerToNextFight` overwrites the downstream slot **even if the next fight already started** (no `isDownstreamFightLocked` check); same in draw-time propagation | `backend/src/fights/fights.service.ts:1717-1749`, `draw.service.ts:613-644` |
| BF4 | HIGH | Race condition | `generateSchedule` / `autoSchedule` clear **all** assignments then reassign every "playable" fight — including `IN_PROGRESS`/`PAUSED` — and are allowed during `LIVE`; can move a fight that's being contested | `backend/src/schedule/schedule.service.ts:816-847, 550-560`, `auto-schedule-order.logic.ts:191-198` |
| BF5 | HIGH | Dead end / missing state | 1-athlete category builds a `Bracket` with **zero fights** (no champion, no walkover); 0-athlete categories silently skipped → event reaches `DRAWN` with undrawn categories | `backend/src/draw/draw.service.ts:286-289`, `competition-format.ts:25`, `brackets.service.ts:751-756` |
| BF6 | HIGH | Permission gap | Weigh-in `record()` does **not** check `registration.status` — PENDING/REJECTED/WITHDRAWN athletes appear in the weigh-in queue and can be weighed; controller comment claiming "APPROVED only" is wrong | `backend/src/weighin/weighin.service.ts:251, 481-492`, `weighin.controller.ts:35-36` |
| BF7 | HIGH | Missing state | `REWEIGH_ALLOWED` is non-final and **blocks event auto-advance indefinitely**; there is no cron that auto-DQs at `deadlineAt` — DQ only happens if an operator records again after expiry | `backend/src/weighin/weighin.logic.ts:208-223`, `event-stage-automation.service.ts:273-287` |
| BF8 | HIGH | Permission gap | Bulk status change **bypasses the transition table** during `REG_OPEN`: `WITHDRAWN → APPROVED` succeeds with no override/reason (single-row API requires override) | `backend/src/registrations/registration-bulk-status.service.ts:95-127` |
| BF9 | HIGH | Permission gap | WebSocket auth is **connect-time JWT only** — no DB re-validation, no capability check to subscribe. Suspended/DQ'd/disabled user keeps the socket and live data until the 15-min JWT expires | `backend/src/fights/fights.gateway.ts:52-68, 114-183` |
| BF10 | HIGH | Race / error handling | Concurrent duplicate registration hits `@@unique([eventId, athleteId])` but the controller catch returns **HTTP 500** instead of a clean 409 (P2002 never reaches the global filter) | `backend/src/registrations/registrations.controller.ts:178-211`, `registrations.service.ts:300-307` |
| BF11 | MEDIUM | Data integrity | Public results include fights with status **`COMPLETE`** (unconfirmed), so provisional/unconfirmed outcomes can show publicly on a published event | `backend/src/public/public-results.service.ts:209-210` |
| BF12 | MEDIUM | Race / corruption | `swapParticipants` during LIVE has **no lifecycle guard and no downstream lock** — can orphan bracket state; brackets page has no phase gate | `backend/src/draw/brackets.service.ts:504-558`, `frontend/.../brackets/BracketsHeaderSummary.tsx:109-116` |
| BF13 | MEDIUM | Race condition | Admin approve vs coach withdraw = blind `update` with no `WHERE status = expected` → lost update | `backend/src/registrations/registrations.service.ts:417-419`, `registration-bulk-status.service.ts:124-127` |
| BF14 | MEDIUM | Edge case | Withdrawing/rejecting an athlete after draw **does not remove them from brackets/fights**; integrity checks don't flag it | `backend/src/registrations/registrations.service.ts`, `draw.service.ts:169-176` |
| BF15 | MEDIUM | Race condition | No `@@unique([registrationId, attemptNo])` — concurrent weigh-in `record()` calls compute the same `attemptNo` and both insert | `backend/src/weighin/weighin.service.ts:559-560`, `schema.prisma:560-585` |
| BF16 | MEDIUM | Permission gap | `reorderSessions`, `upsertSession`, `deleteSession` have **no `assertScheduleMutable`** — session CRUD works on `COMPLETED` events | `backend/src/schedule/schedule.service.ts:163-221, 998-1023` |
| BF17 | MEDIUM | Race condition | Schedule `moveFight` / `moveFightToSession` / `updateFightOrder` read-then-write outside locks → duplicate `orderInMat`/`orderInSession` under concurrent drag-drop | `backend/src/schedule/schedule.service.ts:656-731, 940-986, 1050-1078` |
| BF18 | MEDIUM | Dead end / UX | No un-confirm/reopen path in the UI; event auto-`COMPLETED` with **no revert** if a fight is reopened via override → COMPLETED event with an incomplete fight | `backend/src/fights/fights.service.ts:851-879`, `lifecycle-rules.ts:45-47` |
| BF19 | MEDIUM | Data integrity | Admin changing a coach's `clubId` orphans the coach from existing athletes/registrations (no cascade, no warning) | `backend/src/users/users.service.ts:100-117` |
| BF20 | MEDIUM | Permission gap / UX | Coach category-edit modal presents a full picker + Save, but backend **always** rejects coaches (`COACH_CANNOT_SET_CATEGORY`) | `backend/src/registrations/registrations.service.ts:476-478`, coach registrations `page.tsx:98-100` |
| BF21 | MEDIUM | Security | `bootstrap-admin` is **open to the first caller** in dev/staging when `BOOTSTRAP_SECRET` is unset | `backend/src/auth/auth.controller.ts:328-335` |
| BF22 | LOW | Dead end / missing feature | "Forgot password?" links to `#`; there is **no password reset or change-password flow** anywhere (coach `/me` and admin edit can't change passwords) | `frontend/.../LoginForm.tsx:147-153`, `users.schemas.ts:22-33` |
| BF23 | LOW | Dead end / UX | Judge/timekeeper login → `/admin/live` → `/no-access` (admin layout needs `EVENTS_MANAGE`); no admin UI to create these roles | `frontend/.../dashboard/page.tsx:19-20`, `permissions.ts:132-136` |
| BF24 | LOW | Confusing UX | Contact form copy promises the message will be "forwarded to the relevant organiser" — it's only stored in the DB inbox (no email) | `frontend/src/messages/en.json` (`contactBody`), `forms.controller.ts:67-76` |
| BF25 | LOW | Dead end / UX | Coach-without-club: dashboard blocks but the sidebar still links to Athletes/Events (which then leak — see BF1) | `frontend/.../CoachShell.tsx:23-27` |
| BF26 | LOW | UX | Logout revokes **all** device sessions with no warning; "Forgot password?"/disabled error strings handled in UI but never sent by backend (dead code) | `auth.controller.ts:154`, `LoginForm.tsx:32-35` |
| BF27 | LOW | UX / session | Stale/expired `gw_auth` cookie keeps the user off the login page (bounce to dashboard → refresh fails → `login?force=1`); mid-form session expiry loses unsaved work | `frontend/src/proxy.ts:55-63`, `lib/api/client.ts:88-91` |
| BF28 | LOW | Operational | Export JSON files written to `/tmp/wushu-exports` with **no cleanup**; `DocumentLink` rows 404 after reboot. `PUBLIC_ORG_SLUG` unset → non-deterministic public org | `backend/src/exports/exports.service.ts`, `common/public-org.ts:11-14` |
| BF29 | LOW | Edge case | Eligibility mismatches: frontend uses **today** for age vs backend `competitionStartDate`; youth 15-16→18+ exception missing in `CategoryPicker`; `SUBMITTED` status never used in coach flow | `frontend/src/components/registration/CategoryPicker.tsx:37-61`, `registrations.service.ts:114-116` |

### Confirmed by design (not defects)
- No public self-service signup; accounts are admin-provisioned (`POST /api/auth/signup` is `EVENTS_MANAGE`-gated).
- No email / notifications / payments anywhere.
- Honeypot spam returns silent `{ ok: true }` without persisting.
- Account-enumeration is mitigated (uniform `INVALID_CREDENTIALS`).
- Cross-org IDOR on public endpoints is mitigated via `resolvePublicOrg` scoping (set `PUBLIC_ORG_SLUG` in prod).

---

## Tasks (Phase 3 — Business Flow)

> Continue working in priority order. These come **after** the Phase 2 tasks unless a CRITICAL is involved — **TASK BF-1 should be done immediately** regardless of phase ordering, as it is an active data leak.

### TASK BF-1 — Fix coach-without-club data leak (DO FIRST)
**Severity: CRITICAL** — fixes BF1.

**Problem.** When a coach has `clubId = null`, `effectiveClubId` becomes `undefined`, and the list query applies no club filter, returning every athlete (and registration) in the organisation.

**Do this:**
1. In `athletes.controller.ts` `list()` and `registrations.controller.ts` list handler: when `auth.role === 'coach'` and `auth.clubId` is null/undefined, **reject with `COACH_NO_CLUB` (403)** — same as the POST paths — instead of falling through to an unfiltered query.
2. Defense in depth: in `athletes.service.list()` / registrations list, if a `coachScope` flag is set but no `clubId` is present, return an empty result rather than all rows.
3. Audit any other coach-scoped GET endpoints for the same `undefined → no filter` pattern (athlete profile, weigh-in queue, schedule, live).

**Acceptance criteria:** A coach with no club assigned receives `403 COACH_NO_CLUB` (or empty list) on every coach-scoped read; an integration test covers it.

---

### TASK BF-2 — Add optimistic locking to live fight mutations
**Severity: HIGH** — fixes BF2, BF3, and the `setResult`/`finishFight` half of BF18.

**Do this:**
1. Add `expectedUpdatedAt` (or a `version` int) to `setResult` and `finishFight`, matching the existing pattern already used by `timerAction` / `recordRoundResult` (`TIMER_STALE_UPDATE`). Reject stale writes with a `FIGHT_STALE_UPDATE` code; have the frontend pass `updatedAt` and surface a "reload, someone else scored this" message.
2. In `propagateWinnerToNextFight` (and the draw-time `propagateWinner`), **check `isDownstreamFightLocked` before overwriting** a downstream slot; if locked, skip + flag for manual review instead of silently overwriting.

**Acceptance criteria:** Two concurrent result submissions on the same fight — the second gets a stale-write error, not a silent overwrite. Propagation never overwrites a started downstream fight.

---

### TASK BF-3 — Guard schedule mutations during LIVE / against in-progress fights
**Severity: HIGH** — fixes BF4; relates to BF16, BF17.

**Do this:**
1. In `autoSchedule` / `generateSchedule`, **exclude `IN_PROGRESS`, `PAUSED`, `COMPLETE`, `CONFIRMED` fights** from the "clear and reassign" set — only (re)assign `QUEUED`/`ON_DECK` fights with no result.
2. Add `assertScheduleMutable` to `reorderSessions`, `upsertSession`, `deleteSession` (BF16).
3. Make `moveFight`/`moveFightToSession`/`updateFightOrder` transactional with a status re-check inside the transaction; block moving `COMPLETE`/`CONFIRMED` fights (BF17 + the `moveFightToSession` gap).
4. Frontend: gate destructive schedule actions behind the event phase (no full regenerate/drag during LIVE without explicit confirm).

**Acceptance criteria:** Running auto-schedule during LIVE never moves a fight that has a result or is in progress; session CRUD is rejected on read-only events.

---

### TASK BF-4 — Handle degenerate draw categories (0 and 1 athlete)
**Severity: HIGH** — fixes BF5.

**Do this:**
1. For a 1-athlete category, either auto-declare that athlete the category winner (walkover/medal) or refuse to create an empty bracket and surface it as a blocking readiness issue — do not leave a bracket with zero fights.
2. For 0-athlete categories, make the draw readiness/result surface explicitly report "no eligible athletes — not drawn" so an event can't appear fully drawn while categories are silently empty.

**Acceptance criteria:** No bracket exists with zero fights; 0/1-athlete categories produce a clear, correct outcome and are visible in readiness + results.

---

### TASK BF-5 — Enforce APPROVED + reweigh-deadline handling in weigh-in
**Severity: HIGH** — fixes BF6, BF7; relates to BF15.

**Do this:**
1. `weighin.service.record()` and the queue `search()` must filter/require `registration.status === 'APPROVED'` (allow override with reason for edge corrections). Fix the incorrect controller comment.
2. Add a scheduled job (or fold into the hourly stage-automation cron) that transitions expired `REWEIGH_ALLOWED` / open `ONE_HOUR` windows to their terminal decision (`DISQUALIFIED` or policy outcome) at `deadlineAt`, so a stalled reweigh can't block event completion forever.
3. Add `@@unique([registrationId, attemptNo])` (BF15) and compute `attemptNo` inside a transaction to prevent collisions.

**Acceptance criteria:** Non-APPROVED registrations don't appear in the weigh-in queue; an expired reweigh window resolves automatically; concurrent attempts can't duplicate `attemptNo`.

---

### TASK BF-6 — Make bulk registration status respect the transition table
**Severity: HIGH** — fixes BF8; relates to BF13.

**Do this:**
1. In `registration-bulk-status.service.ts`, apply the **same `ALLOWED_STATUS_TRANSITIONS` enforcement** as the single-row path: a non-direct transition (e.g. exiting `WITHDRAWN`) requires `override=true` + reason regardless of lifecycle mutability.
2. Add a `WHERE status IN (expectedStates)` guard to the `updateMany` (and single-row `update`) so a concurrent change makes the write a no-op rather than a lost update (BF13).
3. Update/repair `registration-bulk-status.service.spec.ts` to cover the transition rules.

**Acceptance criteria:** `WITHDRAWN → APPROVED` via bulk requires override+reason; concurrent approve/withdraw doesn't silently clobber.

---

### TASK BF-7 — Re-validate WebSocket connections
**Severity: HIGH** — fixes BF9.

**Do this:**
1. In `fights.gateway.ts`, after `verifyToken`, call `validateAuthenticatedUser` (reject archived/disabled/suspended) and require `LIVE_RUN` (or appropriate read capability) to subscribe to mat/event scoring rooms.
2. Periodically re-validate long-lived sockets (or disconnect on token expiry) so a suspended/expired operator is dropped within a bounded window, not up to 15 minutes.

**Acceptance criteria:** A suspended judge's socket is rejected/dropped promptly; subscribing requires the right capability.

---

### TASK BF-8 — Map duplicate-registration conflict to 409
**Severity: HIGH (small fix)** — fixes BF10.

**Do this:** In `registrations.controller.ts`, catch Prisma `P2002` (and the `REGISTRATION_ALREADY_EXISTS` domain error) and return **409** with code `REGISTRATION_ALREADY_EXISTS`, instead of falling through to HTTP 500. (Pairs well with the typed-error work in Phase 2 TASK M1.)

**Acceptance criteria:** Concurrent/duplicate registration returns a clean 409 with a clear code; never a 500.

---

### TASK BF-9 — Gate public results on confirmation; gate bracket swaps
**Severity: MEDIUM** — fixes BF11, BF12.

**Do this:**
1. Public results should include **`CONFIRMED` fights only** (not `COMPLETE`) so unconfirmed/provisional outcomes never show publicly. Confirm admin views can still see `COMPLETE` + `needsReview`.
2. Add a lifecycle guard + `isDownstreamFightLocked` check to `swapParticipants`, and a phase gate on the brackets regenerate/swap UI so it isn't offered when the API will reject it (or when it would corrupt live state).

**Acceptance criteria:** Public results never show unconfirmed outcomes; bracket swaps are blocked/safe during live competition.

---

### TASK BF-10 — Reconcile bracket membership with withdrawals + add reopen/revert path
**Severity: MEDIUM** — fixes BF14, BF18.

**Do this:**
1. When an athlete is withdrawn/rejected/DQ'd after the draw, either remove them from pending fights (award walkover to the opponent) or flag it as a blocking integrity issue so admins resolve it before LIVE.
2. Provide a supported "reopen fight" flow (UI + API with override+reason) that, when used on a `COMPLETED` event, **reverts the event lifecycle back to `LIVE`** so state stays consistent.

**Acceptance criteria:** A post-draw withdrawal is surfaced and resolvable; reopening a fight on a completed event reverts the event to LIVE.

---

### TASK BF-11 — UX & lifecycle correctness cleanup (MEDIUM/LOW batch)
**Severity: MEDIUM→LOW** — fixes BF19, BF20, BF21, BF25, BF29.

**Do this:**
- BF19: Warn (or block) when changing a coach's `clubId` while they own athletes/registrations; offer to reassign.
- BF20: Hide/disable the category-edit control for coaches (it always fails server-side).
- BF21: Require `BOOTSTRAP_SECRET` (or a one-time setup token) in all non-`development` environments, including staging.
- BF25: Hide coach sidebar links to Athletes/Events when the coach has no club (works with BF-1).
- BF29: Align frontend eligibility with backend — use `competitionStartDate` for age, add the 15-16→18+ youth exception to `CategoryPicker`; remove or wire up the unused `SUBMITTED` status.

**Acceptance criteria:** Each sub-item resolved; no UI control that the backend will always reject.

---

### TASK BF-12 — Dead-end / missing-feature UX (LOW batch)
**Severity: LOW** — fixes BF22, BF23, BF24, BF26, BF27, BF28.

**Do this:**
- BF22: Either implement a password change (authenticated) + reset flow, or remove the "Forgot password?" link and document that admins reset passwords manually.
- BF23: Give judges/timekeepers a working landing page (a live-ops view that doesn't require `EVENTS_MANAGE`) and an admin UI to create those roles — or remove the roles if unused.
- BF24: Fix contact-form copy to match reality ("your message has been received" — no "forwarded"/email claim). Update both `en.json` and `ka.json`.
- BF26: Tell users logout signs them out on all devices (or implement single-session logout); remove dead error-string handling.
- BF27: Validate the access cookie (not just presence) in `proxy.ts` before redirecting away from login; consider draft persistence for long forms.
- BF28: Add cleanup for `/tmp` export files (or move to durable storage); require `PUBLIC_ORG_SLUG` in production.

**Acceptance criteria:** No dead links or misleading copy; each role has a non-dead landing; exports/public-org are deterministic and documented.

---

---

## Part 4 — Security Findings (verified)

Threat model: an authenticated, intelligent attacker (a real admin/coach of *some* org) plus anonymous internet attackers. Severities assume the system is deployed **multi-tenant** (the data model is org-scoped, so this is the design intent); single-tenant deployments lower the real-world impact of the cross-tenant IDORs but they remain latent bugs.

### Strong posture (verified — do not regress)
- **No SQL injection surface** — all DB access is parameterized Prisma; the only raw SQL is the static DDL in `repairSchema()` (no user input).
- **No SSRF / command injection** — zero outbound `fetch`/`http.request`/`child_process` in the backend.
- **No stored XSS** — React escapes all rendered content; news `body` renders as `{post.body}` (escaped); the only `dangerouslySetInnerHTML` is a static theme-bootstrap constant (`frontend/src/app/layout.tsx:31`).
- **JWT hardened** — `jwt.verify` pins `algorithms: ['HS256']` (blocks alg-confusion / `none`); no default secret (throws if unset); refresh-token rotation + theft detection.
- **Cookies** — `httpOnly`, `secure` in production, `sameSite` default `lax`.
- **No committed secrets**; request logger logs no passwords/tokens/bodies; `GlobalExceptionFilter` returns no stack traces to clients.
- **CORS** allow-list (no wildcard-with-credentials); tenant scoping correct on fights/weigh-in/draw/results/exports; **bcrypt** hashing; uniform `INVALID_CREDENTIALS` (no user enumeration).

### Findings table

| ID | Severity | Category | Summary | Location |
|----|----------|----------|---------|----------|
| SEC1 | CRITICAL | Broken access control (IDOR, cross-tenant write) | `reorderSessions` updates `scheduleSession` rows by **raw id with no `organisationId`/`eventId` scope**; the controller does no ownership check (the code comment claiming it does is false). Any `SCHEDULE_MANAGE` admin can rewrite another org's session ordering with guessed/leaked CUIDs | `backend/src/schedule/schedule.service.ts:998-1011`, `schedule.controller.ts:273-289` |
| SEC2 | HIGH | Broken access control (IDOR) | `moveFightToSession` does not verify `toSessionId` (or the target session's fights) belong to the fight's event/org — can attach a fight to a foreign event/org session and repack its order | `backend/src/schedule/schedule.service.ts:918-967`, `schedule.controller.ts:235-261` |
| SEC3 | HIGH | Input validation (missing) | The global `ZodValidationPipe` is effectively a **no-op** — no controller DTO exposes a `.schema`, so the pipe never validates. Live-competition mutations (`fights`, `schedule`, `weighin`) accept untyped bodies; invalid enums/numbers reach Prisma as 500s and can drive unexpected states | `backend/src/common/zod-validation.pipe.ts:17-18`, `fights/fights.controller.ts`, `schedule/schedule.controller.ts`, `weighin/weighin.controller.ts` |
| SEC4 | MEDIUM | Security headers / clickjacking | Helmet + CSP are applied **only inside the Nest app (`/api`)**; the Next-rendered HTML pages (the entire UI) get **no CSP, no `X-Frame-Options`/`frame-ancestors`, no HSTS**. The app pages are clickjackable and have no script-source policy | `backend/src/main.ts:41-55` (Nest only), `server.js:30-31` (Next serves the rest) |
| SEC5 | MEDIUM | CSRF | Cookie auth with **no CSRF token / Origin check on mutations** — relies entirely on `SameSite`. With the default `lax` this is mostly OK (mutations are POST), but the documented `COOKIE_SAME_SITE=none` cross-site option removes all CSRF protection | `backend/src/auth/auth-cookie.config.ts:12-16`, all mutating controllers |
| SEC6 | MEDIUM | Info disclosure | `draw.controller` returns raw `Error.message` in HTTP 500 bodies (5 handlers) — leaks internal failure strings | `backend/src/draw/draw.controller.ts:97-99, 165-167, 202-204, 247-249, 283-285` |
| SEC7 | MEDIUM | Auth / privilege | `bootstrap-admin` is open to the first caller in any non-`production` env when `BOOTSTRAP_SECRET` is unset (staging risk) | `backend/src/auth/auth.controller.ts:328-335` |
| SEC8 | MEDIUM | Input validation / DoS | News/content fields (`title`, `slug`, `body`) have no length/format bounds (content abuse / storage growth; partially mitigated by 100 KB body cap) | `backend/src/content/content.controller.ts:21-44` |
| SEC9 | MEDIUM | Brute force | Login has only a 5/min **per-IP** throttle — no per-account lockout or backoff; distributed/rotating-IP credential stuffing on a single account is unthrottled | `backend/src/config/throttle-config.ts:32-33`, `auth.controller.ts:47-48` |
| SEC10 | LOW | Secret strength | `JWT_SECRET` presence is checked but **length/entropy is not enforced** at runtime (a weak secret enables token forgery) | `backend/src/auth/auth.service.ts:44-45` |
| SEC11 | LOW | Password policy | Admin-created users allow 6-char passwords (`users.schemas.ts`) vs signup's 8 + letter + number | `backend/src/users/users.schemas.ts:12` |
| SEC12 | LOW | Secret hygiene | `.env.example` ships `JWT_SECRET="your-secret-key"` — risk if copied to prod unchanged | `backend/.env.example` |
| SEC13 | LOW | Defense in depth | `POST /clubs` relies on an inline `auth.role === 'admin'` check instead of `@RequireCapability` (inconsistent with the rest of the app) | `backend/src/clubs/clubs.controller.ts:64-70` |
| SEC14 | (cross-ref BF9) | Broken auth (WebSocket) | Socket JWT is verified only at connect — no DB re-validation, no capability check; a suspended/expired operator keeps the live stream. Tracked as **BF9 / TASK BF-7** | `backend/src/fights/fights.gateway.ts:52-68` |

---

## Tasks (Phase 4 — Security)

### TASK SEC-1 — Close cross-tenant schedule IDORs (DO EARLY)
**Severity: CRITICAL/HIGH** — fixes SEC1, SEC2.

**Do this:**
1. `reorderSessions`: before writing, load the sessions by id **and** assert each belongs to `{ organisationId, eventId }`; reject the whole batch if any id is foreign. Then update only those rows (ideally with `updateMany`/scoped `where`).
2. `moveFightToSession`: validate that `toSessionId` (when non-null) belongs to the same `organisationId` + `eventId` as the fight; scope the target-session `findMany` by `organisationId`/`eventId`.
3. Sweep the whole codebase for the `findFirst(org) … then update({ where: { id } })` pattern and any `update`/`delete` keyed on a raw client-supplied id without a tenant-scoped guard; fix similarly. Prefer scoped `updateMany`/`deleteMany` with `{ organisationId, … }` in the `where`.

**Acceptance criteria:** A user authenticated in org A cannot reorder, move into, or repack any session/fight belonging to org B (returns 403/404); an integration test covers cross-tenant attempts.

---

### TASK SEC-2 — Make input validation real on mutating endpoints
**Severity: HIGH** — fixes SEC3; complements Phase 2 TASK M1.

**Do this:**
1. Decide on one mechanism and apply it consistently: either give every mutating DTO a Zod `.schema` so the global `ZodValidationPipe` actually runs, or replace it with explicit `schema.parse(body)` at the top of each handler.
2. Prioritise the live-competition + schedule + weigh-in controllers (untyped enums/numbers today): validate enums (`WinMethod`, `FightStatus`, `WeighInDecision`, timer `action`), numeric ranges (`weightKg`, durations, order indices), and required ids.
3. Add bounded string validation for content/news fields (SEC8): max lengths on `title`, `slug` (slug pattern), `body`.

**Acceptance criteria:** Invalid enum/number/missing-field bodies return a clean 400 with a code, never a 500/Prisma error; the validation pipe is either functional or removed in favour of explicit parsing.

---

### TASK SEC-3 — Apply security headers to the actual web app
**Severity: MEDIUM** — fixes SEC4.

**Do this:**
1. Add security headers (CSP, `X-Frame-Options: DENY`/`frame-ancestors 'none'`, HSTS in prod, `Referrer-Policy`, `X-Content-Type-Options`) to the **Next-served responses**, not just `/api`. Use Next `headers()` in `next.config.ts` (and/or `proxy.ts`/middleware), since Helmet on the Nest app doesn't cover HTML pages.
2. Build a CSP compatible with Next 16 (nonce or hashes for the inline theme script; allow the socket.io `connect-src`).

**Acceptance criteria:** App HTML responses carry CSP + anti-clickjacking + HSTS (prod); the UI and live socket still function under the policy.

---

### TASK SEC-4 — Add CSRF defense for cookie-authenticated mutations
**Severity: MEDIUM** — fixes SEC5.

**Do this:** Add a defense that doesn't depend solely on SameSite — e.g. require a custom header (`x-request-id`/`x-csrf`) on state-changing requests and verify it, or a double-submit CSRF token, and/or verify the `Origin`/`Referer` against the CORS allow-list on all non-GET requests. Especially required if `COOKIE_SAME_SITE=none` is ever used.

**Acceptance criteria:** A cross-site form/auto-POST without the token/valid Origin is rejected even when `sameSite=none`.

---

### TASK SEC-5 — Security hardening batch (MEDIUM/LOW)
**Severity: MEDIUM→LOW** — fixes SEC6, SEC7, SEC9, SEC10, SEC11, SEC12, SEC13.

**Do this:**
- SEC6: Sanitize `draw.controller` 500s — return a generic message + code (route through the global filter / typed errors from M1), never raw `Error.message`.
- SEC7: Require `BOOTSTRAP_SECRET` (or a one-time setup token) in **all** non-`development` environments incl. staging (align with BF21).
- SEC9: Add per-account login throttling/lockout (e.g. exponential backoff or temporary lock after N failures) on top of the per-IP throttle; consider CAPTCHA after repeated failures.
- SEC10: Enforce `JWT_SECRET` length (≥32 chars) at startup; fail fast if weak.
- SEC11: Raise admin-created-user password policy to match signup (≥8, letter+number).
- SEC12: Change `.env.example` `JWT_SECRET` to an obvious placeholder like `CHANGE_ME_min_32_random_chars` and document generation.
- SEC13: Add `@RequireCapability(EVENTS_MANAGE)` (or appropriate) to `POST /clubs` for consistency, keeping the role check as defense in depth.

**Acceptance criteria:** Each sub-item addressed; startup fails on a weak/missing `JWT_SECRET`; no raw error strings to clients.

> SEC14 (WebSocket re-validation) is already covered by **TASK BF-7** — do it there.

---

---

## Part 5 — Database Findings (verified)

Engine: PostgreSQL via Prisma 7 (`pg` adapter). Reference event scale: **R ≈ 500–2000 registrations, F ≈ 500–3000 fights, C ≈ 30–80 categories, mats ≈ 2–8** per event.

### Healthy
- Good index coverage on the busiest tenant paths: `Registration` (`[org,event]`, `[org,event,status]`, `weighInStatus`, both weight-cat FKs), `Fight` (`[org,event]`, `[org,event,status]`, `[matId,orderInMat]`, `[sessionId,orderInSession]`, `nextFightId`), `Athlete` (`[org,documentId]` unique, `[org,lastName,firstName]`, `[org,dob,documentId]`), `RefreshToken` (`tokenHash`, `userId`).
- Sensible unique constraints (`[eventId,athleteId]`, `[eventId,categoryCode]`, `[org,email]`, `[org,documentId]`).
- Audit reads are bounded (`take: 8/15`); cascade deletes defined on template/category sub-trees.

### Findings table

| ID | Severity | Category | Summary | Location |
|----|----------|----------|---------|----------|
| DB1 | HIGH | Missing indexes | **`AuditLog` has NO indexes** (grows unbounded — one row per mutation), and several org-scoped FK columns are unindexed (Postgres does **not** auto-index FKs): `Club.organisationId`, `DocumentLink.organisationId`, `ContactSubmission.organisationId`, `AthleteMerge.organisationId`, `TimerState.organisationId`. Tenant-filtered reads + cascade deletes table-scan | `backend/prisma/schema.prisma` (`AuditLog` 403-422, `Club` 455-469, `TimerState` 690-713, etc.) |
| DB2 | HIGH | Unbounded queries | Pervasive `findMany` with **no `take`/pagination** on growing tables: athletes list, registrations list, weigh-in queue, live board, schedule view, results, fights list, draw readiness, integrity, events/users/clubs lists. Each returns the full set, often with deep joins, into the single Node process | `athletes.service.ts:58-75`, `registrations.service.ts:221-258`, `weighin.service.ts:275-365`, `fights.service.ts:257-291,400-433`, `schedule.service.ts:268-301`, `results.service.ts:61-120`, `public-results.service.ts:33-92` |
| DB3 | HIGH | N+1 | `autoConfirmByes` issues per-bye `findFirst`/`update`/propagation **inside the 30s draw transaction**; weigh-in queue reconcile loops `findFirst+findMany+update+audit` per broken row, then **re-runs the entire heavy list query** | `draw.service.ts:513-566`, `weighin.service.ts:367-401` |
| DB4 | HIGH | Locking / long transaction | `executeDraw` **deletes all fights/timers/brackets for the event then recreates them** per-category in one transaction (exclusive locks on the event's fight rows for the whole draw, 30s timeout); `autoSchedule`/`generateSchedule` do **F sequential `fight.update`** in one transaction | `draw.service.ts:240-384`, `schedule.service.ts:550-587, 843-876` |
| DB5 | MEDIUM | Over-fetching | Hot paths fetch wide graphs with no `select`: weigh-in queue includes a **4-level** category ladder duplicated per registration row; live board / schedule load full `Fight` rows + whole `mat`/`timerState` on every poll | `weighin.service.ts:275-365`, `fights.service.ts:257-291`, `schedule.service.ts:268-301` |
| DB6 | MEDIUM | Query volume | **Every authenticated request** runs `validateAuthenticatedUser` (a user lookup) → DB QPS scales 1:1 with all API traffic, uncached; `/me` does a second user fetch. The 800ms live-board cache is in-process only (ties to H2) | `auth.guard.ts:40`, `auth.service.ts:253-313` |
| DB7 | MEDIUM | Aggregation in JS | Public homepage leaderboard loads **all org won + lost fights** (two full scans) and counts in JS instead of SQL `groupBy`/`COUNT` | `public.controller.ts:112-127` |
| DB8 | MEDIUM | Repeated scan | Every LIVE result confirmation runs a full-event `fight.count` over playable fights to decide auto-COMPLETE | `fights.service.ts:852-860` |
| DB9 | MEDIUM | Missing constraint | No `@@unique([registrationId, attemptNo])` on `WeighInAttempt` → concurrent attempts duplicate `attemptNo` (same root as BF15) | `schema.prisma:560-585` |
| DB10 | MEDIUM | Migration risk | **Confirmed Prisma drift**: `20260410000000_ensure_timer_fight_columns` exists solely because a prior migration "was recorded as applied without the DDL executing" — the root cause of the `repairSchema()` hack (C1). Also `20260304_add_event_date_fields` adds NOT NULL date columns with `DEFAULT NOW()`, backfilling existing events with bogus competition/registration dates. No down-migration/rollback path | `backend/prisma/migrations/20260410000000_ensure_timer_fight_columns/migration.sql`, `20260304_add_event_date_fields/migration.sql` |
| DB11 | LOW | Missing index | `TimerState` has no index on `state`; the 1s automation cron scans all timer rows (grows with historical fights) to find `RUNNING` | `schema.prisma:690-713`, `fights.service.ts:1072+` |
| DB12 | LOW | Missing CHECK constraints | No DB-level checks for `maxWeightKgIncl > minWeightKgExcl`, date ordering, or `redAthleteId != blueAthleteId` — integrity is app-only | `schema.prisma` (Event dates, CategoryTemplateWeight, Fight) |
| DB13 | LOW | Cascade fragility | Event/org deletion relies on a **manual `deleteMany` sequence** in `event-ops.service.ts` rather than DB-level `onDelete` cascades (most Event-referencing relations have no `onDelete`); easy to orphan rows or hit FK `Restrict` if a relation is missed | `event-ops.service.ts:125-156`, `schema.prisma` (Fight/Registration/WeighInAttempt/Bracket/Mat/ScheduleSession → Event) |

### Scaling estimate

| Scale | Verdict | Dominant DB risk |
|-------|---------|------------------|
| **100 users** | Fine | None — all unbounded queries return small sets |
| **1,000 users** (one real federation event) | OK with care | Weigh-in-day queue (R×W join), live-board polling loading all fights each cache miss, 30s draw lock — all tolerable but wasteful |
| **10,000 users** (large championship / many concurrent events) | Strained | `AuditLog` now large + unindexed; unbounded athlete/registration lists return thousands of deep-joined rows; live polling × many viewers spikes DB CPU on the single process; per-request auth lookup becomes the dominant query |
| **100,000 users** | Won't hold | Single-instance ceiling (H2/H3) hits first; DB-side: per-request auth lookup makes DB QPS ≈ total request volume (uncached, no read replica), unbounded queries untenable, huge unindexed `AuditLog`, FK-unindexed scans |

**Framing note:** "users" is a loose metric for a tournament system — real load is *concurrent pollers per live event* and *registrations/fights per event*. The DB is healthy for realistic single-federation event sizes; the risks compound under many concurrent events/orgs or high public-viewer fan-out during a live final.

---

## Tasks (Phase 5 — Database)

### TASK DB-1 — Add missing indexes
**Severity: HIGH** — fixes DB1, DB11.

**Do this (new Prisma migration):**
1. `AuditLog`: add `@@index([organisationId, createdAt])` and `@@index([entityType, entityId])` (and `[eventId, createdAt]`).
2. Add `@@index([organisationId])` to `Club`, `DocumentLink`, `ContactSubmission`, `AthleteMerge`, `TimerState`.
3. `TimerState`: add `@@index([state])` (or `[organisationId, state]`) for the 1s automation scan.
4. Verify against actual query `where` clauses with `EXPLAIN` on a seeded DB; only keep indexes that are used.

**Acceptance criteria:** Tenant-filtered reads and audit queries use index scans (verified via `EXPLAIN`); migration applies cleanly.

---

### TASK DB-2 — Paginate and narrow hot list endpoints
**Severity: HIGH** — fixes DB2, DB5.

**Do this:**
1. Add server-side pagination (`take`/`skip` or cursor) to: athletes list, registrations list, fights list, results list, events/users/clubs lists, contact submissions. Keep the existing frontend `usePagination` in sync.
2. Replace bare `findMany` includes on hot read paths (live board, schedule, weigh-in queue, public results) with explicit `select` of only the fields rendered. For the weigh-in queue, fetch the category weight ladder **once per category**, not nested per registration row.
3. For the live board, scope by mat/session and select minimal fields; rely on socket invalidation instead of wide polling where possible.

**Acceptance criteria:** No hot endpoint returns an unbounded result set; payloads on live/schedule/weigh-in are trimmed to rendered fields; large-event page loads stay responsive.

---

### TASK DB-3 — De-risk the draw + schedule transactions
**Severity: HIGH** — fixes DB3 (draw half), DB4.

**Do this:**
1. `autoConfirmByes`: replace the per-bye N+1 with set-based queries (batch-load bye fights and their dependencies; compute propagation in memory; apply with batched `updateMany`/`createMany`).
2. Reduce `executeDraw` lock window: do the heavy compute (shuffle, format, bracket/fight shapes) **outside** the transaction; keep the transaction to the minimal delete+insert. Consider per-category transactions instead of one event-wide transaction so a 60-category draw doesn't hold all fight rows at once.
3. `autoSchedule`/`generateSchedule`: replace the sequential `fight.update` loop with batched updates (e.g. `CASE`-based bulk update or grouped `updateMany`), and move overflow-session creation inside the main transaction (also fixes the BF3/consistency note).

**Acceptance criteria:** Draw of a large event holds locks briefly per category, not for the full 30s; bye confirmation is O(1)–O(log n) queries, not O(byes); schedule generation is a small number of statements.

---

### TASK DB-4 — Fix the weigh-in queue query
**Severity: HIGH** — fixes DB3 (weigh-in half), part of DB5.

**Do this:**
1. Remove the "reconcile then re-run the entire list query" double fetch; reconcile in a batch and merge results in memory, or reconcile lazily.
2. Narrow the registration `select` and load the category weight ladder once per category (not per row).
3. Combine with the BF-5 weigh-in work (APPROVED filter + `@@unique([registrationId, attemptNo])`).

**Acceptance criteria:** Weigh-in queue loads with one bounded query (+ batched reconcile), no per-row 4-level join, no second full list fetch.

---

### TASK DB-5 — SQL aggregation + reduce per-request query load
**Severity: MEDIUM** — fixes DB6, DB7, DB8.

**Do this:**
1. Replace the public leaderboard JS counting with SQL `groupBy`/`COUNT` (DB7).
2. Replace the per-confirmation full-event `fight.count` with a cheaper signal (e.g. a maintained "remaining playable" counter, or scope the count by category) (DB8).
3. Reduce the per-request auth DB lookup cost (DB6): short-TTL in-memory/Redis cache of `validateAuthenticatedUser` keyed by userId (invalidate on suspend/role change), and collapse the `/me` double user fetch into one. (Coordinate with H2 — a Redis cache here also helps the multi-instance story.)

**Acceptance criteria:** Leaderboard and live-confirmation paths no longer scan all org/event fights; authenticated request DB load drops measurably under load test.

---

### TASK DB-6 — Add data-integrity constraints
**Severity: MEDIUM→LOW** — fixes DB9, DB12, DB13.

**Do this:**
1. Add `@@unique([registrationId, attemptNo])` to `WeighInAttempt` (pairs with BF-5).
2. Add CHECK constraints (via migration SQL) where cheap and safe: `maxWeightKgIncl > minWeightKgExcl`, event date ordering, `redAthleteId <> blueAthleteId`.
3. Decide on cascade strategy for Event/Organisation deletion: either add explicit `onDelete: Cascade`/`SetNull` to the Event-referencing relations (and test), or keep the manual sequence but add a test that proves it deletes every child table. Document the choice.

**Acceptance criteria:** Duplicate weigh-in attempts impossible at the DB level; degenerate weights/dates rejected; event deletion provably leaves no orphans.

> DB10 (migration drift / repair hack, backfilled dates) is the database facet of **TASK C1** — address it there; additionally, write a one-off data-fix to correct any events whose dates were backfilled to `NOW()` if such rows exist in prod.

---

---

## Part 6 — Performance Findings (verified)

Backend query inefficiency is covered in Part 5 (DB); this part focuses on the frontend and on the frontend→backend load amplifiers. Reference: React Query is configured well globally (`staleTime: 30s`, `retry: 1`, `refetchOnWindowFocus: false`), public events list is RSC, admin ops routes use thin server `page.tsx` + client child, and the realtime socket hook cleans up correctly.

### Findings table

| ID | Severity | Area | Summary | Location |
|----|----------|------|---------|----------|
| PF1 | HIGH | Re-render (CPU) | The live timer hook drives a `requestAnimationFrame` loop calling `setState` ~60×/sec, re-rendering the **entire** live page tree (admin live, mat TV, public live) while a fight runs — high CPU on the venue TV/scoreboard and admin console during scoring | `frontend/src/hooks/useFightTimerDisplay.ts:12-24`, consumed by `AdminLivePageClient.tsx`, `mat/[eventSlug]/[matName]/page.tsx:42-60`, `PublicLivePanel.tsx:79-88` |
| PF2 | HIGH | Excessive API / backend load | Public live polls **every 4s**, mat every 5s, coach live 8s, display 10s — **on top of** socket invalidation (redundant), and each poll hits the **unbounded** Phase-5 queries. With many public viewers during a final this multiplies DB load (viewers × queries/4s) | `usePublicApi.ts:76,85`, `PublicLivePanel.tsx:81`, `coach/.../live/page.tsx:48`, `display/.../DisplayPageClient.tsx:98` |
| PF3 | HIGH | Re-render / API | Search and weigh-in inputs fire **per keystroke**: registrations search does `router.replace` + refetch each character; weigh-in search updates the query key each character; weigh-in decision preview POSTs on every digit | `RegistrationsPageClient.tsx:134,182`, `useWeighInAthletes.ts:14`, `useWeighInDecisionPreview.ts:24-31` |
| PF4 | HIGH | Re-render / DOM | Bracket renderer has **no memoization and no virtualization**: the rounds→view mapper recomputes every render, and DOM slot height scales `2^roundIndex`, so large categories (e.g. 64-athlete) produce very tall DOM with heavy paint/scroll cost. There is **zero `React.memo`** in the whole frontend | `BracketViewerPanel.tsx:100`, `BracketDetailsPanel.tsx:102`, `BracketRoundColumn.tsx:50-61`, `components/bracket/*` |
| PF5 | HIGH | Bundle | `framer-motion` is statically imported in ~65 files; the home page **eagerly** imports heavy motion/scroll components (`CinematicHero`, `ScrollStory`, `StatsBand`, `HorizontalEvents`) — large client JS and slow LCP on the public/marketing surface | `app/[locale]/page.tsx:6-9`, ~65× `framer-motion` imports |
| PF6 | MEDIUM | Re-render | No `React.memo` at list leaves + inline object/lambda props (e.g. `actionConfig`, translation wrappers) passed to heavy children (`LiveFightCard`, `SessionCard`, `FightCard`) → cascade re-renders on any parent update | `AdminLivePageClient.tsx:203-245`, `SchedulePageClient.tsx:226-247`, `features/live/components/LiveFightCard.tsx` |
| PF7 | MEDIUM | Re-render / leak | `ToastProvider` recreates its context `value={{ toast }}` every render → all consumers re-render; per-toast `setTimeout` is not cleared on unmount | `components/ui/Toast.tsx:28,36` |
| PF8 | MEDIUM | Connections / bundle | Each `useRealtimeQuerySync` consumer opens its **own** socket.io connection and pulls `socket.io-client` into its chunk; no shared per-event socket manager | `hooks/useRealtimeQuerySync.ts:32` |
| PF9 | MEDIUM | Hydration / LCP | ~230 `'use client'` files; key public surfaces (event detail `events/[slug]`, marketing pages) are fully client-rendered when the static shell could be RSC — larger hydration cost and JS payload | `app/[locale]/events/[slug]/page.tsx:1`, `about/rules/news/contact` pages |
| PF10 | LOW | Excessive API | Home page runs two 30s polls **and** overrides the global `refetchOnWindowFocus:false` to refetch on focus | `HomePageSections.tsx:413-427` |
| PF-B1 | (cross-ref) | Backend | Backend latency under load is dominated by the **single combined event loop (H3)** + **unbounded queries (DB2)** + **per-request auth DB lookup (DB6)** — tracked in those tasks | — |

**Backend blocking check (clean):** bcrypt rounds = 10 (async), the 1s timer `@Interval` has an in-process mutex and does async work, exports use async `writeFile`, `repairSchema` is one-time at boot. No synchronous CPU hot-loops on the request path were found; the backend perf risk is query volume + single process, not blocking code.

---

## Tasks (Phase 6 — Performance)

### TASK PF-1 — Isolate and throttle the live timer
**Severity: HIGH** — fixes PF1.

**Do this:**
1. Move the `requestAnimationFrame` countdown into a **small leaf component** that holds its own `nowMs` state, so only the timer digits re-render — not the whole live page / bracket / queue.
2. Throttle updates to ~250–500ms (timers display whole seconds anyway); cancel the rAF/interval when the timer isn't `RUNNING`.

**Acceptance criteria:** During a running fight, only the timer element re-renders; the mat TV and admin live page no longer re-render at frame rate (verify with React Profiler).

---

### TASK PF-2 — Socket-first realtime; stop redundant polling
**Severity: HIGH** — fixes PF2, PF10; reduces backend load (pairs with DB-2).

**Do this:**
1. On views that already use `useRealtimeQuerySync` (public live, schedule, results, mat, display), **drop the `refetchInterval`** while the socket is connected; keep a long fallback interval (e.g. 30–60s) only when disconnected.
2. Remove the home page's `refetchOnWindowFocus` override and lengthen its polling.
3. Combine with DB-2 so the remaining (less frequent) live queries are also bounded/narrow.

**Acceptance criteria:** A connected live viewer drives ~0 polling requests (updates arrive via socket); polling resumes only on socket loss. Live-final DB load no longer scales linearly with viewer count × 4s.

---

### TASK PF-3 — Debounce search and preview inputs
**Severity: HIGH** — fixes PF3.

**Do this:** Debounce (250–300ms) the registrations search → URL/query update, the weigh-in athlete search query key, and the weigh-in decision-preview POST so they fire after typing stops, not per keystroke.

**Acceptance criteria:** Typing a search term issues one request after the pause, not one per character; no per-keystroke full-page refetch.

---

### TASK PF-4 — Memoize and virtualize hot lists + bracket
**Severity: HIGH/MEDIUM** — fixes PF4, PF6, and the results/weigh-in list size issues from Part 5.

**Do this:**
1. Wrap list leaves in `React.memo` with stable props: `LiveFightCard`, `SessionCard`, `FightCard`, bracket match/row components, registration/weigh-in rows.
2. `useMemo` the bracket rounds→view mappers (`BracketViewerPanel`, `BracketDetailsPanel`) and per-category layout computation.
3. Virtualize long lists (weigh-in queue, registrations table, results categories) and/or cap/lazy-render bracket rounds for large categories.
4. Hoist inline object/lambda props (`actionConfig`, translation wrappers) into `useMemo`/`useCallback`.

**Acceptance criteria:** Typing/polling on live, schedule, weigh-in, and results no longer re-renders unrelated rows; large brackets scroll smoothly.

---

### TASK PF-5 — Trim the client bundle (motion + RSC)
**Severity: HIGH/MEDIUM** — fixes PF5, PF9.

**Do this:**
1. Reduce eager `framer-motion`: use `LazyMotion`/dynamic imports for below-the-fold and marketing motion; keep only the hero critical-path animation eager.
2. Dynamic-import the heavy home sections (extend the existing dynamic-import pattern to `CinematicHero`/`ScrollStory`/`StatsBand`/`HorizontalEvents`).
3. Convert static public shells (event detail header, about/rules/news/contact content) to **server components**, keeping motion/interactivity as small client islands.

**Acceptance criteria:** Measurable drop in initial JS for `/` and public pages; LCP improves; interactivity preserved.

---

### TASK PF-6 — Small render/connection fixes
**Severity: MEDIUM/LOW** — fixes PF7, PF8.

**Do this:**
- `Toast`: `useMemo` the provider value; track and `clearTimeout` toast timers on unmount/dismiss.
- Realtime: introduce a shared socket manager keyed by `eventId` so multiple panels reuse one connection, and lazy-load `socket.io-client`.

**Acceptance criteria:** Toast consumers don't re-render on unrelated updates; one socket per event per client.

---

---

## Part 7 — Reliability Findings (verified)

The system has exactly **one external dependency: PostgreSQL (Neon)**. There is no external auth provider (JWT is in-process), no email provider, and no external cache (in-memory only). That simplicity is a strength — but it also means the DB is a total single point of failure, and the app does little to soften a DB blip.

### Dependency failure matrix

| Dependency | What breaks | User impact | Current recovery | Fallback today |
|------------|-------------|-------------|------------------|----------------|
| **PostgreSQL** | Everything — **every authenticated request** does a DB user-lookup (`AuthGuard`), plus all reads/writes, login/refresh, live scoring, the 1s timer automation, and public pages (`resolvePublicOrg` + queries) | **Total outage.** Live scoring halts mid-fight; mutations fail; even public/read pages error. The worst possible event-day failure | Known Prisma request errors (P1001/P1002/P1017) → clean **503 DATABASE_UNAVAILABLE**; socket clients auto-reconnect | **None** — no read replica, no cache layer, no offline score buffer, no retry/backoff |
| **Auth (JWT, in-process)** | Can't fail independently — signing/verifying is local | n/a (but auth *data* lives in the DB, so DB-down = auth-down) | n/a | n/a (positive: no external IdP) |
| **Email** | Nothing depends on it (none exists) | n/a — but also **no channel to notify users/admins during an incident** | n/a | n/a |
| **Cache** | In-memory only (`liveBoardCache`, 800ms) — can't be "unavailable"; lost on restart (rebuilds harmlessly) | Minimal | Rebuilds on next request | n/a (positive, but also no distributed cache to cushion the per-request auth lookup) |
| **Network (client↔server)** | Transient | Brief | socket.io auto-reconnect, React Query `retry:1`, API client 401→refresh, mat TV 30s poll fallback | Reasonable client resilience |
| **Network (server↔DB / PgBouncer)** | Connection drops / pool exhaustion under load | 500s/503s | None app-side (no retry/backoff/circuit breaker); known PgBouncer DDL-drop issue (see C1) | **None** |
| **Process restart / deploy** | In-flight requests dropped; connections not drained; timer auto-advance pauses while down | Brief disruption; **scores are NOT lost** (TimerState + results are DB-persisted — positive) | Process manager restarts it | **No graceful shutdown** (no SIGTERM/`enableShutdownHooks`) |

### Findings table

| ID | Severity | Summary | Location |
|----|----------|---------|----------|
| REL1 | HIGH | **Health check is a constant `{ ok: true }` with no DB ping.** A process whose DB is unreachable still reports healthy → load balancer keeps routing to it and uptime monitors stay green during an outage. No readiness vs liveness distinction | `backend/src/health.controller.ts:11-14` |
| REL2 | HIGH | **No graceful shutdown** — no `app.enableShutdownHooks()`, no SIGTERM/SIGINT handler in `main.ts` or `server.js`, no Prisma `$disconnect` on shutdown beyond `onModuleDestroy`. Deploys/restarts drop in-flight requests and abruptly close DB connections (risky mid-live-event) | `backend/src/main.ts:88-91`, `server.js` |
| REL3 | HIGH | **No DB resilience layer:** no retry/backoff or circuit breaker on transient DB errors; `PrismaClientInitializationError` (connect failure / **pool exhaustion**) is NOT a `KnownRequestError`, so it falls through to a generic **500** instead of 503; the per-request auth lookup has no cache, so a 2-second DB blip fails 100% of authenticated requests | `prisma.service.ts`, `global-exception.filter.ts:62,98-101`, `auth.guard.ts:40` |
| REL4 | MEDIUM | **Error boundaries only on `/admin`.** No `global-error.tsx`, no `not-found.tsx`, and no boundary for public pages, coach portal, login, or the **unattended mat/TV scoreboard** — an uncaught render error white-screens the most visible screen at the venue with no auto-recovery | only `frontend/src/app/[locale]/admin/error.tsx` exists |
| REL5 | MEDIUM | **No connection-pool sizing/timeout config** in the Prisma/`pg` setup; the single combined process shares one pool between Next SSR and the Nest API. Under load (or many concurrent events) pool exhaustion is likely and surfaces as REL3's unmapped 500s | `prisma.service.ts:13-20`, `backend/.env.example` (no `connection_limit`/`pool_timeout`) |
| REL6 | LOW | Timer auto-advance depends on a single process running `@Interval(1000)`; if the process is down, **timers silently stop advancing** (manual control still works on restart) and **nothing alerts** that automation stopped | `fight-timer.automation.service.ts` |

**Positives (verified):** known DB-unreachable errors map to a clean 503 with a helpful message; live scoring/timer state is **DB-persisted** so a restart does not lose scores; socket.io auto-reconnects; the client refreshes/retries on 401; no external auth/email/cache dependencies that can fail independently.

---

## Tasks (Phase 7 — Reliability)

### TASK REL-1 — Real readiness health check
**Severity: HIGH** — fixes REL1.

**Do this:**
1. Keep `GET /api/health` as a cheap **liveness** probe (process up).
2. Add `GET /api/ready` (**readiness**) that does a fast `SELECT 1` (with a short timeout) and returns 503 if the DB is unreachable.
3. Point the load balancer / orchestrator at readiness so a DB-disconnected instance is removed from rotation; document the probe config.

**Acceptance criteria:** When the DB is down, readiness returns 503 (and the LB stops routing) while liveness still confirms the process is up.

---

### TASK REL-2 — Graceful shutdown
**Severity: HIGH** — fixes REL2.

**Do this:**
1. Call `app.enableShutdownHooks()` and handle SIGTERM/SIGINT to stop accepting new connections, drain in-flight requests (short grace period), stop the timer interval, and `$disconnect` Prisma.
2. Do the same in `server.js` (close the HTTP server, await Nest `app.close()`).

**Acceptance criteria:** On SIGTERM, in-flight requests complete within the grace window and DB connections close cleanly; no abrupt connection resets during a deploy.

---

### TASK REL-3 — DB resilience (retry, pooling, error mapping, auth cushion)
**Severity: HIGH** — fixes REL3, REL5.

**Do this:**
1. Configure connection pool sizing + timeouts (`connection_limit`, `pool_timeout`, `connect_timeout`) appropriate for Neon/PgBouncer and the single process; document them.
2. Map `PrismaClientInitializationError` (and pool-timeout errors) to **503 DATABASE_UNAVAILABLE** in the exception filter (today it's a generic 500).
3. Add bounded retry/backoff for transient DB errors on idempotent reads (and a circuit breaker so the app fails fast instead of piling up connections during an outage).
4. Add a short-TTL cache for `validateAuthenticatedUser` (ties to DB-6) so a brief blip doesn't fail every authenticated request; invalidate on suspend/role change.

**Acceptance criteria:** A short DB blip degrades gracefully (503s + retries) rather than a flood of 500s; pool exhaustion is reported as 503; authenticated traffic survives a 1–2s blip via cache.

---

### TASK REL-4 — Frontend error boundaries (especially the scoreboard)
**Severity: MEDIUM** — fixes REL4.

**Do this:**
1. Add `app/global-error.tsx` (root) and `app/[locale]/error.tsx` + `not-found.tsx`.
2. Add dedicated error boundaries for the **mat/TV scoreboard**, the public event pages, the coach portal, and login — the scoreboard boundary should auto-retry/reload (it's unattended) rather than show a dev error.

**Acceptance criteria:** An uncaught render error on any surface shows a branded recovery UI; the mat TV self-recovers without a human touching it.

---

### TASK REL-5 — Incident visibility for stopped automation (LOW)
**Severity: LOW** — fixes REL6.

**Do this:** Emit a heartbeat/metric from the timer automation and alert if it stops while a `LIVE` event has running timers (ties to the observability work in Phase 12). Optionally surface "live updates paused" in the admin live UI when the socket/automation is down.

**Acceptance criteria:** Operators are notified (or can see) when timer automation stops during a live event.

---

---

## Part 8 — Production Readiness Findings (verified)

### Positives
- No committed secrets; secrets are env-based (verified Part 4). `import-neon-db.sh` has thoughtful safety guards (refuses pooled connection strings, requires `CONFIRM_RESET=yes`, requires a direct URL). Structured Pino logging with request IDs; configurable throttling via env; `NODE_ENV` correctly gates secure cookies / trust-proxy / bootstrap.

### Findings table

| ID | Severity | Area | Summary | Location |
|----|----------|------|---------|----------|
| PROD1 | HIGH | Env config | **No central env validation at startup.** Vars are checked ad-hoc at point of use; missing/misconfigured vars either crash at runtime or **silently fall back** (e.g. unset `FRONTEND_URL`/`CORS_ALLOWED_ORIGINS` → CORS defaults to **localhost** in prod; unset `PUBLIC_ORG_SLUG` → non-deterministic public org). No fail-fast boot check | `backend/src/config/runtime-env.ts`, `common/public-org.ts:16`, `auth/auth.service.ts:44` |
| PROD2 | HIGH | Env docs | **`.env.example` is incomplete** — missing `DIRECT_URL` (critical: used by migrations + `repairSchema`; omitting it routes DDL through the PgBouncer pooler → the drift in C1/DB10), `BOOTSTRAP_SECRET`, `COOKIE_DOMAIN`, `LOG_LEVEL`, and all `THROTTLE_*` vars. `JWT_SECRET="your-secret-key"` is a weak placeholder. Frontend example uses `API_URL`/`NEXT_PUBLIC_SOCKET_URL` while `CLAUDE.md` documents `NEXT_PUBLIC_API_URL` (naming drift) | `backend/.env.example`, `frontend/.env.local.example` |
| PROD3 | HIGH | Monitoring | **No error tracking, APM, or metrics** (no Sentry/Datadog/OpenTelemetry/Prometheus). Logs go to stdout via two separate Pino instances; no log shipping/aggregation, no correlation between request-logger and exception-filter logs, no alerting. During a live event, a failure is invisible unless someone is tailing stdout | `request-logger.middleware.ts`, `global-exception.filter.ts` (separate pino instances); no monitoring deps in `package.json` |
| PROD4 | HIGH | Deployment safety | **Custom `migrate-deploy.mjs` runs each migration file as a single `client.query(sql)` with no `BEGIN/COMMIT` wrapper** — a multi-statement migration that fails midway leaves **partially applied DDL** (marked `rolled_back_at` but the executed statements persist) = the exact drift that `repairSchema()` exists to patch. It also never verifies checksums of already-applied migrations (silent edits undetected) | `backend/scripts/migrate-deploy.mjs:64-89` |
| PROD5 | HIGH | Backups / DR | **No production backup or disaster-recovery strategy in the repo.** The scripts (`export-local-db.sh`, `import-neon-db.sh`) are for **seeding prod from local dev** (destructive `pg_restore --clean`), not for backing up prod. Prod DR relies entirely on Neon's platform PITR, which is undocumented and **untested** here. No restore runbook, no scheduled logical backups | `backend/scripts/*`, no DR docs |
| PROD6 | MEDIUM | CI/CD | **No CI pipeline** (no `.github/workflows`, no other CI config) — the Jest test suite, lint, type-check, and build are **not enforced** before deploy. Deploys are manual; nothing gates a broken commit | repo root (no CI) |
| PROD7 | MEDIUM | Reproducible build | **No Dockerfile** — production builds rely on an implicit platform buildpack; the combined `server.js` + `prestart:prod` (repair + custom migrate) startup is undocumented and not reproducible locally | repo root |
| PROD8 | LOW | Secrets lifecycle | No secret-rotation story (JWT_SECRET rotation would invalidate all sessions instantly — no key-id/dual-key support); `BOOTSTRAP_SECRET` undocumented (ties to BF21/SEC7) | `auth.service.ts:44` |

---

## Tasks (Phase 8 — Production Readiness)

### TASK PROD-1 — Validate env at startup + complete `.env.example`
**Severity: HIGH** — fixes PROD1, PROD2; also covers SEC10/SEC12/BF21 env aspects.

**Do this:**
1. Add a Zod (or similar) env schema validated **once at boot**; fail fast with a clear message listing missing/invalid vars. Required in production: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` (≥32 chars), `FRONTEND_URL`/`CORS_ALLOWED_ORIGINS`, `PUBLIC_ORG_SLUG`, `BOOTSTRAP_SECRET`.
2. Refuse to boot in production if CORS would fall back to localhost or `PUBLIC_ORG_SLUG` is unset (don't silently default).
3. Complete `backend/.env.example` (add `DIRECT_URL`, `BOOTSTRAP_SECRET`, `COOKIE_DOMAIN`, `LOG_LEVEL`, `THROTTLE_*`) with safe placeholders and comments; reconcile frontend var names with `CLAUDE.md`.

**Acceptance criteria:** Booting prod without a required/valid var fails immediately with a precise error; `.env.example` documents every var the code reads.

---

### TASK PROD-2 — Add error tracking + metrics + log shipping
**Severity: HIGH** — fixes PROD3 (and underpins Phase 12).

**Do this:**
1. Integrate an error tracker (e.g. Sentry) on **both** backend (capture unhandled + 5xx in the exception filter) and frontend (the new error boundaries from REL-4).
2. Use a single shared Pino logger; propagate `x-request-id` into all logs (request, exception, service) for correlation; ship logs to an aggregator.
3. Expose basic metrics (request rate/latency/error rate, DB pool usage, socket connections, timer-automation heartbeat) for a dashboard + alerts.

**Acceptance criteria:** A 5xx or unhandled error during an event produces an alert with request context; logs are queryable by request id; key metrics are visible on a dashboard.

---

### TASK PROD-3 — Make migration deployment safe and singular
**Severity: HIGH** — fixes PROD4; resolves the root cause of C1/DB10.

**Do this:**
1. Wrap each migration's SQL in a transaction (`BEGIN; … COMMIT;`) in `migrate-deploy.mjs` so a mid-file failure rolls back cleanly (no partial DDL). Only record success after commit.
2. Verify checksums of already-applied migrations and warn/fail on drift.
3. Once migrations are transactional and reliable, **remove the runtime `repairSchema()` and `repair-schema.mjs`** (the C1 work) — converge on one mechanism: transactional `migrate-deploy` at `prestart:prod`.

**Acceptance criteria:** A failing migration leaves the DB unchanged (not partially applied); applied-migration checksums are verified; no runtime DDL repair remains.

---

### TASK PROD-4 — Define and test backup / disaster recovery
**Severity: HIGH** — fixes PROD5.

**Do this:**
1. Document Neon PITR settings (retention window) and confirm they meet the recovery objective.
2. Add scheduled **logical backups** (`pg_dump` to durable off-platform storage) independent of Neon, with retention.
3. Write a restore runbook and **perform a restore drill** into a scratch DB to verify backups are usable and the RTO/RPO are acceptable. Also include the `/tmp` export-file durability fix (BF28).

**Acceptance criteria:** A documented, tested restore path exists with known RTO/RPO; backups run on a schedule and have been proven restorable.

---

### TASK PROD-5 — Add CI + reproducible build
**Severity: MEDIUM** — fixes PROD6, PROD7.

**Do this:**
1. Add CI (e.g. GitHub Actions) that runs lint, type-check, the Jest suite, and a build on every PR; block merge on failure. Optionally add a migration "is the schema reproducible from migrations on an empty DB?" check (guards C1/DB10 from regressing).
2. Add a `Dockerfile` (or document the buildpack config) for a reproducible production image; document the `prestart:prod` startup sequence.

**Acceptance criteria:** PRs are gated by green tests/lint/types/build; production image builds reproducibly from the repo.

---

### TASK PROD-6 — Secret lifecycle (LOW)
**Severity: LOW** — fixes PROD8.

**Do this:** Document secret rotation; consider supporting a JWT key-id / dual-secret window so `JWT_SECRET` can be rotated without instantly invalidating every session. Document `BOOTSTRAP_SECRET` (ties to BF-11/SEC-5).

**Acceptance criteria:** A documented rotation procedure exists; JWT rotation doesn't force a hard global logout (or the tradeoff is explicitly accepted).

---

## Execution notes for Claude Code

- **Order:** **BF-1 + SEC-1 first (active data-access bugs)** → C1 → SEC-2 → BF-2 → BF-3 → BF-4 → BF-5 → BF-6 → BF-7 (also covers SEC14) → BF-8 → BF-10 → SEC-3 → SEC-4 → H1 → H2 → H3 → BF-9 → SEC-5 → M1 → M2 → M3 → BF-11 → BF-12 → L1 → L3 → L2.
- Group rationale: BF-1 (coach-club leak) and SEC-1 (cross-tenant schedule IDOR) are the live access-control bugs — ship first. C1 is the deployment landmine. SEC-2 (real input validation) underpins many race/500 fixes. The BF-2…BF-10 live-ops correctness fixes bite on event day. Security headers/CSRF (SEC-3/4), architecture (H/M/L), and UX cleanup follow.
- **Phase 5 DB tasks** slot by impact: **DB-1 (indexes)** is cheap and high-value — do it early alongside SEC/C1. **DB-2/DB-3/DB-4** (pagination, draw/schedule transaction de-risking, weigh-in query) are event-day performance fixes — pair them with the related BF tasks (DB-4 with BF-5; DB-3 with BF-3/BF-4). **DB-5/DB-6** follow with the M/L architecture batch. DB-1 is a recommended addition to the "do early" group: **BF-1 + SEC-1 + DB-1**.
- **Phase 6 perf tasks** are event-day experience fixes: **PF-2 (socket-first, stop polling)** pairs directly with **DB-2** (it removes the load that hits the unbounded queries) — do them together. **PF-1 (timer isolation)** and **PF-3 (debounce)** are quick, high-impact UI wins. **PF-4/PF-5/PF-6** (memoize/virtualize, bundle, small fixes) ride with the M/L batch.
- **Phase 7 reliability tasks** are pre-launch ops hardening: **REL-1 (readiness probe)** and **REL-2 (graceful shutdown)** are small and should land before any production deploy. **REL-3 (DB resilience)** overlaps DB-6/H2 (the auth cache helps all three) — do it with the DB batch. **REL-4 (error boundaries)** is a quick safety net for the unattended scoreboard. **REL-5** ties to Phase 12 observability.
- **Phase 8 production-readiness tasks** are launch gates: **PROD-1 (env validation)** and **PROD-3 (safe migrations)** are prerequisites — PROD-3 finally resolves the C1/DB10 root cause, so do **C1 + PROD-3 together**. **PROD-2 (error tracking/metrics)** and **PROD-4 (backup/DR)** must exist before go-live (you can't operate a live event blind or without a restore path). **PROD-5 (CI + Dockerfile)** and **PROD-6 (secret rotation)** are fast-follows.
- **Never** start the dev server or run `npm run build` / `tsc` unless asked.
- **Do not** migrate or mutate any live database without explicit instruction; produce migration files + a written plan instead.
- Keep the API error contract `{ code, message }` stable (M1).
- Add new i18n keys to **both** `en.json` and `ka.json`.
- Preserve the verified-healthy parts: no new circular deps, keep logic in `*.logic.ts`, keep `organisationId` scoping.
- After each task, state the acceptance criteria met and the files changed.
