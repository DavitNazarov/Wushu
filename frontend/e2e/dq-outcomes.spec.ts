import { test, expect, type APIRequestContext } from '@playwright/test';

// EXHAUSTIVE "every outcome" pipeline, paced to survive the dev rate limiter
// (global 10 req/10s + 120/min; login 5/min) so it runs against the SHARED
// :3000 dev stack with throttling ON — no THROTTLE_DISABLED restart needed.
//
// Covers, end to end through the REAL API:
//   • every weigh-in decision     PASS / MOVED_UP / ONE_HOUR→resolve DQ / DISQUALIFIED
//   • every bracket format        SINGLE_ELIMINATION / ROUND_ROBIN / DIRECT_FINAL
//   • every fight win method       POINTS / KO / DQ / WO
//   • results + medal-table integrity, then read-only enforcement
//
// Self-contained: logs in itself (1 login), creates its own event, deletes it
// afterward.

test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

const ADMIN = { email: 'admin@geowushu.ge', password: 'Password123!' };
const ORDER = ['REG_OPEN', 'LOCKED', 'WEIGHIN', 'WEIGH_IN_COMPLETED', 'DRAWN', 'PUBLISHED', 'LIVE', 'COMPLETED'];

// --- request pacer: never fire two mutating/read calls closer than GAP apart,
//     keeping us comfortably under the short 10-req/10s bucket. ---
const GAP_MS = 1200;
let lastAt = 0;
async function gate() {
  const now = Date.now();
  const wait = Math.max(0, GAP_MS - (now - lastAt));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastAt = Date.now();
}
// paced wrappers
async function gget(request: APIRequestContext, url: string) {
  await gate();
  return request.get(url);
}
async function gpost(request: APIRequestContext, url: string, data?: unknown) {
  await gate();
  return request.post(url, data === undefined ? undefined : { data });
}
async function gdelete(request: APIRequestContext, url: string) {
  await gate();
  return request.delete(url);
}

async function lifecycle(request: APIRequestContext, id: string) {
  return ((await (await gget(request, `/api/events/${id}`)).json()) as any).lifecycle as string;
}
async function advance(request: APIRequestContext, id: string, to: string) {
  const cur = await lifecycle(request, id);
  if (ORDER.indexOf(cur) >= ORDER.indexOf(to)) return;
  let r = await gpost(request, `/api/events/${id}/lifecycle`, { to });
  if (!r.ok()) r = await gpost(request, `/api/events/${id}/lifecycle`, { to, override: true, reason: 'dq-spec' });
  expect(r.ok(), `lifecycle ${cur}->${to}: ${await r.text()}`).toBeTruthy();
}
async function getFights(request: APIRequestContext, id: string) {
  const j = await (await gget(request, `/api/fights?eventId=${id}`)).json();
  return (Array.isArray(j) ? j : j.fights ?? []) as any[];
}
const mid = (cat: any) => {
  const lo = cat.minWeightKgExcl, hi = cat.maxWeightKgIncl;
  if (hi == null) return (lo ?? 80) + 5;
  if (lo == null) return Math.max(1, hi - 2);
  return Math.round(((lo + hi) / 2) * 10) / 10;
};

// competing classes (clean draws) + one weigh-in-decision showcase class
const COMPETE: Array<[string, number]> = [
  ['70kg', 4], // SINGLE_ELIMINATION
  ['75kg', 3], // ROUND_ROBIN
  ['80kg', 2], // DIRECT_FINAL
];
const DECISION_CLASS: [string, number] = ['60kg', 4]; // PASS / MOVED_UP / ONE_HOUR→DQ / DISQUALIFIED

test.describe('every outcome incl DQ — paced full pipeline', () => {
  let eventId = '';
  let token: { request: APIRequestContext } | null = null;

  test.afterAll(async ({ request }) => {
    if (eventId) await gdelete(request, `/api/events/${eventId}`).catch(() => undefined);
  });

  test('weigh-in decisions + all formats + all win methods + results', async ({ request, baseURL }) => {
    // --- login (single, paced) ---
    await gate();
    const li = await request.post('/api/auth/login', { data: ADMIN, headers: { origin: baseURL! } });
    expect(li.ok(), `login: ${await li.text()}`).toBeTruthy();

    // --- create event ---
    const slug = `dq-${Date.now()}`;
    const created = await gpost(request, '/api/events', {
      name: 'DQ Outcomes', nameKa: 'დისკვალიფიკაცია', slug, location: 'Tbilisi',
      dates: {
        registrationStartDate: '2026-09-01T09:00:00.000Z', registrationEndDate: '2026-09-10T18:00:00.000Z',
        weighInStartDate: '2026-09-14T09:00:00.000Z', weighInEndDate: '2026-09-14T18:00:00.000Z',
        competitionStartDate: '2026-09-15T09:00:00.000Z', competitionEndDate: '2026-09-16T18:00:00.000Z',
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    eventId = ((await created.json()) as any).id;

    // --- select adults-men weight classes (compete set + decision class + move-up target) ---
    const meta = (await (await gget(request, `/api/events/${eventId}/categories`)).json()) as any;
    const tplId = meta.categoryTemplateId;
    const template = (await (await gget(request, `/api/category-templates/${tplId}/categories`)).json()) as any[];
    const group = template.find((g) => g.code === 'adults-men-sanda');
    expect(group, 'adults-men group present').toBeTruthy();
    const wanted = new Set([...COMPETE.map(([n]) => n), DECISION_CLASS[0], '65kg']); // 65kg = move-up target
    const weightCategoryIds = group.weightCategories.filter((w: any) => wanted.has(w.name)).map((w: any) => w.id);
    const sel = await gpost(request, `/api/events/${eventId}/categories`, {
      categoryTemplateId: tplId, ageGroups: [{ categoryTemplateGroupId: group.id, weightCategoryIds }],
    });
    expect(sel.ok(), await sel.text()).toBeTruthy();

    const evCats = (await (await gget(request, `/api/events/${eventId}/categories`)).json()) as any;
    const byName = new Map<string, any>(evCats.ageGroups[0].weightCategories.map((w: any) => [w.name, w]));

    // --- athletes + approved registrations ---
    type Reg = { regId: string; cat: any; className: string };
    const regs: Reg[] = [];
    let n = 0;
    const plan: Array<[string, number]> = [...COMPETE, DECISION_CLASS];
    for (const [className, count] of plan) {
      const cat = byName.get(className)!;
      expect(cat, `category ${className} selected`).toBeTruthy();
      for (let i = 0; i < count; i++) {
        const a = await gpost(request, '/api/athletes', {
          firstName: `D${n}`, lastName: 'Dq', documentId: `DQ${Date.now()}${n}`, sex: 'MALE', dateOfBirth: '2000-03-15',
        });
        expect(a.status(), await a.text()).toBe(201);
        const athleteId = ((await a.json()) as any).athlete.id;
        const reg = await gpost(request, '/api/registrations', { eventId, athleteId, eventWeightCategoryId: cat.id });
        expect(reg.ok(), await reg.text()).toBeTruthy();
        const regId = ((await reg.json()) as any).id ?? ((await reg.json()) as any).registration?.id;
        let st = await gpost(request, `/api/registrations/${regId}/status`, { status: 'APPROVED' });
        if (!st.ok()) st = await gpost(request, `/api/registrations/${regId}/status`, { status: 'APPROVED', override: true, reason: 'dq-spec' });
        expect(st.ok(), await st.text()).toBeTruthy();
        regs.push({ regId, cat, className });
        n++;
      }
    }

    // --- weigh-in: lock → WEIGHIN ---
    await advance(request, eventId, 'LOCKED');
    await advance(request, eventId, 'WEIGHIN');

    const decisionRegs = regs.filter((r) => r.className === DECISION_CLASS[0]); // 4 of them
    const moveTarget = byName.get('65kg').id;
    const decisionsSeen = new Set<string>();

    for (const r of regs) {
      if (r === decisionRegs[0]) {
        // MOVED_UP → 65kg
        const w = await gpost(request, '/api/weighin', { registrationId: r.regId, weightKg: (r.cat.maxWeightKgIncl ?? 60) + 2, decision: 'MOVED_UP', nextEventWeightCategoryId: moveTarget, override: true, reason: 'dq moveup' });
        expect(w.ok(), `MOVED_UP: ${await w.text()}`).toBeTruthy();
        decisionsSeen.add('MOVED_UP');
      } else if (r === decisionRegs[1]) {
        // ONE_HOUR provisional → resolve as DQ
        const w = await gpost(request, '/api/weighin', { registrationId: r.regId, weightKg: (r.cat.maxWeightKgIncl ?? 60) + 1.5, decision: 'ONE_HOUR', override: true, reason: 'dq 1h' });
        expect(w.ok(), `ONE_HOUR: ${await w.text()}`).toBeTruthy();
        const wj = (await w.json()) as any;
        const attemptId = wj.attempt?.id ?? wj.id ?? wj.attemptId;
        expect(attemptId, 'ONE_HOUR returns attempt id').toBeTruthy();
        const rr = await gpost(request, `/api/weighin/${attemptId}/resolve`, { action: 'DQ', reason: 'dq resolve' });
        expect(rr.ok(), `resolve DQ: ${await rr.text()}`).toBeTruthy();
        decisionsSeen.add('ONE_HOUR_DQ');
      } else if (r === decisionRegs[2]) {
        // DISQUALIFIED outright (overweight)
        const w = await gpost(request, '/api/weighin', { registrationId: r.regId, weightKg: (r.cat.maxWeightKgIncl ?? 60) + 5, decision: 'DISQUALIFIED', override: true, reason: 'dq overweight' });
        expect(w.ok(), `DISQUALIFIED: ${await w.text()}`).toBeTruthy();
        decisionsSeen.add('DISQUALIFIED');
      } else {
        // PASS (everyone else, incl. decisionRegs[3])
        let w = await gpost(request, '/api/weighin', { registrationId: r.regId, weightKg: mid(r.cat), decision: 'PASS' });
        if (!w.ok()) w = await gpost(request, '/api/weighin', { registrationId: r.regId, weightKg: mid(r.cat), decision: 'PASS', override: true, reason: 'dq pass' });
        expect(w.ok(), `PASS: ${await w.text()}`).toBeTruthy();
        decisionsSeen.add('PASS');
      }
    }
    // every weigh-in decision type was exercised
    expect([...decisionsSeen].sort()).toEqual(['DISQUALIFIED', 'MOVED_UP', 'ONE_HOUR_DQ', 'PASS']);

    await advance(request, eventId, 'WEIGH_IN_COMPLETED');
    expect(await lifecycle(request, eventId)).toBe('WEIGH_IN_COMPLETED');

    // --- draw: assert all 3 bracket formats present ---
    let draw = await gpost(request, '/api/draw', { eventId });
    if (!draw.ok()) draw = await gpost(request, '/api/draw', { eventId, override: true, reason: 'dq-spec' });
    expect(draw.ok(), `draw: ${await draw.text()}`).toBeTruthy();
    const brackets = (await (await gget(request, `/api/brackets?eventId=${eventId}`)).json()) as any[];
    const formats = new Set(brackets.map((b) => b.format));
    expect(formats.has('SINGLE_ELIMINATION'), 'SINGLE_ELIMINATION produced').toBeTruthy();
    expect(formats.has('ROUND_ROBIN'), 'ROUND_ROBIN produced').toBeTruthy();
    expect(formats.has('DIRECT_FINAL'), 'DIRECT_FINAL produced').toBeTruthy();

    // --- schedule ---
    expect((await gpost(request, '/api/mats', { eventId, name: 'Mat 1', order: 0 })).ok()).toBeTruthy();
    expect((await gpost(request, '/api/schedule-sessions', { eventId, name: 'S1', startTime: '2026-09-15T09:00:00.000Z', endTime: '2026-09-15T20:00:00.000Z' })).ok()).toBeTruthy();
    expect((await gpost(request, '/api/schedule/generate', { eventId, avgBoutSeconds: 180, bufferSeconds: 60 })).ok()).toBeTruthy();

    // --- go LIVE ---
    await advance(request, eventId, 'DRAWN');
    await advance(request, eventId, 'PUBLISHED');
    await advance(request, eventId, 'LIVE');
    expect(await lifecycle(request, eventId)).toBe('LIVE');

    // --- run every contested fight, cycling all 4 win methods ---
    const methods = ['POINTS', 'KO', 'DQ', 'WO'];
    const methodsSeen = new Set<string>();
    let ran = 0, mi = 0;
    const maxRound = Math.max(1, ...(await getFights(request, eventId)).map((f) => f.round || 1));
    for (let round = 1; round <= maxRound + 2; round++) {
      let progressed = true;
      while (progressed) {
        progressed = false;
        const playable = (await getFights(request, eventId)).filter(
          (f) => f.redAthleteId && f.blueAthleteId && f.redAthleteId !== f.blueAthleteId && !f.winnerAthleteId && (f.round || 1) === round,
        );
        for (const f of playable) {
          const method = methods[mi++ % methods.length];
          await gpost(request, `/api/fights/${f.id}/start`);
          await gpost(request, `/api/fights/${f.id}/timer`, { action: 'START', round: 1 });
          const body: any = { winner: ran % 2 === 0 ? 'RED' : 'BLUE', method };
          if (method === 'DQ') body.dqReason = 'Illegal technique';
          const fin = await gpost(request, `/api/fights/${f.id}/finish`, body);
          expect(fin.ok(), `finish (${method}): ${await fin.text()}`).toBeTruthy();
          methodsSeen.add(method);
          ran++; progressed = true;
        }
      }
    }
    expect(ran, 'ran contested fights').toBeGreaterThan(0);
    // all four win methods exercised (7 contested fights ≥ 4 → cycle covers them)
    expect([...methodsSeen].sort()).toEqual(['DQ', 'KO', 'POINTS', 'WO']);

    // no contested fight left unresolved; winners are real corners
    const finalFights = await getFights(request, eventId);
    const unresolved = finalFights.filter((f) => f.redAthleteId && f.blueAthleteId && f.redAthleteId !== f.blueAthleteId && !f.winnerAthleteId);
    expect(unresolved, 'no contested fight unresolved').toEqual([]);
    for (const f of finalFights) {
      if (f.winnerAthleteId && f.redAthleteId && f.blueAthleteId) {
        expect([f.redAthleteId, f.blueAthleteId]).toContain(f.winnerAthleteId);
      }
    }
    expect(await lifecycle(request, eventId)).toBe('COMPLETED');

    // --- results + medal-table integrity ---
    const results = (await (await gget(request, `/api/results?eventId=${eventId}`)).json()) as any[];
    expect(results.length).toBeGreaterThan(0);
    const summary = await gget(request, `/api/results/summary?eventId=${eventId}`);
    expect(summary.ok()).toBeTruthy();
    const mt = ((await summary.json()) as any).medalTable ?? [];
    for (const row of mt) {
      if (row.total != null) expect((row.gold || 0) + (row.silver || 0) + (row.bronze || 0)).toBe(row.total);
    }

    // --- read-only enforcement once COMPLETED ---
    const ro = await gpost(request, '/api/schedule/generate', { eventId, avgBoutSeconds: 180, bufferSeconds: 60 });
    expect(ro.status()).toBe(400);
    expect(await ro.text()).toContain('EVENT_READ_ONLY');
  });
});
