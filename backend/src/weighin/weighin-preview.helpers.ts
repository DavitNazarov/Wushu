import type {
  EventLifecycle,
  WeighInDecision,
  WeighInPolicyCode,
  WeighInStatus,
} from '@prisma/client';
import { isWithinCategoryBounds, type WeightCategoryBounds } from './weighin.logic';

export const FINAL_WEIGHIN_STATUSES = new Set<WeighInStatus>([
  'PASSED',
  'MOVED_UP',
  'FAILED',
  'DISQUALIFIED',
  'OVERRIDE_APPROVED',
]);

export type RegistrationPreviewContext = {
  id: string;
  eventId: string;
  weighInStatus: WeighInStatus;
  eventWeightCategory: {
    id: string;
    rulesetWeightCategory: {
      name: string;
      minWeightKgExcl: number | null;
      maxWeightKgIncl: number | null;
      sortOrder: number;
    };
    eventAgeGroup: {
      weightCategories: Array<{
        id: string;
        rulesetWeightCategory: {
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
    rulesetWeightCategory: {
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

export function toBounds(
  category: RegistrationPreviewContext['eventWeightCategory'],
): WeightCategoryBounds[] {
  if (!category) return [];
  return category.eventAgeGroup.weightCategories.map((entry) => ({
    id: entry.id,
    name: entry.rulesetWeightCategory.name,
    minWeightKgExcl: entry.rulesetWeightCategory.minWeightKgExcl,
    maxWeightKgIncl: entry.rulesetWeightCategory.maxWeightKgIncl,
    sortOrder: entry.rulesetWeightCategory.sortOrder,
  }));
}

export function findCategoryById(
  categories: WeightCategoryBounds[],
  categoryId: string | null | undefined,
): WeightCategoryBounds | null {
  if (!categoryId) return null;
  return categories.find((item) => item.id === categoryId) ?? null;
}

export function findNextHigherMatchingCategory(input: {
  weightKg: number;
  currentCategory: WeightCategoryBounds;
  categories: WeightCategoryBounds[];
}): WeightCategoryBounds | null {
  const sorted = [...input.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const currentIdx = sorted.findIndex((item) => item.id === input.currentCategory.id);
  if (currentIdx < 0) return null;

  for (const candidate of sorted.slice(currentIdx + 1)) {
    if (isWithinCategoryBounds(input.weightKg, candidate)) return candidate;
  }
  return null;
}

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
  if (category.minWeightKgExcl != null && weightKg <= category.minWeightKgExcl) {
    const delta = Number((category.minWeightKgExcl - weightKg).toFixed(2));
    return {
      overLimitKg: null,
      underLimitKg: delta,
      deltaToLimitKg: -delta,
    };
  }
  return { overLimitKg: null, underLimitKg: null, deltaToLimitKg: 0 };
}
