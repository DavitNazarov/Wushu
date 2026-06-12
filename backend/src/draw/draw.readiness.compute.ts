import {
  ACTIVE_REGISTRATION_STATUSES,
  computeCategoryReviewSignature,
  deriveCategoryStatus,
  deriveDrawOverallStatus,
  deriveExclusionReasonCode,
  ELIGIBLE_WEIGHIN_STATUSES,
  isRegistrationClosedForDraw,
  isWeighInCompletedForDraw,
} from './draw.readiness.helpers';
import type {
  DrawAthletePoolRow,
  DrawCategoryComputedRow,
  DrawCategoryStatus,
  DrawComputedOverview,
  DrawValidationIssue,
} from './draw.readiness.types';
import type { DrawReadinessContext } from './draw.readiness.queries';
import { buildValidationAndSummary } from './draw.readiness.validation';

// Pure compute step for draw readiness. Takes a fully-loaded DrawReadinessContext
// and emits the user-facing overview + per-category map. NO Prisma here — the
// entire file is deterministic so it's trivially unit-testable.

// Per-category accumulator. Built once per event category, then iterated
// to attach athletes + tally issue counts before being projected into the
// final DrawCategoryComputedRow.
type CategoryBucket = {
  id: string;
  ageGroupCode: string;
  ageGroupName: string;
  division: 'MALE' | 'FEMALE' | null;
  categoryName: string;
  sortOrder: number;
  bracketDrawn: boolean;
  eligibleAthletes: DrawAthletePoolRow[];
  excludedAthletes: DrawAthletePoolRow[];
  criticalIssueCounts: Map<string, { count: number; sampleIds: string[] }>;
  warningIssueCounts: Map<string, { count: number; sampleIds: string[] }>;
  drawReviewedAt: Date | null;
  drawReviewSignature: string | null;
  reviewedByName: string | null;
};

// Increment-and-collect helper for issue tallies. We cap sampleIds at 5 so
// the API doesn't return huge arrays for events with hundreds of athletes;
// the UI shows "5 affected + N more" using count.
function pushIssueCount(
  bucket: Map<string, { count: number; sampleIds: string[] }>,
  code: string,
  sampleId: string,
): void {
  const existing = bucket.get(code);
  if (!existing) {
    bucket.set(code, { count: 1, sampleIds: [sampleId] });
    return;
  }
  existing.count += 1;
  if (existing.sampleIds.length < 5 && !existing.sampleIds.includes(sampleId)) {
    existing.sampleIds.push(sampleId);
  }
}

// Map → array projection with a severity tag attached. Used when assembling
// the per-category issues list at the end of the loop.
function toIssueArray(
  input: Map<string, { count: number; sampleIds: string[] }>,
  severity: 'CRITICAL' | 'WARNING',
): DrawValidationIssue[] {
  return Array.from(input.entries()).map(([code, row]) => ({
    code,
    severity,
    count: row.count,
    sampleIds: row.sampleIds,
  }));
}

// Shape one athlete row for the eligible/excluded lists. The eligibility flag
// is derived upstream; this fn just packages everything for the UI.
// `eligibilityState` is the string the frontend filters/sorts on.
function toAthletePoolRow(input: {
  registrationId: string;
  athleteId: string;
  athleteName: string;
  clubName: string | null;
  athleteCode: string;
  registrationStatus: DrawAthletePoolRow['registrationStatus'];
  weighInStatus: DrawAthletePoolRow['weighInStatus'];
  weighInWeightKg: number | null;
  originalCategory: string | null;
  finalCategory: string | null;
  movedUp: boolean;
  crossesAgeGroup: boolean;
  overrideUsed: boolean;
  eligible: boolean;
  exclusionReasonCode: string | null;
}): DrawAthletePoolRow {
  return {
    registrationId: input.registrationId,
    athleteId: input.athleteId,
    athleteName: input.athleteName,
    clubName: input.clubName,
    athleteCode: input.athleteCode,
    registrationStatus: input.registrationStatus,
    weighInStatus: input.weighInStatus,
    weighInWeightKg: input.weighInWeightKg,
    originalCategory: input.originalCategory,
    finalCategory: input.finalCategory,
    movedUp: input.movedUp,
    crossesAgeGroup: input.crossesAgeGroup,
    overrideUsed: input.overrideUsed,
    eligibilityState: input.eligible ? 'ELIGIBLE' : 'EXCLUDED',
    exclusionReasonCode: input.exclusionReasonCode,
  };
}

// Build an empty bucket per event category, keyed by eventWeightCategory id.
// Captures the bracket-drawn flag from drawnCategoryIds so each bucket later
// knows whether it's been drawn yet without a second pass.
function buildBuckets(
  input: DrawReadinessContext,
): Map<string, CategoryBucket> {
  const buckets = new Map<string, CategoryBucket>();
  for (const category of input.categories) {
    buckets.set(category.id, {
      id: category.id,
      ageGroupCode: category.eventAgeGroup.categoryTemplateAgeGroup.code,
      ageGroupName: category.eventAgeGroup.categoryTemplateAgeGroup.name,
      division: category.eventAgeGroup.categoryTemplateAgeGroup.sex,
      categoryName: category.categoryTemplateWeight.name,
      sortOrder: category.categoryTemplateWeight.sortOrder,
      bracketDrawn: input.drawnCategoryIds.has(category.id),
      eligibleAthletes: [],
      excludedAthletes: [],
      criticalIssueCounts: new Map(),
      warningIssueCounts: new Map(),
      drawReviewedAt: category.drawReviewedAt,
      drawReviewSignature: category.drawReviewSignature,
      reviewedByName: category.drawReviewedBy?.displayName ?? null,
    });
  }
  return buckets;
}

// Main entry point. Three logical passes:
//   1. Bucket every active registration into its event category, tagging it
//      eligible or excluded. Tracks orphans (missing/invalid final category id)
//      separately so they surface as event-level critical issues, not category ones.
//   2. After bucketing, walk each bucket once to compute category-level
//      warnings (AGE_GROUP_MOVE_PRESENT, ONE_ATHLETE_POOL) and derive its
//      readinessStatus.
//   3. Delegate top-level validation + summary aggregation to
//      buildValidationAndSummary, then project the final response shape.
// The returned `categoriesById` Map lets the per-category endpoint avoid
// recomputing — the caller picks from the map.
export function computeDrawReadiness(
  input: DrawReadinessContext,
): DrawComputedOverview {
  const buckets = buildBuckets(input);
  // categoryId → age-group code, so we can tell a same-age-group weight bump
  // (not a review concern) apart from a cross-age-group move (a review concern).
  const categoryAgeGroupCode = new Map<string, string>();
  for (const category of input.categories) {
    categoryAgeGroupCode.set(
      category.id,
      category.eventAgeGroup.categoryTemplateAgeGroup.code,
    );
  }
  const missingFinalCategoryIds: string[] = [];
  const invalidFinalCategoryIds: string[] = [];
  let movedUpAthletesCount = 0;

  for (const registration of input.registrations) {
    if (!ACTIVE_REGISTRATION_STATUSES.has(registration.status)) continue;

    if (!registration.eventWeightCategoryId) {
      if (missingFinalCategoryIds.length < 8)
        missingFinalCategoryIds.push(registration.id);
      continue;
    }

    const bucket = buckets.get(registration.eventWeightCategoryId);
    if (!bucket) {
      if (invalidFinalCategoryIds.length < 8)
        invalidFinalCategoryIds.push(registration.id);
      continue;
    }

    const movedUp =
      registration.registeredEventWeightCategoryId != null &&
      registration.eventWeightCategoryId !==
        registration.registeredEventWeightCategoryId;
    // Only a move that lands in a DIFFERENT age group flags review; a same-age
    // weight bump is routine. If either age code is unknown, don't flag.
    const finalAgeCode = categoryAgeGroupCode.get(
      registration.eventWeightCategoryId,
    );
    const registeredAgeCode = registration.registeredEventWeightCategoryId
      ? categoryAgeGroupCode.get(registration.registeredEventWeightCategoryId)
      : undefined;
    const crossesAgeGroup =
      movedUp &&
      registeredAgeCode != null &&
      finalAgeCode != null &&
      registeredAgeCode !== finalAgeCode;
    const overrideUsed =
      registration.weighInStatus === 'OVERRIDE_APPROVED' ||
      Boolean(registration.weighIns[0]?.override);

    const eligible =
      registration.status === 'APPROVED' &&
      ELIGIBLE_WEIGHIN_STATUSES.has(registration.weighInStatus);

    const exclusionReasonCode = eligible
      ? null
      : deriveExclusionReasonCode({
          registrationStatus: registration.status,
          weighInStatus: registration.weighInStatus,
        });

    const athleteRow = toAthletePoolRow({
      registrationId: registration.id,
      athleteId: registration.athleteId,
      athleteName: `${registration.athlete.firstName} ${registration.athlete.lastName}`,
      clubName: registration.club?.name ?? null,
      athleteCode: registration.athlete.documentId ?? registration.athlete.id,
      registrationStatus: registration.status,
      weighInStatus: registration.weighInStatus,
      weighInWeightKg: registration.weighIns[0]?.weightKg ?? null,
      originalCategory:
        registration.registeredEventWeightCategory?.categoryTemplateWeight
          .name ?? null,
      finalCategory:
        registration.eventWeightCategory?.categoryTemplateWeight.name ?? null,
      movedUp,
      crossesAgeGroup,
      overrideUsed,
      eligible,
      exclusionReasonCode,
    });

    if (eligible) {
      bucket.eligibleAthletes.push(athleteRow);
      if (movedUp) movedUpAthletesCount += 1;
    } else {
      bucket.excludedAthletes.push(athleteRow);
      pushIssueCount(
        bucket.criticalIssueCounts,
        exclusionReasonCode!,
        registration.id,
      );
    }
  }

  const categoriesComputed: DrawCategoryComputedRow[] = [];

  for (const bucket of buckets.values()) {
    // A cross-age-group move is the only move-up that flags review now; a
    // same-age-group weight bump is routine and no longer flagged.
    if (bucket.eligibleAthletes.some((row) => row.crossesAgeGroup)) {
      pushIssueCount(
        bucket.warningIssueCounts,
        'AGE_GROUP_MOVE_PRESENT',
        bucket.id,
      );
    }
    // Override is intentionally NOT flagged — it was already decided at weigh-in.
    if (bucket.eligibleAthletes.length === 1) {
      pushIssueCount(bucket.warningIssueCounts, 'ONE_ATHLETE_POOL', bucket.id);
    }

    const criticalIssues = toIssueArray(bucket.criticalIssueCounts, 'CRITICAL');
    const warningIssues = toIssueArray(bucket.warningIssueCounts, 'WARNING');
    const issues = [...criticalIssues, ...warningIssues];

    const rawStatus = deriveCategoryStatus({
      bracketDrawn: bucket.bracketDrawn,
      eligibleCount: bucket.eligibleAthletes.length,
      excludedCount: bucket.excludedAthletes.length,
      criticalIssueCount: criticalIssues.length,
      warningIssueCount: warningIssues.length,
    });
    // A stored review sign-off promotes SOLO/NEEDS_REVIEW to READY, but only
    // while its signature still matches the current pool — otherwise it has
    // auto-expired (a late registration / re-weigh / reassignment changed it).
    const reviewActive =
      bucket.drawReviewedAt != null &&
      bucket.drawReviewSignature ===
        computeCategoryReviewSignature(bucket.eligibleAthletes) &&
      (rawStatus === 'SOLO' || rawStatus === 'NEEDS_REVIEW');
    const reviewed = reviewActive;
    const reviewedAt = reviewActive ? bucket.drawReviewedAt : null;
    const reviewedByName = reviewActive ? bucket.reviewedByName : null;
    const readinessStatus: DrawCategoryStatus = reviewActive
      ? 'READY'
      : rawStatus;

    categoriesComputed.push({
      id: bucket.id,
      ageGroupCode: bucket.ageGroupCode,
      ageGroupName: bucket.ageGroupName,
      division: bucket.division,
      categoryName: bucket.categoryName,
      sortOrder: bucket.sortOrder,
      bracketStatus: bucket.bracketDrawn ? 'DRAWN' : 'NOT_DRAWN',
      readinessStatus,
      eligibleAthletesCount: bucket.eligibleAthletes.length,
      excludedAthletesCount: bucket.excludedAthletes.length,
      criticalIssueCount: criticalIssues.length,
      warningIssueCount: warningIssues.length,
      issueCount: issues.length,
      hasMovedUpAthletes: bucket.eligibleAthletes.some((row) => row.movedUp),
      hasAgeGroupMove: bucket.eligibleAthletes.some(
        (row) => row.crossesAgeGroup,
      ),
      reviewed,
      reviewedAt,
      reviewedByName,
      issues,
      eligibleAthletes: bucket.eligibleAthletes,
      excludedAthletes: bucket.excludedAthletes,
    });
  }

  // Event-wide athlete tally for the cross-age-group warning, excluding any
  // category that's been reviewed away.
  let ageGroupMoveAthletesCount = 0;
  for (const row of categoriesComputed) {
    if (row.reviewed) continue;
    ageGroupMoveAthletesCount += row.eligibleAthletes.filter(
      (a) => a.crossesAgeGroup,
    ).length;
  }

  const drawStatus = deriveDrawOverallStatus({
    bracketCount: input.bracketCount,
    eventLifecycle: input.event.lifecycle,
    published: input.event.published,
  });

  const validationResult = buildValidationAndSummary({
    categoriesComputed,
    drawStatus,
    eventId: input.event.id,
    eventLifecycle: input.event.lifecycle,
    registrationClosedForDraw: isRegistrationClosedForDraw({
      lifecycle: input.event.lifecycle,
      registrationOpensAt: input.event.registrationOpensAt,
      registrationClosesAt: input.event.registrationClosesAt,
    }),
    weighInCompletedForDraw: isWeighInCompletedForDraw({
      lifecycle: input.event.lifecycle,
      statuses: input.registrations
        .filter((registration) => registration.status !== 'WITHDRAWN')
        .map((registration) => registration.weighInStatus),
    }),
    missingFinalCategoryIds,
    invalidFinalCategoryIds,
    ageGroupMoveAthletesCount,
    bracketCount: input.bracketCount,
  });

  const categoriesById = new Map<string, DrawCategoryComputedRow>(
    categoriesComputed.map((row) => [row.id, row]),
  );

  return {
    overview: {
      event: {
        id: input.event.id,
        name: input.event.name,
        lifecycle: input.event.lifecycle,
        publishTimingPolicyCode: input.event.publishTimingPolicyCode,
        drawStatus,
        registrationLocked: input.event.lifecycle !== 'REG_OPEN',
        weighInResultsPublic: input.event.weighInResultsPublic,
      },
      summary: {
        totalCategories: categoriesComputed.length,
        readyCategoriesCount: validationResult.summary.readyCategoriesCount,
        blockedCategoriesCount: validationResult.summary.blockedCategoriesCount,
        drawnCategoriesCount: validationResult.summary.drawnCategoriesCount,
        emptyCategoriesCount: validationResult.summary.emptyCategoriesCount,
        needsReviewCategoriesCount:
          validationResult.summary.needsReviewCategoriesCount,
        soloCategoriesCount: validationResult.summary.soloCategoriesCount,
        eligibleAthletesCount: validationResult.summary.eligibleAthletesCount,
        movedUpAthletesCount,
        outstandingIssuesCount:
          validationResult.validation.critical.length +
          validationResult.validation.warnings.length,
        criticalIssuesCount: validationResult.validation.critical.length,
        warningIssuesCount: validationResult.validation.warnings.length,
      },
      validation: validationResult.validation,
      actions: validationResult.actions,
      lastGeneration: {
        action: input.lastGeneration?.action ?? null,
        at: input.lastGeneration?.createdAt ?? null,
        by:
          input.lastGeneration?.actorUserId != null
            ? {
                id: input.lastGeneration.actorUserId,
                displayName: input.lastGeneration.actor?.displayName ?? null,
              }
            : null,
      },
      audit: {
        recent: input.recentAudit.map((entry) => ({
          id: entry.id,
          action: entry.action,
          createdAt: entry.createdAt,
          actorUserId: entry.actorUserId,
          actorDisplayName: entry.actor?.displayName ?? null,
          reason: entry.reason,
          override: entry.override,
        })),
      },
      categories: categoriesComputed.map(
        ({ eligibleAthletes, excludedAthletes, ...row }) => row,
      ),
    },
    categoriesById,
  };
}
