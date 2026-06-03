// ─────────────────────────────────────────────────────────────────────────────
// Shared k6 helpers for the Wushu backend load tests.
//
// Three traffic categories, each modelled as a short "user session":
//   • public   — unauthenticated spectator browsing (events, brackets, results…)
//   • coach    — authenticated club manager (me, athletes, registrations)
//   • weighin  — authenticated weigh-in station (queue search + decision preview)
//
// Auth: we log in ONCE in setup() and hand each VU a gw_auth cookie. The access
// token is short-lived (15 min), so VUs lazily re-login on a 401 and cache the
// fresh cookie per-VU. In "limited" runs the login route is throttled, so long
// SOAK tests should use the "raised" run (THROTTLE_DISABLED=1) to avoid 429s on
// re-login — see the run instructions.
//
// Metrics: 429s are the limiter doing its job, NOT a server failure, so we track
// them separately (throttled_429 / throttled_rate) and EXCLUDE them from the
// `errors` rate. Thresholds in the profiles assert on `errors`, on 429 share,
// and on per-group latency tags.
//
// Everything is overridable via -e / __ENV. Defaults match the seeded mock data.
// ─────────────────────────────────────────────────────────────────────────────

import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { Counter, Rate } from 'k6/metrics';

export const CONFIG = {
  base: (__ENV.API_URL || 'http://localhost:4000').replace(/\/+$/, ''),
  adminEmail: __ENV.ADMIN_EMAIL || 'admin@geowushu.ge',
  adminPassword: __ENV.ADMIN_PASSWORD || 'Password123!',
  coachEmail: __ENV.COACH_EMAIL || 'davit.k@tbilisiwushu.ge',
  coachPassword: __ENV.COACH_PASSWORD || 'Password123!',
  // The WEIGHIN-stage fixture event provisioned by setup.mjs.
  eventSlug: __ENV.EVENT_SLUG || 'load-weighin-stress',
  // A published event with full bracket/schedule/results data for public reads.
  publicEventSlug: __ENV.PUBLIC_EVENT_SLUG || 'ge-national-spring-2026',
};

// ── custom metrics ───────────────────────────────────────────────────────────
export const errors = new Rate('errors'); // unexpected failures (excludes 429)
export const throttled = new Counter('throttled_429'); // count of 429 responses
export const throttledRate = new Rate('throttled_rate'); // share of reqs that 429

// ── tiny utils (avoid remote jslib imports so tests run fully offline) ────────
function rand(min, max) {
  return Math.random() * (max - min) + min;
}
export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
export function think(min, max) {
  sleep(rand(min, max));
}

// ── per-VU cookie cache for lazy re-login on token expiry ─────────────────────
const vuCookie = {}; // role -> "gw_auth=<value>"

// Perform a login and return the gw_auth cookie string, or null on failure.
export function loginCookie(email, password) {
  const res = http.post(
    `${CONFIG.base}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' }, tags: { group: 'auth', endpoint: 'login' } },
  );
  classify(res, 'auth', [200, 201]);
  if (res.status === 200 || res.status === 201) {
    const value = res.cookies && res.cookies.gw_auth && res.cookies.gw_auth[0] && res.cookies.gw_auth[0].value;
    if (value) return `gw_auth=${value}`;
  }
  return null;
}

// Record metrics for a response. 429 is tolerated (limiter), never an "error".
function classify(res, group, okStatuses) {
  const is429 = res.status === 429;
  throttledRate.add(is429, { group });
  if (is429) throttled.add(1, { group });
  const ok = is429 || okStatuses.indexOf(res.status) !== -1;
  errors.add(!ok, { group });
  check(res, { [`${group} responded ${okStatuses.join('/')}=ok (429 tolerated)`]: () => ok }, { group });
}

// Unauthenticated request with metrics + tags.
export function request(method, path, body, opts) {
  const o = opts || {};
  const group = o.group || 'public';
  const okStatuses = o.okStatuses || [200];
  const params = { tags: { group, endpoint: o.endpoint || path }, headers: {} };
  if (o.cookie) params.headers['Cookie'] = o.cookie;
  let res;
  if (method === 'GET') {
    res = http.get(`${CONFIG.base}${path}`, params);
  } else {
    params.headers['Content-Type'] = 'application/json';
    res = http.post(`${CONFIG.base}${path}`, body === undefined ? null : JSON.stringify(body), params);
  }
  classify(res, group, okStatuses);
  return res;
}

// Authenticated request: uses the per-VU cookie (falling back to the setup
// cookie), and on a 401 re-logs-in once and retries.
export function authedRequest(role, data, method, path, body, opts) {
  const o = opts || {};
  let cookie = vuCookie[role] || (role === 'admin' ? data.adminCookie : data.coachCookie);
  let res = request(method, path, body, Object.assign({}, o, { cookie }));
  if (res.status === 401) {
    const email = role === 'admin' ? CONFIG.adminEmail : CONFIG.coachEmail;
    const password = role === 'admin' ? CONFIG.adminPassword : CONFIG.coachPassword;
    const fresh = loginCookie(email, password);
    if (fresh) {
      vuCookie[role] = fresh;
      res = request(method, path, body, Object.assign({}, o, { cookie: fresh }));
    }
  }
  return res;
}

// ── setup(): log in once and discover the fixture (read-only) ─────────────────
export function discover() {
  const adminCookie = loginCookie(CONFIG.adminEmail, CONFIG.adminPassword);
  if (!adminCookie) {
    fail(`admin login failed at ${CONFIG.base} — is the backend running and seeded (SEED_MOCK_DATA=1)?`);
  }
  // Coach login is best-effort: if it fails, coach VUs re-login on first use.
  const coachCookie = loginCookie(CONFIG.coachEmail, CONFIG.coachPassword);

  const evRes = http.get(`${CONFIG.base}/api/events`, { headers: { Cookie: adminCookie }, tags: { group: 'setup', endpoint: 'events' } });
  if (evRes.status !== 200) {
    fail(`GET /api/events → ${evRes.status}; cannot discover the fixture event`);
  }
  const events = evRes.json();
  const event = (Array.isArray(events) ? events : []).find((e) => e.slug === CONFIG.eventSlug);
  if (!event) {
    fail(`event "${CONFIG.eventSlug}" not found — run the provisioner first: node load-test/setup.mjs`);
  }

  // Harvest APPROVED registration ids from the weigh-in queue for preview calls.
  let registrationIds = [];
  const wRes = http.get(`${CONFIG.base}/api/weighin?eventId=${event.id}`, {
    headers: { Cookie: adminCookie },
    tags: { group: 'setup', endpoint: 'weighin' },
  });
  if (wRes.status === 200) {
    const rows = wRes.json();
    if (Array.isArray(rows)) registrationIds = rows.map((r) => r.id).filter(Boolean);
  }

  console.log(
    `[setup] base=${CONFIG.base} event=${CONFIG.eventSlug} id=${event.id} lifecycle=${event.lifecycle} ` +
      `weighin-queue=${registrationIds.length} coachCookie=${coachCookie ? 'ok' : 'deferred'}`,
  );
  if (registrationIds.length === 0) {
    console.warn('[setup] WARNING: weigh-in queue is empty — preview calls will be skipped. Re-run setup.mjs.');
  }

  return {
    adminCookie,
    coachCookie,
    eventId: event.id,
    eventLifecycle: event.lifecycle,
    registrationIds,
    publicEventSlug: CONFIG.publicEventSlug,
  };
}

// ── scenario step functions ───────────────────────────────────────────────────

// PUBLIC: a spectator browsing the site + a competition.
export function publicBrowsing(data) {
  const slug = data.publicEventSlug;

  request('GET', '/api/public/events', undefined, { group: 'public', endpoint: 'events_list' });
  think(0.3, 1.2);

  request('GET', `/api/public/events/${slug}`, undefined, { group: 'public', endpoint: 'event_detail' });
  request('GET', `/api/public/events/${slug}/categories`, undefined, { group: 'public', endpoint: 'event_categories' });
  think(0.3, 1.2);

  // Pick one of several deeper views — mixes cheap reads with heavier aggregations.
  const view = randomItem([
    'brackets_overview',
    'brackets',
    'schedule',
    'results',
    'live',
    'clubs_top',
    'athletes_top',
    'news',
  ]);
  switch (view) {
    case 'brackets_overview':
      request('GET', `/api/public/brackets/overview?eventSlug=${slug}`, undefined, { group: 'public', endpoint: 'brackets_overview' });
      break;
    case 'brackets':
      request('GET', `/api/public/brackets?eventSlug=${slug}`, undefined, { group: 'public', endpoint: 'brackets' });
      break;
    case 'schedule':
      request('GET', `/api/public/schedule?eventSlug=${slug}`, undefined, { group: 'public', endpoint: 'schedule' });
      break;
    case 'results':
      request('GET', `/api/public/results?eventSlug=${slug}`, undefined, { group: 'public', endpoint: 'results' });
      break;
    case 'live':
      request('GET', `/api/public/live?eventSlug=${slug}`, undefined, { group: 'public', endpoint: 'live' });
      break;
    case 'clubs_top':
      request('GET', '/api/public/clubs/top', undefined, { group: 'public', endpoint: 'clubs_top' });
      break;
    case 'athletes_top':
      request('GET', '/api/public/athletes/top', undefined, { group: 'public', endpoint: 'athletes_top' });
      break;
    case 'news':
      request('GET', '/api/public/news', undefined, { group: 'public', endpoint: 'news' });
      break;
  }
  think(0.5, 2);
}

// COACH: an authenticated club manager checking their roster + registrations.
export function coachSession(data) {
  authedRequest('coach', data, 'GET', '/api/auth/me', undefined, { group: 'coach', endpoint: 'me' });
  think(0.3, 1);

  authedRequest('coach', data, 'GET', '/api/athletes', undefined, { group: 'coach', endpoint: 'athletes' });
  think(0.3, 1.2);

  authedRequest('coach', data, 'GET', `/api/registrations?eventId=${data.eventId}`, undefined, { group: 'coach', endpoint: 'registrations' });
  think(0.3, 1);

  // Coaches browse events through the public API (they lack EVENTS_MANAGE).
  request('GET', '/api/public/events', undefined, { group: 'coach', endpoint: 'public_events' });
  think(0.5, 2);
}

// WEIGHIN (admin): the weigh-in station refreshing the queue + previewing weights.
export function weighinStation(data) {
  authedRequest('admin', data, 'GET', `/api/weighin?eventId=${data.eventId}`, undefined, { group: 'weighin', endpoint: 'queue_search' });
  think(0.2, 0.8);

  // Occasionally a filtered search (heavier OR/contains query).
  if (Math.random() < 0.3) {
    const q = randomItem(['a', 'e', 'i', 'an', 'ia', 'ka', 'gio']);
    authedRequest('admin', data, 'GET', `/api/weighin?eventId=${data.eventId}&q=${q}`, undefined, { group: 'weighin', endpoint: 'queue_search_q' });
  }

  // Dry-run a decision for a random athlete in the queue.
  if (data.registrationIds && data.registrationIds.length > 0) {
    const registrationId = randomItem(data.registrationIds);
    const weightKg = Math.round(rand(20, 95) * 10) / 10;
    authedRequest('admin', data, 'POST', '/api/weighin/preview', { registrationId, weightKg }, {
      group: 'weighin',
      endpoint: 'preview',
      okStatuses: [200, 201],
    });
  }
  think(0.3, 1.2);
}
