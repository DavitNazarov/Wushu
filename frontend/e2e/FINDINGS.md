# E2E Test Findings — Geo Wushu

Generated from the Playwright suite under `frontend/e2e/` run against a local
dev stack (frontend :3000 + backend :4000 + Postgres) seeded with
`SEED_MOCK_DATA=1`. **95 tests, all green.**

Run with:

```bash
docker compose up -d db
npm run loadtest:seed          # SEED_MOCK_DATA=1 seed (admin@geowushu.ge / Password123!)
npm run dev                    # leave running
cd frontend && npx playwright test
```

---

## Bugs found

### 1. Tailwind v4 corrupts `globals.css` → site-wide HTTP 500  — FIXED here
**Severity: High (blocked all testing); dev/CI-only**

Tailwind v4's automatic content scanner reads every file under `frontend/`
(pruned only by `.gitignore`). Playwright writes failure artifacts to
`frontend/test-results/**/error-context.md`, which embed serialized RSC HTML
containing flight data (`self.__next_f.push([1,"…`). That directory was **not**
gitignored (the existing `e2e/.gitignore` only covered `e2e/test-results/`, one
level down). Tailwind ingested the flight data as a class candidate, emitted
invalid CSS (`globals.css:3423 Unexpected token`), and every page importing
`globals.css` returned 500.

Time-dependent: clean on first compile, self-corrupting once the first test
failure wrote an artifact — which is why the first suite run cascaded into 30
failures from this one cause.

**Fix applied:** `playwright.config.ts` `outputDir → ./e2e/.test-results`
(gitignored), plus `/test-results/` + `/playwright-report/` + `/e2e/.test-results/`
in `frontend/.gitignore`. Verified: 0 CSS parse failures across full parallel runs.
*Not a production bug* — `next build` compiles CSS from source only, before any
runtime artifact exists — but a real footgun that breaks local/CI test runs.

### 2. Athlete profile API drops Georgian (KA) name fields  — APP BUG (confirmed)
**Severity: Medium (user-facing i18n defect)**

`backend/src/athletes/athlete-profile.service.ts` builds **both** the admin
(`GET /api/athletes/:id`) and public (`GET /api/public/athletes/:id`) profile
responses with only `firstName`/`lastName` and a hardcoded English
`fullName: \`${firstName} ${lastName}\`` (lines ~57–59 and ~113–115). It never
selects/returns `firstNameKa` / `lastNameKa` (no `fullNameKa` either).

Result: `/ka/athletes/[id]` renders the athlete's name in **English** even when
Georgian names exist in the DB. Confirmed end-to-end: profile response keys are
`[id, firstName, lastName, fullName, sex, dateOfBirth, club, coaches]` — no KA.
Violates CLAUDE.md's "Prisma Select Rule".

Encoded as `test.fail()` in `athletes.admin.spec.ts` ("profile endpoint SHOULD
expose KA name fields") — it flips to a passing regression guard once the
service includes the KA fields.

### 3. Mock seed crashes on re-run (FK violation)  — SEED BUG
**Severity: Low (dev tooling)**

`backend/prisma/seed-results.ts:193` deletes `Fight` rows before their
`TimerState` rows. `TimerState.fight` has no `onDelete` cascade
(`schema.prisma:834`), so re-seeding over an event that already has completed
fights throws `P2003 (TimerState_fightId_fkey)`. A *first* seed on a clean DB
works (the mock seed creates no fights); only re-seeds crash. The app's own
re-draw path is correct — `draw.service.ts:251,443` delete `timerState` before
`fight`. **Fix:** mirror that order in the seed, or add the cascade.

---

### 4. Mid-event "auto-generate" collides newly-ready finals with completed fights — FIXED
**Severity: Medium-High (corrupts the live running order during a competition)**

**Fix applied** (`backend/src/schedule/schedule.service.ts` `generateSchedule`):
new `orderInSession` now starts after the highest slot held by retained
(completed/in-progress) fights in each session, and those fights also consume
session capacity. Repro now yields `[semi1=1, semi2=2, final=3]` — no collision.
Guarded by `schedule-regen.admin.spec.ts` (no longer `test.fail`). Schedule unit
tests still green. Original analysis below.

The admin "auto-generate" button calls `POST /api/schedule/generate`
(`frontend/.../admin/schedule/hooks/useScheduleMutations.ts:59`). Mid-event this
corrupts `orderInSession`.

Repro (`schedule-regen.admin.spec.ts`, marked `test.fail()`): LIVE 4-fighter
single-elim. Initially only the two semis are schedulable, so the session is
`{semi1: ord 1, semi2: ord 2}` and the final is unscheduled (its athletes are
"Winner of …"). Finish both semis → the final becomes ready. Click auto-generate:

```
before: semi1 CONFIRMED ord=1 | semi2 CONFIRMED ord=2 | final QUEUED (unscheduled)
after:  semi1 CONFIRMED ord=1 | semi2 CONFIRMED ord=2 | final QUEUED ord=1   ← collision
        session orderInSession = [1, 2, 1]  (duplicate) — final sits ON TOP of the played semis
```

Root cause: `generateSchedule` (`backend/src/schedule/schedule.service.ts`
~947-965) renumbers `orderInSession` from `i+1` (starting at 1) for the
reschedulable set, but the BF-4 guard correctly leaves COMPLETED/IN_PROGRESS
fights holding their old `orderInSession`. It never offsets the new numbers past
the slots already occupied by those fights, so the newly-ready final lands at
`orderInSession=1`, ahead of the already-played semifinals. The running order is
corrupted exactly as reported ("regenerates the running schedule with finals").

Fix: when bucketing, start `orderInSession` after the max existing
`orderInSession` of the completed/in-progress fights still in that session (or
renumber the whole session while preserving the played fights' relative order).
`/schedule/auto` (mat/orderInMat path) does NOT have this defect — it only
writes the schedulable set and leaves completed fights' placement intact.

(Earlier note, now superseded: when *all* fights are still pending, re-running
generate is a harmless no-op — that was a red herring; the real defect is the
mid-event collision above.)

## Observations (lower confidence / data-shape dependent)

### 4. Admin vs public results paths diverge
For the seeded completed event, `/api/public/results?eventSlug=…` returns 12
categories + a 7-row medal table, but admin `/api/results/summary?eventId=…`
returns empty `categories`/`medalTable`. The admin path keys off
`EventWeightCategory` rows (null on the shortcut-seeded event) while the public
path computes from `categoryCode`. On a normally-drawn event both populate, but
the two surfaces computing results differently is a latent robustness gap.
Logged (not asserted) by `invariants.admin.spec.ts`.

### 5. Public athlete profile 404s for a rostered athlete
`/api/public/athletes/:id` returns 404 for a seeded athlete who **is** listed in
that club's public roster (`/api/public/clubs/:id`). The two public surfaces
disagree on whether the athlete is publicly visible.

### 6. Dev-only `performance.measure` throw on redirect pages
The redirect-only Legacy admin shims (`admin/live`, `admin/brackets`,
`admin/rulesets`) trigger a Next.js 16 / React 19 dev-mode
`performance.measure(<componentName>)` whose start time replays as negative
across the redirect → "cannot have a negative time stamp". Dev-only, harmless
(the redirect still works), absent from production builds. Added to the
console-ignore list in `e2e/helpers/console.ts`.

---

## Verified correct (no bug — behaviour confirmed by passing tests)

- **Full competition pipeline** (`pipeline.admin.spec.ts`) — a fresh event driven
  through the REAL API end to end: create → categories → register 4 athletes →
  lock → weigh-in (auto-advances to WEIGH_IN_COMPLETED) → draw (4-fighter
  single-elim) → mat/session/schedule → PUBLISHED → LIVE → run every fight →
  results. Not the shortcut seed.
- **Live fight state machine** — every fight run one-by-one; per fight: start +
  timer START then PAUSE/RESUME ×3; winner finishes on points; winner propagates
  into the next round's fight; the final resolves. `pausedMs` accumulates
  correctly across multiple pauses (278→564→851ms), state flips RUNNING↔PAUSED,
  `startedAt`/`pausedAt` toggle correctly. Confirming the last fight
  auto-completes the event (LIVE → COMPLETED).
- **Round-by-round scoring (best of 3)** (`rounds.admin.spec.ts`, opt-in
  `E2E_SLOW=1` — ~4min of real 60s inter-round rests) — full ROUND→REST→next-ROUND
  machine: a 2-0 sweep (decided in 2), a 2-1 split that goes to round 3, and a
  2-0 final. Round-win tallies accrue correctly (R1-B0→R2-B0; R1-B1 split→R2-B1),
  the 1s cron auto-advances each REST to the next round, decisive 2-0 ends early,
  winners propagate, and the event auto-completes. No bug.
- **Coach authorization** — every admin-only endpoint returns 403; foreign
  `clubId` on create is forced to the coach's own club; cross-club mutation is
  refused (403); browser admin routes redirect to no-access/login.
- **Fight results integrity** — every confirmed fight's winner is one of the two
  corners, loser is the other corner, winner ≠ loser; winners propagate into the
  next fight's slot.
- **Medal tables** — club totals equal gold+silver+bronze; rank→medal mapping is
  correct; `TWO_BRONZES` policy yields two distinct bronze placements; no
  duplicate athlete on a podium.
- **PDF exports** — schedule + weigh-in protocols render valid PDFs; the results
  protocol correctly refuses without a `?templateId` (`SIGNATURE_TEMPLATE_REQUIRED`)
  and renders once a signature template is supplied.
- **Event lifecycle / draw readiness** — create → `REG_OPEN`; invalid skip →
  `INVALID_EVENT_TRANSITION`; unknown target state → 400 (no 500); draw on an
  unprepared event → `EVENT_NOT_LOCKED`; duplicate slug → 422; category
  selection round-trips.
- **i18n** — `/ka` renders Georgian event + club names (and not English); `html
  lang` matches locale; the live feed carries `redDisplayNameKa` /
  `blueDisplayNameKa`.
- **Athletes** — create persists bilingual fields; duplicate `documentId` →
  `DOCUMENT_ID_ALREADY_EXISTS` (409); invalid payloads → `VALIDATION_ERROR`
  (400); upsert updates in place; list is row-capped.
- **Auth** — valid login reaches the role app; bad credentials stay on /login;
  anonymous /admin + /coach redirect to login; logout ends the session;
  anonymous live pages make no socket handshake.

---

## Suite layout

| File | Project | Focus |
|---|---|---|
| `auth.setup.ts` | setup | Logs in per role, saves storageState |
| `public.spec.ts` | public | Public routes, SEO/OG, sitemap, anon-no-socket |
| `auth.spec.ts` | public | Login / authz / logout |
| `performance.spec.ts` | public | Navigation-timing budgets |
| `i18n.public.spec.ts` | public | EN/KA rendering + display-name KA contract |
| `admin.spec.ts` | admin | All admin routes smoke + data loads |
| `athletes.admin.spec.ts` | admin | Athlete CRUD, uniqueness, validation, KA bug |
| `invariants.admin.spec.ts` | admin | Fight/medal results integrity |
| `lifecycle.admin.spec.ts` | admin | Event lifecycle, draw readiness, categories |
| `pipeline.admin.spec.ts` | admin | Full reg→live→results pipeline + timer + schedule-during-live |
| `schedule-regen.admin.spec.ts` | admin | Mid-event regenerate must not collide finals with played fights (fix guard) |
| `rounds.admin.spec.ts` | admin | Round-by-round best-of-3 scoring (opt-in `E2E_SLOW=1`) |
| `exports.admin.spec.ts` | admin | Puppeteer PDFs |
| `coach.spec.ts` | coach | Coach portal smoke + scoping |
| `authz.coach.spec.ts` | coach | Vertical + horizontal privilege matrix |
