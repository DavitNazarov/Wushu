# Backend — Geo Wushu Competition System

NestJS 11 + Prisma 7 (PostgreSQL) API for the Georgian Wushu Federation
tournament system: athlete registration, weigh-in, bracket drawing, fight
scheduling, live scoring, results, and exports.

This is the `backend` workspace of an npm-workspaces monorepo. Most commands are
run from the **repository root** (see the root [README](../README.md)); the
scripts below are for working inside this package directly.

## Prerequisites

- Node 22 LTS (`.nvmrc` at the repo root)
- A PostgreSQL instance. From the repo root: `docker compose up -d db`
- Env: `cp .env.example .env` (key vars validated at boot by
  `src/config/validate-env.ts` — `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET ≥32`,
  `PUBLIC_ORG_SLUG`, …)

## Common commands

```bash
npm run dev                   # nest start --watch (port 4000)
npm run build                 # prisma generate + nest build
npm test                      # unit tests (jest, *.spec.ts colocated in src/)
npm run test:e2e              # DB-backed e2e (supertest; needs a live DATABASE_URL)
npm run lint                  # eslint --fix
npm run lint:check            # eslint (non-mutating, used by CI)

npm run prisma:migrate        # create + apply a dev migration
npm run prisma:migrate:deploy # apply migrations (production / fresh DB)
npm run prisma:seed           # seed category templates (+ mock data when SEED_MOCK_DATA=1)
npm run prisma:studio         # Prisma Studio
```

## Architecture

Feature-per-folder NestJS modules (`auth`, `events`, `registrations`, `weighin`,
`draw`, `schedule`, `fights`, `results`, `public`, `exports`, …). `src/main.ts`
is both the standalone Nest entry and the `createApp` factory reused by the
combined production server (`../server.js`) and the e2e tests.

- Architecture, conventions, and domain model: root [CLAUDE.md](../CLAUDE.md)
- Deployment runbook: [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)
- Auth/roles, routing, public pages, i18n: [`docs/`](../docs)

## Tests

- Unit specs are colocated with source (`src/**/*.spec.ts`) and cover the
  high-risk pure logic (lifecycle, draw readiness, round-robin, timer flow,
  scheduling order, fight visibility, winner propagation, eligibility/age).
- DB-backed e2e specs live under `test/` and `test/e2e/` and self-skip without
  `DATABASE_URL`. CI runs them against a Postgres service container.
