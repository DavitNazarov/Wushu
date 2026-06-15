import { expect, type APIRequestContext } from '@playwright/test';

// Builds a fresh event all the way to LIVE through the REAL API: create →
// one category → register N athletes → weigh-in (PASS) → draw → mat + session +
// schedule → LIVE. Returns ids needed to drive fights/schedule. Caller is
// responsible for deleting the event (DELETE /api/events/:id).

const ORDER = [
  'REG_OPEN', 'LOCKED', 'WEIGHIN', 'WEIGH_IN_COMPLETED',
  'DRAWN', 'PUBLISHED', 'LIVE', 'COMPLETED',
];

export type LiveEvent = {
  eventId: string;
  ewcId: string;
  sex: string;
  maxWeightKgIncl: number;
};

async function lifecycle(request: APIRequestContext, eventId: string) {
  return ((await (await request.get(`/api/events/${eventId}`)).json()) as { lifecycle: string }).lifecycle;
}

export async function advance(request: APIRequestContext, eventId: string, to: string) {
  const cur = await lifecycle(request, eventId);
  if (ORDER.indexOf(cur) >= ORDER.indexOf(to)) return; // already at/past (auto-advance)
  let r = await request.post(`/api/events/${eventId}/lifecycle`, { data: { to } });
  if (!r.ok()) r = await request.post(`/api/events/${eventId}/lifecycle`, { data: { to, override: true, reason: 'e2e' } });
  expect(r.ok(), `lifecycle ${cur}->${to}: ${await r.text()}`).toBeTruthy();
}

export async function getFights(request: APIRequestContext, eventId: string) {
  const j = await (await request.get(`/api/fights?eventId=${eventId}`)).json();
  return (Array.isArray(j) ? j : j.fights ?? []) as Array<Record<string, any>>;
}

export async function buildLiveEvent(
  request: APIRequestContext,
  athleteCount = 4,
): Promise<LiveEvent> {
  const slug = `e2e-comp-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  const dates = {
    registrationStartDate: '2026-09-01T09:00:00.000Z', registrationEndDate: '2026-09-10T18:00:00.000Z',
    weighInStartDate: '2026-09-14T09:00:00.000Z', weighInEndDate: '2026-09-14T18:00:00.000Z',
    competitionStartDate: '2026-09-15T09:00:00.000Z', competitionEndDate: '2026-09-16T18:00:00.000Z',
  };
  const created = await request.post('/api/events', { data: { name: 'E2E Comp', slug, location: 'Tbilisi', dates } });
  expect(created.status(), await created.text()).toBe(201);
  const eventId = ((await created.json()) as { id: string }).id;

  const tplId = ((await (await request.get(`/api/events/${eventId}/categories`)).json()) as { categoryTemplateId: string }).categoryTemplateId;
  const template = (await (await request.get(`/api/category-templates/${tplId}/categories`)).json()) as any[];
  const group = template[0];
  const weight = group.weightCategories[0];
  await request.post(`/api/events/${eventId}/categories`, {
    data: { categoryTemplateId: tplId, ageGroups: [{ categoryTemplateGroupId: group.id, weightCategoryIds: [weight.id] }] },
  });
  const ewcId = ((await (await request.get(`/api/events/${eventId}/categories`)).json()) as any).ageGroups[0].weightCategories[0].id;

  const regIds: string[] = [];
  for (let i = 1; i <= athleteCount; i++) {
    const a = await request.post('/api/athletes', {
      data: { firstName: `C${i}`, lastName: 'Comp', documentId: `COMP${Date.now()}${i}`, sex: group.sex, dateOfBirth: '2016-05-05' },
    });
    const athleteId = ((await a.json()) as any).athlete.id;
    const reg = await request.post('/api/registrations', { data: { eventId, athleteId, eventWeightCategoryId: ewcId } });
    const regId = ((await reg.json()) as any).id ?? ((await reg.json()) as any).registration?.id;
    let st = await request.post(`/api/registrations/${regId}/status`, { data: { status: 'APPROVED' } });
    if (!st.ok()) st = await request.post(`/api/registrations/${regId}/status`, { data: { status: 'APPROVED', override: true, reason: 'e2e' } });
    regIds.push(regId);
  }

  await advance(request, eventId, 'LOCKED');
  await advance(request, eventId, 'WEIGHIN');
  for (const registrationId of regIds) {
    await request.post('/api/weighin', { data: { registrationId, weightKg: Math.max(1, weight.maxWeightKgIncl - 2), decision: 'PASS' } });
  }
  await advance(request, eventId, 'WEIGH_IN_COMPLETED');
  expect((await request.post('/api/draw', { data: { eventId } })).ok()).toBeTruthy();
  expect((await request.post('/api/mats', { data: { eventId, name: 'Mat 1', order: 0 } })).ok()).toBeTruthy();
  expect((await request.post('/api/schedule-sessions', { data: { eventId, name: 'Session 1', startTime: '2026-09-15T09:00:00.000Z', endTime: '2026-09-15T18:00:00.000Z' } })).ok()).toBeTruthy();
  expect((await request.post('/api/schedule/generate', { data: { eventId, avgBoutSeconds: 180, bufferSeconds: 60 } })).ok()).toBeTruthy();
  await advance(request, eventId, 'DRAWN');
  await advance(request, eventId, 'PUBLISHED');
  await advance(request, eventId, 'LIVE');
  expect(await lifecycle(request, eventId)).toBe('LIVE');

  return { eventId, ewcId, sex: group.sex, maxWeightKgIncl: weight.maxWeightKgIncl };
}

export async function finishFight(request: APIRequestContext, fightId: string, winner: 'RED' | 'BLUE' = 'RED') {
  await request.post(`/api/fights/${fightId}/start`);
  await request.post(`/api/fights/${fightId}/timer`, { data: { action: 'START', round: 1 } });
  const fin = await request.post(`/api/fights/${fightId}/finish`, { data: { winner, method: 'POINTS' } });
  expect(fin.ok(), `finish ${fightId}: ${await fin.text()}`).toBeTruthy();
}

export async function fightDetail(request: APIRequestContext, fightId: string) {
  return (await (await request.get(`/api/fights/${fightId}`)).json()) as Record<string, any>;
}

// Scores a fight one round at a time through the real ROUND→REST→next-ROUND
// machine. Each round is ended early (PAUSE) so the result records immediately;
// between rounds it waits out the (~60s) REST that the 1s cron auto-advances.
// roundWinners e.g. ['RED','RED'] (2-0) or ['RED','BLUE','RED'] (2-1, to round 3).
// SLOW: ~60s of real wall-clock per non-final round.
export async function scoreRoundByRound(
  request: APIRequestContext,
  fightId: string,
  roundWinners: Array<'RED' | 'BLUE'>,
) {
  expect((await request.post(`/api/fights/${fightId}/start`)).ok()).toBeTruthy();
  expect((await request.post(`/api/fights/${fightId}/timer`, { data: { action: 'START', round: 1 } })).ok()).toBeTruthy();

  for (let round = 1; round <= roundWinners.length; round++) {
    if (round > 1) {
      // wait for the 1s cron to end REST and auto-start this round (RUNNING)
      const deadline = Date.now() + 80_000;
      let started = false;
      while (Date.now() < deadline) {
        const tm = (await fightDetail(request, fightId)).timerState ?? {};
        if (tm.phase === 'ROUND' && tm.round === round && tm.state === 'RUNNING') { started = true; break; }
        await new Promise((r) => setTimeout(r, 3000));
      }
      expect(started, `round ${round} must auto-start after REST`).toBeTruthy();
    }
    const pre = (await fightDetail(request, fightId)).timerState ?? {};
    if (pre.state === 'RUNNING') await request.post(`/api/fights/${fightId}/timer`, { data: { action: 'PAUSE' } });
    const rr = await request.post(`/api/fights/${fightId}/round-result`, { data: { winner: roundWinners[round - 1] } });
    expect(rr.ok(), `round ${round} result: ${await rr.text()}`).toBeTruthy();

    const d = await fightDetail(request, fightId);
    if (d.winnerAthleteId) return d; // decisive (2-0 / 2-1 / after round 3)
  }
  return await fightDetail(request, fightId);
}
