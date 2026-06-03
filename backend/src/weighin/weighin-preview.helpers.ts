import type {
  EventLifecycle,
  WeighInDecision,
  WeighInPolicyCode,
  WeighInStatus,
} from '@prisma/client';
import {
  isWithinCategoryBounds,
  type WeightCategoryBounds,
} from './weighin.logic';

// Pure helpers + shared types used by WeighinPreviewService. Kept stateless
// (no Prisma) so they're trivial to unit-test via the preview.mapper spec.

// Set of weigh-in statuses where the registration is "done" and the operator
// shouldn't be able to keep recording attempts. The preview service uses this
// to drop into "already recorded" mode and suppress new policy outputs.
export const FINAL_WEIGHIN_STATUSES = new Set<WeighInStatus>([
  'PASSED',
  'MOVED_UP',
  'FAILED',
  'DISQUALIFIED',
  'OVERRIDE_APPROVED',
]);

// Shape returned by the preview's Prisma include block. Carries everything
// the preview functions need WITHOUT pulling Prisma types directly.
export type RegistrationPreviewContext = {
  id: string;
  eventId: string;
  weighInStatus: WeighInStatus;
  eventWeightCategory: {
    id: string;
    categoryTemplateWeight: {
      name: string;
      minWeightKgExcl: number | null;
      maxWeightKgIncl: number | null;
      sortOrder: number;
    };
    eventAgeGroup: {
      weightCategories: Array<{
        id: string;
        categoryTemplateWeight: {
          name: string;
          minWeightKgExcl: number | null;
          maxWeightKgIncl: number | null;
          sortOrder: number;
        };
      }>;
    };
  } | null;
  registeredEventWeightCategory: {
    id: string;
    categoryTemplateWeight: {
      name: string;
      minWeightKgExcl: number | null;
      maxWeightKgIncl: number | null;
      sortOrder: number;
    };
  } | null;
  weighIns: Array<{
    id: string;
    attemptNo: number;
    weightKg: number;
    decision: WeighInDecision;
    deadlineAt: Date | null;
    resolvedAt: Date | null;
    reason: string | null;
    override: boolean;
    createdAt: Date;
    operatorUserId: string | null;
    operator: {
      id: string;
      displayName: string;
    } | null;
  }>;
  event: {
    id: string;
    name: string;
    lifecycle: EventLifecycle;
    weighInPolicyCode: WeighInPolicyCode;
    reweighWindowMinutes: number;
  };
};

// Project the registration's joined eventWeightCategory into the
// WeightCategoryBounds list that weighin.logic accepts. Returns [] when no
// category is attached (registration not category-mapped yet).
export function toBounds(
  category: RegistrationPreviewContext['eventWeightCategory'],
): WeightCategoryBounds[] {
  if (!category) return [];
  return category.eventAgeGroup.weightCategories.map((entry) => ({
    id: entry.id,
    name: entry.categoryTemplateWeight.name,
    minWeightKgExcl: entry.categoryTemplateWeight.minWeightKgExcl,
    maxWeightKgIncl: entry.categoryTemplateWeight.maxWeightKgIncl,
    sortOrder: entry.categoryTemplateWeight.sortOrder,
  }));
}

// Trivial id→category lookup with a null-safe input. Used to resolve the
// policy's moveToCategoryId into a full bounds row so the UI can render the
// target category's name and weight range.
export function findCategoryById(
  categories: WeightCategoryBounds[],
  categoryId: string | null | undefined,
): WeightCategoryBounds | null {
  if (!categoryId) return null;
  return categories.find((item) => item.id === categoryId) ?? null;
}

// Local copy of findNextHigherMatchingCategory from weighin.logic with the
// slightly different param naming the preview prefers. Used as a fallback
// when the policy didn't produce a moveToCategoryId so the UI can still
// suggest the obvious target.
export function findNextHigherMatchingCategory(input: {
  weightKg: number;
  currentCategory: WeightCategoryBounds;
  categories: WeightCategoryBounds[];
}): WeightCategoryBounds | null {
  const sorted = [...input.categories].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const currentIdx = sorted.findIndex(
    (item) => item.id === input.currentCategory.id,
  );
  if (currentIdx < 0) return null;

  for (const candidate of sorted.slice(currentIdx + 1)) {
    if (isWithinCategoryBounds(input.weightKg, candidate)) return candidate;
  }
  return null;
}

// Find the most-recent unresolved ONE_HOUR attempt and return a UI-friendly
// snapshot: attempt id, deadline, and a precomputed isExpired flag (so the
// frontend doesn't have to re-do the time-comparison itself). Returns null
// when there's no open window.
export function extractOpenOneHourWindow(
  context: RegistrationPreviewContext,
  now: Date,
) {
  const oneHourAttempt = [...context.weighIns]
    .reverse()
    .find((attempt) => attempt.decision === 'ONE_HOUR' && !attempt.resolvedAt);

  if (!oneHourAttempt?.deadlineAt) return null;
  return {
    attemptId: oneHourAttempt.id,
    deadlineAt: oneHourAttempt.deadlineAt,
    isExpired: now.getTime() > oneHourAttempt.deadlineAt.getTime(),
  };
}

// Compute the operator-friendly "how far over/under" hint.
//   - over the upper bound:  overLimitKg = +Δ, deltaToLimitKg = +Δ
//   - under the lower bound: underLimitKg = +Δ, deltaToLimitKg = -Δ
//   - within bounds:         all zero/null
// Rounded to 2 decimals to match scale-display precision; the sign of
// deltaToLimitKg is what the UI uses to color the indicator.
export function metricFromCategory(
  weightKg: number,
  category: WeightCategoryBounds,
): {
  overLimitKg: number | null;
  underLimitKg: number | null;
  deltaToLimitKg: number | null;
} {
  if (category.maxWeightKgIncl != null && weightKg > category.maxWeightKgIncl) {
    const delta = Number((weightKg - category.maxWeightKgIncl).toFixed(2));
    return {
      overLimitKg: delta,
      underLimitKg: null,
      deltaToLimitKg: delta,
    };
  }
  if (
    category.minWeightKgExcl != null &&
    weightKg <= category.minWeightKgExcl
  ) {
    const delta = Number((category.minWeightKgExcl - weightKg).toFixed(2));
    return {
      overLimitKg: null,
      underLimitKg: delta,
      deltaToLimitKg: -delta,
    };
  }
  return { overLimitKg: null, underLimitKg: null, deltaToLimitKg: 0 };
}
