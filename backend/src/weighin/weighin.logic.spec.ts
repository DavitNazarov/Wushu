import {
  computeManualDecisionOutcome,
  computePolicyWeighInOutcome,
} from './weighin.logic';

const categories = [
  {
    id: 'c1',
    name: '52kg',
    minWeightKgExcl: null,
    maxWeightKgIncl: 52,
    sortOrder: 1,
  },
  {
    id: 'c2',
    name: '56kg',
    minWeightKgExcl: 52,
    maxWeightKgIncl: 56,
    sortOrder: 2,
  },
  {
    id: 'c3',
    name: '60kg',
    minWeightKgExcl: 56,
    maxWeightKgIncl: 60,
    sortOrder: 3,
  },
];

describe('weighin policy engine', () => {
  it('passes in registered category under strict policy', () => {
    const outcome = computePolicyWeighInOutcome({
      policyCode: 'IWUF_STRICT_ONE_HOUR',
      weightKg: 51.8,
      currentCategory: categories[0],
      categoriesInAgeGroup: categories,
      attemptHistory: [],
      reweighWindowMinutes: 60,
      now: new Date('2026-03-07T10:00:00Z'),
    });

    expect(outcome.decision).toBe('PASS');
    expect(outcome.weighInStatus).toBe('PASSED');
  });

  it('opens one-hour window on first strict-policy failure', () => {
    const now = new Date('2026-03-07T10:00:00Z');
    const outcome = computePolicyWeighInOutcome({
      policyCode: 'IWUF_STRICT_ONE_HOUR',
      weightKg: 54,
      currentCategory: categories[0],
      categoriesInAgeGroup: categories,
      attemptHistory: [],
      reweighWindowMinutes: 60,
      now,
    });

    expect(outcome.decision).toBe('ONE_HOUR');
    expect(outcome.weighInStatus).toBe('REWEIGH_ALLOWED');
    expect(outcome.deadlineAt?.toISOString()).toBe('2026-03-07T11:00:00.000Z');
  });

  it('disqualifies when strict one-hour window is expired', () => {
    const outcome = computePolicyWeighInOutcome({
      policyCode: 'IWUF_STRICT_ONE_HOUR',
      weightKg: 54,
      currentCategory: categories[0],
      categoriesInAgeGroup: categories,
      attemptHistory: [
        {
          decision: 'ONE_HOUR',
          deadlineAt: new Date('2026-03-07T11:00:00Z'),
          resolvedAt: null,
        },
      ],
      reweighWindowMinutes: 60,
      now: new Date('2026-03-07T11:05:00Z'),
    });

    expect(outcome.decision).toBe('DISQUALIFIED');
    expect(outcome.weighInStatus).toBe('DISQUALIFIED');
  });

  it('moves up after failed reweigh when policy allows it', () => {
    const outcome = computePolicyWeighInOutcome({
      policyCode: 'MOVE_UP_AFTER_FAILED_REWEIGH',
      weightKg: 54,
      currentCategory: categories[0],
      categoriesInAgeGroup: categories,
      attemptHistory: [
        {
          decision: 'ONE_HOUR',
          deadlineAt: new Date('2026-03-07T11:00:00Z'),
          resolvedAt: null,
        },
      ],
      reweighWindowMinutes: 60,
      now: new Date('2026-03-07T11:10:00Z'),
    });

    expect(outcome.decision).toBe('MOVED_UP');
    expect(outcome.moveToCategoryId).toBe('c2');
  });

  it('moves up immediately under DIRECT_MOVE_UP policy', () => {
    const outcome = computePolicyWeighInOutcome({
      policyCode: 'DIRECT_MOVE_UP',
      weightKg: 54,
      currentCategory: categories[0],
      categoriesInAgeGroup: categories,
      attemptHistory: [],
      reweighWindowMinutes: 60,
      now: new Date('2026-03-07T10:00:00Z'),
    });

    expect(outcome.decision).toBe('MOVED_UP');
    expect(outcome.weighInStatus).toBe('MOVED_UP');
  });

  it('fails when athlete is under category minimum', () => {
    const outcome = computePolicyWeighInOutcome({
      policyCode: 'IWUF_STRICT_ONE_HOUR',
      weightKg: 12,
      currentCategory: categories[2],
      categoriesInAgeGroup: categories,
      attemptHistory: [],
      reweighWindowMinutes: 60,
      now: new Date('2026-03-07T10:00:00Z'),
    });

    expect(outcome.decision).toBe('FAIL');
    expect(outcome.weighInStatus).toBe('FAILED');
    expect(outcome.reason).toBe('UNDER_MINIMUM_WEIGHT_LIMIT');
  });

  it('supports manual admin decisions', () => {
    const outcome = computeManualDecisionOutcome({
      decision: 'MOVED_UP',
      reason: 'Manual decision by chief referee',
      currentCategory: categories[0],
      categoriesInAgeGroup: categories,
      weightKg: 54,
      reweighWindowMinutes: 60,
      now: new Date('2026-03-07T10:00:00Z'),
    });

    expect(outcome.decision).toBe('MOVED_UP');
    expect(outcome.moveToCategoryId).toBe('c2');
  });
});
