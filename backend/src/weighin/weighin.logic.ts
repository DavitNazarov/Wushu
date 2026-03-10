import type {
  WeighInDecision,
  WeighInPolicyCode,
  WeighInStatus,
} from '@prisma/client';

export type WeightCategoryBounds = {
  id: string;
  name: string;
  minWeightKgExcl: number | null;
  maxWeightKgIncl: number | null;
  sortOrder: number;
};

export type WeighInAttemptContext = {
  decision: WeighInDecision;
  deadlineAt: Date | null;
  resolvedAt: Date | null;
};

export type PolicyWeighInOutcome = {
  decision: WeighInDecision;
  weighInStatus: WeighInStatus;
  moveToCategoryId: string | null;
  deadlineAt: Date | null;
  reason: string;
};

function sortCategories(categories: WeightCategoryBounds[]): WeightCategoryBounds[] {
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function isWithinCategoryBounds(
  weightKg: number,
  category: WeightCategoryBounds,
): boolean {
  const aboveMin =
    category.minWeightKgExcl == null || weightKg > category.minWeightKgExcl;
  const belowMax =
    category.maxWeightKgIncl == null || weightKg <= category.maxWeightKgIncl;
  return aboveMin && belowMax;
}

function findNextHigherMatchingCategory(input: {
  weightKg: number;
  currentCategory: WeightCategoryBounds;
  categoriesInAgeGroup: WeightCategoryBounds[];
}): WeightCategoryBounds | null {
  const sorted = sortCategories(input.categoriesInAgeGroup);
  const currentIdx = sorted.findIndex((c) => c.id === input.currentCategory.id);
  if (currentIdx < 0) return null;

  for (const candidate of sorted.slice(currentIdx + 1)) {
    if (isWithinCategoryBounds(input.weightKg, candidate)) {
      return candidate;
    }
  }
  return null;
}

function findOpenOneHourWindow(
  attempts: WeighInAttemptContext[],
): WeighInAttemptContext | null {
  const oneHourAttempts = attempts
    .filter((row) => row.decision === 'ONE_HOUR')
    .sort((a, b) => {
      const aDeadline = a.deadlineAt?.getTime() ?? 0;
      const bDeadline = b.deadlineAt?.getTime() ?? 0;
      return bDeadline - aDeadline;
    });

  return oneHourAttempts.find((row) => !row.resolvedAt) ?? null;
}

function buildPassedOutcome(reason: string): PolicyWeighInOutcome {
  return {
    decision: 'PASS',
    weighInStatus: 'PASSED',
    moveToCategoryId: null,
    deadlineAt: null,
    reason,
  };
}

function buildFailOutcome(
  decision: 'FAIL' | 'DISQUALIFIED',
  reason: string,
): PolicyWeighInOutcome {
  return {
    decision,
    weighInStatus: decision === 'DISQUALIFIED' ? 'DISQUALIFIED' : 'FAILED',
    moveToCategoryId: null,
    deadlineAt: null,
    reason,
  };
}

function buildReweighAllowedOutcome(
  deadlineAt: Date,
  reason: string,
): PolicyWeighInOutcome {
  return {
    decision: 'ONE_HOUR',
    weighInStatus: 'REWEIGH_ALLOWED',
    moveToCategoryId: null,
    deadlineAt,
    reason,
  };
}

function buildMovedUpOutcome(
  moveToCategoryId: string,
  reason: string,
): PolicyWeighInOutcome {
  return {
    decision: 'MOVED_UP',
    weighInStatus: 'MOVED_UP',
    moveToCategoryId,
    deadlineAt: null,
    reason,
  };
}

export function computePolicyWeighInOutcome(input: {
  policyCode: WeighInPolicyCode;
  weightKg: number;
  currentCategory: WeightCategoryBounds;
  categoriesInAgeGroup: WeightCategoryBounds[];
  attemptHistory: WeighInAttemptContext[];
  reweighWindowMinutes: number;
  now?: Date;
}): PolicyWeighInOutcome {
  const now = input.now ?? new Date();

  if (isWithinCategoryBounds(input.weightKg, input.currentCategory)) {
    return buildPassedOutcome('WEIGHT_IN_REGISTERED_CATEGORY');
  }

  const isUnderLowerBound =
    input.currentCategory.minWeightKgExcl != null &&
    input.weightKg <= input.currentCategory.minWeightKgExcl;
  if (isUnderLowerBound) {
    return buildFailOutcome('FAIL', 'UNDER_MINIMUM_WEIGHT_LIMIT');
  }

  const isOverUpperBound =
    input.currentCategory.maxWeightKgIncl != null &&
    input.weightKg > input.currentCategory.maxWeightKgIncl;

  if (!isOverUpperBound) return buildFailOutcome('FAIL', 'OUTSIDE_CATEGORY_RANGE');

  const nextHigher = findNextHigherMatchingCategory({
    weightKg: input.weightKg,
    currentCategory: input.currentCategory,
    categoriesInAgeGroup: input.categoriesInAgeGroup,
  });

  if (input.policyCode === 'DIRECT_MOVE_UP') {
    if (nextHigher) {
      return buildMovedUpOutcome(nextHigher.id, 'DIRECT_MOVE_UP_TO_NEXT_CATEGORY');
    }
    return buildFailOutcome('FAIL', 'NO_VALID_HIGHER_CATEGORY');
  }

  const oneHourWindow = findOpenOneHourWindow(input.attemptHistory);
  const newWindowDeadline = new Date(
    now.getTime() + input.reweighWindowMinutes * 60 * 1000,
  );

  if (input.policyCode === 'IWUF_STRICT_ONE_HOUR') {
    if (!oneHourWindow?.deadlineAt) {
      return buildReweighAllowedOutcome(
        newWindowDeadline,
        'IWUF_STRICT_REWEIGH_WINDOW_STARTED',
      );
    }

    if (now <= oneHourWindow.deadlineAt) {
      return buildReweighAllowedOutcome(
        oneHourWindow.deadlineAt,
        'IWUF_STRICT_REWEIGH_WINDOW_STILL_OPEN',
      );
    }

    return buildFailOutcome('DISQUALIFIED', 'IWUF_STRICT_REWEIGH_WINDOW_EXPIRED');
  }

  if (input.policyCode === 'MOVE_UP_AFTER_FAILED_REWEIGH') {
    if (!oneHourWindow?.deadlineAt) {
      return buildReweighAllowedOutcome(
        newWindowDeadline,
        'MOVE_UP_POLICY_REWEIGH_WINDOW_STARTED',
      );
    }

    if (now <= oneHourWindow.deadlineAt) {
      return buildReweighAllowedOutcome(
        oneHourWindow.deadlineAt,
        'MOVE_UP_POLICY_REWEIGH_WINDOW_STILL_OPEN',
      );
    }

    if (nextHigher) {
      return buildMovedUpOutcome(nextHigher.id, 'MOVE_UP_AFTER_REWEIGH_WINDOW_EXPIRED');
    }

    return buildFailOutcome('FAIL', 'NO_VALID_HIGHER_CATEGORY_AFTER_REWEIGH');
  }

  // For manual policy the service requires an explicit admin choice.
  return buildFailOutcome('FAIL', 'MANUAL_DECISION_REQUIRED');
}

export function computeManualDecisionOutcome(input: {
  decision: WeighInDecision;
  reason: string;
  currentCategory: WeightCategoryBounds;
  categoriesInAgeGroup: WeightCategoryBounds[];
  weightKg: number;
  reweighWindowMinutes: number;
  now?: Date;
  nextEventWeightCategoryId?: string | null;
}): PolicyWeighInOutcome {
  const now = input.now ?? new Date();

  if (input.decision === 'PASS') {
    return buildPassedOutcome(input.reason);
  }

  if (input.decision === 'MOVED_UP') {
    if (input.nextEventWeightCategoryId) {
      return buildMovedUpOutcome(input.nextEventWeightCategoryId, input.reason);
    }

    const nextHigher = findNextHigherMatchingCategory({
      weightKg: input.weightKg,
      currentCategory: input.currentCategory,
      categoriesInAgeGroup: input.categoriesInAgeGroup,
    });

    if (!nextHigher) {
      throw new Error('NO_HIGHER_CATEGORY_AVAILABLE');
    }

    return buildMovedUpOutcome(nextHigher.id, input.reason);
  }

  if (input.decision === 'ONE_HOUR' || input.decision === 'REWEIGH') {
    return buildReweighAllowedOutcome(
      new Date(now.getTime() + input.reweighWindowMinutes * 60 * 1000),
      input.reason,
    );
  }

  if (input.decision === 'DISQUALIFIED') {
    return buildFailOutcome('DISQUALIFIED', input.reason);
  }

  return buildFailOutcome('FAIL', input.reason);
}
