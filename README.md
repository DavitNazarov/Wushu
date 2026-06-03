# Geo Wushu Competition System

Monorepo with **frontend** (Next.js) and **backend** (NestJS + Prisma).

## Structure

```
├── frontend/     Next.js (React) app — port 3000
├── backend/      NestJS + Prisma API — port 4000
├── package.json  Workspace root
└── README.md
```

## Database

Start PostgreSQL (once, persists across reboots):

```bash
docker compose up -d db
```

Then apply migrations and bootstrap the first admin:

```bash
cd backend && npx prisma migrate deploy
curl -X POST http://localhost:4000/api/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@geo.com","password":"admin123","displayName":"Admin"}'
```

> If you prefer Homebrew PostgreSQL instead of Docker, create the role manually:
> `createuser -s geo` then set password `geo123` and `createdb geo_wushu -O geo`.
> Run `brew services start postgresql@16` to auto-start at login.

## Requirements

- **Node.js 22 LTS** — pinned in `.nvmrc` (run `nvm use`) and root `engines`. Do **not** use Node 25 (non-LTS).
- npm 10+ (the repo uses npm **workspaces**) and PostgreSQL 16.

## Install

```bash
npm install
```

## Run both apps

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

Or run separately:

```bash
npm run dev:frontend   # Next.js on :3000
npm run dev:backend   # NestJS on :4000
```

## Migrations

```bash
cd backend
npm run prisma:migrate
```

For production:

```bash
cd backend
npm run prisma:migrate:deploy
```

## Environment

**Backend** (`backend/.env`) — full list and validation rules in `backend/.env.example`:

- `DATABASE_URL` — PostgreSQL connection (pooled in prod)
- `DIRECT_URL` — direct (non-pooled) connection for migrations/DDL
- `JWT_SECRET` — JWT signing secret (**≥32 chars**, enforced at boot in prod)
- `PUBLIC_ORG_SLUG` — organisation slug served on public pages
- `FRONTEND_URL` / `CORS_ALLOWED_ORIGINS` — CORS origin allow-list
- `PORT` — API port (default 4000; Render/host injects this in prod)

**Frontend** (`frontend/.env.local`) — only optional Sentry vars; the app calls the
API with **relative `/api/*` paths** and connects sockets to the **same origin**, so
no API/socket URL is needed for the combined deployment.

Copy the example files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

## Build

```bash
npm run build
```

Builds backend first (Prisma generate + Nest), then frontend.

## Production deployment

Production runs as a **single combined Node process** (`server.js`): Next.js serves
the frontend and mounts the NestJS API under `/api` on one port.

- **Current target: Render.** One-click via the `render.yaml` Blueprint.
- **Full runbook:** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — env vars, health
  checks, seeding, backups/rollback, and known scaling limits.
- **Future self-hosting:** inert Hetzner (Docker + nginx) artifacts live under
  [`deploy/hetzner/`](deploy/hetzner/), clearly marked `[FUTURE HETZNER MIGRATION]`
  and not used by the Render deploy.

## Code quality

```bash
npm run lint           # frontend (next lint)
npm run lint:backend   # backend (eslint)
npm test               # backend unit tests (jest)
npm run knip           # dead-code / unused-export / unused-dependency report
```

