import { test, expect, type APIRequestContext } from '@playwright/test';

// A COMPLETE event through the REAL API (authed admin via storageState):
// create → categories → ~28 athletes → registrations → weigh-in (PASS / MOVED_UP
// / ONE_HOUR→DQ / DISQUALIFIED / no-show) → draw (all 3 formats) → schedule →
// LIVE → run every fight (POINTS/KO/DQ/WO) → auto-complete → results + medal
// integrity → signature template + 3 PDFs + JSON export. Self-contained: deletes
// its event afterward.

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

const ORDER = ['REG_OPEN', 'LOCKED', 'WEIGHIN', 'WEIGH_IN_COMPLETED', 'DRAWN', 'PUBLISHED', 'LIVE', 'COMPLETED'];
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// adults-men weight classes → athlete count, covering every bracket format.
const PLAN: Array<[string, number]> = [
  ['56kg', 8],  // SINGLE_ELIMINATION (power of 2)
  ['60kg', 6],  // SINGLE_ELIMINATION (byes)
  ['65kg', 5],  // SINGLE_ELIMINATION (byes)
  ['70kg', 4],  // SINGLE_ELIMINATION
  ['75kg', 3],  // ROUND_ROBIN
  ['80kg', 2],  // DIRECT_FINAL
];

async function lifecycle(request: APIRequestContext, id: string) {
  return ((await (await request.get(`/api/events/${id}`)).json()) as any).lifecycle as string;
}
async function advance(request: APIRequestContext, id: string, to: string) {
  const cur = await lifecycle(request, id);
  if (ORDER.indexOf(cur) >= ORDER.indexOf(to)) return;
  let r = await request.post(`/api/events/${id}/lifecycle`, { data: { to } });
  if (!r.ok()) r = await request.post(`/api/events/${id}/lifecycle`, { data: { to, override: true, reason: 'fc' } });
  expect(r.ok(), `lifecycle ${cur}->${to}: ${await r.text()}`).toBeTruthy();
}
async function getFights(request: APIRequestContext, id: string) {
  const j = await (await request.get(`/api/fights?eventId=${id}`)).json();
  return (Array.isArray(j) ? j : j.fights ?? []) as any[];
}

test.describe('full event pipeline via API', () => {
  let eventId = '';
  test.afterAll(async ({ request }) => {
    if (eventId) await request.delete(`/api/events/${eventId}`).catch(() => undefined);
  });

  test('drives create → weigh-in → draw → live → results → exports', async ({ request }) => {
    // --- create ---
    const slug = `fc-api-${Date.now()}`;
    const created = await request.post('/api/events', {
      data: {
        name: 'FC API Event', nameKa: 'ეპი ივენთი', slug, location: 'Tbilisi',
        dates: {
          registrationStartDate: '2026-09-01T09:00:00.000Z', registrationEndDate: '2026-09-10T18:00:00.000Z',
          weighInStartDate: '2026-09-14T09:00:00.000Z', weighInEndDate: '2026-09-14T18:00:00.000Z',
          competitionStartDate: '2026-09-15T09:00:00.000Z', competitionEndDate: '2026-09-16T18:00:00.000Z',
        },
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    eventId = ((await created.json()) as any).id;

    // --- select adults-men weight classes ---
    const meta = (await (await request.get(`/api/events/${eventId}/categories`)).json()) as any;
    const tplId = meta.categoryTemplateId;
    const template = (await (await request.get(`/api/category-templates/${tplId}/categories`)).json()) as any[];
    const group = template.find((g) => g.code === 'adults-men-sanda');
    expect(group, 'adults-men group present in template').toBeTruthy();
    const wantNames = new Set(PLAN.map(([n]) => n));
    const weightCategoryIds = group.weightCategories.filter((w: any) => wantNames.has(w.name)).map((w: any) => w.id);
    const sel = await request.post(`/api/events/${eventId}/categories`, {
      data: { categoryTemplateId: tplId, ageGroups: [{ categoryTemplateGroupId: group.id, weightCategoryIds }] },
    });
    expect(sel.ok(), await sel.text()).toBeTruthy();

    const evCats = (await (await request.get(`/api/events/${eventId}/categories`)).json()) as any;
    const ag = evCats.ageGroups[0];
    const byName = new Map<string, any>(ag.weightCategories.map((w: any) => [w.name, w]));

    // --- athletes + registrations ---
    const regs: Array<{ regId: string; cat: any; className: string }> = [];
    let n = 0;
    for (const [className, count] of PLAN) {
      const cat = byName.get(className)!;
      for (let i = 0; i < count; i++) {
        const a = await request.post('/api/athletes', {
          data: { firstName: `M${n}`, lastName: 'Fc', documentId: `FCAPI${Date.now()}${n}`, sex: 'MALE', dateOfBirth: '2000-03-15' },
        });
        expect(a.status(), await a.text()).toBe(201);
        const athleteId = ((await a.json()) as any).athlete.id;
        const reg = await request.post('/api/registrations', { data: { eventId, athleteId, eventWeightCategoryId: cat.id } });
        expect(reg.ok(), await reg.text()).toBeTruthy();
        const regId = ((await reg.json()) as any).id ?? ((await reg.json()) as any).registration?.id;
        let st = await request.post(`/api/registrations/${regId}/status`, { data: { status: 'APPROVED' } });
        if (!st.ok()) st = await request.post(`/api/registrations/${regId}/status`, { data: { status: 'APPROVED', override: true, reason: 'fc' } });
        expect(st.ok(), await st.text()).toBeTruthy();
        regs.push({ regId, cat, className });
        n++;
      }
    }
    expect(regs.length).toBe(PLAN.reduce((s, [, c]) => s + c, 0));

    // --- weigh-in: lock → WEIGHIN, then every decision type ---
    await advance(request, eventId, 'LOCKED');
    await advance(request, eventId, 'WEIGHIN');
    const mid = (cat: any) => {
      const { minWeightKgExcl: lo, maxWeightKgIncl: hi } = cat;
      if (hi == null) return (lo ?? 80) + 5;
      if (lo == null) return Math.max(1, hi - 2);
      return Math.round(((lo + hi) / 2) * 10) / 10;
    };
    const big = regs.filter((r) => r.className === '56kg'); // edge cases here (size 8 → stays SE)
    const next56 = byName.get('60kg').id;
    let pass = 0;
    for (let i = 0; i < regs.length; i++) {
      const r = regs[i];
      if (r === big[0]) { // MOVED_UP
        const w = await request.post('/api/weighin', { data: { registrationId: r.regId, weightKg: (r.cat.maxWeightKgIncl ?? 56) + 2, decision: 'MOVED_UP', nextEventWeightCategoryId: next56, override: true, reason: 'fc moveup' } });
        expect(w.ok(), `MOVED_UP: ${await w.text()}`).toBeTruthy(); continue;
      }
      if (r === big[1]) { // ONE_HOUR → resolve DQ
        const w = await request.post('/api/weighin', { data: { registrationId: r.regId, weightKg: (r.cat.maxWeightKgIncl ?? 56) + 1.5, decision: 'ONE_HOUR', override: true, reason: 'fc 1h' } });
        expect(w.ok(), `ONE_HOUR: ${await w.text()}`).toBeTruthy();
        const wj = (await w.json()) as any;
        const attemptId = wj.attempt?.id ?? wj.id ?? wj.attemptId;
        expect(attemptId, 'ONE_HOUR returns an attempt id').toBeTruthy();
        const rr = await request.post(`/api/weighin/${attemptId}/resolve`, { data: { action: 'DQ', reason: 'fc resolve dq' } });
        expect(rr.ok(), `resolve DQ: ${await rr.text()}`).toBeTruthy(); continue;
      }
      if (r === big[2]) { // DISQUALIFIED
        const w = await request.post('/api/weighin', { data: { registrationId: r.regId, weightKg: (r.cat.maxWeightKgIncl ?? 56) + 5, decision: 'DISQUALIFIED', override: true, reason: 'fc dq' } });
        expect(w.ok(), `DISQUALIFIED: ${await w.text()}`).toBeTruthy(); continue;
      }
      if (r === big[3]) { continue; } // no-show (skip)
      const w = await request.post('/api/weighin', { data: { registrationId: r.regId, weightKg: mid(r.cat), decision: 'PASS' } });
      if (w.ok()) pass++;
      else {
        const w2 = await request.post('/api/weighin', { data: { registrationId: r.regId, weightKg: mid(r.cat), decision: 'PASS', override: true, reason: 'fc pass' } });
        expect(w2.ok(), `PASS: ${await w2.text()}`).toBeTruthy(); pass++;
      }
    }
    expect(pass).toBeGreaterThan(15);

    // advance to WEIGH_IN_COMPLETED (resolve the no-show if it blocks)
    let r = await request.post(`/api/events/${eventId}/lifecycle`, { data: { to: 'WEIGH_IN_COMPLETED' } });
    if (!r.ok()) {
      const ns = big[3];
      await request.post('/api/weighin', { data: { registrationId: ns.regId, weightKg: (ns.cat.maxWeightKgIncl ?? 56) - 1, decision: 'DISQUALIFIED', override: true, reason: 'fc no-show' } });
      await advance(request, eventId, 'WEIGH_IN_COMPLETED');
    }
    expect(await lifecycle(request, eventId)).toBe('WEIGH_IN_COMPLETED');

    // --- draw (override blocked categories) + verify all 3 formats ---
    let draw = await request.post('/api/draw', { data: { eventId } });
    if (!draw.ok()) draw = await request.post('/api/draw', { data: { eventId, override: true, reason: 'fc' } });
    expect(draw.ok(), `draw: ${await draw.text()}`).toBeTruthy();
    const brackets = (await (await request.get(`/api/brackets?eventId=${eventId}`)).json()) as any[];
    const formats = new Set(brackets.map((b) => b.format));
    expect(formats.has('DIRECT_FINAL'), 'DIRECT_FINAL produced').toBeTruthy();
    expect(formats.has('ROUND_ROBIN'), 'ROUND_ROBIN produced').toBeTruthy();
    expect(formats.has('SINGLE_ELIMINATION'), 'SINGLE_ELIMINATION produced').toBeTruthy();

    // --- schedule ---
    expect((await request.post('/api/mats', { data: { eventId, name: 'Mat 1', order: 0 } })).ok()).toBeTruthy();
    expect((await request.post('/api/mats', { data: { eventId, name: 'Mat 2', order: 1 } })).ok()).toBeTruthy();
    expect((await request.post('/api/schedule-sessions', { data: { eventId, name: 'S1', startTime: '2026-09-15T09:00:00.000Z', endTime: '2026-09-15T20:00:00.000Z' } })).ok()).toBeTruthy();
    expect((await request.post('/api/schedule/generate', { data: { eventId, avgBoutSeconds: 180, bufferSeconds: 60 } })).ok()).toBeTruthy();

    // --- go LIVE ---
    await advance(request, eventId, 'DRAWN');
    await advance(request, eventId, 'PUBLISHED');
    await advance(request, eventId, 'LIVE');
    expect(await lifecycle(request, eventId)).toBe('LIVE');

    // --- run every fight (rotate win methods) ---
    const methods = ['POINTS', 'KO', 'DQ', 'WO'];
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
          await request.post(`/api/fights/${f.id}/start`);
          await request.post(`/api/fights/${f.id}/timer`, { data: { action: 'START', round: 1 } });
          const body: any = { winner: ran % 2 === 0 ? 'RED' : 'BLUE', method };
          if (method === 'DQ') body.dqReason = 'Illegal technique';
          const fin = await request.post(`/api/fights/${f.id}/finish`, { data: body });
          expect(fin.ok(), `finish (${method}): ${await fin.text()}`).toBeTruthy();
          ran++; progressed = true;
        }
      }
    }
    expect(ran, 'ran fights').toBeGreaterThan(10);

    // every contested fight resolved; winners are real corners
    const finalFights = await getFights(request, eventId);
    const unresolved = finalFights.filter((f) => f.redAthleteId && f.blueAthleteId && f.redAthleteId !== f.blueAthleteId && !f.winnerAthleteId);
    expect(unresolved, 'no contested fight left unresolved').toEqual([]);
    for (const f of finalFights) {
      if (f.winnerAthleteId && f.redAthleteId && f.blueAthleteId) {
        expect([f.redAthleteId, f.blueAthleteId]).toContain(f.winnerAthleteId);
      }
    }
    expect(await lifecycle(request, eventId)).toBe('COMPLETED');

    // --- results + medal integrity ---
    const results = (await (await request.get(`/api/results?eventId=${eventId}`)).json()) as any[];
    expect(results.length).toBeGreaterThan(0);
    const summary = await request.get(`/api/results/summary?eventId=${eventId}`);
    expect(summary.ok()).toBeTruthy();
    const mt = ((await summary.json()) as any).medalTable ?? [];
    for (const row of mt) {
      if (row.total != null) expect((row.gold || 0) + (row.silver || 0) + (row.bronze || 0)).toBe(row.total);
    }

    // --- exports: signature template + 3 PDFs + JSON export ---
    const sig = await request.post('/api/signature-templates', { data: { judgeNameEn: 'Head Judge', judgeNameKa: 'მთავარი მსაჯი', signature: PNG } });
    expect(sig.ok(), `signature template: ${await sig.text()}`).toBeTruthy();
    const sigId = ((await sig.json()) as any).id;
    for (const [path, label] of [
      [`/api/exports/${eventId}/results.pdf?templateId=${sigId}`, 'results.pdf'],
      [`/api/exports/${eventId}/schedule.pdf`, 'schedule.pdf'],
      [`/api/exports/${eventId}/weighin.pdf`, 'weighin.pdf'],
    ] as const) {
      const res = await request.get(path);
      expect(res.ok(), `${label}: ${res.status()}`).toBeTruthy();
      const buf = await res.body();
      expect(buf.subarray(0, 5).toString('latin1'), `${label} is a PDF`).toBe('%PDF-');
    }
    const exp = await request.post('/api/exports', { data: { eventId, types: ['registrations', 'brackets', 'schedule', 'results'] } });
    expect(exp.ok(), `json export: ${await exp.text()}`).toBeTruthy();
    expect(((await exp.json()) as any).links.length).toBeGreaterThan(0);

    // schedule edits refused once read-only (COMPLETED)
    const ro = await request.post('/api/schedule/generate', { data: { eventId, avgBoutSeconds: 180, bufferSeconds: 60 } });
    expect(ro.status()).toBe(400);
    expect(await ro.text()).toContain('EVENT_READ_ONLY');
  });
});
