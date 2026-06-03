# TASK: Cache-Control on public APIs

Goal: add `Cache-Control` headers so Cloudflare (prod) + browser (dev) cache public reads. Cut origin load + stop rate-limit 429 on spectator traffic. CF cache **off by default for JSON** — header is the switch.

## Rule

Cache = public, anonymous, read-only, slow-changing. NO cache = auth, user-specific, real-time, or sets cookie.

## CACHE LONG — static-ish public reads

Header: `Cache-Control: public, max-age=30, stale-while-revalidate=120`

`backend/src/public/public.controller.ts`
- GET `/public/events`
- GET `/public/events/:slug`
- GET `/public/events/:slug/categories`
- GET `/public/news`
- GET `/public/news/:slug`
- GET `/public/clubs`
- GET `/public/clubs/top`
- GET `/public/clubs/:id`
- GET `/public/athletes/top`
- GET `/public/athletes/:id`

`backend/src/public/public-competition.controller.ts`
- GET `/public/brackets/overview`
- GET `/public/brackets/category`
- GET `/public/brackets`
- GET `/public/results`

## CACHE SHORT — schedule (shifts, but 30s lag fine, not real-time)

Header: `Cache-Control: public, max-age=15, stale-while-revalidate=30`

- GET `/public/schedule`
- GET `/public/schedule-sessions`
- GET `/public/event-schedule`

## NO CACHE — real-time only

Header: `Cache-Control: no-store` (or `max-age=2` if jitter OK).

- `/public/live` — live scores, must be fresh
- `/public/mat` — TV scoreboard, live

## NO ACTION — already non-cacheable, touch nothing

Authed routes sit behind `gw_auth` cookie → CF bypasses cache automatically (cookie present) + NestJS default = no-store. No header needed.
- ALL `/admin/*`, `/coach/*` (Registrations, Weigh-in, Integrity, Draw, Brackets, Schedule, Live, Display, Results, inbox)
- `/auth/*`, `/users/*` — user-specific

## Watch out

- Cached public GET must NOT `Set-Cookie` → CF skips cache if cookie present. Verify.
- Live page real-time = websocket anyway. Header only affects initial fetch; keep short.
- Already done: `@SkipThrottle({ short: true })` on both public controllers = backstop for cache-miss bursts. Keep.

## How (NestJS)

Per-route: `@Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=120')` on the method.
Or interceptor on controller for the cacheable group. Per-route header simpler, explicit.

## Verify

- dev: refresh public page many time → `/api/public/clubs` hit backend once per 30s (not every refresh).
- prod: CF response header `cf-cache-status: HIT` after warm.
