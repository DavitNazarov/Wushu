import { test, expect, type APIRequestContext } from '@playwright/test';

// FULL competition pipeline on a fresh event, through the REAL API (not the
// shortcut seed): create → categories → register 4 athletes → weigh-in → draw →
// schedule → LIVE → run every fight (timer START + PAUSE/RESUME ×3 each) →
// winner propagation → auto-complete → results. Also probes the schedule
// generate/auto/manual behaviour while the event is genuinely LIVE.
//
// Runs serially as one flow; cleans up its event afterward.

const LIFECYCLE_ORDER = [
  'REG_OPEN', 'LOCKED', 'WEIGHIN', 'WEIGH_IN_COMPLETED',
  'DRAWN', 'PUBLISHED', 'LIVE', 'COMPLETED',
];

test.describe.configure({ mode: 'serial' });

test.describe('full pipeline — reg → results + live + schedule', () => {
  let eventId = '';

  test.afterAll(async ({ request }) => {
    if (eventId) await request.delete(`/api/events/${eventId}`).catch(() => undefined);
  });

  const lifecycle = async (request: APIRequestContext) =>
    ((await (await request.get(`/api/events/${eventId}`)).json()) as { lifecycle: string }).lifecycle;

  async function advance(request: APIRequestContext, to: string) {
    const cur = await lifecycle(request);
    if (LIFECYCLE_ORDER.indexOf(cur) >= LIFECYCLE_ORDER.indexOf(to)) return; // auto-advanced past it
    let r = await request.post(`/api/events/${eventId}/lifecycle`, { data: { to } });
    if (!r.ok()) r = await request.post(`/api/events/${eventId}/lifecycle`, { data: { to, override: true, reason: 'e2e' } });
    expect(r.ok(), `lifecycle ${cur}->${to}: ${await r.text()}`).toBeTruthy();
  }

  const getFights = async (request: APIRequestContext) => {
    const r = await request.get(`/api/fights?eventId=${eventId}`);
    const j = await r.json();
    return (Array.isArray(j) ? j : j.fights ?? []) as Array<Record<string, any>>;
  };

  test('drives a competition from registration through results', async ({ request }) => {
    // --- create event ---
    const slug = `e2e-pipe-${Date.now()}`;
    const dates = {
      registrationStartDate: '2026-09-01T09:00:00.000Z', registrationEndDate: '2026-09-10T18:00:00.000Z',
      weighInStartDate: '2026-09-14T09:00:00.000Z', weighInEndDate: '2026-09-14T18:00:00.000Z',
      competitionStartDate: '2026-09-15T09:00:00.000Z', competitionEndDate: '2026-09-16T18:00:00.000Z',
    };
    const created = await request.post('/api/events', {
      data: { name: 'E2E Pipeline', nameKa: 'პაიპლაინი', slug, location: 'Tbilisi', dates },
    });
    expect(created.status(), await created.text()).toBe(201);
    eventId = ((await created.json()) as { id: string }).id;

    // --- select one age group + weight ---
    let cats = (await (await request.get(`/api/events/${eventId}/categories`)).json()) as { categoryTemplateId: string };
    const tplId = cats.categoryTemplateId;
    const template = (await (await request.get(`/api/category-templates/${tplId}/categories`)).json()) as any[];
    const group = template[0];
    const weight = group.weightCategories[0];
    const sel = await request.post(`/api/events/${eventId}/categories`, {
      data: { categoryTemplateId: tplId, ageGroups: [{ categoryTemplateGroupId: group.id, weightCategoryIds: [weight.id] }] },
    });
    expect(sel.ok(), await sel.text()).toBeTruthy();
    const ewcId = ((await (await request.get(`/api/events/${eventId}/categories`)).json()) as any)
      .ageGroups[0].weightCategories[0].id;

    // --- register 4 athletes (4-fighter single-elim → tests propagation) ---
    const regIds: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const a = await request.post('/api/athletes', {
        data: { firstName: `Fighter${i}`, lastName: 'Pipe', firstNameKa: `მებრძ${i}`, lastNameKa: 'პ',
          documentId: `PIPE${Date.now()}${i}`, sex: group.sex, dateOfBirth: '2016-05-05' },
      });
      expect(a.status(), await a.text()).toBe(201);
      const athleteId = ((await a.json()) as any).athlete.id;
      const reg = await request.post('/api/registrations', { data: { eventId, athleteId, eventWeightCategoryId: ewcId } });
      expect(reg.ok(), await reg.text()).toBeTruthy();
      const regId = ((await reg.json()) as any).id ?? ((await reg.json()) as any).registration?.id;
      let st = await request.post(`/api/registrations/${regId}/status`, { data: { status: 'APPROVED' } });
      if (!st.ok()) st = await request.post(`/api/registrations/${regId}/status`, { data: { status: 'APPROVED', override: true, reason: 'e2e' } });
      expect(st.ok(), await st.text()).toBeTruthy();
      regIds.push(regId);
    }

    // --- lock → weigh-in (PASS each) ---
    await advance(request, 'LOCKED');
    await advance(request, 'WEIGHIN');
    for (const registrationId of regIds) {
      const w = await request.post('/api/weighin', {
        data: { registrationId, weightKg: Math.max(1, weight.maxWeightKgIncl - 2), decision: 'PASS' },
      });
      expect(w.ok(), await w.text()).toBeTruthy();
    }
    // event auto-advances to WEIGH_IN_COMPLETED once all weigh-ins are final
    await advance(request, 'WEIGH_IN_COMPLETED');

    // --- draw ---
    const draw = await request.post('/api/draw', { data: { eventId } });
    expect(draw.ok(), await draw.text()).toBeTruthy();

    // --- mat + session + generate schedule ---
    expect((await request.post('/api/mats', { data: { eventId, name: 'Mat 1', order: 0 } })).ok()).toBeTruthy();
    expect((await request.post('/api/schedule-sessions', {
      data: { eventId, name: 'Session 1', startTime: '2026-09-15T09:00:00.000Z', endTime: '2026-09-15T18:00:00.000Z' },
    })).ok()).toBeTruthy();
    expect((await request.post('/api/schedule/generate', { data: { eventId, avgBoutSeconds: 180, bufferSeconds: 60 } })).ok()).toBeTruthy();

    // --- go LIVE ---
    await advance(request, 'DRAWN');
    await advance(request, 'PUBLISHED');
    await advance(request, 'LIVE');
    expect(await lifecycle(request)).toBe('LIVE');

    // === schedule behaviour while genuinely LIVE (fights pending) ===
    const fingerprint = async () =>
      (await getFights(request))
        .map((x) => `${x.id.slice(-4)}:${x.matId ?? '∅'}/${x.orderInMat ?? '∅'}/${x.scheduledStartTime ?? '∅'}`)
        .sort()
        .join('|');

    const liveFights = await getFights(request);
    const sessionId = liveFights.find((f) => f.sessionId)?.sessionId;
    if (sessionId) {
      const inSession = liveFights.filter((f) => f.sessionId === sessionId).map((f) => f.id);
      if (inSession.length > 1) {
        const manual = await request.post('/api/schedule/reorder-fights', {
          data: { sessionId, orderedFightIds: [...inSession].reverse() },
        });
        expect(manual.ok(), 'MANUAL reorder must work during LIVE').toBeTruthy();
      }
    }

    const beforeGen = await fingerprint();
    const gen = await request.post('/api/schedule/generate', { data: { eventId, avgBoutSeconds: 240, bufferSeconds: 30 } });
    const afterGen = await fingerprint();
    // When ALL fights are still pending+already-scheduled, generate is a harmless
    // no-op (mat/order/time unchanged). The real mid-event regenerate defect —
    // where a newly-ready final collides with completed fights' orderInSession —
    // is covered by schedule-regen.admin.spec.ts.
    expect(gen.ok()).toBeTruthy();
    expect(afterGen, 'generate is a no-op when all fights are pending+scheduled').toBe(beforeGen);

    const auto = await request.post('/api/schedule/auto', {
      data: { eventId, startTimeIso: '2026-09-15T10:30:00.000Z', avgBoutSeconds: 300, bufferSeconds: 30, useSessions: false },
    });
    expect(auto.ok(), 'auto-schedule should run during LIVE').toBeTruthy();

    // === run every fight: start + timer START/PAUSE/RESUME ×3 + finish ===
    const totalRounds = Math.max(...(await getFights(request)).map((f) => f.round));
    let ran = 0;
    for (let round = 1; round <= totalRounds; round++) {
      const playable = (await getFights(request)).filter(
        (f) => f.round === round && f.redAthleteId && f.blueAthleteId &&
          f.redAthleteId !== f.blueAthleteId && !f.winnerAthleteId,
      );
      for (const fight of playable) {
        expect((await request.post(`/api/fights/${fight.id}/start`)).ok(), `start ${fight.id}`).toBeTruthy();
        expect((await request.post(`/api/fights/${fight.id}/timer`, { data: { action: 'START', round: 1 } })).ok()).toBeTruthy();
        for (let k = 0; k < 3; k++) {
          expect((await request.post(`/api/fights/${fight.id}/timer`, { data: { action: 'PAUSE' } })).ok(), `pause ${k}`).toBeTruthy();
          expect((await request.post(`/api/fights/${fight.id}/timer`, { data: { action: 'RESUME' } })).ok(), `resume ${k}`).toBeTruthy();
        }
        const fin = await request.post(`/api/fights/${fight.id}/finish`, { data: { winner: 'RED', method: 'POINTS' } });
        expect(fin.ok(), `finish ${fight.id}: ${await fin.text()}`).toBeTruthy();
        ran++;
      }
    }
    expect(ran, 'ran every fight in the bracket').toBeGreaterThanOrEqual(3);

    // every fight resolved + winner propagated to the final
    const finalFights = await getFights(request);
    expect(finalFights.every((f) => f.winnerAthleteId), 'all fights have winners').toBeTruthy();

    // finishing the last fight auto-completes the event
    expect(await lifecycle(request)).toBe('COMPLETED');

    // schedule edits are now correctly refused (read-only)
    const afterComplete = await request.post('/api/schedule/generate', { data: { eventId, avgBoutSeconds: 180, bufferSeconds: 60 } });
    expect(afterComplete.status()).toBe(400);
    expect(await afterComplete.text()).toContain('EVENT_READ_ONLY');

    // results compiled
    const results = (await (await request.get(`/api/results?eventId=${eventId}`)).json()) as any[];
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.filter((r) => r.winnerAthleteId).length).toBe(results.length);
  });
});
