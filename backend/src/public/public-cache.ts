/**
 * Cache-Control values for the anonymous public read endpoints.
 *
 * These routes are public, anonymous, read-only and never Set-Cookie, so the
 * same payload is safe to share across every viewer at a CDN (Cloudflare) and
 * in the browser. Cloudflare leaves JSON uncached by default — the header is
 * the switch that turns edge caching on. Caching them cuts origin load and
 * stops spectator traffic tripping the rate limiter (429) during an event.
 *
 * Tiers follow CACHING_TASK.md:
 * - LONG   — static-ish public reads (events, news, clubs, athletes, brackets,
 *            results). 30s is well within how often these change.
 * - SHORT  — schedule feeds: they shift during an event, but a ~15-30s lag is
 *            acceptable (not real-time).
 * - live / mat get `no-store` (see controller) — live scores must stay fresh;
 *            real-time delivery is over the websocket anyway.
 *
 * `stale-while-revalidate` lets the cache serve the slightly-stale copy while
 * it refreshes in the background, so a refresh never blocks on the origin.
 */

/** Static-ish public reads (events, news, clubs, athletes, brackets, results). */
export const CACHE_LONG = 'public, max-age=30, stale-while-revalidate=120';

/** Schedule feeds — shift during an event but tolerate a short lag. */
export const CACHE_SHORT = 'public, max-age=15, stale-while-revalidate=30';

/** Real-time feeds (live scores, mat board) — must never be cached. */
export const CACHE_NONE = 'no-store';
