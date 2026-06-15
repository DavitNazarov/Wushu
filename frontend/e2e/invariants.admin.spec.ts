import { test, expect, type APIRequestContext } from '@playwright/test';

// Read-only domain-invariant checks against the seeded COMPLETED event. These
// catch results-compilation / winner-propagation logic bugs without mutating
// anything. The seed builds ge-national-spring-2026 with 12 brackets + 35
// confirmed fights.

const COMPLETED_SLUG = 'ge-national-spring-2026';

type Placement = { medal: string; athleteId: string };

type Fight = {
  id: string;
  status: string;
  round: number;
  redAthleteId: string | null;
  blueAthleteId: string | null;
  winnerAthleteId: string | null;
  loserAthleteId: string | null;
  nextFightId: string | null;
  nextFightSlot: string | null;
};

async function completedEventId(request: APIRequestContext): Promise<string> {
  const events = (await (await request.get('/api/events')).json()) as {
    id: string;
    slug: string;
  }[];
  const ev = events.find((e) => e.slug === COMPLETED_SLUG);
  if (!ev) throw new Error('seeded completed event not found');
  return ev.id;
}

test.describe('invariants — fight results integrity', () => {
  test('every confirmed fight has a coherent winner/loser', async ({
    request,
  }) => {
    const eventId = await completedEventId(request);
    const fights = (await (
      await request.get(`/api/results?eventId=${eventId}`)
    ).json()) as Fight[];
    expect(fights.length, 'event has fights').toBeGreaterThan(0);

    const violations: string[] = [];
    for (const f of fights) {
      if (f.status !== 'CONFIRMED' || !f.winnerAthleteId) continue;
      const sides = [f.redAthleteId, f.blueAthleteId].filter(Boolean);
      // Winner must be one of the two corners.
      if (!sides.includes(f.winnerAthleteId)) {
        violations.push(`fight ${f.id}: winner not a competitor in the bout`);
      }
      // Winner != loser.
      if (f.loserAthleteId && f.loserAthleteId === f.winnerAthleteId) {
        violations.push(`fight ${f.id}: winner === loser`);
      }
      // Loser, when both corners are present, must be the other corner.
      if (f.redAthleteId && f.blueAthleteId && f.loserAthleteId) {
        const expectedLoser =
          f.winnerAthleteId === f.redAthleteId
            ? f.blueAthleteId
            : f.redAthleteId;
        if (f.loserAthleteId !== expectedLoser) {
          violations.push(`fight ${f.id}: loser is not the non-winner corner`);
        }
      }
    }
    expect(violations, violations.join('\n')).toHaveLength(0);
  });

  test('winner propagates into the next fight slot', async ({ request }) => {
    const eventId = await completedEventId(request);
    const fights = (await (
      await request.get(`/api/results?eventId=${eventId}`)
    ).json()) as Fight[];
    const byId = new Map(fights.map((f) => [f.id, f]));

    const violations: string[] = [];
    for (const f of fights) {
      if (!f.nextFightId || !f.winnerAthleteId) continue;
      const next = byId.get(f.nextFightId);
      if (!next) continue; // next fight may be outside this query window
      const inNext =
        next.redAthleteId === f.winnerAthleteId ||
        next.blueAthleteId === f.winnerAthleteId;
      if (!inNext) {
        violations.push(
          `fight ${f.id} winner ${f.winnerAthleteId} absent from next fight ${next.id}`,
        );
      }
    }
    expect(violations, violations.join('\n')).toHaveLength(0);
  });
});

test.describe('invariants — medal table consistency', () => {
  test('public medal table totals are internally consistent', async ({
    request,
  }) => {
    const results = (await (
      await request.get(`/api/public/results?eventSlug=${COMPLETED_SLUG}`)
    ).json()) as {
      categories: unknown[];
      medalTable: {
        clubName: string;
        gold: number;
        silver: number;
        bronze: number;
        total: number;
      }[];
    };

    expect(results.categories.length, 'results compiled categories').toBeGreaterThan(0);
    expect(results.medalTable.length, 'medal table populated').toBeGreaterThan(0);

    for (const row of results.medalTable) {
      expect(row.gold).toBeGreaterThanOrEqual(0);
      expect(row.silver).toBeGreaterThanOrEqual(0);
      expect(row.bronze).toBeGreaterThanOrEqual(0);
      expect(
        row.total,
        `medal total mismatch for ${row.clubName}`,
      ).toBe(row.gold + row.silver + row.bronze);
    }
  });

  test('category placements map ranks to the right medals', async ({
    request,
  }) => {
    const results = (await (
      await request.get(`/api/public/results?eventSlug=${COMPLETED_SLUG}`)
    ).json()) as {
      categories: {
        categoryCode: string;
        placements: {
          isAvailable: boolean;
          // `third` is an array under the TWO_BRONZES policy (two bronzes), or a
          // single placement otherwise. Normalize before asserting.
          first?: Placement | null;
          second?: Placement | null;
          third?: Placement | Placement[] | null;
        };
      }[];
    };

    const violations: string[] = [];
    for (const c of results.categories) {
      const p = c.placements;
      if (!p?.isAvailable) continue;
      if (p.first && p.first.medal !== 'GOLD')
        violations.push(`${c.categoryCode}: rank1 medal=${p.first.medal}`);
      if (p.second && p.second.medal !== 'SILVER')
        violations.push(`${c.categoryCode}: rank2 medal=${p.second.medal}`);

      const bronzes = Array.isArray(p.third)
        ? p.third
        : p.third
          ? [p.third]
          : [];
      for (const b of bronzes) {
        if (b.medal !== 'BRONZE')
          violations.push(`${c.categoryCode}: rank3 medal=${b.medal}`);
      }

      // Podium athletes must be distinct (gold + silver + every bronze).
      const ids = [
        p.first?.athleteId,
        p.second?.athleteId,
        ...bronzes.map((b) => b.athleteId),
      ].filter(Boolean);
      if (new Set(ids).size !== ids.length)
        violations.push(`${c.categoryCode}: duplicate athlete on podium`);
    }
    expect(violations, violations.join('\n')).toHaveLength(0);
  });

  // OBSERVATION (documented divergence, not asserted as a hard failure):
  // the public results path compiles 12 categories + a 7-row medal table for
  // this event, but the admin /api/results/summary returns empty categories &
  // medalTable for the same event — the admin path keys off EventWeightCategory
  // rows (null on this seed) while the public path computes from categoryCode.
  // On a normally-drawn event both paths populate; this only diverges on the
  // shortcut-seeded completed event. Logged so the divergence is visible.
  test('admin vs public results path divergence (informational)', async ({
    request,
  }) => {
    const eventId = await completedEventId(request);
    const adminSummary = (await (
      await request.get(`/api/results/summary?eventId=${eventId}`)
    ).json()) as { categories: unknown[]; medalTable: unknown[] };
    const pub = (await (
      await request.get(`/api/public/results?eventSlug=${COMPLETED_SLUG}`)
    ).json()) as { categories: unknown[]; medalTable: unknown[] };

    // Public must always have the medals. (This is the user-facing surface.)
    expect(pub.medalTable.length).toBeGreaterThan(0);
    if (adminSummary.medalTable.length !== pub.medalTable.length) {
      // eslint-disable-next-line no-console
      console.log(
        `\n⚠ results divergence: admin summary medalTable=${adminSummary.medalTable.length} vs public=${pub.medalTable.length} for ${COMPLETED_SLUG}\n`,
      );
    }
  });
});
