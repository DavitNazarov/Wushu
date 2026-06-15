import { test, expect } from '@playwright/test';
import { buildLiveEvent, getFights, finishFight } from './helpers/competition';

// Regression for the mid-event schedule-regenerate bug.
//
// Repro: in a LIVE 4-fighter single-elim, finish both semifinals so the final
// becomes ready, then click "auto-generate" (the UI calls POST /schedule/generate).
// generateSchedule renumbers orderInSession from 1 for the reschedulable
// (QUEUED/ON_DECK) set, but the BF-4 guard leaves the completed semis holding
// their old orderInSession (1, 2). The newly-ready final therefore lands at
// orderInSession=1 — colliding with, and ordered ahead of, the already-played
// semifinals. The running order is corrupted.
//
// FIXED: generateSchedule now offsets new orderInSession past the slots held by
// retained completed/in-progress fights, so the newly-ready final is appended
// after the played semis instead of colliding at slot 1. This test guards the fix.

test.describe.configure({ mode: 'serial' });

test.describe('schedule — regenerate mid-event (live)', () => {
  let eventId = '';
  test.afterAll(async ({ request }) => {
    if (eventId) await request.delete(`/api/events/${eventId}`).catch(() => undefined);
  });

  test('regenerating after semis finish must not collide the final with completed fights', async ({ request }) => {
    const ev = await buildLiveEvent(request, 4);
    eventId = ev.eventId;

    // finish both semifinals (round 1) → final (round 2) becomes ready
    const before = await getFights(request, eventId);
    for (const semi of before.filter((f) => f.round === 1)) {
      await finishFight(request, semi.id, 'RED');
    }

    // the user action: "auto-generate" mid-event
    const regen = await request.post('/api/schedule/generate', {
      data: { eventId, avgBoutSeconds: 180, bufferSeconds: 60 },
    });
    expect(regen.ok()).toBeTruthy();

    const after = await getFights(request, eventId);

    // group by session and assert orderInSession is unique (no collision)
    const bySession = new Map<string, number[]>();
    for (const f of after) {
      if (!f.sessionId || f.orderInSession == null) continue;
      const arr = bySession.get(f.sessionId) ?? [];
      arr.push(f.orderInSession);
      bySession.set(f.sessionId, arr);
    }
    for (const [sid, orders] of bySession) {
      expect(
        new Set(orders).size,
        `duplicate orderInSession in session ${sid}: [${orders.join(', ')}]`,
      ).toBe(orders.length);
    }

    // the final must be ordered AFTER the completed semifinals, not on top of them
    const finalRound = Math.max(...after.map((f) => f.round));
    const finalFight = after.find((f) => f.round === finalRound)!;
    const completed = after.filter((f) => f.status === 'CONFIRMED' || f.status === 'COMPLETE');
    for (const done of completed) {
      if (done.sessionId === finalFight.sessionId && done.orderInSession != null && finalFight.orderInSession != null) {
        expect(
          finalFight.orderInSession,
          'final should be scheduled after the already-played semifinals',
        ).toBeGreaterThan(done.orderInSession);
      }
    }
  });
});
