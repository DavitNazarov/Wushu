# Hetzner production stack

> This is the **current production deployment** for Geo Wushu. The full
> step-by-step runbook (provision → TLS → env → launch → seed) lives in
> [`../../docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md). This file documents the
> files here and the scaling rules.

## What's here

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage image for the combined `server.js` (Node 22). |
| `docker-compose.prod.yml` | nginx + app + Postgres 16 + one-shot migrate job. |
| `nginx.conf` | TLS, WebSocket upgrade, public-route micro-caching. |
| `.env.prod.example` | Environment for the stack — copy to `.env.prod`. |

## Quick start

```bash
cp deploy/hetzner/.env.prod.example deploy/hetzner/.env.prod   # then edit
docker compose -f deploy/hetzner/docker-compose.prod.yml \
  --env-file deploy/hetzner/.env.prod up -d --build
```

Full instructions (DNS, TLS certs, seeding, first admin, backups) → `docs/DEPLOYMENT.md`.

## Why Hetzner

- Fixed low monthly cost on a single CPX/CCX VPS.
- Frankfurt/Nuremberg DCs are low-latency to Georgia.
- Full control of the box, and a clean Cloudflare origin for the public pages.

The app runs as the **same combined process** as in local dev — no code changes
for the deploy. The scaling items below are separate.

## Scaling (needs real work before going multi-replica)

The combined process is **single-instance by design**. Running more than one `app`
replica is unsafe until all of the following are done — **these are code changes:**

1. **socket.io Redis adapter** — `@socket.io/redis-adapter` + Redis, so `emit()`
   fans out across replicas. Without it, a fight update from one replica never
   reaches viewers connected to another.
2. **Single-owner schedulers** — the hourly stage-advance, daily token cleanup, and
   1-second fight timer (`@nestjs/schedule`) run in-process; with N replicas they
   fire N times. Move them behind a distributed lock (Redis / `pg_advisory`) or a
   single dedicated worker.
3. **Shared export storage** — exports write to local `/tmp/wushu-exports`. Move to
   S3-compatible object storage or a shared volume.
4. **Shared rate-limit store** — `ThrottlerModule` is in-memory; add a Redis store.

### Public-audience scaling (independent of replicas)

Even single-instance, a large anonymous audience should sit behind **Cloudflare**:
the public read endpoints send `Cache-Control: public, max-age=30,
stale-while-revalidate=120`, and `nginx.conf` already micro-caches `/api/public/`.
The remaining item is the **anonymous read-only socket namespace** (a code change)
to stop anonymous viewers retry-looping against the auth-gated gateway.
