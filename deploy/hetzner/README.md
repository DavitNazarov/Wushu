# [FUTURE HETZNER MIGRATION]

> **Status: INACTIVE.** Nothing in this directory affects the current **Render**
> deployment. These are prepared, self-contained artifacts for a future move to a
> self-hosted Hetzner box. Read `../../docs/DEPLOYMENT.md` for the live (Render)
> flow.

## What's here

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage image for the combined `server.js` (Node 22). |
| `docker-compose.prod.yml` | nginx + app + Postgres 16 + one-shot migrate job. |
| `nginx.conf` | TLS, WebSocket upgrade, public-route micro-caching. |
| `.env.prod.example` | Environment for the compose stack — copy to `.env.prod`. |

## Why Hetzner is the eventual target

- Fixed monthly cost on a single CPX/CCX VPS vs Render's per-service pricing.
- Frankfurt/Nuremberg DCs are low-latency to Georgia.
- Full control of the box for a CDN (Cloudflare) origin in front of public pages.

This is a **lift-and-shift** of the *same combined process* — no app code changes
required for the basic migration. The scaling items below are separate.

## Migration steps (when the time comes)

1. **Provision** a Hetzner Cloud VPS (Ubuntu 24.04, ≥2 vCPU / 4GB for a real
   event). Install Docker + Docker Compose plugin.
2. **DNS:** point `wushu.example.com` at the VPS IP. Update `server_name` in
   `nginx.conf`.
3. **TLS:** issue certs (certbot or Caddy). Place `fullchain.pem` / `privkey.pem`
   in `deploy/hetzner/certs/`.
4. **Env:** `cp deploy/hetzner/.env.prod.example deploy/hetzner/.env.prod` and
   fill in real values (`JWT_SECRET` via `openssl rand -base64 48`, DB creds,
   `PUBLIC_ORG_SLUG`, `FRONTEND_URL`/`CORS_ALLOWED_ORIGINS` = the public HTTPS URL).
5. **Data migration:** dump the Render/Neon DB and restore into the compose
   Postgres volume:
   ```bash
   pg_dump "$RENDER_DATABASE_URL" -Fc -f wushu.dump
   # bring up only db, then:
   docker compose -f deploy/hetzner/docker-compose.prod.yml --env-file deploy/hetzner/.env.prod up -d db
   pg_restore --no-owner -d "postgresql://USER:PW@localhost:5432/DB" wushu.dump
   ```
6. **Launch:**
   ```bash
   docker compose -f deploy/hetzner/docker-compose.prod.yml \
     --env-file deploy/hetzner/.env.prod up -d --build
   ```
   The `migrate` service applies any pending migrations, then `app` starts and
   `nginx` fronts it on 80/443.
7. **Verify:** `curl https://wushu.example.com/api/ready` → `{"ok":true,"db":"up"}`.
8. **Cut over DNS** from Render to Hetzner once verified. Keep Render running
   until the new box is confirmed healthy, then decommission.

## Infrastructure notes

- **Backups:** schedule `pg_dump` via cron on the host (or use Hetzner volume
  snapshots). The `pgdata` named volume holds all state.
- **Logs:** the app logs JSON (Pino) to stdout → `docker logs` / a log driver.
  Consider shipping to Loki/Grafana.
- **Body limits / IPs:** `nginx.conf` caps bodies at 128k and forwards
  `X-Forwarded-*`; the app's `trust proxy` makes `req.ip` accurate for rate limits.
- **Health:** the container `HEALTHCHECK` and nginx both target `/api/health`.

## Scaling (the part that needs real work)

The combined process is **single-instance by design today**. Running more than one
`app` replica (here or on Render) is unsafe until all of the following are done —
**these are code changes, do not enable them blind:**

1. **socket.io Redis adapter** — `@socket.io/redis-adapter` + a Redis service, so
   `emit()` fans out across replicas. Without it, a fight update emitted by the
   replica handling the scoring request never reaches viewers connected to other
   replicas.
2. **Single-owner schedulers** — the hourly stage-advance, daily token cleanup,
   and 1-second fight timer (`@nestjs/schedule`) run in-process. With N replicas
   they fire N times. Move them behind a distributed lock (Redis/`pg_advisory`)
   or into one dedicated worker container.
3. **Shared export storage** — exports write to local `/tmp/wushu-exports`. Move
   to S3-compatible object storage (or a shared volume) so any replica can serve
   any export.
4. **Shared rate-limit store** — `ThrottlerModule` is in-memory. Add a Redis
   storage provider so limits are global, not per-replica.

### Public-audience scaling (independent of replicas)

Even single-instance, a large anonymous audience should sit behind **Cloudflare**:
the public read endpoints send `Cache-Control: public, max-age=30,
stale-while-revalidate=120`, and `nginx.conf` already micro-caches `/api/public/`.
The remaining item is the **anonymous read-only socket namespace** (a code change,
see `docs/DEPLOYMENT.md` §7 / the audit) to stop anonymous viewers retry-looping
against the auth-gated gateway.
