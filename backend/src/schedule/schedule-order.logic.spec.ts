import {
  buildScheduleRows,
  sortFightsForAutoSchedule,
  type ScheduleSourceFight,
} from './schedule-order.logic';

// Tests for the schedule-row builder + thin auto-schedule wrapper. Pins the
// display-string output ("Winner of N", "TBD") and sort order so accidental
// edits to compareFightCandidate or displayName are caught.

// Factory: minimal fight with defaults for everything unrelated to the test.
function createFight(
  input: Partial<ScheduleSourceFight> & {
    id: string;
    categoryCode: string;
    round: number;
    boutNo: number;
  },
): ScheduleSourceFight {
  return {
    id: input.id,
    bracketId: input.bracketId ?? input.categoryCode,
    categoryCode: input.categoryCode,
    eventWeightCategoryId: input.eventWeightCategoryId ?? input.categoryCode,
    round: input.round,
    boutNo: input.boutNo,
    status: input.status ?? 'QUEUED',
    redAthleteId: input.redAthleteId ?? `${input.id}_red`,
    blueAthleteId: input.blueAthleteId ?? `${input.id}_blue`,
    winnerAthleteId: input.winnerAthleteId ?? null,
    matId: input.matId ?? null,
    orderInMat: input.orderInMat ?? null,
    scheduledStartTime: input.scheduledStartTime ?? null,
    redAthlete: null,
    blueAthlete: null,
    winnerAthlete: null,
    mat: null,
    eventWeightCategory: {
      categoryTemplateWeight: {
        name: input.categoryCode,
        sortOrder:
          input.eventWeightCategory?.categoryTemplateWeight?.sortOrder ?? 1,
      },
      eventAgeGroup: {
        categoryTemplateAgeGroup: {
          name: 'Adults',
          sortOrder:
            input.eventWeightCategory?.eventAgeGroup?.categoryTemplateAgeGroup
              ?.sortOrder ?? 1,
        },
      },
    },
  };
}

describe('schedule-order.logic', () => {
  it('pushes finals behind earlier dependency stages across categories', () => {
    const fights = [
      createFight({ id: 'cat-a-sf-1', categoryCode: 'A', round: 1, boutNo: 1 }),
      createFight({ id: 'cat-a-sf-2', categoryCode: 'A', round: 1, boutNo: 2 }),
      createFight({
        id: 'cat-a-final',
        categoryCode: 'A',
        round: 2,
        boutNo: 1,
        redAthleteId: null,
        blueAthleteId: null,
      }),
      createFight({ id: 'cat-b-qf-1', categoryCode: 'B', round: 1, boutNo: 1 }),
      createFight({ id: 'cat-b-qf-2', categoryCode: 'B', round: 1, boutNo: 2 }),
      createFight({ id: 'cat-b-sf-1', categoryCode: 'B', round: 2, boutNo: 1 }),
      createFight({ id: 'cat-b-sf-2', categoryCode: 'B', round: 2, boutNo: 2 }),
      createFight({
        id: 'cat-b-final',
        categoryCode: 'B',
        round: 3,
        boutNo: 1,
        redAthleteId: null,
        blueAthleteId: null,
      }),
    ];

    const rows = buildScheduleRows(fights);
    const orderedIds = rows.map((row) => row.id);

    expect(orderedIds.indexOf('cat-a-final')).toBeGreaterThan(
      orderedIds.indexOf('cat-b-sf-1'),
    );
    expect(orderedIds.indexOf('cat-b-final')).toBeGreaterThan(
      orderedIds.indexOf('cat-a-final'),
    );
  });

  it('uses the same stage-aware order when auto-scheduling fights', () => {
    const orderedIds = sortFightsForAutoSchedule([
      createFight({ id: 'semi-1', categoryCode: 'A', round: 1, boutNo: 1 }),
      createFight({ id: 'semi-2', categoryCode: 'A', round: 1, boutNo: 2 }),
      createFight({
        id: 'final',
        categoryCode: 'A',
        round: 2,
        boutNo: 1,
        redAthleteId: 'winner-1',
        blueAthleteId: 'winner-2',
      }),
      createFight({ id: 'qf-1', categoryCode: 'B', round: 1, boutNo: 1 }),
      createFight({ id: 'qf-2', categoryCode: 'B', round: 1, boutNo: 2 }),
      createFight({ id: 'qf-3', categoryCode: 'B', round: 1, boutNo: 3 }),
      createFight({ id: 'qf-4', categoryCode: 'B', round: 1, boutNo: 4 }),
      createFight({ id: 'sf-1', categoryCode: 'B', round: 2, boutNo: 1 }),
      createFight({ id: 'sf-2', categoryCode: 'B', round: 2, boutNo: 2 }),
      createFight({
        id: 'cat-b-final',
        categoryCode: 'B',
        round: 3,
        boutNo: 1,
        redAthleteId: 'winner-3',
        blueAthleteId: 'winner-4',
      }),
    ]).map((fight) => fight.id);

    expect(orderedIds[0]).toBe('qf-1');
    expect(orderedIds.indexOf('sf-1')).toBeGreaterThan(
      orderedIds.indexOf('qf-4'),
    );
    expect(orderedIds.indexOf('final')).toBeGreaterThan(
      orderedIds.indexOf('sf-2'),
    );
  });
});
