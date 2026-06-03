import type {
  PolicyWeighInOutcome,
  WeightCategoryBounds,
} from './weighin.logic';
import type {
  WeighInAllowedAction,
  WeighInCategorySummary,
  WeighInDecisionState,
} from './weighin.preview.types';

// Reusable action lists for each preview state. Each entry tells the UI
// what button to render and what data to collect. PRIMARY/SECONDARY/DANGER
// drive button styling; requires* flags drive form-control visibility.

// Shown when the policy says "PASS": one big "record this" primary button
// plus an admin override escape hatch.
const AUTO_PASS_ACTIONS: WeighInAllowedAction[] = [
  {
    code: 'RECORD_WEIGH_IN',
    level: 'PRIMARY',
    decision: 'PASS',
  },
  {
    code: 'MANUAL_OVERRIDE',
    level: 'SECONDARY',
    requiresDecision: true,
    requiresReason: true,
    requiresTargetCategory: false,
  },
];

// Shown when the event uses MANUAL_ADMIN_DECISION OR the policy ran but
// returned an indeterminate result — operator MUST pick a decision, give a
// reason, and (for MOVE_UP) choose a target class.
const MANUAL_DECISION_ACTIONS: WeighInAllowedAction[] = [
  {
    code: 'SUBMIT_MANUAL_DECISION',
    level: 'PRIMARY',
    requiresDecision: true,
    requiresReason: true,
    requiresTargetCategory: true,
  },
];

// Shown when the registration is already in a final state — only an admin
// override can change the outcome at that point.
const ALREADY_RECORDED_ACTIONS: WeighInAllowedAction[] = [
  {
    code: 'MANUAL_OVERRIDE',
    level: 'SECONDARY',
    requiresDecision: true,
    requiresReason: true,
    requiresTargetCategory: false,
  },
];

// Translate a PolicyWeighInOutcome (or its absence) into the UI-facing
// preview state. The ordering of the early-returns matters:
//   1. alreadyRecorded short-circuits everything else (no recompute needed)
//   2. manualPolicy / null-outcome both demand a manual decision
//   3. Otherwise we pick a state per decision (PASS / REWEIGH / MOVED_UP /
//      DISQUALIFIED) and assemble the corresponding action list.
// MOVE_UP enrichment: we inline targetCategoryId/Name so the UI doesn't have
// to look them up again.
export function mapPreviewStateFromOutcome(input: {
  alreadyRecorded: boolean;
  manualPolicy: boolean;
  outcome: PolicyWeighInOutcome | null;
  nextCategory: WeighInCategorySummary | null;
}): {
  decisionState: WeighInDecisionState;
  summaryCode: string;
  policyReasonCode: string | null;
  previewDecision: PolicyWeighInOutcome['decision'] | null;
  previewStatus: PolicyWeighInOutcome['weighInStatus'] | null;
  allowedActions: WeighInAllowedAction[];
} {
  if (input.alreadyRecorded) {
    return {
      decisionState: 'ALREADY_RECORDED',
      summaryCode: 'ALREADY_RECORDED',
      policyReasonCode: null,
      previewDecision: null,
      previewStatus: null,
      allowedActions: [...ALREADY_RECORDED_ACTIONS],
    };
  }

  if (input.manualPolicy) {
    return {
      decisionState: 'MANUAL_DECISION_REQUIRED',
      summaryCode: 'MANUAL_DECISION_REQUIRED',
      policyReasonCode: null,
      previewDecision: null,
      previewStatus: null,
      allowedActions: [...MANUAL_DECISION_ACTIONS],
    };
  }

  if (!input.outcome) {
    return {
      decisionState: 'MANUAL_DECISION_REQUIRED',
      summaryCode: 'MANUAL_DECISION_REQUIRED',
      policyReasonCode: null,
      previewDecision: null,
      previewStatus: null,
      allowedActions: [...MANUAL_DECISION_ACTIONS],
    };
  }

  if (input.outcome.decision === 'PASS') {
    return {
      decisionState: 'AUTO_PASS',
      summaryCode: 'AUTO_PASS',
      policyReasonCode: input.outcome.reason,
      previewDecision: input.outcome.decision,
      previewStatus: input.outcome.weighInStatus,
      allowedActions: [...AUTO_PASS_ACTIONS],
    };
  }

  if (
    input.outcome.decision === 'REWEIGH' ||
    input.outcome.decision === 'ONE_HOUR'
  ) {
    return {
      decisionState: 'REWEIGH_ALLOWED',
      summaryCode: 'REWEIGH_ALLOWED',
      policyReasonCode: input.outcome.reason,
      previewDecision: input.outcome.decision,
      previewStatus: input.outcome.weighInStatus,
      allowedActions: [
        {
          code: 'RECORD_REWEIGH',
          level: 'PRIMARY',
          decision: input.outcome.decision,
        },
        {
          code: 'MANUAL_OVERRIDE',
          level: 'SECONDARY',
          requiresDecision: true,
          requiresReason: true,
        },
      ],
    };
  }

  if (input.outcome.decision === 'MOVED_UP') {
    return {
      decisionState: 'MOVE_UP_AVAILABLE',
      summaryCode: 'MOVE_UP_AVAILABLE',
      policyReasonCode: input.outcome.reason,
      previewDecision: input.outcome.decision,
      previewStatus: input.outcome.weighInStatus,
      allowedActions: [
        {
          code: 'MOVE_UP',
          level: 'PRIMARY',
          decision: 'MOVED_UP',
          targetCategoryId: input.nextCategory?.id ?? null,
          targetCategoryName: input.nextCategory?.name ?? null,
        },
        {
          code: 'MANUAL_OVERRIDE',
          level: 'SECONDARY',
          requiresDecision: true,
          requiresReason: true,
        },
      ],
    };
  }

  if (input.outcome.decision === 'DISQUALIFIED') {
    return {
      decisionState: 'DISQUALIFY_REQUIRED',
      summaryCode: 'DISQUALIFY_REQUIRED',
      policyReasonCode: input.outcome.reason,
      previewDecision: input.outcome.decision,
      previewStatus: input.outcome.weighInStatus,
      allowedActions: [
        {
          code: 'RECORD_DISQUALIFICATION',
          level: 'DANGER',
          decision: 'DISQUALIFIED',
        },
        {
          code: 'MANUAL_OVERRIDE',
          level: 'SECONDARY',
          requiresDecision: true,
          requiresReason: true,
        },
      ],
    };
  }

  return {
    decisionState: 'DISQUALIFY_REQUIRED',
    summaryCode: 'DISQUALIFY_REQUIRED',
    policyReasonCode: input.outcome.reason,
    previewDecision: input.outcome.decision,
    previewStatus: input.outcome.weighInStatus,
    allowedActions: [
      {
        code: 'RECORD_FAIL',
        level: 'DANGER',
        decision: 'FAIL',
      },
      {
        code: 'MANUAL_OVERRIDE',
        level: 'SECONDARY',
        requiresDecision: true,
        requiresReason: true,
      },
    ],
  };
}

// Project the policy's WeightCategoryBounds shape into the UI-facing summary
// shape (currently identical, but the UI type lives separately so we can
// extend either side without coupling them).
export function toCategorySummary(
  category: WeightCategoryBounds,
): WeighInCategorySummary {
  return {
    id: category.id,
    name: category.name,
    minWeightKgExcl: category.minWeightKgExcl,
    maxWeightKgIncl: category.maxWeightKgIncl,
    sortOrder: category.sortOrder,
  };
}
