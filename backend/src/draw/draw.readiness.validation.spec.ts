import { buildValidationAndSummary } from './draw.readiness.validation';
import type { DrawCategoryComputedRow } from './draw.readiness.types';

// Unit tests for the issue-tally / action-availability step. Pin the exact
// CRITICAL / WARNING code emission so changing the list in
// draw.readiness.validation.ts requires a deliberate test update.

// Builds a synthetic computed-category row for tests. Defaults to a "happy
// path" READY category; overrides flip individual fields to trigger issues.
function makeCategory(
  overrides: Partial<DrawCategoryComputedRow> = {},
): DrawCategoryComputedRow {
  return {
    id: 'cat1',
    ageGroupCode: 'SR',
    ageGroupName: 'Senior',
    division: 'MALE',
    categoryName: '60kg',
    sortOrder: 1,
    bracketStatus: 'NOT_DRAWN',
    readinessStatus: 'READY',
    eligibleAthletesCount: 2,
    excludedAthletesCount: 0,
    criticalIssueCount: 0,
    warningIssueCount: 0,
    issueCount: 0,
    hasMovedUpAthletes: false,
    hasAgeGroupMove: false,
    reviewed: false,
    reviewedAt: null,
    reviewedByName: null,
    issues: [],
    eligibleAthletes: [],
    excludedAthletes: [],
    ...overrides,
  };
}

describe('draw readiness validation', () => {
  it('blocks draw when registration is still open', () => {
    const result = buildValidationAndSummary({
      categoriesComputed: [makeCategory()],
      drawStatus: 'NOT_GENERATED',
      eventId: 'ev1',
      eventLifecycle: 'REG_OPEN',
      registrationClosedForDraw: false,
      weighInCompletedForDraw: true,
      missingFinalCategoryIds: [],
      invalidFinalCategoryIds: [],
      ageGroupMoveAthletesCount: 0,
      bracketCount: 0,
    });

    expect(
      result.validation.critical.some(
        (issue) => issue.code === 'EVENT_NOT_LOCKED',
      ),
    ).toBe(true);
  });

  it('blocks draw when registration is closed but weigh-in incomplete', () => {
    const result = buildValidationAndSummary({
      categoriesComputed: [makeCategory()],
      drawStatus: 'NOT_GENERATED',
      eventId: 'ev1',
      eventLifecycle: 'WEIGHIN',
      registrationClosedForDraw: true,
      weighInCompletedForDraw: false,
      missingFinalCategoryIds: [],
      invalidFinalCategoryIds: [],
      ageGroupMoveAthletesCount: 0,
      bracketCount: 0,
    });

    expect(
      result.validation.critical.some(
        (issue) => issue.code === 'WEIGHIN_NOT_COMPLETED_FOR_DRAW',
      ),
    ).toBe(true);
  });

  it('allows generation when registration is closed and weigh-in is done', () => {
    const result = buildValidationAndSummary({
      categoriesComputed: [makeCategory()],
      drawStatus: 'NOT_GENERATED',
      eventId: 'ev1',
      eventLifecycle: 'WEIGH_IN_COMPLETED',
      registrationClosedForDraw: true,
      weighInCompletedForDraw: true,
      missingFinalCategoryIds: [],
      invalidFinalCategoryIds: [],
      ageGroupMoveAthletesCount: 0,
      bracketCount: 0,
    });

    expect(result.actions.canGenerate).toBe(true);
    expect(result.validation.critical.length).toBe(0);
  });

  it('prevents duplicate generation when draw already exists', () => {
    const result = buildValidationAndSummary({
      categoriesComputed: [
        makeCategory({ readinessStatus: 'READY', bracketStatus: 'NOT_DRAWN' }),
      ],
      drawStatus: 'GENERATED',
      eventId: 'ev1',
      eventLifecycle: 'DRAWN',
      registrationClosedForDraw: true,
      weighInCompletedForDraw: true,
      missingFinalCategoryIds: [],
      invalidFinalCategoryIds: [],
      ageGroupMoveAthletesCount: 0,
      bracketCount: 1,
    });

    expect(result.actions.canGenerate).toBe(false);
    expect(result.actions.generateBlockedReasonCode).toBe(
      'DRAW_ALREADY_EXISTS',
    );
  });

  it('reports SOLO categories in their own bucket + warning, still drawable', () => {
    const result = buildValidationAndSummary({
      categoriesComputed: [
        makeCategory({ readinessStatus: 'SOLO', eligibleAthletesCount: 1 }),
      ],
      drawStatus: 'NOT_GENERATED',
      eventId: 'ev1',
      eventLifecycle: 'WEIGH_IN_COMPLETED',
      registrationClosedForDraw: true,
      weighInCompletedForDraw: true,
      missingFinalCategoryIds: [],
      invalidFinalCategoryIds: [],
      ageGroupMoveAthletesCount: 0,
      bracketCount: 0,
    });

    expect(result.summary.soloCategoriesCount).toBe(1);
    expect(result.summary.readyCategoriesCount).toBe(1);
    expect(
      result.validation.warnings.some(
        (i) => i.code === 'ONE_ATHLETE_POOLS_PRESENT',
      ),
    ).toBe(true);
    expect(result.validation.critical.length).toBe(0);
    expect(result.actions.canGenerate).toBe(true);
  });

  it('warns on cross-age-group moves and never on overrides', () => {
    const result = buildValidationAndSummary({
      categoriesComputed: [
        makeCategory({
          readinessStatus: 'NEEDS_REVIEW',
          hasAgeGroupMove: true,
        }),
      ],
      drawStatus: 'NOT_GENERATED',
      eventId: 'ev1',
      eventLifecycle: 'WEIGH_IN_COMPLETED',
      registrationClosedForDraw: true,
      weighInCompletedForDraw: true,
      missingFinalCategoryIds: [],
      invalidFinalCategoryIds: [],
      ageGroupMoveAthletesCount: 1,
      bracketCount: 0,
    });

    expect(result.summary.needsReviewCategoriesCount).toBe(1);
    expect(
      result.validation.warnings.some(
        (i) => i.code === 'AGE_GROUP_MOVE_ATHLETES_PRESENT',
      ),
    ).toBe(true);
    expect(
      result.validation.warnings.some(
        (i) => i.code === 'OVERRIDE_RECORDS_PRESENT',
      ),
    ).toBe(false);
  });
});
