import { buildActionAvailability } from './draw.readiness.helpers';
import type {
  DrawActionAvailability,
  DrawCategoryComputedRow,
  DrawOverallStatus,
  DrawValidationIssue,
  DrawValidationSummary,
} from './draw.readiness.types';

// Combined output of the validation pass: critical+warning issues, the
// derived button-availability map, and the rolled-up category counters
// shown in the page summary cards.
export type DrawValidationBuildResult = {
  validation: DrawValidationSummary;
  actions: DrawActionAvailability;
  summary: {
    drawnCategoriesCount: number;
    blockedCategoriesCount: number;
    needsReviewCategoriesCount: number;
    soloCategoriesCount: number;
    readyCategoriesCount: number;
    emptyCategoriesCount: number;
    eligibleAthletesCount: number;
  };
};

// Pure aggregation step. Walks the per-category rows + event-wide context to
// emit:
//   - counters for every readinessStatus bucket
//   - a critical issue list (each one blocks the draw)
//   - a warning issue list (each one shows a banner but doesn't block)
//   - the derived action availability for the Generate/Regenerate buttons
// CRITICAL set (in order added):
//   NO_EVENT_CATEGORIES | EVENT_NOT_LOCKED | WEIGHIN_NOT_COMPLETED_FOR_DRAW |
//   MISSING_FINAL_CATEGORY_ASSIGNMENT | INVALID_FINAL_CATEGORY_REFERENCE |
//   BLOCKED_CATEGORIES_PRESENT | NO_READY_CATEGORIES
// WARNING set:
//   DRAW_ALREADY_GENERATED | NEEDS_REVIEW_CATEGORIES_PRESENT |
//   AGE_GROUP_MOVE_ATHLETES_PRESENT | ONE_ATHLETE_POOLS_PRESENT
// `sampleIds` is always capped at 5 (UI shows "+N more").
export function buildValidationAndSummary(input: {
  categoriesComputed: DrawCategoryComputedRow[];
  drawStatus: DrawOverallStatus;
  eventId: string;
  eventLifecycle:
    | 'REG_OPEN'
    | 'LOCKED'
    | 'WEIGHIN'
    | 'WEIGH_IN_COMPLETED'
    | 'DRAWN'
    | 'PUBLISHED'
    | 'LIVE'
    | 'COMPLETED';
  registrationClosedForDraw: boolean;
  weighInCompletedForDraw: boolean;
  missingFinalCategoryIds: string[];
  invalidFinalCategoryIds: string[];
  ageGroupMoveAthletesCount: number;
  bracketCount: number;
}): DrawValidationBuildResult {
  const drawnCategoriesCount = input.categoriesComputed.filter(
    (row) => row.readinessStatus === 'DRAWN',
  ).length;
  const blockedCategoriesCount = input.categoriesComputed.filter(
    (row) => row.readinessStatus === 'BLOCKED',
  ).length;
  const needsReviewCategoriesCount = input.categoriesComputed.filter(
    (row) => row.readinessStatus === 'NEEDS_REVIEW',
  ).length;
  const soloCategoriesCount = input.categoriesComputed.filter(
    (row) => row.readinessStatus === 'SOLO',
  ).length;
  // SOLO and NEEDS_REVIEW are still drawable (a reviewed/solo category can run),
  // so they count toward "ready" for the NO_READY_CATEGORIES guard + summary.
  const readyCategoriesCount = input.categoriesComputed.filter(
    (row) =>
      row.readinessStatus === 'READY' ||
      row.readinessStatus === 'NEEDS_REVIEW' ||
      row.readinessStatus === 'SOLO',
  ).length;
  const emptyCategoriesCount = input.categoriesComputed.filter(
    (row) => row.readinessStatus === 'EMPTY',
  ).length;
  const eligibleAthletesCount = input.categoriesComputed.reduce(
    (acc, row) => acc + row.eligibleAthletesCount,
    0,
  );

  const critical: DrawValidationIssue[] = [];
  if (input.categoriesComputed.length === 0) {
    critical.push({
      code: 'NO_EVENT_CATEGORIES',
      severity: 'CRITICAL',
      count: 1,
      sampleIds: [input.eventId],
    });
  }

  if (
    input.drawStatus === 'NOT_GENERATED' &&
    !input.registrationClosedForDraw
  ) {
    critical.push({
      code: 'EVENT_NOT_LOCKED',
      severity: 'CRITICAL',
      count: 1,
      sampleIds: [input.eventId],
    });
  }

  if (input.drawStatus === 'NOT_GENERATED' && !input.weighInCompletedForDraw) {
    critical.push({
      code: 'WEIGHIN_NOT_COMPLETED_FOR_DRAW',
      severity: 'CRITICAL',
      count: 1,
      sampleIds: [input.eventId],
    });
  }

  if (input.missingFinalCategoryIds.length > 0) {
    critical.push({
      code: 'MISSING_FINAL_CATEGORY_ASSIGNMENT',
      severity: 'CRITICAL',
      count: input.missingFinalCategoryIds.length,
      sampleIds: input.missingFinalCategoryIds,
    });
  }

  if (input.invalidFinalCategoryIds.length > 0) {
    critical.push({
      code: 'INVALID_FINAL_CATEGORY_REFERENCE',
      severity: 'CRITICAL',
      count: input.invalidFinalCategoryIds.length,
      sampleIds: input.invalidFinalCategoryIds,
    });
  }

  if (blockedCategoriesCount > 0) {
    critical.push({
      code: 'BLOCKED_CATEGORIES_PRESENT',
      severity: 'CRITICAL',
      count: blockedCategoriesCount,
      sampleIds: input.categoriesComputed
        .filter((row) => row.readinessStatus === 'BLOCKED')
        .slice(0, 5)
        .map((row) => row.id),
    });
  }

  if (readyCategoriesCount === 0) {
    critical.push({
      code: 'NO_READY_CATEGORIES',
      severity: 'CRITICAL',
      count: 1,
      sampleIds: [input.eventId],
    });
  }

  const warnings: DrawValidationIssue[] = [];

  if (input.drawStatus !== 'NOT_GENERATED') {
    warnings.push({
      code: 'DRAW_ALREADY_GENERATED',
      severity: 'WARNING',
      count: input.bracketCount,
      sampleIds: [input.eventId],
    });
  }

  if (needsReviewCategoriesCount > 0) {
    warnings.push({
      code: 'NEEDS_REVIEW_CATEGORIES_PRESENT',
      severity: 'WARNING',
      count: needsReviewCategoriesCount,
      sampleIds: input.categoriesComputed
        .filter((row) => row.readinessStatus === 'NEEDS_REVIEW')
        .slice(0, 5)
        .map((row) => row.id),
    });
  }

  if (input.ageGroupMoveAthletesCount > 0) {
    warnings.push({
      code: 'AGE_GROUP_MOVE_ATHLETES_PRESENT',
      severity: 'WARNING',
      count: input.ageGroupMoveAthletesCount,
      sampleIds: input.categoriesComputed
        .filter((row) => row.hasAgeGroupMove)
        .slice(0, 5)
        .map((row) => row.id),
    });
  }

  if (soloCategoriesCount > 0) {
    warnings.push({
      code: 'ONE_ATHLETE_POOLS_PRESENT',
      severity: 'WARNING',
      count: soloCategoriesCount,
      sampleIds: input.categoriesComputed
        .filter((row) => row.readinessStatus === 'SOLO')
        .slice(0, 5)
        .map((row) => row.id),
    });
  }

  const validation: DrawValidationSummary = {
    critical,
    warnings,
    healthy: critical.length === 0 && warnings.length === 0,
  };

  const actions = buildActionAvailability({
    drawStatus: input.drawStatus,
    validation,
  });

  return {
    summary: {
      drawnCategoriesCount,
      blockedCategoriesCount,
      needsReviewCategoriesCount,
      soloCategoriesCount,
      readyCategoriesCount,
      emptyCategoriesCount,
      eligibleAthletesCount,
    },
    validation,
    actions,
  };
}
