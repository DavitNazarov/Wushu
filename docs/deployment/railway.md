# Railway Deployment

This deployment uses the locked proxy architecture:
- browser HTTP calls stay on relative `/api/...`
- Next.js rewrites proxy to the backend
- auth cookies stay on the frontend origin
- `COOKIE_SAME_SITE=lax`

## Backend env vars

- `NODE_ENV=production`
- `PORT`
- `DATABASE_URL=<Neon connection string>`
- `JWT_SECRET=<strong secret>`
- `JWT_REFRESH_SECRET=<strong secret>` if refresh signing is split later
- `FRONTEND_URL=https://<frontend-service>.up.railway.app`
- `CORS_ALLOWED_ORIGINS=https://<frontend-service>.up.railway.app`
- `COOKIE_SAME_SITE=lax`

## Frontend env vars

- `NODE_ENV=production`
- `API_URL=https://<backend-service>.up.railway.app`
- `NEXT_PUBLIC_SOCKET_URL=https://<frontend-service>.up.railway.app`

`API_URL` is for Next.js server-side rewrites only. Browser requests must keep using relative `/api/...`.

## Deploy Order

1. Deploy `backend`.
2. Verify the backend is up and reachable on its Railway URL.
3. Deploy `frontend`.
4. Verify the frontend loads and its `/api` proxy reaches the backend.
5. Run the final smoke test.

## Railway Dashboard Checklist

### Backend service

- Root directory: `backend`
- Build command: `npm run build`
- Start command: `npm run start:prod`
- Set the backend env vars above
- Deploy
- Run `npm run prisma:migrate:deploy` only if migrations are pending

### Frontend service

- Root directory: `frontend`
- Build command: `npm run build`
- Start command: `npm run start`
- Set the frontend env vars above
- Deploy

### Important note

- Keep the Neon database exactly as-is
- Do not migrate the database provider now

## Smoke Test Checklist

- Public events page loads
- `/api` proxy works
- Login works
- Cookies persist correctly on the frontend origin
- Live/realtime updates work
- No CORS errors in the browser
- No Render URLs remain
