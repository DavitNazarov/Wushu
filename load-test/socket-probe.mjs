// SOCKET PROBE — empirically test the real-time join path against a RUNNING backend.
//
// Why: fights.gateway.ts `join-event` runs assertUuid() on the eventId, but
// Event.id is @default(cuid()). A cuid is not a UUID, so the join should be
// rejected at the format gate — meaning the live page silently never joins the
// `event:<id>` room and never receives fight/timer/schedule broadcasts.
//
// This does two join attempts so we can tell WHERE it fails:
//   A) real cuid eventId      -> expect "Invalid eventId: must be a UUID" (the bug)
//   B) random valid UUID      -> expect "FORBIDDEN" (format gate passed, lookup failed)
// If A and B fail differently, the cuid is dying at the UUID gate. Proven.
//
//   node load-test/socket-probe.mjs
//   (override: API_URL, ADMIN_EMAIL, ADMIN_PASSWORD, EVENT_ID)
//
import { io } from 'socket.io-client';
import { randomUUID } from 'node:crypto';

const BASE = process.env.API_URL || 'http://localhost:4000';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@geowushu.ge';
const PASS = process.env.ADMIN_PASSWORD || 'Password123!';
const REAL_CUID = process.env.EVENT_ID || 'cmpuw57s90002vdftiapf47n5'; // load-weighin-stress
const SOCKET_PATH = '/api/socket.io';

function fail(msg, ...rest) {
  console.error('✗', msg, ...rest);
  process.exit(1);
}

// 1) Login -> gw_auth cookie (which IS the JWT)
const res = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
});
if (!res.ok) fail('login failed', res.status, await res.text());
const setCookie = (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('gw_auth='));
const gwAuth = setCookie ? setCookie.split(';')[0].slice('gw_auth='.length) : null;
if (!gwAuth) fail('no gw_auth cookie in login response');
console.log(`→ logged in as ${EMAIL}; gw_auth len=${gwAuth.length}`);

// 2) Connect (auth via both cookie header and bearer token — gateway accepts either)
const socket = io(BASE, {
  path: SOCKET_PATH,
  transports: ['websocket'],
  extraHeaders: { Cookie: `gw_auth=${gwAuth}` },
  auth: { token: `Bearer ${gwAuth}` },
});

socket.on('connect_error', (e) => fail('connect_error (auth rejected at handshake?):', e.message));

// Emit one join-event and resolve with how it settled: ack | exception | timeout.
function joinOnce(eventId, label, timeoutMs = 4000) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => {
      if (settled) return;
      settled = true;
      socket.off('exception', onException);
      resolve({ label, eventId, ...r });
    };
    const onException = (err) => done({ result: 'exception', payload: err });
    socket.on('exception', onException);
    socket.timeout(timeoutMs).emit('join-event', { eventId }, (timeoutErr, ack) => {
      if (timeoutErr) return done({ result: 'timeout' });
      done({ result: 'ack', payload: ack });
    });
  });
}

socket.on('connect', async () => {
  console.log(`→ CONNECTED socket id=${socket.id}\n`);

  const randUuid = randomUUID();
  const a = await joinOnce(REAL_CUID, 'A: real cuid eventId');
  const b = await joinOnce(randUuid, 'B: random valid UUID');

  const show = (x) =>
    `   ${x.label}\n     eventId=${x.eventId}\n     => ${x.result}: ${JSON.stringify(x.payload ?? null)}`;
  console.log('RESULTS:');
  console.log(show(a));
  console.log(show(b));
  console.log('');

  const aRejectedByFormat =
    a.result === 'exception' && JSON.stringify(a.payload).toLowerCase().includes('uuid');
  const bPassedFormat =
    b.result === 'exception'
      ? !JSON.stringify(b.payload).toLowerCase().includes('uuid') // e.g. FORBIDDEN
      : b.result === 'ack';

  if (aRejectedByFormat && bPassedFormat) {
    console.log('VERDICT: CONFIRMED BUG ✗');
    console.log('  The real cuid eventId is rejected at the UUID format gate, while a');
    console.log('  syntactically-valid UUID gets past it (and fails later at org lookup).');
    console.log('  => Live clients can NEVER join event:<cuid>; broadcasts never arrive.');
  } else if (a.result === 'ack') {
    console.log('VERDICT: join-event with a cuid SUCCEEDED — no bug, real-time joins work.');
  } else {
    console.log('VERDICT: inconclusive — inspect the raw results above.');
  }

  socket.close();
  process.exit(0);
});

setTimeout(() => fail('TIMEOUT — no connect within 8s'), 8000);
