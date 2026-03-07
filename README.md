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

**Backend** (`backend/.env`):

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Secret for JWT signing
- `PORT` — API port (default 4000)
- `FRONTEND_URL` — CORS origin (default http://localhost:3000)

**Frontend** (`frontend/.env.local`):

- `NEXT_PUBLIC_API_URL` — Backend URL (default http://localhost:4000)

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
