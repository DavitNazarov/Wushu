import type {
  WeighInDecision,
  WeighInPolicyCode,
  WeighInStatus,
} from '@prisma/client';

// Pure weigh-in decision logic — NO Prisma, NO Nest. All state needed for a
// decision is passed in, all output is a plain object. Lives separate from
// WeighinService so we can unit-test every policy branch deterministically.

// Bounds for one weight category. minWeightKgExcl is exclusive (>),
// maxWeightKgIncl is inclusive (≤) — the IWUF convention. nulls mean "no bound".
export type WeightCategoryBounds = {
  id: string;
  name: string;
  minWeightKgExcl: number | null;
  maxWeightKgIncl: number | null;
  sortOrder: number;
};

// Minimal projection of a prior WeighInAttempt — enough to detect an open
// ONE_HOUR reweigh window without joining everything.
export type WeighInAttemptContext = {
  decision: WeighInDecision;
  deadlineAt: Date | null;
  resolvedAt: Date | null;
};

// Output of a policy evaluation. Always carries a decision + status pair
// (paired in statusForOverrideOutcome too). moveToCategoryId is set when
// the decision is MOVED_UP; deadlineAt is set when ONE_HOUR triggers.
// `reason` is a machine-readable code (e.g. WEIGHT_IN_REGISTERED_CATEGORY)
// that travels into the audit log + reason column.
export type PolicyWeighInOutcome = {
  decision: WeighInDecision;
  weighInStatus: WeighInStatus;
  moveToCategoryId: string | null;
  deadlineAt: Date | null;
  reason: string;
};

// Copy + sort by sortOrder ascending — the canonical order categories appear
// in the UI's weight ladder. Doesn't mutate input.
function sortCategories(
  categories: WeightCategoryBounds[],
): WeightCategoryBounds[] {
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
}

// Standalone bounds check, exported because the preview service uses it too.
// Both nulls mean unbounded on that side.
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

// Walk up the sortOrder ladder from the current class and return the FIRST
// higher class the athlete's actual weight fits in. Used by both MOVE_UP
// and DIRECT_MOVE_UP policies. Returns null when the athlete is over the
// heaviest class — i.e. nowhere to go.
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

// Find an unresolved ONE_HOUR attempt with the latest deadline. If one
// exists, we're still inside the reweigh window from a previous fail and
// must continue that window rather than opening a new one.
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

// Helpers below collapse the four valid outcome shapes into single calls so
// the policy function stays readable. Each enforces a sensible decision↔status
// pairing — e.g. you can't accidentally produce { decision: PASS, status: FAILED }.
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

// Pure policy evaluator. Decision order:
//   1. Weight fits the registered category exactly → PASS.
//   2. Under the lower bound → FAIL (no path back).
//   3. Over upper bound → branches by policy:
//        DIRECT_MOVE_UP        → MOVED_UP to next fitting class, else FAIL.
//        IWUF_STRICT_ONE_HOUR  → open/extend the 1-hour reweigh window.
//                                After it expires → DISQUALIFIED.
//        MOVE_UP_AFTER_FAILED_REWEIGH → same window, then MOVED_UP on expiry.
//        MANUAL                → return FAIL with reason MANUAL_DECISION_REQUIRED
//                                so the service knows to throw.
// `now` is injectable so tests can drive reweigh-window scenarios.
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

  if (!isOverUpperBound)
    return buildFailOutcome('FAIL', 'OUTSIDE_CATEGORY_RANGE');

  const nextHigher = findNextHigherMatchingCategory({
    weightKg: input.weightKg,
    currentCategory: input.currentCategory,
    categoriesInAgeGroup: input.categoriesInAgeGroup,
  });

  if (input.policyCode === 'DIRECT_MOVE_UP') {
    if (nextHigher) {
      return buildMovedUpOutcome(
        nextHigher.id,
        'DIRECT_MOVE_UP_TO_NEXT_CATEGORY',
      );
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

    return buildFailOutcome(
      'DISQUALIFIED',
      'IWUF_STRICT_REWEIGH_WINDOW_EXPIRED',
    );
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
      return buildMovedUpOutcome(
        nextHigher.id,
        'MOVE_UP_AFTER_REWEIGH_WINDOW_EXPIRED',
      );
    }

    return buildFailOutcome('FAIL', 'NO_VALID_HIGHER_CATEGORY_AFTER_REWEIGH');
  }

  // For manual policy the service requires an explicit admin choice.
  return buildFailOutcome('FAIL', 'MANUAL_DECISION_REQUIRED');
}

// Same outcome shape as the policy version, but the decision is supplied by
// a human (admin override or MANUAL_ADMIN_DECISION policy). We still derive
// downstream details (deadline for ONE_HOUR, next category for MOVED_UP)
// so the caller doesn't have to know how each decision maps. MOVED_UP
// throws NO_HIGHER_CATEGORY_AVAILABLE if there's no fitting class and the
// caller didn't provide an explicit target id.
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
