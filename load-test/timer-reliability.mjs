// TIMER RELIABILITY — prove the round timer survives heavy stop/resume + a
// mid-fight socket reconnect, the way a real timekeeper drives one bout.
//
// WHY this matters: a single fight can be paused/resumed 15+ times (injury,
// protest, judge confer), across ~100 fights/day. The timer must NOT drift,
// must NOT count paused wall-time against the round, and must NOT be perturbed
// by a flaky live connection. The design that makes this safe is that
// TimerState is TIMESTAMP-BASED, not a ticking counter:
//
//   pausedMs  = total accumulated RUN milliseconds up to the last pause
//   startedAt = when the current RUN segment began (null while paused)
//   liveElapsed(running) = pausedMs + (now - startedAt)
//   remaining = phaseDurationSeconds*1000 - liveElapsed
//
// So PAUSE freezes pausedMs; RESUME starts a fresh segment; the countdown is
// COMPUTED, never stored. This test exercises that path against a RUNNING
// backend and asserts the invariants empirically.
//
// WHAT it checks:
//   1. FREEZE      — sit PAUSED for PAUSE_MS; pausedMs must NOT grow by PAUSE_MS
//                    (paused wall-time is not counted against the round).
//   2. HAMMER      — CYCLES x (pause -> resume), threading expectedUpdatedAt
//                    (optimistic concurrency). 0 stale errors, 0 http errors,
//                    pausedMs monotonic, grows only by RUN segments.
//   3. STALE GUARD — one deliberate stale expectedUpdatedAt must be REJECTED
//                    with TIMER_STALE_UPDATE (two operators can't race).
//   4. RECONNECT   — join-event over socket.io (also proves the cuid join fix
//                    on a LIVE event), drop the socket, reconnect, re-join;
//                    the DB timer is unchanged (pausedMs stable while paused).
//
// It needs ONE live, startable fight. It will DISCOVER one (any event in LIVE
// lifecycle with a real bout) or take EVENT_ID + FIGHT_ID. It only touches the
// TIMER (START/PAUSE/RESUME) — never records a result — so it is reversible.
//
//   node load-test/timer-reliability.mjs
//   FIGHT_ID=<cuid> EVENT_ID=<cuid> npm run loadtest:timer
//   CYCLES=30 PAUSE_MS=5000 npm run loadtest:timer
//
import { io } from 'socket.io-client';

const BASE = (process.env.API_URL || 'http://localhost:4000').replace(/\/+$/, '');
const EMAIL = process.env.ADMIN_EMAIL || 'admin@geowushu.ge';
const PASS = process.env.ADMIN_PASSWORD || 'Password123!';
const ENV_EVENT_ID = process.env.EVENT_ID || null;
const ENV_FIGHT_ID = process.env.FIGHT_ID || null;
const CYCLES = Number(process.env.CYCLES || 20);
const RUN_MS = Number(process.env.RUN_MS || 1500); // run segment in the freeze proof
const PAUSE_MS = Number(process.env.PAUSE_MS || 3000); // paused wall-time in the freeze proof
const HAMMER_RUN_MS = 120; // tiny run between each hammer pause/resume
const SOCKET_PATH = '/api/socket.io';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DRIVABLE = new Set(['IN_PROGRESS', 'PAUSED', 'ON_DECK', 'QUEUED']);

// ── tiny cookie-aware HTTP client ───────────────────────────────────────────
let authCookie = null; // "gw_auth=<jwt>"
let rawToken = null; // the jwt itself (for the socket bearer)

function extractCookie(res) {
  const jar =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie')].filter(Boolean);
  for (const line of jar) {
    const m = /(^|[;,\s])gw_auth=([^;]+)/.exec(line ?? '');
    if (m) return m[2];
  }
  return null;
}

async function http(method, path, body) {
  const headers = { 'content-type': 'application/json' };
  if (authCookie) headers.cookie = authCookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  let parsed = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed, raw: res };
}

function errCode(res) {
  const b = res.body;
  if (typeof b === 'string') return b;
  return b?.code ?? b?.error ?? b?.message ?? `HTTP_${res.status}`;
}

function fail(msg, ...rest) {
  console.error('\n✗', msg, ...rest);
  process.exit(1);
}

// ── timer helpers (mirror the server's timestamp math) ──────────────────────
function liveElapsedMs(timer, nowMs = Date.now()) {
  if (timer.state === 'RUNNING' && timer.startedAt) {
    return timer.pausedMs + (nowMs - Date.parse(timer.startedAt));
  }
  return timer.pausedMs;
}
function remainingMs(timer, nowMs = Date.now()) {
  return Math.max(0, timer.phaseDurationSeconds * 1000 - liveElapsedMs(timer, nowMs));
}

// POST a timer action; thread expectedUpdatedAt for optimistic concurrency.
// Returns { ok, timer?, code? }.
async function timerAction(fightId, action, { round, expectedUpdatedAt } = {}) {
  const res = await http('POST', `/api/fights/${fightId}/timer`, {
    action,
    ...(round != null ? { round } : {}),
    ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
  });
  if (res.status >= 200 && res.status < 300) return { ok: true, timer: res.body };
  return { ok: false, code: errCode(res), status: res.status };
}

async function getFight(fightId) {
  const res = await http('GET', `/api/fights/${fightId}`);
  if (res.status !== 200) return null;
  return res.body;
}

// ── steps ───────────────────────────────────────────────────────────────────
async function login() {
  const res = await http('POST', '/api/auth/login', { email: EMAIL, password: PASS });
  if (res.status !== 200 && res.status !== 201) fail('login failed', res.status, JSON.stringify(res.body));
  rawToken = extractCookie(res.raw);
  if (!rawToken) fail('login ok but no gw_auth cookie');
  authCookie = `gw_auth=${rawToken}`;
  console.log(`→ logged in as ${EMAIL}`);
}

function asList(body) {
  return Array.isArray(body) ? body : (body?.items ?? []);
}

function realBout(f) {
  return Boolean(f?.redAthlete?.id && f?.blueAthlete?.id) && DRIVABLE.has(f.status);
}

// Find a live, startable fight (or use the env override).
async function resolveFight() {
  if (ENV_FIGHT_ID) {
    const f = await getFight(ENV_FIGHT_ID);
    if (!f) fail(`FIGHT_ID ${ENV_FIGHT_ID} not found`);
    return { fight: f, eventId: ENV_EVENT_ID || f.eventId };
  }

  const events = asList((await http('GET', '/api/events')).body);
  const liveEvents = events.filter((e) => e.lifecycle === 'LIVE');
  const scoped = ENV_EVENT_ID ? liveEvents.filter((e) => e.id === ENV_EVENT_ID) : liveEvents;

  for (const ev of scoped) {
    const fights = asList((await http('GET', `/api/fights?eventId=${ev.id}`)).body);
    // prefer already-live, then on-deck, then queued
    const ranked = fights
      .filter(realBout)
      .sort((a, b) => statusRank(a.status) - statusRank(b.status));
    if (ranked.length) return { fight: ranked[0], eventId: ev.id };
  }

  console.log('\n✗ No live, startable fight found.');
  console.log('  This test needs ONE event in LIVE lifecycle with a drawn bout');
  console.log('  (both red + blue athletes present). Either:');
  console.log('    • take an event LIVE in the UI and start/queue a fight, or');
  console.log('    • pass an explicit target:  FIGHT_ID=<cuid> EVENT_ID=<cuid> npm run loadtest:timer');
  console.log(`  Scanned ${events.length} events, ${liveEvents.length} in LIVE.\n`);
  process.exit(0);
}

function statusRank(s) {
  return { IN_PROGRESS: 0, PAUSED: 1, ON_DECK: 2, QUEUED: 3 }[s] ?? 9;
}

// Get the fight to IN_PROGRESS, then START a clean RUNNING timer (round 1).
async function startCleanTimer(fightId, status) {
  if (status !== 'IN_PROGRESS') {
    if (status === 'PAUSED') {
      const r = await timerAction(fightId, 'RESUME');
      if (!r.ok) {
        const s = await http('POST', `/api/fights/${fightId}/start`);
        if (s.status >= 300) fail('could not resume/start paused fight', errCode(s));
      }
    } else {
      const s = await http('POST', `/api/fights/${fightId}/start`);
      if (s.status >= 300) fail('could not start fight', errCode(s));
    }
  }
  const r = await timerAction(fightId, 'START', { round: 1 });
  if (!r.ok) fail('timer START failed', r.code);
  return r.timer; // RUNNING, pausedMs=0, has updatedAt + phaseDurationSeconds
}

// ── main ─────────────────────────────────────────────────────────────────────
await login();
const { fight, eventId } = await resolveFight();
console.log(
  `→ target fight ${fight.id}  (event ${eventId}, status ${fight.status})\n`,
);

const metrics = {
  httpErrors: 0,
  staleUnderCorrectThreading: 0,
  intentionalStaleRejected: false,
  cyclesDone: 0,
  pausedMonotonic: true,
  joinInitialOk: false,
  joinAfterReconnectOk: false,
};

let timer = await startCleanTimer(fight.id, fight.status);
let updatedAt = timer.updatedAt;
const firstUpdatedAt = updatedAt; // keep an OLD value for the stale-guard test
const durationS = timer.phaseDurationSeconds;
console.log(
  `→ timer started: round duration=${durationS}s, remaining≈${(remainingMs(timer) / 1000).toFixed(1)}s\n`,
);

// Guard: keep total run time well under the round so we never expire mid-test.
const runBudgetMs = RUN_MS + 200 + CYCLES * HAMMER_RUN_MS + 2000;
if (runBudgetMs > durationS * 1000 * 0.6) {
  console.log(
    `  ! round is short (${durationS}s); test run budget ≈${(runBudgetMs / 1000).toFixed(1)}s. ` +
      `Reduce CYCLES/RUN_MS if it expires.\n`,
  );
}

// ── 1. FREEZE PROOF ─────────────────────────────────────────────────────────
console.log('▒ 1/4 FREEZE  — paused wall-time must NOT count against the round');
await sleep(RUN_MS); // run for RUN_MS
let r = await timerAction(fight.id, 'PAUSE', { expectedUpdatedAt: updatedAt });
if (!r.ok) fail('freeze: first PAUSE failed', r.code);
const e1 = r.timer.pausedMs;
updatedAt = r.timer.updatedAt;

await sleep(PAUSE_MS); // sit PAUSED — this time must be IGNORED
r = await timerAction(fight.id, 'RESUME', { expectedUpdatedAt: updatedAt });
if (!r.ok) fail('freeze: RESUME failed', r.code);
updatedAt = r.timer.updatedAt;

await sleep(150); // a tiny run
r = await timerAction(fight.id, 'PAUSE', { expectedUpdatedAt: updatedAt });
if (!r.ok) fail('freeze: second PAUSE failed', r.code);
const e2 = r.timer.pausedMs;
updatedAt = r.timer.updatedAt;

const freezeDelta = e2 - e1; // should be ~150ms, definitely NOT ~PAUSE_MS
const freezeOk = freezeDelta < Math.max(PAUSE_MS * 0.25, 750);
console.log(
  `      pausedMs before/after a ${PAUSE_MS}ms pause: ${e1} → ${e2}  (Δ=${freezeDelta}ms)  ` +
    `${freezeOk ? 'PASS ✓ paused time ignored' : 'FAIL ✗ paused time counted!'}\n`,
);

// ── 2. STALE GUARD ──────────────────────────────────────────────────────────
console.log('▒ 2/4 STALE   — a stale expectedUpdatedAt must be rejected');
// timer is PAUSED now; RESUME with an OLD updatedAt -> expect TIMER_STALE_UPDATE
const staleTry = await timerAction(fight.id, 'RESUME', { expectedUpdatedAt: firstUpdatedAt });
metrics.intentionalStaleRejected = !staleTry.ok && staleTry.code === 'TIMER_STALE_UPDATE';
console.log(
  `      stale RESUME → ${staleTry.ok ? `ACCEPTED (✗ guard broken)` : staleTry.code}  ` +
    `${metrics.intentionalStaleRejected ? 'PASS ✓' : 'FAIL ✗'}\n`,
);
// resume properly (timer still PAUSED, current updatedAt unchanged by the rejected call)
r = await timerAction(fight.id, 'RESUME', { expectedUpdatedAt: updatedAt });
if (!r.ok) fail('post-stale RESUME failed', r.code);
updatedAt = r.timer.updatedAt;

// ── 3. HAMMER ───────────────────────────────────────────────────────────────
console.log(`▒ 3/4 HAMMER  — ${CYCLES} x (pause → resume), threading updatedAt`);
let lastPausedMs = -1;
for (let i = 0; i < CYCLES; i++) {
  await sleep(HAMMER_RUN_MS);
  const p = await timerAction(fight.id, 'PAUSE', { expectedUpdatedAt: updatedAt });
  if (!p.ok) {
    if (p.code === 'TIMER_STALE_UPDATE') metrics.staleUnderCorrectThreading++;
    else metrics.httpErrors++;
    // re-sync updatedAt from the DB and keep going
    const f = await getFight(fight.id);
    updatedAt = f?.timerState?.updatedAt ?? updatedAt;
    continue;
  }
  if (p.timer.pausedMs < lastPausedMs) metrics.pausedMonotonic = false;
  lastPausedMs = p.timer.pausedMs;
  updatedAt = p.timer.updatedAt;

  await sleep(40);
  const rr = await timerAction(fight.id, 'RESUME', { expectedUpdatedAt: updatedAt });
  if (!rr.ok) {
    if (rr.code === 'TIMER_STALE_UPDATE') metrics.staleUnderCorrectThreading++;
    else metrics.httpErrors++;
    const f = await getFight(fight.id);
    updatedAt = f?.timerState?.updatedAt ?? updatedAt;
    continue;
  }
  updatedAt = rr.timer.updatedAt;
  metrics.cyclesDone++;
  process.stdout.write(`\r      cycles ${metrics.cyclesDone}/${CYCLES}  pausedMs=${lastPausedMs}   `);
}
process.stdout.write('\n\n');

// ── 4. RECONNECT ────────────────────────────────────────────────────────────
console.log('▒ 4/4 RECONNECT — join-event, drop the socket, reconnect; DB timer unchanged');

// Pause + freeze so we can compare the DB timer across the socket churn exactly.
r = await timerAction(fight.id, 'PAUSE', { expectedUpdatedAt: updatedAt });
if (!r.ok && r.code !== 'TIMER_NOT_RUNNING') fail('pre-reconnect PAUSE failed', r.code);
if (r.ok) updatedAt = r.timer.updatedAt;
const before = (await getFight(fight.id))?.timerState?.pausedMs ?? null;

function connectAndJoin(label) {
  return new Promise((resolve) => {
    const socket = io(BASE, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      extraHeaders: { Cookie: `gw_auth=${rawToken}` },
      auth: { token: `Bearer ${rawToken}` },
      reconnection: false,
    });
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      resolve({ ok, socket });
    };
    socket.on('connect_error', () => done(false));
    socket.on('connect', () => {
      socket.timeout(6000).emit('join-event', { eventId }, (err, ack) => {
        if (err || !ack?.ok) return done(false);
        console.log(`      ${label}: joined room ${ack.room} ✓`);
        done(true);
      });
    });
    setTimeout(() => done(false), 8000);
  });
}

const first = await connectAndJoin('initial connect');
metrics.joinInitialOk = first.ok;
first.socket?.close(); // simulate a dropped live connection
await sleep(400);
const second = await connectAndJoin('after reconnect');
metrics.joinAfterReconnectOk = second.ok;
second.socket?.close();

const after = (await getFight(fight.id))?.timerState?.pausedMs ?? null;
const reconnectStable = before != null && after != null && before === after;
console.log(
  `      DB pausedMs across reconnect: ${before} → ${after}  ` +
    `${reconnectStable ? 'PASS ✓ timer unperturbed' : 'FAIL ✗ timer drifted'}\n`,
);

// ── verdict ──────────────────────────────────────────────────────────────────
const finalTimer = (await getFight(fight.id))?.timerState ?? null;
const pass =
  freezeOk &&
  metrics.intentionalStaleRejected &&
  metrics.staleUnderCorrectThreading === 0 &&
  metrics.httpErrors === 0 &&
  metrics.cyclesDone === CYCLES &&
  metrics.pausedMonotonic &&
  metrics.joinInitialOk &&
  metrics.joinAfterReconnectOk &&
  reconnectStable;

console.log('  █ TIMER RELIABILITY RESULTS\n');
console.log(`    fight / event.............: ${fight.id} / ${eventId}`);
console.log(`    round duration............: ${durationS}s`);
console.log(`    1) freeze Δ (want ≈tiny)...: ${freezeDelta}ms over a ${PAUSE_MS}ms pause  ${freezeOk ? '✓' : '✗'}`);
console.log(`    2) stale update rejected...: ${metrics.intentionalStaleRejected ? 'yes ✓' : 'no ✗'}`);
console.log(`    3) hammer cycles done.....: ${metrics.cyclesDone}/${CYCLES}  (stale=${metrics.staleUnderCorrectThreading}, httpErr=${metrics.httpErrors}, monotonic=${metrics.pausedMonotonic})`);
console.log(`    4) socket join init/recon.: ${metrics.joinInitialOk ? '✓' : '✗'} / ${metrics.joinAfterReconnectOk ? '✓' : '✗'}   DB timer stable=${reconnectStable ? '✓' : '✗'}`);
if (finalTimer) {
  console.log(
    `    final timer...............: state=${finalTimer.state} round=${finalTimer.round} ` +
      `remaining≈${(remainingMs(finalTimer) / 1000).toFixed(1)}s`,
  );
}
console.log(
  `\n  VERDICT: ${pass ? 'PASS ✓ — timer holds across heavy stop/resume + reconnect' : 'INVESTIGATE ✗ — see failed checks above'}\n`,
);
console.log('  (timer left where it is; this test never records a result — no fight state was finalized)\n');

process.exit(pass ? 0 : 1);
