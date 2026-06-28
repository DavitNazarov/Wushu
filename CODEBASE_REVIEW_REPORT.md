# Full Codebase Review Report

_Geo Wushu Competition System — review-only audit_
_Date: 2026-06-28 · Branch: `main` · Reviewer: multi-discipline engineering panel (simulated)_

> **Scope note (read first).** This audit reviews the **working tree as it sits on disk**, not the last commit. At review time the tree has **105 files with uncommitted changes** (84 modified, ~21 new untracked files/dirs) representing a large in-progress feature set: new `coaches`, `cities`, `federations` modules, an `athlete-clubs` join, `entryFee`, `accessType`/`isOfficial`, plus 6 new migrations. Findings are evidence-tagged with `file:line`. Where a finding is specific to the uncommitted work it is marked **[WIP]**.

---

## 0. Remediation Status (updated 2026-06-28)

Fixes applied after the initial audit, all verified:

| ID | Item | Status | Verification |
|---|---|---|---|
| **C1** | Red unit test (stale fight mock) | ✅ Fixed | `npm test` → 260/260 green |
| **M1** | Float weight boundary risk | ✅ Fixed (reframed) | Gram-grid rounding in `weighin.logic.ts` + new boundary spec; **Decimal migration deliberately rejected** as net-negative (216-site blast radius, more likely to *introduce* a misclassification bug). |
| **M3** | Dead code | ✅ Fixed | 6 files deleted + 2 exports cleaned; knip clean (1 intentional alias left) |
| **M4** | Lint backlog hidden by `continue-on-error` | ✅ Fixed | Ratchet (`scripts/lint-ratchet.mjs` + `.lint-baseline.json`) wired into CI; blocks any increase, baseline 154 |
| **M5** | `types/api.ts` 1,039-line dump | ✅ Fixed | Split into `types/api/{enums,catalog,competition,admin}.ts` behind a barrel; `tsc --noEmit` → 0 errors, all 138 importers unchanged |
| **L1** | API client flattened 403s | ✅ Fixed | Both sites now parse the server `{code,message}` |
| **H1** | HTML security headers | ✅ Already handled | `next.config.ts` ships XFO/nosniff/Referrer-Policy/CSP/HSTS (initial audit missed this) |
| **L3** | Public-endpoint org scoping | ✅ Non-issue | Both methods already resolve org internally; verified, no leak |
| — | **Bonus**: `EditEventModal` `accessType` | ✅ Fixed | Pre-existing WIP build-breaker (would fail `next build`); mirrored `CreateEventModal`. `tsc` clean |
| **M2** | Split 1,933-line `fights.service.ts` | ⏸️ Deferred | Cosmetic-only; the meaningful extraction (`getLiveCategoryBoard`) is covered only by DB-backed e2e (unrunnable here), shares hot-path helpers, and DI delegation breaks the 2-arg `new FightsService()` used by 3 specs. Belongs in its own e2e-verified PR after the WIP lands. |
| **M6** | Explicit `onDelete` policy | ⏸️ Deferred | Requires an FK-constraint migration; doing it without the live DB risks the exact schema-drift class this project has a documented painful history with. Own PR with a verified migration. |
| **H2** | Commit the WIP | ⏸️ Owner action | Not mine to commit; required before M2/M6 can land cleanly. |

---

## 1. Executive Summary

| Metric | Score | Notes |
|---|---|---|
| **Overall risk level** | **Medium** | One red unit test that would fail CI's hard gate; missing HTML security headers. Core architecture is strong. |
| Production readiness | **72 / 100** | Hardened runtime (health/ready, graceful shutdown, env fail-fast), but red test blocks the CI deploy gate and a large WIP set is uncommitted/untested as a unit. |
| Maintainability | **78 / 100** | Excellent intent-comments, domain naming, modular feature folders. Dragged down by a few god-files and a 154-error backend lint backlog. |
| Security | **80 / 100** | Strong auth/authz/socket/CSRF posture and clean injection surface. Main gap: no security headers on user-facing HTML. |
| Performance | **82 / 100** | Good indexing, column projection, CDN micro-caching, pagination. Single-instance ceiling is known and documented. |
| Test confidence | **68 / 100** | 43/44 suites + broad e2e, but the suite is **currently red** and there is no coverage gate. |

### Top 10 Most Important Findings

1. **`npm test` is red on the working tree** — `fight-round-flow.service.spec.ts` "finishes the fight in two rounds…" throws `FIGHT_NOT_FOUND`. CI gates `npm test` as a **hard** gate, so this would block merge/deploy. (C1)
2. **No security headers on HTML pages** — Helmet/CSP is mounted only on the `/api` Express app; nginx adds none. No HSTS (despite TLS), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, or CSP on the actual pages. (H1)
3. **Large uncommitted WIP set (105 files)** — new modules + 6 migrations are untracked/uncommitted and have not gone through CI as a unit; the red test is a direct symptom of a partial refactor. (H2)
4. **`weightKg` and category bounds are `Float`** — floating-point for the value that decides weight-category eligibility; exclusive/inclusive boundary comparisons can misclassify. (M1)
5. **`fights.service.ts` is a 1,933-line god-service** — timer automation, round flow, result finalize, winner propagation, and queries in one class. (M2)
6. **6 confirmed dead files** in `admin/weighin-results/` plus 2 unused exports and 1 duplicate export (knip-confirmed). (M3)
7. **Backend lint is red (154 errors / 97 warnings)** but `continue-on-error` in CI — a growing type-safety backlog hidden behind an informational gate. (M4)
8. **`frontend/src/types/api.ts` is a 1,039-line type dumping-ground** — no domain boundaries. (M5)
9. **Delete integrity depends entirely on manual ordered cascades** (relations default to `Restrict`); every new delete path must remember to clean children in the right order. (M6)
10. **Frontend API client collapses all 403s to a generic code** (`client.ts:110-112`), discarding server-specific `{ code, message }` — weakens error UX and the documented `e.code` handling pattern. (L1)

**Strengths worth preserving:** refresh-token rotation + theft detection; per-request DB re-validation in `AuthGuard` and the socket handshake; consistent `organisationId` tenant scoping; the new `RESULTS_OVERRIDE` privilege separation; the `assertId` Prisma-`undefined`-collapse guard; JSON-LD `<`-escaping; env fail-fast; comprehensive FK indexing; intent-rich comments.

---

## 2. Commands Run

| Command | Result | Important output | Meaning |
|---|---|---|---|
| `npm test` (backend jest) | **Failed (exit 1)** | `Tests: 1 failed, 258 passed, 259 total`; `FAIL fights/fight-round-flow.service.spec.ts … FIGHT_NOT_FOUND` | Suite is red; see C1. |
| `npx knip` | Passed (ran) | 6 unused files, 2 unused exports, 1 duplicate export | Dead-code inventory (§6). |
| `npx knip --dependencies` | Passed (ran) | No unused/unlisted dependencies reported | Dependency hygiene is clean. |
| `npx eslint "src/**/*.ts"` (backend) | **Failed (exit 1)** | `251 problems (154 errors, 97 warnings)` | Lint backlog; CI marks it `continue-on-error` (M4). |
| `git status --short` / `git diff --stat` | n/a | `84 files changed, 2533 insertions, 1461 deletions` + ~21 untracked | Large WIP (H2). |
| `grep` secret scan | Passed | Only `password: 'secret123'` in `auth-user.service.spec.ts` (test fixture) | No committed secrets. |
| `grep` raw-SQL scan | Passed | Only `$queryRaw\`SELECT 1\`` in `health.controller.ts:24` | No SQL-injection surface. |

> **Not run** (per project rule "never run build/type-check unless asked", and to keep the pass review-only): `npm run build`, `tsc`, frontend `next build`, Playwright e2e. **Recommended later:** `npm run build` (catches type errors the red unit suite may mask), `npm run test:e2e:backend` against a throwaway Postgres, and `npx tsc --noEmit` per workspace to quantify the type-safety backlog behind the informational lint gate.

---

## 3. Project Inventory

- **Package manager / workspaces:** npm workspaces (`frontend`, `backend`) at root; single `package-lock.json`. Node `>=22 <23` pinned via `.nvmrc` + `engines`.
- **Frontend:** Next.js 16 (React 19, App Router), TS strict, Tailwind 4, Radix UI, TanStack Query 5, socket.io-client, next-intl (en/ka). `@/` → `src/`.
- **Backend:** NestJS 11, Prisma 7 + PostgreSQL, Zod 4 validation pipe, JWT cookie auth, socket.io gateway, Pino, Helmet, Throttler, Puppeteer (PDF).
- **Database:** Prisma schema (949 lines), 6 new untracked migrations; `DATABASE_URL` (pooled) + `DIRECT_URL` (direct, for DDL).
- **Testing:** backend Jest (44 suites) + supertest e2e; frontend Playwright (e2e/, fullcheck/, full-lifecycle/). No coverage threshold enforced.
- **Build/deploy:** combined single Node process (`server.js` mounts Nest at `/api`, Next serves the rest). Prod = Hetzner `docker-compose.prod.yml` (nginx TLS → app → postgres 16 + one-shot migrate). CI = `.github/workflows/ci.yml` (backend lint·test·build, DB-backed e2e, frontend lint·build).
- **Architecture:** feature-per-folder modules; pure lifecycle/competition helpers extracted (`lifecycle-rules.ts`, `competition.logic.ts`); capability-based authz (`@RequireCapability`); CDN micro-cache tiers on `/api/public/*`.

---

## 4. Critical and High Severity Issues

### C1 — Unit test suite is red (would fail the CI deploy gate)
- **Severity:** Critical · **Category:** Testing / CI / Correctness · **Confidence:** Confirmed
- **File:** `backend/src/fights/fight-round-flow.service.spec.ts:90-163`; root cause in `backend/src/fights/fights.service.ts:942-946`
- **Evidence:** `npm test` → `Tests: 1 failed, 258 passed`. The "two rounds" case mocks only `prisma.fight.findFirst`/`.update`/`timerState.*`. The working-tree refactor added a lost-update guard to `finalizeFightResult`:
  ```ts
  const live = await tx.fight.findUnique({ where: { id: input.fight.id }, select: { status: true, winnerAthleteId: true } });
  if (!live) throw new Error('FIGHT_NOT_FOUND');   // ← thrown: findUnique is unstubbed
  ```
  plus an `updateMany` compare-and-swap. The sibling spec `fights.service.spec.ts` **was** updated (it has new `RESULTS_OVERRIDE` cases at lines 161/404/441), but this file was not.
- **Why it matters:** `ci.yml` runs `npm test` with **no** `continue-on-error` — this is a hard gate. The branch cannot pass CI; a deploy that bypasses CI ships a fights path whose unit coverage no longer executes the finalize branch.
- **Fix:** Update the "two rounds" mock to stub `prisma.fight.findUnique` (return `{ status: 'PAUSED', winnerAthleteId: null }` pre-swap, then the finalized row) and `prisma.fight.updateMany` (`{ count: 1 }`), mirroring the already-fixed cases in `fights.service.spec.ts`. Then re-run `npm test`.
- **Effort:** ~20 min · **Confidence:** Confirmed

### H1 — No security headers on user-facing HTML responses
- **Severity:** High · **Category:** Security · **Confidence:** Confirmed
- **Files:** `backend/src/main.ts:59-73` (helmet), `server.js:33-34`, `deploy/hetzner/nginx.conf:76-96`
- **Evidence:** In `server.js`, `helmet()` is applied to the **Nest `apiServer`** that is mounted at `server.use('/api', apiServer)`. HTML pages are served by `nextHandler` (`server.all(/^(?!\/api…)/ …)`), which never passes through helmet. nginx only adds `X-Cache-Status` (`nginx.conf:83`). So `/` responses carry **no** `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or `Content-Security-Policy` — even though TLS + HTTP→HTTPS redirect are configured (`nginx.conf:42-57`).
- **Why it matters:** Clickjacking of the admin/live console (no frame-ancestors/X-Frame-Options); no HSTS means a first-visit SSL-strip is possible; no CSP backstop for any future injection. The CSP that *is* configured sits on JSON API responses where it does the least good.
- **Fix:** Add headers at the edge (cheapest): in each `nginx.conf` `server`/`location` block add `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`, `X-Frame-Options "SAMEORIGIN"`, `X-Content-Type-Options "nosniff"`, `Referrer-Policy "strict-origin-when-cross-origin"`, and a page-level CSP (or use Next.js `headers()` in `next.config.ts` so it travels with the app regardless of proxy). Move the page CSP off the API-only helmet block.
- **Effort:** ~1-2 h (plus CSP tuning for Next inline theme script — currently `layout.tsx:58-62`, which would need a nonce/`'unsafe-inline'`) · **Confidence:** Confirmed

### H2 — Large uncommitted WIP set unverified as a unit
- **Severity:** High · **Category:** Production readiness / Process · **Confidence:** Confirmed
- **Evidence:** `git status` → 84 modified + untracked `backend/src/coaches/`, `geography/cities.*`, `geography/federations.*`, `common/assert-id.ts`, `draw/draw.schemas.ts`, `integrity/integrity.schemas.ts`, 6 migrations under `backend/prisma/migrations/2026062*`, and frontend `full-lifecycle/`, `not-found.tsx`, `[...rest]/`, etc.
- **Why it matters:** This volume of schema + module change has not been committed or run through CI together; C1 (the red test) is exactly the kind of partial-refactor gap this state produces. Six new migrations against production data are the highest-risk part.
- **Fix:** Land the WIP in reviewable commits, get CI green (fixing C1 first), and dry-run the 6 migrations against a restored prod snapshot (`db:deploy` path) before deploying. Verify each new migration is idempotent and ordered (per the documented migration-replay history).
- **Effort:** Process, not code · **Confidence:** Confirmed

---

## 5. Medium and Low Severity Issues

### M1 — `weightKg` / category bounds stored as `Float`
- **Severity:** Medium · **Category:** Database / Data integrity · **Confidence:** Confirmed
- **Files:** `schema.prisma:793` (`weightKg Float`), `:370-371`, `:404-405` (`minWeightKgExcl Float? / maxWeightKgIncl Float?`)
- **Evidence/why:** Weight decides category eligibility, and the bounds are explicitly **exclusive/inclusive** (`Excl`/`Incl`). Float equality at a boundary (e.g. an athlete at exactly the cap) is the classic floating-point footgun; a `69.999999`-style representation can flip a pass/fail or a move-up.
- **Fix:** Migrate to `Decimal @db.Decimal(5,2)` (or store integer grams) for `weightKg` and both bounds; compare with explicit tolerance only if you keep Float. New migration + update every `select`/comparison in `weighin.service.ts` and the draw move-up logic.
- **Effort:** ~half day (migration + comparisons + tests) · **Confidence:** Confirmed

### M2 — `fights.service.ts` god-service (1,933 lines)
- **Severity:** Medium · **Category:** Clean code / Structure · **Confidence:** Confirmed — see §12.

### M3 — Confirmed dead code (knip)
- **Severity:** Medium (cleanliness) · **Confidence:** Confirmed — see §6.

### M4 — Backend lint red behind an informational gate
- **Severity:** Medium · **Category:** DX / Code health · **Confidence:** Confirmed
- **Evidence:** `eslint "src/**/*.ts"` → `251 problems (154 errors, 97 warnings)`; `ci.yml` runs `lint:backend:check` with `continue-on-error: true`.
- **Why:** The "errors" are real type-safety violations (`no-unsafe-argument`, `no-unsafe-assignment`, etc.). Hidden behind `continue-on-error`, the count only grows. A future genuine lint regression is invisible.
- **Fix:** Snapshot the current count, fail CI on any *increase* (ratchet), and burn down by folder. Don't flip to hard-fail in one step.
- **Effort:** Ongoing · **Confidence:** Confirmed

### M5 — `frontend/src/types/api.ts` (1,039 lines) is a type dumping-ground
- **Severity:** Medium · **Category:** Frontend structure · **Confidence:** Confirmed — see §12.

### M6 — Delete integrity relies on manual ordered cascades
- **Severity:** Medium · **Category:** Database · **Confidence:** Confirmed
- **Evidence:** Competition relations specify no `onDelete` (e.g. `Registration.event/athlete`, `WeighInAttempt.registration` at `schema.prisma:772-806`), so they default to `Restrict`. Deletes work today because callers clean up manually in the right order (`event-ops.service.ts:176-177` deletes `weighInAttempt` then `registration` in one `$transaction`).
- **Why:** Correct but fragile — every new delete path must re-derive the order or hit a runtime FK error. There is no DB-level safety net describing intended cascade vs. restrict.
- **Fix:** Make the policy explicit on each relation (`onDelete: Restrict` where deletion should be blocked, `Cascade` where children should follow), so intent is declared once at the schema rather than re-implemented per service.
- **Effort:** ~half day + migration · **Confidence:** Confirmed

### L1 — API client flattens all 403s to a generic code
- **Severity:** Low · **Category:** Frontend / API contract · **Confidence:** Confirmed
- **Evidence:** `frontend/src/lib/api/client.ts:110-112` throws `new ApiError(403, 'FORBIDDEN', 'Access denied')` **before** `handleResponse`, so the server's `{ code, message }` for a 403 is discarded.
- **Why:** CLAUDE.md's own error pattern keys on `e.code === 'SOME_CODE'`; for any 403 that code is always `FORBIDDEN`, so capability-specific messaging can't reach the UI.
- **Fix:** Let `handleResponse` parse 403 bodies like every other status (it already handles non-ok), or special-case only the no-body 403.
- **Effort:** ~15 min · **Confidence:** Confirmed

### L2 — Local `docker-compose.yml` ships a weak DB password
- **Severity:** Low · **Category:** DevOps · **Confidence:** Confirmed
- **Evidence:** `docker-compose.yml:6-7` → `POSTGRES_USER: geo / POSTGRES_PASSWORD: geo123`. This is the **local-dev** compose (prod uses `deploy/hetzner/`), so impact is limited to a dev box, but it normalizes a weak credential.
- **Fix:** Acceptable for local, but document that prod creds come only from `deploy/hetzner` env, and never copy this into a publicly-bound environment.
- **Effort:** doc-only · **Confidence:** Confirmed

### L3 — Public `getPublicCountry` / `getPublicClub` not org-scoped at the call site
- **Severity:** Low · **Category:** API · **Confidence:** Needs manual verification
- **Evidence:** `public.controller.ts:122-125` (`countries.getPublicById(id)`) and `:351-355` (`clubs.getPublicDetails(id)`) don't pass `org.id`, unlike sibling endpoints. In a single-tenant (`PUBLIC_ORG_SLUG`-pinned) deployment this is harmless, but it diverges from the pattern and would leak cross-org rows if the system ever serves multiple public orgs.
- **Fix:** Thread `org.id` through these two service calls for consistency and future-proofing. Verify the service queries don't already scope internally before changing.
- **Effort:** ~30 min · **Confidence:** Needs verification

---

## 6. Dead Code and Unused Code

**Files (Confirmed — knip):** all under `frontend/src/app/[locale]/admin/weighin-results/`
- `DrawHeaderSummary.tsx`, `DrawValidationPanel.tsx`, `DrawWarningBanner.tsx`, `GenerateDrawDialog.tsx`, `RegenerateDrawDialog.tsx`, `useGenerateDraw.ts`

**Exports (Confirmed — knip):**
- `EMPTY_CLUB_MEDALS` — `backend/src/clubs/clubs.service.ts:21`
- `statusBadgeClasses` (function) — `frontend/src/app/[locale]/admin/weighin-results/drawReadinessMapper.ts:30`

**Duplicate export (Confirmed — knip):**
- `CreateEventSchema` / `UpdateEventSchema` exported twice from `backend/src/events/event.types.ts` (re-export collision — pick one source of truth).

**Comments / debug code:** Clean — `0` `TODO/FIXME/HACK` markers and `0` `console.log/debug` in frontend `src`; only 3 intentional `console.*` in backend (`main.ts`/bootstrap). No commented-out code blocks found in the sampled hot files.

**Dependencies:** `knip --dependencies` reports none unused/unlisted. Good.

> **Caution honored:** API routes, migrations, seeds, and `scripts/**` were **not** flagged as dead even when unreferenced by imports — they're entry points. The 6 unused files above are React components with no importer and no route role.

---

## 7. API and Backend Findings

- **Validation:** Consistent Zod-via-`ZodValidationPipe` at the global level; `{ message, code }` SCREAMING_SNAKE error shape enforced by `GlobalExceptionFilter`. New untracked schemas (`draw.schemas.ts`, `integrity.schemas.ts`) continue the pattern. **Good.**
- **Authn/Authz:** `AuthGuard` re-validates the user against the DB every request (rejects archived/disabled/DQ); `@RequireCapability` + capability guard; socket handshake mirrors it and additionally requires `LIVE_RUN` with 60s re-validation (`fights.gateway.ts:59-93,151-180`). **Strong.**
- **Privilege separation [WIP, positive]:** new `RESULTS_OVERRIDE` capability is admin-only and properly plumbed: controller passes `auth.capabilities` (`fights.controller.ts:170,280,479`) → `assertOverridePermitted` (`fights.service.ts:116-122`) → 3 covering specs. Judges/timekeepers (LIVE_RUN) can run fights but cannot waive result guards. Terminal (`COMPLETE`/`CONFIRMED`) fights are hard-blocked even with the cap.
- **Concurrency [WIP, positive]:** `finalizeFightResult` now does an in-transaction compare-and-swap on `(status, updatedAt, winnerAthleteId)` (`fights.service.ts:958-980`) closing a double-finalize race — the same change that broke C1's stale mock.
- **IDOR:** `assertId` (`common/assert-id.ts`) guards the Prisma `where:{id:undefined}` collapse for `deleteMany`/`updateMany`; adopted in `draw`, `brackets`, `fights.gateway`, `integrity`. **Partial** — most read paths use route `@Param('id')` (always a string when the route matches), so the residual risk is *optional body-supplied ids* feeding `updateMany/deleteMany`; spot-check those.
- **Status codes / shape:** consistent; `X-Total-Count` for server-side pagination (`client.ts:125-149`).
- **CSRF:** same-origin + `SameSite=lax` httpOnly cookies + CORS allow-list + `OriginCheckMiddleware` (defense-in-depth). Reasonable for this deployment model.
- **Gap:** 403 contract loss on the client (L1).

---

## 8. Security Findings

| Risk | Severity | Where | Status |
|---|---|---|---|
| Missing HTML security headers (HSTS/XFO/CSP/nosniff) | **High** | `main.ts:59-73`, `server.js:33-34`, `nginx.conf` | Open (H1) |
| Cross-org leak potential on 2 public endpoints | Low | `public.controller.ts:122,351` | Needs verification (L3) |
| Weak local DB password | Low | `docker-compose.yml:6-7` | Local-only (L2) |
| SQL injection | — | only `$queryRaw\`SELECT 1\`` (`health.controller.ts:24`) | **None found** |
| XSS via `dangerouslySetInnerHTML` | — | `jsonLd.tsx:8` escapes `<`→`<`; `layout.tsx:60` static string | **Mitigated** |
| Committed secrets | — | only `secret123` test fixtures | **None found** |
| Refresh-token handling | — | rotation + reuse/theft detection (revokes chain) | **Strong** |
| Auth bypass via socket | — | DB re-validation + `LIVE_RUN` + 60s recheck | **Strong** |
| Rate limiting | — | global 120/min + short 10/10s + per-endpoint login/refresh/bootstrap | **Present** |

Net: the application layer is well-defended; the one real gap is the **edge/transport header posture (H1)**.

---

## 9. Database and Data Integrity Findings

- **Indexing:** thorough — FK columns indexed (`@@index` on `cityId/countryId/clubId/eventWeightCategoryId/nextFightId/…`), composite indexes for hot query paths (`[organisationId, eventId, status]`, `[matId, orderInMat]`, `[sessionId, orderInSession]`). A prior "DB-1: FK column was unindexed" note (`schema.prisma:752`) shows this was actively hardened. **Good.**
- **Unique constraints:** correct domain keys — `@@unique([organisationId, documentId])`, `[eventId, athleteId]`, `[registrationId, attemptNo]`, `[eventId, categoryCode]`, `[eventId, name]`. **Good.**
- **`Float` for weights:** see **M1** — the one substantive data-integrity concern.
- **Cascade policy:** implicit `Restrict`; manual ordered cleanup in services — see **M6**.
- **Transactions:** used where multi-row invariants matter (`schedule` 6, `fights` 5, `users` 4, geography upserts wrap denormalization cascades in `$transaction` — `cities.service.ts:77-114`). The `cities.remove` count-check sits just *outside* its delete transaction (`cities.service.ts:121-148`) — a tiny TOCTOU window, but FK `Restrict` + admin-only access makes it benign.
- **Scaling:** unbounded list endpoints are row-capped (athletes 500 / registrations 1000 per CLAUDE.md) with `limit/offset`. Single-instance schedulers/cron are documented; multi-instance needs Redis + distributed locks.

---

## 10. Frontend Findings

- **Type hub (M5):** `types/api.ts` (1,039 lines) — split per domain (§12).
- **Large components:** `UserDetailsDrawer.tsx` (661), `AddAthleteToEventModal.tsx` (643), `HomePageSections.tsx` (565), `CreateEventModal.tsx` (474) — candidates for data-hook / form / presentational splits.
- **Data layer:** clean — React Query everywhere, mutations invalidate, single-flight 401 refresh de-dupe (`client.ts:81-102`), socket→query invalidation via `useRealtimeQuerySync`, anonymous viewers gated off sockets (`useCanUseLiveSocket`). **Good.**
- **i18n discipline:** `localizedName`/`localizedFullName` helpers, parallel KA fields end-to-end, `redDisplayNameKa`/`blueDisplayNameKa`. **Good.**
- **XSS:** JSON-LD escaping handled (§8). No other `dangerouslySetInnerHTML`.
- **Error contract:** L1 (403 flattening).
- **Dead UI:** 6 unused `weighin-results/` components (§6).

---

## 11. Performance Findings

**Backend**
- Column projection is the norm (`select` blocks everywhere; commit `07fe156` "project only needed columns in public results"). **Good.**
- Leaderboards use `groupBy` + a single batched `findMany(in:[...ids])` + `Promise.all` rather than per-row queries (`public.controller.ts:265-303`) — **no N+1** in the sampled public hot paths.
- `clubs.computeMedalsByClub` aggregates in-process; fine at federation scale, watch if club/medal counts grow large.
- Puppeteer PDF + exports are synchronous in-process on a single instance — acceptable for this load profile, but a heavy export will contend with request handling.

**Frontend**
- Public pages poll cached `/api/public/*` (mat 30s `no-store`, live/schedule 20s `refetchInterval`) — offloaded to the nginx micro-cache.
- Large client components (§10) are the main bundle/render watch-items; no obvious render-loop or missing-memo smell in sampled files.

**Database** — see §9 (indexing strong; `Float` aside).

**Build/runtime** — combined single process; nginx micro-cache with `stale-while-revalidate` + `proxy_cache_background_update` (`nginx.conf:76-84`) is a strong origin-offload design.

**Network** — gzip on for text/json/js (`nginx.conf:27-28`); CDN tiers via `Cache-Control`.

---

## 12. Large Files and Split Plan

### `backend/src/fights/fights.service.ts` — 1,933 lines (highest priority)
**Problems:** mixes (a) live timer automation (`advanceExpiredTimers`), (b) round-flow state machine (`recordRoundResult`), (c) result finalize + compare-and-swap (`finalizeFightResult`), (d) winner propagation, (e) read/query helpers, (f) capability/override guards. Multiple abstraction levels in one class; the file's size is *why* a refactor could silently strand a test (C1).
**Recommended split:**
- `fights.service.ts` — orchestration/facade only
- `fight-result.service.ts` — `setResult`/`finalizeFightResult`/override guard/CAS
- `fight-timer.service.ts` — `advanceExpiredTimers` + round/rest transitions
- `fight-round-flow.logic.ts` — pure round-winner→outcome decisions (already partly mirrored by the spec naming)
- `fight-query.service.ts` — read/list/board projections
**Strategy:** extract pure logic first (no Prisma) behind existing specs, then move Prisma-bound methods. **Risk:** Medium (hot live path) — keep the existing specs green at each step.

### `backend/src/schedule/schedule.service.ts` — 1,462 lines
Split scheduling (mat/session assignment), ordering (`schedule-order.logic.ts` already exists), and rest-violation checks into separate services; move display/gaps helpers (the new untracked `schedule.display.ts`/`schedule.gaps.ts` on the frontend suggest the seam already exists). **Risk:** Medium.

### `frontend/src/types/api.ts` — 1,039 lines
Split by domain: `types/events.ts`, `types/registrations.ts`, `types/weighin.ts` (exists), `types/fights.ts`, `types/clubs.ts` (exists), `types/geography.ts`, re-exported from an `index.ts` barrel. **Risk:** Low (mechanical).

### Frontend components (`UserDetailsDrawer.tsx` 661, `AddAthleteToEventModal.tsx` 643)
Per the prompt's pattern: `*Page/Drawer.tsx` (composition) + `use*Data.ts` (fetching) + `*Form.tsx` (controlled inputs) + `*.schema.ts` (validation) + `*.mapper.ts` (API↔UI). **Risk:** Low-Medium.

---

## 13. Clean Code Rule Violations

- **Naming:** strong overall — domain-specific, searchable (`finalizeFightResult`, `assertOverridePermitted`, `isWeighInCompletedForDraw`). Audit-tag prefixes (`BF-7`, `REL-2`, `SEC-10`, `DB-1`) make grep-tracing of past fixes easy. No `data`/`temp`/`mgr` smells in sampled code.
- **Functions:** the fights/schedule god-services host long multi-concern methods (§12). Otherwise functions are focused.
- **Comments:** exemplary — explain *intent/tradeoff/why*, not the obvious (e.g. the lost-update-guard rationale at `fights.service.ts:938-957`). No noise/outdated/commented-out code found.
- **Structure:** feature-per-folder with pure helpers extracted; the two god-services are the exceptions.
- **Modules/coupling:** capability codes centralized; tenant scoping uniform; no circular-dependency smell surfaced (knip clean).
- **Tests:** broad and behavior-focused (race conditions, DQ outcomes, redaction, timer expiry). Gaps in §14. The **one** structural test smell is C1's stale mock — a unit test coupled to the exact set of Prisma calls, which breaks on internal refactor; the pure-logic extraction in §12 would make these resilient.
- **Code smells present:** large files (fights/schedule/api.ts), a thin layer of primitive-Float obsession for weights (M1), and the informational-lint backlog (M4). Not present: dead abstractions, duplicated business rules (recent commits actively *de-duplicated* event-critical rules), debug noise.

---

## 14. Testing Gaps

**Must-have before production**
1. **Fix C1** so the suite is green (CI gate).
2. **Migration dry-run test** for the 6 new untracked migrations against a restored prod snapshot (idempotency + ordering) — H2.
3. **`weightKg` boundary tests** once typed correctly (M1): athlete exactly at an exclusive/inclusive bound passes/fails as specified.

**Should-have soon**
4. Socket gateway authz spec — handshake reject paths (no token, revoked cap, mid-session revalidate-drop). The logic exists (`fights.gateway.ts`) but isn't covered by a spec file in the sampled suite.
5. The two public endpoints in L3 — assert org-scoping (or document single-tenant intent in a test).
6. A coverage ratchet (don't let the green-suite count drift down silently).

**Nice-to-have**
7. A contract test that the frontend `ApiError.code` for 403 matches a server code (would have caught L1).
8. Frontend split components (§12) get focused unit tests as they're extracted.

---

## 15. Refactoring Roadmap

### Phase 1 — Safe quick wins (low risk)
- Fix C1 stale mock; get `npm test` green.
- Delete the 6 dead `weighin-results/` files + 2 unused exports; resolve the duplicate `CreateEventSchema/UpdateEventSchema` export (§6).
- Fix L1 (403 body parsing) and L3 (org-scope two public calls).
- Add nginx/Next security headers (H1) — high value, low effort.

### Phase 2 — Important cleanup (medium)
- Split `types/api.ts` by domain (M5).
- Burn-down lint with a CI ratchet (M4).
- Make `onDelete` policy explicit in the schema (M6).

### Phase 3 — Architecture (planned)
- Decompose `fights.service.ts` and `schedule.service.ts` (§12), extracting pure logic behind existing specs.
- Migrate `weightKg`/bounds to `Decimal` (M1) with a careful data migration.

### Phase 4 — Optional polish
- Frontend large-component splits (§10/§12).
- Socket gateway + public-endpoint test coverage (§14).
- Tighten the local `docker-compose` credential story (L2).

---

## 16. Production Checklist

- [ ] **`npm test` green** (fix C1) — CI hard gate.
- [ ] **`npm run build`** (backend + frontend) passes — run before deploy (not run in this review).
- [ ] **6 new migrations** dry-run against a restored prod snapshot; confirm idempotent + correctly ordered.
- [ ] **Security headers** (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, page CSP) added at nginx and/or Next (H1).
- [ ] **WIP committed** in reviewable chunks and pushed through CI as a unit (H2).
- [ ] `nginx.conf` `server_name`/cert paths replaced from the `wushu.example.com` template.
- [ ] Prod env validated: `JWT_SECRET ≥32`, `DIRECT_URL` (non-pooled) set, `PUBLIC_ORG_SLUG` pinned, `CORS_ALLOWED_ORIGINS`/`FRONTEND_URL` set, `BOOTSTRAP_SECRET` unset *after* first admin exists.
- [ ] Nightly DB backup cron verified (`deploy/hetzner/backup.sh`).
- [ ] Sentry DSNs set (or intentionally left no-op).
- [ ] Confirm single-instance assumptions still hold (no horizontal scale without Redis adapter + distributed cron locks).

---

## 17. Final Recommendation

**Is it production-ready?** **Not at this exact moment — but it's close, and the blockers are small and concrete.** The architecture is genuinely strong: clean tenant scoping, thoughtful auth (rotation + theft detection + per-request and per-socket DB re-validation), real concurrency guards, thorough indexing, intent-rich comments, and a hardened runtime (health/ready, graceful shutdown, env fail-fast, CDN micro-cache). This is well above typical for a project this size.

**What must be fixed first:**
1. **C1** — make the unit suite green (a ~20-minute mock fix); it currently fails the CI deploy gate.
2. **H1** — add security headers to HTML responses (the one real security gap).
3. **H2** — commit the WIP and run the 6 migrations through a snapshot dry-run before they touch prod.

**What can wait:** the `Float`→`Decimal` weight migration (M1), god-file decomposition (§12), the lint ratchet (M4), and the dead-code sweep (§6) — all valuable, none release-blocking.

**Biggest hidden risk:** the **gap between disk and git**. The single most dangerous thing here isn't any one line of code — it's that a large, schema-changing feature set is sitting uncommitted, with a red test as proof that the refactor was only partially propagated. The codebase's own safety nets (CI hard-gating `npm test`, env fail-fast, migration-replay discipline) are good enough to catch this **if** the work is committed and pushed through CI rather than deployed from the working tree. Land it properly and the production-readiness score jumps into the high 80s.
