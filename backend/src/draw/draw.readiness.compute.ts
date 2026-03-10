import {
  ACTIVE_REGISTRATION_STATUSES,
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
  DrawComputedOverview,
  DrawValidationIssue,
} from './draw.readiness.types';
import type { DrawReadinessContext } from './draw.readiness.queries';
import { buildValidationAndSummary } from './draw.readiness.validation';

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
};

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

function toAthletePoolRow(input: {
  registrationId: string;
  athleteId: string;
  athleteName: string;
  clubName: string | null;
  athleteCode: string;
  registrationStatus: DrawAthletePoolRow['registrationStatus'];
  weighInStatus: DrawAthletePoolRow['weighInStatus'];
  originalCategory: string | null;
  finalCategory: string | null;
  movedUp: boolean;
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
    originalCategory: input.originalCategory,
    finalCategory: input.finalCategory,
    movedUp: input.movedUp,
    overrideUsed: input.overrideUsed,
    eligibilityState: input.eligible ? 'ELIGIBLE' : 'EXCLUDED',
    exclusionReasonCode: input.exclusionReasonCode,
  };
}

function buildBuckets(input: DrawReadinessContext): Map<string, CategoryBucket> {
  const buckets = new Map<string, CategoryBucket>();
  for (const category of input.categories) {
    buckets.set(category.id, {
      id: category.id,
      ageGroupCode: category.eventAgeGroup.rulesetAgeGroup.code,
      ageGroupName: category.eventAgeGroup.rulesetAgeGroup.name,
      division: category.eventAgeGroup.rulesetAgeGroup.sex,
      categoryName: category.rulesetWeightCategory.name,
      sortOrder: category.rulesetWeightCategory.sortOrder,
      bracketDrawn: input.drawnCategoryIds.has(category.id),
      eligibleAthletes: [],
      excludedAthletes: [],
      criticalIssueCounts: new Map(),
      warningIssueCounts: new Map(),
    });
  }
  return buckets;
}

export function computeDrawReadiness(input: DrawReadinessContext): DrawComputedOverview {
  const buckets = buildBuckets(input);
  const missingFinalCategoryIds: string[] = [];
  const invalidFinalCategoryIds: string[] = [];
  let movedUpAthletesCount = 0;
  let overrideAthletesCount = 0;

  for (const registration of input.registrations) {
    if (!ACTIVE_REGISTRATION_STATUSES.has(registration.status)) continue;

    if (!registration.eventWeightCategoryId) {
      if (missingFinalCategoryIds.length < 8) missingFinalCategoryIds.push(registration.id);
      continue;
    }

    const bucket = buckets.get(registration.eventWeightCategoryId);
    if (!bucket) {
      if (invalidFinalCategoryIds.length < 8) invalidFinalCategoryIds.push(registration.id);
      continue;
    }

    const movedUp =
      registration.registeredEventWeightCategoryId != null &&
      registration.eventWeightCategoryId !== registration.registeredEventWeightCategoryId;
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
      originalCategory:
        registration.registeredEventWeightCategory?.rulesetWeightCategory.name ?? null,
      finalCategory: registration.eventWeightCategory?.rulesetWeightCategory.name ?? null,
      movedUp,
      overrideUsed,
      eligible,
      exclusionReasonCode,
    });

    if (eligible) {
      bucket.eligibleAthletes.push(athleteRow);
      if (movedUp) movedUpAthletesCount += 1;
      if (overrideUsed) overrideAthletesCount += 1;
    } else {
      bucket.excludedAthletes.push(athleteRow);
      pushIssueCount(bucket.criticalIssueCounts, exclusionReasonCode!, registration.id);
    }
  }

  let oneAthletePoolsCount = 0;
  const categoriesComputed: DrawCategoryComputedRow[] = [];

  for (const bucket of buckets.values()) {
    if (bucket.eligibleAthletes.some((row) => row.movedUp)) {
      pushIssueCount(bucket.warningIssueCounts, 'MOVED_UP_PRESENT', bucket.id);
    }
    if (bucket.eligibleAthletes.some((row) => row.overrideUsed)) {
      pushIssueCount(bucket.warningIssueCounts, 'OVERRIDE_PRESENT', bucket.id);
    }
    if (bucket.eligibleAthletes.length === 1) {
      oneAthletePoolsCount += 1;
      pushIssueCount(bucket.warningIssueCounts, 'ONE_ATHLETE_POOL', bucket.id);
    }

    const criticalIssues = toIssueArray(bucket.criticalIssueCounts, 'CRITICAL');
    const warningIssues = toIssueArray(bucket.warningIssueCounts, 'WARNING');
    const issues = [...criticalIssues, ...warningIssues];

    categoriesComputed.push({
      id: bucket.id,
      ageGroupCode: bucket.ageGroupCode,
      ageGroupName: bucket.ageGroupName,
      division: bucket.division,
      categoryName: bucket.categoryName,
      sortOrder: bucket.sortOrder,
      bracketStatus: bucket.bracketDrawn ? 'DRAWN' : 'NOT_DRAWN',
      readinessStatus: deriveCategoryStatus({
        bracketDrawn: bucket.bracketDrawn,
        eligibleCount: bucket.eligibleAthletes.length,
        excludedCount: bucket.excludedAthletes.length,
        criticalIssueCount: criticalIssues.length,
        warningIssueCount: warningIssues.length,
      }),
      eligibleAthletesCount: bucket.eligibleAthletes.length,
      excludedAthletesCount: bucket.excludedAthletes.length,
      criticalIssueCount: criticalIssues.length,
      warningIssueCount: warningIssues.length,
      issueCount: issues.length,
      hasMovedUpAthletes: bucket.eligibleAthletes.some((row) => row.movedUp),
      hasOverrideAthletes: bucket.eligibleAthletes.some((row) => row.overrideUsed),
      issues,
      eligibleAthletes: bucket.eligibleAthletes,
      excludedAthletes: bucket.excludedAthletes,
    });
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
    movedUpAthletesCount,
    overrideAthletesCount,
    oneAthletePoolsCount,
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
      },
      summary: {
        totalCategories: categoriesComputed.length,
        readyCategoriesCount: validationResult.summary.readyCategoriesCount,
        blockedCategoriesCount: validationResult.summary.blockedCategoriesCount,
        drawnCategoriesCount: validationResult.summary.drawnCategoriesCount,
        emptyCategoriesCount: validationResult.summary.emptyCategoriesCount,
        needsReviewCategoriesCount: validationResult.summary.needsReviewCategoriesCount,
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
      categories: categoriesComputed.map(({ eligibleAthletes, excludedAthletes, ...row }) => row),
    },
    categoriesById,
  };
}
