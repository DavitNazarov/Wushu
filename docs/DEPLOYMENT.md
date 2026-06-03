# Deployment Guide — Geo Wushu Competition System

This guide takes a developer with **zero prior context** from a fresh clone to a
live production deployment on **Render**, and documents the future migration path
to **Hetzner** (inactive today — see the last section).

- **Current production target:** Render (native Node runtime).
- **Architecture:** one combined Node process (`server.js`). Next.js serves the
  frontend and mounts the NestJS API under `/api` on a single port. There is **no**
  separate frontend/backend deployment.
- **Database:** PostgreSQL 16 (Render-managed, or external Neon).
- **Required external services:** PostgreSQL only. Everything else (email,
  exports, queues) is in-process or local.

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | **22 LTS** | Pinned in `.nvmrc` and root `engines`. Do **not** use Node 25. |
| npm | 10+ | Ships with Node 22. Repo uses npm **workspaces** (no pnpm/yarn). |
| PostgreSQL | 16 | Render-managed, Neon, or local Docker for dev. |
| Git | any | Render deploys from a connected Git repo. |

---

## 2. Environment Variables

Validated once at boot in `backend/src/config/validate-env.ts`. In **production a
missing/invalid required var fails the process immediately**; in dev it only warns.

### Required in production

| Variable | Example | Purpose |
|---|---|---|
| `NODE_ENV` | `production` | Enables built Next.js, secure cookies, `trust proxy`. **Must** be `production`. |
| `DATABASE_URL` | `postgresql://u:p@host/db` | Runtime (pooled) connection. |
| `DIRECT_URL` | `postgresql://u:p@host/db` | Direct (non-pooled) connection for migrations/DDL. On Neon this **must** be the non-pooled URL. On Render Postgres it equals `DATABASE_URL`. |
| `JWT_SECRET` | 48-char random | Signs auth cookies. **≥32 chars** or boot fails. Generate: `openssl rand -base64 48`. |
| `PUBLIC_ORG_SLUG` | `georgian-wushu` | Slug of the `Organisation` shown on public pages. Must match a seeded org. |
| `FRONTEND_URL` **or** `CORS_ALLOWED_ORIGINS` | `https://geo-wushu.onrender.com` | CORS origin allow-list. At least one is required or boot fails. For the combined deploy this is the service's own URL. `CORS_ALLOWED_ORIGINS` may be comma-separated. |

### Optional

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | Render injects this automatically — do not hardcode. |
| `BOOTSTRAP_SECRET` | _(unset)_ | Guards `POST /api/auth/bootstrap-admin`. Set once to create the first admin, then clear to disable. |
| `COOKIE_SAME_SITE` | `lax` | `lax` for single-origin (correct here). Only use `none` (with HTTPS) for a true cross-site split. |
| `COOKIE_DOMAIN` | _(host-only)_ | Set to e.g. `.example.com` to share cookies across subdomains. |
| `LOG_LEVEL` | `info` | Pino level: `fatal`…`trace`. |
| `THROTTLE_*` | sane defaults | Rate-limit tuning (see `backend/.env.example`). Leave unset in prod. **Never** set `THROTTLE_DISABLED=1` in prod (load-test only). |
| `NEXT_PUBLIC_SOCKET_URL` | _(same origin)_ | Frontend socket target. Leave unset for the combined deploy (uses `window.location.origin`). |
| `NEXT_PUBLIC_SENTRY_DSN` | _(unset)_ | Enables optional frontend Sentry. Complete no-op when unset. |
| `SENTRY_AUTH_TOKEN` | _(unset)_ | Source-map upload during `next build` only. |

> **Note:** The frontend calls the API with **relative** `/api/*` paths and
> connects sockets to the **same origin**, so a combined deploy needs **no**
> `NEXT_PUBLIC_API_URL`. That variable is not used anywhere in the code.

---

## 3. Deploy to Render (Blueprint — recommended)

The repo ships a `render.yaml` Blueprint that provisions the web service **and** a
Postgres 16 database.

1. **Push** this repo to GitHub/GitLab.
2. Render Dashboard → **New → Blueprint** → select the repo. Render reads
   `render.yaml` and shows the web service + database it will create.
3. Click **Apply**. Render provisions:
   - `geo-wushu-db` (Postgres 16, Frankfurt)
   - `geo-wushu` web service, with build/pre-deploy/start wired up and
     `DATABASE_URL`/`DIRECT_URL`/`JWT_SECRET` set automatically.
4. The first build runs `npm ci && npm run build`, then the **pre-deploy**
   `npm run db:deploy` applies migrations to the empty DB.
5. Fill in the remaining `sync: false` env vars in the dashboard:
   - `PUBLIC_ORG_SLUG` — the org slug you will seed (step 6).
   - `FRONTEND_URL` **and** `CORS_ALLOWED_ORIGINS` — set both to the service URL
     Render assigned, e.g. `https://geo-wushu.onrender.com`.
   - `BOOTSTRAP_SECRET` — a random string (only needed to create the first admin).
6. **Manual Deploy → Deploy latest commit** to apply the env changes.

### Build / Pre-Deploy / Start commands (reference)

| Phase | Command | What it does |
|---|---|---|
| Build | `npm ci && npm run build` | Installs all workspace deps; `prisma generate` + `nest build` (backend) then `next build` (frontend). |
| Pre-Deploy | `npm run db:deploy` | `repair-schema.mjs` (idempotent `IF NOT EXISTS` DDL) then `migrate-deploy.mjs` (lock-free, transactional, applies pending migrations). |
| Start | `npm start` | `node server.js` — the combined Next/Nest process. |
| Health check | `GET /api/health` | Liveness, constant `{ ok: true }`, no DB hit. |

### Deploy to Render (manual, no Blueprint)

If not using the Blueprint, create a **Web Service** from the repo with:
- Runtime: **Node** · Region: **Frankfurt** · Branch: **main**
- Build Command: `npm ci && npm run build`
- Pre-Deploy Command: `npm run db:deploy`
- Start Command: `npm start`
- Health Check Path: `/api/health`
- **Instances: 1** (see §7 — do not scale horizontally)
- Add all env vars from §2. Create a Render Postgres and copy its **Internal**
  connection string into both `DATABASE_URL` and `DIRECT_URL`.

---

## 4. Seed data & first admin

After the first successful deploy (DB schema is live but empty):

1. **Seed the organisation + base data.** From a machine with `DATABASE_URL`/
   `DIRECT_URL` pointed at the production DB:
   ```bash
   cd backend && npm run prisma:seed
   ```
   Confirm the seeded `Organisation.slug` matches `PUBLIC_ORG_SLUG`.
2. **Create the first admin.** With `BOOTSTRAP_SECRET` set, call:
   ```bash
   curl -X POST https://<your-service>.onrender.com/api/auth/bootstrap-admin \
     -H "Content-Type: application/json" \
     -d '{"secret":"<BOOTSTRAP_SECRET>","email":"admin@example.com","password":"<strong-pw>"}'
   ```
3. **Clear `BOOTSTRAP_SECRET`** in the dashboard and redeploy to disable the
   endpoint.

---

## 5. Database & migrations

- Migrations live in `backend/prisma/migrations/`. They are applied by the
  **pre-deploy** step on every deploy via `npm run db:deploy`.
- `migrate-deploy.mjs` is lock-free (avoids the Neon advisory-lock timeout),
  transactional per migration, and idempotent (skips already-applied ones).
- To create a new migration during development:
  ```bash
  cd backend && npm run prisma:migrate
  ```
- **Never** route DDL through a pooled connection (PgBouncer). `DIRECT_URL` must
  be the non-pooled URL — this is the root cause of historical schema drift.

---

## 6. Health checks & probes

| Endpoint | Type | Behaviour | Use for |
|---|---|---|---|
| `GET /api/health` | Liveness | Constant `{ ok: true }`, no DB. | Render health check, process-up probes. |
| `GET /api/ready` | Readiness | `SELECT 1` with a 2s timeout; `503` when DB is down. | External uptime monitoring / load-balancer rotation. |

Render's health check uses **liveness** on purpose: a brief DB blip must not kill
a single-instance service. Point external monitoring (UptimeRobot, etc.) at
`/api/ready` if you want DB-aware alerting.

---

## 7. Known scaling limits (read before a big event)

This deploy is **vertically scalable only — pin to one instance.** Four things
are kept in-process:

1. **Schedulers** — hourly event stage-advance, daily refresh-token cleanup, and
   the **1-second fight timer**. Two instances would double-fire these.
2. **socket.io rooms** — no Redis adapter, so fan-out does not cross processes.
3. **Rate-limit counters** — in-memory (`ThrottlerModule`).
4. **JSON exports** — written to local `/tmp/wushu-exports` (ephemeral; lost on
   redeploy, not shared across instances).

**To scale horizontally you must first:** add a socket.io Redis adapter, move the
crons behind a distributed lock (or a single worker), and move exports to shared
storage (S3/Render disk). See `deploy/hetzner/README.md` §Scaling.

### Public-viewer load (C1)

Anonymous public pages (the `/mat/...` TV screen and the public live/results
panels) open a socket.io connection, but the gateway requires the `LIVE_RUN`
capability and **rejects anonymous handshakes**. socket.io-client then retries.
A reconnection-backoff cap (`reconnectionDelayMax: 30_000`) was added so a
rejected client retries at most once per 30s instead of every ~5s, and the mat
page already falls back to 30s REST polling for data.

- This **bounds** the retry load but does not eliminate it. For a true
  large-public-audience event (thousands of concurrent anonymous viewers):
  - Put a **CDN (Cloudflare)** in front. The public read endpoints already send
    `Cache-Control: public, max-age=30, stale-while-revalidate=120`, so the CDN
    absorbs nearly all read traffic.
  - **Recommended follow-up (requires a code change, not yet done):** add an
    anonymous read-only socket namespace that lets public viewers join
    `event:`/`mat:` rooms without auth (and without a per-handshake DB hit),
    eliminating the reject-retry loop entirely. Tracked as a human decision in
    the audit.

---

## 8. Observability

- **Structured logging:** Pino on every request (`request-logger.middleware.ts`).
  Render captures stdout — view under the service's **Logs** tab.
- **Frontend errors:** optional Sentry (set `NEXT_PUBLIC_SENTRY_DSN`).
- **Backend errors:** currently **stdout only — no aggregation/alerting.**
  Recommended: add `@sentry/node` and wire it into the unknown-error branch of
  `backend/src/common/global-exception.filter.ts`. (Human decision — not done.)
- **Metrics/tracing:** none. Acceptable at this scale; add OpenTelemetry +
  Prometheus/Grafana if/when you scale out.

---

## 9. Backups & rollback

- **Backups:** Render Postgres includes daily backups + point-in-time recovery on
  paid plans (Neon has PITR too). Verify the backup schedule in the DB dashboard
  **before** the event. Local logical dump helper: `npm run db:dump:local`.
- **App rollback:** Render keeps prior deploys — use **Rollback** in the
  dashboard to revert to the previous image instantly.
- **Migration rollback:** Prisma migrations are **forward-only** (no down
  migrations). To revert a bad migration: roll the app back to the prior deploy
  **and** restore the DB to the pre-deploy PITR point. Take a manual DB snapshot
  before deploying a risky migration.

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Boot crashes with `Invalid environment configuration` | A required prod var is missing/invalid (§2). | Read the logged list; set the var; redeploy. |
| 503 `DATABASE_UNAVAILABLE` | DB down or pool exhausted (`P2024`). | Check DB status; raise DB plan / pool size. |
| 503 `DATABASE_SCHEMA_OUT_OF_DATE` | Migrations not applied. | Ensure pre-deploy `npm run db:deploy` ran; re-run it. |
| CORS errors in browser | `FRONTEND_URL`/`CORS_ALLOWED_ORIGINS` ≠ actual origin. | Set them to the exact service URL (scheme + host); redeploy. |
| Public pages 404 / wrong org | `PUBLIC_ORG_SLUG` doesn't match a seeded org. | Seed the org or fix the slug. |
| Login works but every request 401s | Cookies blocked. | Confirm `NODE_ENV=production` (secure cookies) and same-origin; check `COOKIE_SAME_SITE`. |

---

## 11. [FUTURE HETZNER MIGRATION]

A self-hosted Hetzner path (Docker + Postgres + nginx reverse proxy) is prepared
but **inactive**. It does not affect the Render deploy. All artifacts live in
`deploy/hetzner/` and are clearly marked:

- `deploy/hetzner/Dockerfile` — multi-stage build for the combined server.
- `deploy/hetzner/docker-compose.prod.yml` — app + Postgres 16 + nginx.
- `deploy/hetzner/nginx.conf` — TLS termination, WebSocket upgrade, public-route
  caching.
- `deploy/hetzner/README.md` — full migration steps, infra notes, and the
  horizontal-scaling checklist.

Do **not** add a `Dockerfile` at the repo root — Render would auto-detect it and
switch off the native Node runtime. The Hetzner Dockerfile is intentionally kept
under `deploy/hetzner/`.
