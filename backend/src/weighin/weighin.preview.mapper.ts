import type {
  PolicyWeighInOutcome,
  WeightCategoryBounds,
} from './weighin.logic';
import type {
  WeighInAllowedAction,
  WeighInCategorySummary,
  WeighInDecisionState,
} from './weighin.preview.types';

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

const MANUAL_DECISION_ACTIONS: WeighInAllowedAction[] = [
  {
    code: 'SUBMIT_MANUAL_DECISION',
    level: 'PRIMARY',
    requiresDecision: true,
    requiresReason: true,
    requiresTargetCategory: true,
  },
];

const ALREADY_RECORDED_ACTIONS: WeighInAllowedAction[] = [
  {
    code: 'MANUAL_OVERRIDE',
    level: 'SECONDARY',
    requiresDecision: true,
    requiresReason: true,
    requiresTargetCategory: false,
  },
];

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
