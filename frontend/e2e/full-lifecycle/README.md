# Full-lifecycle E2E suite

A single **stateful pipeline** that walks the whole Geo Wushu platform end to end:

```
data setup → event → registration → weigh-in → draw → publish → schedule → live → results → PDF export
```

It lives in `frontend/e2e/full-lifecycle/` and runs under its own Playwright
config, `frontend/playwright.lifecycle.config.ts` (it does **not** touch the
existing `playwright.config.ts` / `playwright.fullcheck.config.ts` suites).

## Hybrid coverage contract

- **Every distinct UI page/function is exercised through the real browser at
  least once**, and every edge-case branch (duplicate docId, reject, withdraw,
  overweight re-attempt, one-hour reweigh, move-up, winner propagation) gets its
  own assertion.
- **Bulk volume** — reaching **400 athletes**, weighing the long tail, resolving
  every fight — is seeded through the **real API** using Playwright's `request`
  context with the admin cookie, _not_ UI clicks. This keeps the suite feasible.
- State that later phases depend on (the athlete pool, every weigh-in/fight
  outcome, lifecycle preconditions) is built via the API and verified from the
  DB, which is the source of truth. Where a browser interaction is preview- or
  timing-gated in dev mode, the action is still **performed in the browser** and
  its **outcome is asserted via the API**.

## Preconditions (you run these — the suite does not)

1. **Stack up**, pointed at a **LOCAL / disposable** database (never prod):
   ```bash
   docker compose up -d db        # Postgres
   npm run dev                    # frontend :3000 + backend :4000
   ```
   There is **no `webServer` block** — the suite assumes the stack is already
   running. Override the target with `E2E_BASE_URL` (use `localhost`, **not**
   `127.0.0.1` — Next 16's dev HMR WebSocket rejects `127.0.0.1` and silently
   breaks hydration).

2. **DB migrated + seeded** with the mock data (the admin login + a Georgian
   club the bilingual-athlete step needs):
   ```bash
   cd backend
   npx prisma migrate reset       # drops, re-migrates
   SEED_MOCK_DATA=1 npm run prisma:seed
   ```
   The suite logs in as the seed admin `admin@geowushu.ge` / `Password123!`.

3. **Disable rate limiting for the run.** Reaching 400 athletes fires ~1,500
   API calls; the default throttler (120 req/min + a short 10 req/10s bucket)
   would crawl. Start the backend with the documented load-test escape hatch:
   ```bash
   THROTTLE_DISABLED=1 npm run dev:backend     # (and dev:frontend separately)
   ```
   The seeder still tolerates throttling (it retries `429` with `Retry-After`
   backoff and re-logs-in on `401`), so the run will _complete_ either way — it
   is just much slower when the limiter is on.

## Running

```bash
cd frontend
npx playwright test --config=playwright.lifecycle.config.ts
# headed / debugging:
npx playwright test --config=playwright.lifecycle.config.ts --headed
npx playwright show-report e2e/.report/lifecycle
```

The `lf-setup` project logs in once via the API and saves cookies to
`e2e/.auth/lifecycle-admin.json`; the `lifecycle` project reuses them. The whole
pipeline runs **serially in one worker** — each phase is its own `test()` so a
failure localises, and module-scoped state carries ids forward.

## Idempotent re-runs (without a reset)

Everything generated is namespaced with a per-run id (`Date.now()` in base36):

- athlete docIds → `E2E<runId><seq>` (international athletes) and a unique
  11-digit number per run for the Georgian national-id athlete (`/^\d{11}$/`);
- all country / region / club / event / coach names and the event slug embed the
  run id.

So re-running **without** a `prisma migrate reset` never collides on
`@@unique([organisationId, documentId])` (→ `DOCUMENT_ID_ALREADY_EXISTS`) or on
the unique name constraints. A reset between runs is still recommended for a
clean slate and a faster run.

## What each phase covers

| Phase | UI (real browser) | API (bulk / verification) |
|---|---|---|
| **P1 registry** | create country, region, club, GE + international coach, a bilingual athlete (EN+KA, 11-digit id) and an international athlete (EN, passport); duplicate-docId → `DOCUMENT_ID_ALREADY_EXISTS` inline | — |
| **P2 event** | open + render the create-event wizard; assert the created event shows **REG_OPEN** in the admin header | authoritative event create + category selection (adults men/women, ~13 classes) + `weighInResultsPublic` |
| **P3 registration** | approve / reject / withdraw a registration on the registrations page, asserting each status chip | bulk to **400** athletes + registrations; outcomes (most APPROVED, some REJECTED/WITHDRAWN, a few SUBMITTED); category-FK invariant |
| **P4 lock → weigh-in** | advance `LOCKED` → `WEIGHIN` (stage badges); weigh-in station renders the queue | roster excludes non-approved (SUBMITTED/REJECTED/WITHDRAWN) |
| **P5 weigh-in** | a **clean PASS** recorded on the station | overweight re-attempt, one-hour → `resolveOneHour`, move-up (FK change asserted), no-show excluded; bulk PASS the tail; advance `WEIGH_IN_COMPLETED` |
| **P6 draw** | brackets page renders | run draw; assert **all three formats** (DIRECT_FINAL / ROUND_ROBIN / SINGLE_ELIMINATION); no-show excluded; advance `DRAWN` |
| **P7 publish + schedule** | advance `PUBLISHED`; schedule page renders mats/fights | mats + session + auto-schedule |
| **P8 live** | go `LIVE`; drive the current fight on the live board to a result | resolve every remaining fight (normal LIVE_RUN path); winner-propagation + "every winner is a real corner" invariants; auto-`COMPLETED` |
| **P9 results + export** | download the results-protocol **PDF** from the export drawer; exercise the real login form once | medal-table integrity; schedule + weigh-in PDFs |

### Why some edge branches are asserted via the API

The weigh-in **station** is exercised in the browser via the clean-PASS path
(select → type weight → record). The other decision branches (overweight
re-attempt, one-hour resolution, move-up) flow through a **preview-gated** action
bar / override dialog whose enablement depends on a server round-trip; in dev
that is timing-sensitive. To keep the suite deterministic those branches are
driven via the API and each asserted from the DB (e.g. move-up asserts the final
`eventWeightCategoryId` changed while the registered pick did not). The helpers
(`helpers/ui.ts`) already contain Radix-select / modal drivers, so promoting any
of these to a full-UI interaction later is a small change.

## Layout

```
e2e/full-lifecycle/
  README.md                 ← this file
  auth.setup.ts             ← admin login via API → storageState
  full-lifecycle.spec.ts    ← the serial pipeline (P1–P9)
  helpers/
    run.ts                  ← per-run id + name/docId namespacing
    auth.ts                 ← admin creds + API/form login
    seed.ts                 ← Seeder (401 re-login + 429 backoff) + bulk methods + mapPool
    lifecycle.ts            ← UI stage-advance + header-scoped badge assertions
    ui.ts                   ← settle, modal-field fillers, native/Radix select drivers
    pdf.ts                  ← download capture + %PDF- validation
```

Artifacts (report, traces) go to the gitignored `e2e/.report/lifecycle` and
`e2e/.test-results` — never a non-ignored dir (Tailwind v4 scans test artifacts
and can corrupt `globals.css`).
