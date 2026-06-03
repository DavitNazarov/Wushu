import {
  planAutoScheduleOrder,
  MIN_AUTO_SCHEDULE_FIGHT_GAP,
} from './auto-schedule-order.logic';
import type { ScheduleSourceFight } from './schedule-order.types';

// Tests for the greedy auto-scheduler. Pure function, so we hand-build
// ScheduleSourceFight arrays and assert on the resulting order + diagnostics.

// Factory that fills in sensible defaults for every Prisma field we don't
// care about in a given test (status=QUEUED, no winner, etc.).
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

describe('auto-schedule-order.logic', () => {
  it('defers repeated athletes until the minimum fight gap is satisfied when alternatives exist', () => {
    const fights = [
      createFight({
        id: 'repeat-1',
        categoryCode: 'A',
        round: 1,
        boutNo: 1,
        redAthleteId: 'athlete-repeat',
        blueAthleteId: 'athlete-a',
      }),
      createFight({
        id: 'repeat-2',
        categoryCode: 'B',
        round: 1,
        boutNo: 1,
        redAthleteId: 'athlete-repeat',
        blueAthleteId: 'athlete-b',
      }),
      ...Array.from({ length: 10 }, (_, index) =>
        createFight({
          id: `spacer-${index + 1}`,
          categoryCode: `C${index + 1}`,
          round: 1,
          boutNo: 1,
        }),
      ),
    ];

    const plannedIds = planAutoScheduleOrder(fights).fights.map(
      (fight) => fight.id,
    );

    expect(
      plannedIds.indexOf('repeat-2') - plannedIds.indexOf('repeat-1') - 1,
    ).toBe(MIN_AUTO_SCHEDULE_FIGHT_GAP);
  });

  it('uses unrelated fights to space round-robin athletes when possible', () => {
    const fights = [
      createFight({
        id: 'rr-1',
        categoryCode: 'RR',
        bracketId: 'rr-bracket',
        eventWeightCategoryId: 'rr-weight',
        round: 1,
        boutNo: 1,
        redAthleteId: 'rr-a',
        blueAthleteId: 'rr-b',
      }),
      createFight({
        id: 'rr-2',
        categoryCode: 'RR',
        bracketId: 'rr-bracket',
        eventWeightCategoryId: 'rr-weight',
        round: 1,
        boutNo: 2,
        redAthleteId: 'rr-a',
        blueAthleteId: 'rr-c',
      }),
      createFight({
        id: 'rr-3',
        categoryCode: 'RR',
        bracketId: 'rr-bracket',
        eventWeightCategoryId: 'rr-weight',
        round: 1,
        boutNo: 3,
        redAthleteId: 'rr-b',
        blueAthleteId: 'rr-c',
      }),
      ...Array.from({ length: 10 }, (_, index) =>
        createFight({
          id: `other-${index + 1}`,
          categoryCode: `X${index + 1}`,
          round: 1,
          boutNo: 1,
        }),
      ),
    ];

    const plannedIds = planAutoScheduleOrder(fights).fights.map(
      (fight) => fight.id,
    );
    const firstRoundRobinIndex = plannedIds.indexOf('rr-1');
    const secondRoundRobinIndex = plannedIds.indexOf('rr-2');

    expect(firstRoundRobinIndex).toBe(0);
    expect(
      secondRoundRobinIndex - firstRoundRobinIndex - 1,
    ).toBeGreaterThanOrEqual(MIN_AUTO_SCHEDULE_FIGHT_GAP);
  });

  it('records diagnostics when the full ten-fight gap is impossible', () => {
    const result = planAutoScheduleOrder([
      createFight({
        id: 'rr-1',
        categoryCode: 'RR',
        bracketId: 'rr-bracket',
        eventWeightCategoryId: 'rr-weight',
        round: 1,
        boutNo: 1,
        redAthleteId: 'rr-a',
        blueAthleteId: 'rr-b',
      }),
      createFight({
        id: 'rr-2',
        categoryCode: 'RR',
        bracketId: 'rr-bracket',
        eventWeightCategoryId: 'rr-weight',
        round: 1,
        boutNo: 2,
        redAthleteId: 'rr-a',
        blueAthleteId: 'rr-c',
      }),
      createFight({
        id: 'rr-3',
        categoryCode: 'RR',
        bracketId: 'rr-bracket',
        eventWeightCategoryId: 'rr-weight',
        round: 1,
        boutNo: 3,
        redAthleteId: 'rr-b',
        blueAthleteId: 'rr-c',
      }),
    ]);

    expect(result.fights).toHaveLength(3);
    expect(result.diagnostics.fullySatisfied).toBe(false);
    expect(result.diagnostics.conflictCount).toBeGreaterThan(0);
    expect(result.diagnostics.conflicts[0]?.scheduledOrder).toBe(2);
  });

  it('keeps dependency order intact while applying rest-gap scheduling', () => {
    const result = planAutoScheduleOrder([
      createFight({
        id: 'semi-1',
        categoryCode: 'A',
        bracketId: 'bracket-a',
        eventWeightCategoryId: 'weight-a',
        round: 1,
        boutNo: 1,
      }),
      createFight({
        id: 'semi-2',
        categoryCode: 'A',
        bracketId: 'bracket-a',
        eventWeightCategoryId: 'weight-a',
        round: 1,
        boutNo: 2,
      }),
      createFight({
        id: 'final',
        categoryCode: 'A',
        bracketId: 'bracket-a',
        eventWeightCategoryId: 'weight-a',
        round: 2,
        boutNo: 1,
        redAthleteId: 'winner-1',
        blueAthleteId: 'winner-2',
      }),
      ...Array.from({ length: 10 }, (_, index) =>
        createFight({
          id: `other-${index + 1}`,
          categoryCode: `B${index + 1}`,
          round: 1,
          boutNo: 1,
        }),
      ),
    ]);

    const orderedIds = result.fights.map((fight) => fight.id);

    expect(orderedIds.indexOf('final')).toBeGreaterThan(
      orderedIds.indexOf('semi-2'),
    );
  });
});
