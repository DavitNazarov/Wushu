// SOCKET LOAD — connection flood for the real-time (socket.io) live layer.
//
// REST load tests measure request RATE. Sockets are different: the cost is
// CONCURRENT PERSISTENT CONNECTIONS (a file descriptor + memory + engine.io
// state each) and the broadcast fan-out to every client in a room. This test
// answers: "a marquee fight goes LIVE and every operator/display opens the live
// page at once — how many simultaneous connections hold, and do they stay up?"
//
// The socket handshake is AUTH-GATED (fights.gateway.ts), so every client
// carries a real JWT. We log in once and reuse the token across all sockets
// (the gateway verifies the JWT per connection; one user, many sockets is fine).
//
// Phases:  ramp TARGET connections over RAMP s  ->  HOLD s flat  ->  teardown.
// A healthy run: connectFail=0, joinFail=0, and ZERO disconnects during the flat
// HOLD (a drop while load is flat = the server shedding connections = a ceiling).
//
//   TARGET = concurrent connections to reach   (default 200)
//   RAMP   = seconds to ramp up to TARGET       (default 20)
//   HOLD   = seconds to hold flat               (default 40)
//   EVENT_ID = event cuid to join               (default load-weighin-stress)
//
//   npm run loadtest:socket
//   TARGET=2000 RAMP=30 HOLD=60 npm run loadtest:socket   # find the ceiling
//
// Going past ~1k connections from one machine? Raise the client fd limit first:
//   ulimit -n 65535
//
import { io } from 'socket.io-client';
import { performance } from 'node:perf_hooks';

const BASE = process.env.API_URL || 'http://localhost:4000';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@geowushu.ge';
const PASS = process.env.ADMIN_PASSWORD || 'Password123!';
const EVENT_ID = process.env.EVENT_ID || 'cmpuw57s90002vdftiapf47n5'; // load-weighin-stress
const TARGET = Number(process.env.TARGET || 200);
const RAMP_S = Number(process.env.RAMP || 20);
const HOLD_S = Number(process.env.HOLD || 40);
const SOCKET_PATH = '/api/socket.io';
const JOIN_TIMEOUT_MS = 8000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
const ms = (n) => `${n.toFixed(1)}ms`;

// --- auth: one login, shared token ------------------------------------------
const res = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
});
if (!res.ok) {
  console.error('✗ login failed', res.status, await res.text());
  process.exit(1);
}
const setCookie = (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('gw_auth='));
const TOKEN = setCookie ? setCookie.split(';')[0].slice('gw_auth='.length) : null;
if (!TOKEN) {
  console.error('✗ no gw_auth cookie in login response');
  process.exit(1);
}
console.log(`→ logged in as ${EMAIL}`);
console.log(`→ flooding ${TARGET} connections over ${RAMP_S}s, holding ${HOLD_S}s, event=${EVENT_ID}\n`);

// --- metrics ----------------------------------------------------------------
const m = {
  connectOk: 0,
  connectFail: 0,
  joinOk: 0,
  joinFail: 0,
  connectMs: [],
  joinMs: [],
  disconnectsTotal: 0,
  disconnectsDuringHold: 0,
};
let connectedNow = 0;
let peakConnected = 0;
let phase = 'ramp'; // ramp | hold | teardown
const sockets = [];

function spawnClient() {
  const t0 = performance.now();
  const socket = io(BASE, {
    path: SOCKET_PATH,
    transports: ['websocket'],
    extraHeaders: { Cookie: `gw_auth=${TOKEN}` },
    auth: { token: `Bearer ${TOKEN}` },
    reconnection: false, // we want raw connect outcomes, not silent retries
  });
  sockets.push(socket);

  socket.on('connect', () => {
    m.connectOk++;
    m.connectMs.push(performance.now() - t0);
    connectedNow++;
    if (connectedNow > peakConnected) peakConnected = connectedNow;

    const jt0 = performance.now();
    let settled = false;
    const onException = () => {
      if (settled) return;
      settled = true;
      socket.off('exception', onException);
      m.joinFail++;
    };
    socket.on('exception', onException);
    socket.timeout(JOIN_TIMEOUT_MS).emit('join-event', { eventId: EVENT_ID }, (err, ack) => {
      if (settled) return;
      settled = true;
      socket.off('exception', onException);
      if (err || !ack?.ok) m.joinFail++;
      else {
        m.joinOk++;
        m.joinMs.push(performance.now() - jt0);
      }
    });
  });

  socket.on('connect_error', () => {
    m.connectFail++;
  });

  socket.on('disconnect', () => {
    connectedNow--;
    if (phase === 'teardown') return; // our own close() — expected
    m.disconnectsTotal++;
    if (phase === 'hold') m.disconnectsDuringHold++;
  });
}

// --- progress line ----------------------------------------------------------
const progress = setInterval(() => {
  process.stdout.write(
    `\r[${phase}] connected=${connectedNow}/${TARGET} ` +
      `joinOk=${m.joinOk} joinFail=${m.joinFail} connectFail=${m.connectFail} ` +
      `holdDrops=${m.disconnectsDuringHold}   `,
  );
}, 500);

// --- ramp -------------------------------------------------------------------
const batches = Math.max(1, RAMP_S * 5); // spawn every 200ms
const perBatch = Math.max(1, Math.ceil(TARGET / batches));
let spawned = 0;
while (spawned < TARGET) {
  const n = Math.min(perBatch, TARGET - spawned);
  for (let i = 0; i < n; i++) spawnClient();
  spawned += n;
  await sleep(200);
}

// --- hold -------------------------------------------------------------------
phase = 'hold';
await sleep(HOLD_S * 1000);

// --- teardown ---------------------------------------------------------------
phase = 'teardown';
clearInterval(progress);
process.stdout.write('\n');
for (const s of sockets) s.close();
await sleep(500);

// --- summary ----------------------------------------------------------------
const pass = m.connectFail === 0 && m.joinFail === 0 && m.disconnectsDuringHold === 0;
console.log('\n  █ SOCKET LOAD RESULTS\n');
console.log(`    target connections........: ${TARGET}`);
console.log(`    peak concurrent connected.: ${peakConnected}`);
console.log(`    connect ok / fail.........: ${m.connectOk} / ${m.connectFail}`);
console.log(`    join-event ok / fail......: ${m.joinOk} / ${m.joinFail}`);
console.log(
  `    connect latency...........: med=${ms(pct(m.connectMs, 50))} p95=${ms(pct(m.connectMs, 95))} p99=${ms(pct(m.connectMs, 99))} max=${ms(pct(m.connectMs, 100))}`,
);
console.log(
  `    join-ack latency..........: med=${ms(pct(m.joinMs, 50))} p95=${ms(pct(m.joinMs, 95))} p99=${ms(pct(m.joinMs, 99))} max=${ms(pct(m.joinMs, 100))}`,
);
console.log(`    disconnects during HOLD...: ${m.disconnectsDuringHold}  (drops while load is flat)`);
console.log(`    disconnects total.........: ${m.disconnectsTotal}\n`);
console.log(`  VERDICT: ${pass ? 'PASS ✓ — all connections held and joined cleanly' : 'INVESTIGATE ✗ — see fails/holdDrops above'}\n`);

process.exit(pass ? 0 : 1);
