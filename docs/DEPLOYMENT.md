# Deployment Guide — Geo Wushu Competition System

This guide takes a developer with **zero prior context** from a fresh clone to a
live production deployment on a **single Hetzner VPS** using Docker Compose.

- **Deployment target:** self-hosted **Hetzner** VPS.
- **Stack:** `nginx` (TLS + reverse proxy) → `app` (combined Node process) → `postgres 16`,
  plus a one-shot `migrate` job. All defined in `deploy/hetzner/docker-compose.prod.yml`.
- **Architecture:** one combined Node process (`server.js`). Next.js serves the
  frontend and mounts the NestJS API under `/api` on a single port (4000). nginx
  fronts it on 80/443. There is **no** separate frontend/backend deployment.
- **Required external services:** none. PostgreSQL runs in the same compose stack.

---

## 1. Prerequisites

| Thing | Notes |
|---|---|
| Hetzner Cloud VPS | Ubuntu 24.04. **CX22** (2 vCPU / 4 GB) is comfortable for an event. |
| Docker + Compose plugin | `docker` + `docker compose` v2. |
| A domain | e.g. `wushu.example.com`, DNS `A` record → the VPS IP. |
| TLS certs | Let's Encrypt (certbot) — see step 3. |
| Open ports | 80 and 443 inbound. |

Node is **not** needed on the host — it lives inside the container (Node 22, pinned
in `.nvmrc` and the Dockerfile).

---

## 2. Environment Variables

The app validates these once at boot (`backend/src/config/validate-env.ts`). In
production a missing/invalid required var **fails the process immediately**.

They are supplied to the container by `deploy/hetzner/.env.prod` (copy of
`.env.prod.example`), read by Docker Compose.

### Required

| Variable | Example | Purpose |
|---|---|---|
| `NODE_ENV` | `production` | Set by compose. Enables built Next.js, secure cookies, `trust proxy`. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | — | Credentials for the compose `db` service. |
| `DATABASE_URL` | `postgresql://USER:PW@db:5432/DB` | Runtime connection. Built from the POSTGRES_* vars; host is `db` (the compose service name). |
| `DIRECT_URL` | same as `DATABASE_URL` | Migration/DDL connection. Single-box Postgres has no pooler, so it equals `DATABASE_URL`. |
| `JWT_SECRET` | 48-char random | Signs auth cookies. **≥32 chars** or boot fails. Generate: `openssl rand -base64 48`. |
| `PUBLIC_ORG_SLUG` | `georgian-wushu` | Slug of the `Organisation` shown on public pages. Must match a seeded org. |
| `FRONTEND_URL` **and** `CORS_ALLOWED_ORIGINS` | `https://wushu.example.com` | Public HTTPS origin. Same value in both for the single-origin combined deploy. |

### Optional

| Variable | Default | Purpose |
|---|---|---|
| `COOKIE_SAME_SITE` | `lax` | `lax` for single-origin (correct here). |
| `COOKIE_DOMAIN` | _(host-only)_ | Set to `.example.com` to share cookies across subdomains. |
| `LOG_LEVEL` | `info` | Pino level. |
| `BOOTSTRAP_SECRET` | _(unset)_ | Guards `POST /api/auth/bootstrap-admin`. Set once to create the first admin, then clear. |
| `THROTTLE_*` | sane defaults | Rate-limit tuning (`backend/.env.example`). **Never** set `THROTTLE_DISABLED=1` in prod. |
| `NEXT_PUBLIC_SENTRY_DSN` | _(unset)_ | Optional frontend Sentry. No-op when unset. |

> The frontend calls the API with **relative** `/api/*` paths and connects sockets
> to the **same origin**, so no `NEXT_PUBLIC_API_URL` / socket URL is needed.

---

## 3. Deploy

All commands run **on the VPS** unless noted.

### 3.1 Provision the box

```bash
# Install Docker + compose plugin (Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER" && newgrp docker
```

### 3.2 Get the code

```bash
git clone https://github.com/DavitNazarov/Wushu.git
cd Wushu
```

### 3.3 DNS + TLS

Point `wushu.example.com` at the VPS IP. Edit `server_name` in
`deploy/hetzner/nginx.conf` to your domain. Issue certs and place them where nginx
expects (`deploy/hetzner/certs/fullchain.pem` + `privkey.pem`):

```bash
sudo apt-get install -y certbot
sudo certbot certonly --standalone -d wushu.example.com
mkdir -p deploy/hetzner/certs
sudo cp /etc/letsencrypt/live/wushu.example.com/fullchain.pem deploy/hetzner/certs/
sudo cp /etc/letsencrypt/live/wushu.example.com/privkey.pem   deploy/hetzner/certs/
sudo chown -R "$USER" deploy/hetzner/certs
```

### 3.4 Environment

```bash
cp deploy/hetzner/.env.prod.example deploy/hetzner/.env.prod
# Edit deploy/hetzner/.env.prod: set strong POSTGRES_PASSWORD + JWT_SECRET
#   (openssl rand -base64 48), PUBLIC_ORG_SLUG, and the FRONTEND_URL /
#   CORS_ALLOWED_ORIGINS to https://wushu.example.com
```

### 3.5 Launch

```bash
docker compose -f deploy/hetzner/docker-compose.prod.yml \
  --env-file deploy/hetzner/.env.prod up -d --build
```

This brings up `db` → runs the one-shot `migrate` job (applies schema +
migrations) → starts `app` → starts `nginx` on 80/443.

### 3.6 Verify

```bash
curl https://wushu.example.com/api/ready     # -> {"ok":true,"db":"up"}
```

---

## 4. Seed data & first admin

After the first launch (schema is live but empty):

1. **Seed the organisation + base data.** Run the seed inside the app container so
   it uses the compose DB:
   ```bash
   docker compose -f deploy/hetzner/docker-compose.prod.yml \
     --env-file deploy/hetzner/.env.prod exec app sh -c "cd backend && npm run prisma:seed"
   ```
   Confirm the seeded `Organisation.slug` matches `PUBLIC_ORG_SLUG`.
2. **Create the first admin.** Set `BOOTSTRAP_SECRET` in `.env.prod`, restart the
   `app` service, then:
   ```bash
   curl -X POST https://wushu.example.com/api/auth/bootstrap-admin \
     -H "Content-Type: application/json" \
     -d '{"secret":"<BOOTSTRAP_SECRET>","email":"admin@example.com","password":"<strong-pw>"}'
   ```
3. **Clear `BOOTSTRAP_SECRET`** and restart `app` to disable the endpoint.

---

## 5. Database & migrations

- Migrations live in `backend/prisma/migrations/`. The compose **`migrate`**
  service runs `npm run db:deploy` (idempotent `repair-schema` + lock-free,
  transactional `migrate-deploy`) on every `up`, before `app` starts.
- New migration during development (on your laptop, not the VPS):
  ```bash
  cd backend && npm run prisma:migrate
  ```
- `DATABASE_URL` and `DIRECT_URL` both point at the compose `db`. (If you ever put
  Postgres behind PgBouncer, `DIRECT_URL` must stay non-pooled for DDL.)

---

## 6. Health checks & probes

| Endpoint | Type | Behaviour |
|---|---|---|
| `GET /api/health` | Liveness | Constant `{ ok: true }`, no DB. The container `HEALTHCHECK` + nginx use this. |
| `GET /api/ready` | Readiness | `SELECT 1` with a 2s timeout; `503` when DB is down. Point external uptime monitoring here. |

---

## 7. Updating / redeploying

```bash
cd Wushu && git pull
docker compose -f deploy/hetzner/docker-compose.prod.yml \
  --env-file deploy/hetzner/.env.prod up -d --build
```

The `migrate` job re-runs (idempotent) and `app` restarts with the new image. Old
images remain for rollback: `docker compose ... up -d` after `git checkout <prev>`.

---

## 8. Backups & rollback

- **Backups:** the `pgdata` named volume holds all DB state. Use the bundled
  script — it dumps, gzips, verifies non-empty, and prunes past 14 days:
  ```bash
  # one-off
  ./deploy/hetzner/backup.sh
  # nightly host cron (03:15)
  crontab -e
  15 3 * * * /opt/geo-wushu/deploy/hetzner/backup.sh >> /var/log/geo-wushu-backup.log 2>&1
  ```
  Then uncomment one of the OFF-BOX copy lines at the bottom of `backup.sh`
  (Hetzner Storage Box / object storage). A VPS has no managed safety net —
  off-box copies are mandatory before an event.
- **App rollback:** `git checkout <previous-tag>` then `up -d --build`.
- **Migration rollback:** Prisma migrations are **forward-only**. To revert: restore
  the latest `pg_dump` and check out the prior app tag. Take a manual `pg_dump`
  **before** deploying a risky migration.

---

## 9. Known scaling limits (read before a big event)

This deploy is **vertically scalable only — run ONE `app` replica.** Four things
are in-process: the schedulers (hourly stage-advance, daily token cleanup, 1-second
fight timer), socket.io rooms, the rate limiter, and JSON exports (local
`/tmp/wushu-exports`). Two replicas would double-fire crons and split socket
fan-out. **To scale horizontally** you must first add a socket.io Redis adapter,
move crons behind a distributed lock, move exports to shared storage, and use a
shared rate-limit store — see `deploy/hetzner/README.md` §Scaling.

### Public-viewer load (C1)

Anonymous public pages open a socket the gateway rejects (no `LIVE_RUN` capability),
so clients retry. A reconnection-backoff cap (`reconnectionDelayMax: 30_000`) bounds
this, and `nginx.conf` micro-caches `/api/public/*` (the app sends
`Cache-Control: public, max-age=30, stale-while-revalidate=120`). For a large public
audience, put **Cloudflare** in front of the domain so the edge absorbs reads. The
full fix (anonymous read-only socket namespace) is a pending code change — see the
audit / `deploy/hetzner/README.md`.

---

## 10. Observability

- **Logs:** Pino JSON to stdout → `docker compose ... logs -f app`. Ship to
  Loki/Grafana if desired.
- **Frontend errors:** optional Sentry (`NEXT_PUBLIC_SENTRY_DSN`).
- **Backend errors:** stdout only today — no aggregation/alerting. Recommended: add
  `@sentry/node` wired into `backend/src/common/global-exception.filter.ts`.

---

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `app` exits with `Invalid environment configuration` | A required var missing/invalid (§2). | Read the logged list; fix `.env.prod`; `up -d`. |
| `502` from nginx | `app` not healthy yet / crashed. | `docker compose ... logs app`. |
| 503 `DATABASE_UNAVAILABLE` | DB down or pool exhausted. | `docker compose ... ps`; check `db` health. |
| 503 `DATABASE_SCHEMA_OUT_OF_DATE` | `migrate` job didn't run. | Re-run `up` (it re-runs migrate), or run `db:deploy` in the app container. |
| CORS errors in browser | `FRONTEND_URL`/`CORS_ALLOWED_ORIGINS` ≠ actual origin. | Set both to the exact `https://` domain; restart `app`. |
| WebSocket won't connect | nginx not forwarding upgrade. | Confirm the `/api/socket.io/` block in `nginx.conf`. |
| Login works but every request 401s | Cookies blocked. | Confirm `NODE_ENV=production` + HTTPS + same origin. |
