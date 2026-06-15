import { test, expect } from '@playwright/test';
import { buildLiveEvent, getFights, fightDetail, scoreRoundByRound } from './helpers/competition';

// Round-by-round (best-of-3 Sanda) scoring through the real ROUND→REST→next-ROUND
// state machine, including a 2-0 sweep, a 2-1 split that goes to round 3, winner
// propagation, auto-complete and results.
//
// SLOW: inter-round REST is ~60s of real wall-clock (auto-advanced by the 1s
// timer cron), so this is opt-in. Run with:  E2E_SLOW=1 npx playwright test rounds
const SLOW = process.env.E2E_SLOW === '1';

test.describe.configure({ mode: 'serial' });

test.describe('live — round-by-round scoring (best of 3)', () => {
  let eventId = '';
  test.afterAll(async ({ request }) => {
    if (eventId) await request.delete(`/api/events/${eventId}`).catch(() => undefined);
  });

  test('scores semis + final round-by-round, incl. a 3-round split', async ({ request }) => {
    test.skip(!SLOW, 'slow (~4min of 60s inter-round rests); run with E2E_SLOW=1');
    test.setTimeout(360_000);

    const ev = await buildLiveEvent(request, 4);
    eventId = ev.eventId;

    const semis = (await getFights(request, eventId))
      .filter((f) => f.round === 1)
      .sort((a, b) => (a.boutNo ?? 0) - (b.boutNo ?? 0));

    // Semifinal 1: RED sweeps 2-0 (decided in two rounds)
    const s1 = await scoreRoundByRound(request, semis[0].id, ['RED', 'RED']);
    expect(s1.winnerAthleteId, 'semi1 decided').toBeTruthy();
    expect(s1.timerState?.redRoundWins).toBe(2);
    expect(s1.timerState?.blueRoundWins).toBe(0);

    // Semifinal 2: split 1-1 then RED takes round 3 → 2-1
    const s2 = await scoreRoundByRound(request, semis[1].id, ['RED', 'BLUE', 'RED']);
    expect(s2.winnerAthleteId, 'semi2 decided').toBeTruthy();
    expect(s2.timerState?.redRoundWins).toBe(2);
    expect(s2.timerState?.blueRoundWins).toBe(1);

    // Final: winners propagated from both semis, then BLUE 2-0
    let finalFight = null as Record<string, any> | null;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      finalFight = (await getFights(request, eventId)).find((f) => f.round === 2) ?? null;
      if (finalFight?.redAthleteId && finalFight?.blueAthleteId) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    expect(finalFight?.redAthleteId && finalFight?.blueAthleteId, 'final populated from semis').toBeTruthy();
    const fin = await scoreRoundByRound(request, finalFight!.id, ['BLUE', 'BLUE']);
    expect(fin.winnerAthleteId, 'final decided').toBeTruthy();

    // whole bracket resolved → event auto-completes → results compiled
    const all = await getFights(request, eventId);
    expect(all.every((f) => f.winnerAthleteId)).toBeTruthy();
    const lc = ((await (await request.get(`/api/events/${eventId}`)).json()) as { lifecycle: string }).lifecycle;
    expect(lc).toBe('COMPLETED');

    const results = (await (await request.get(`/api/results?eventId=${eventId}`)).json()) as any[];
    expect(results.filter((r) => r.winnerAthleteId).length).toBe(results.length);
    expect(results.length).toBeGreaterThanOrEqual(3);
  });
});
