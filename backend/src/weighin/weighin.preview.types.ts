import type {
  WeighInDecision,
  WeighInPolicyCode,
  WeighInStatus,
} from '@prisma/client';

export type WeighInDecisionState =
  | 'AUTO_PASS'
  | 'REWEIGH_ALLOWED'
  | 'MOVE_UP_AVAILABLE'
  | 'DISQUALIFY_REQUIRED'
  | 'MANUAL_DECISION_REQUIRED'
  | 'ALREADY_RECORDED';

export type WeighInAllowedActionCode =
  | 'RECORD_WEIGH_IN'
  | 'RECORD_REWEIGH'
  | 'MOVE_UP'
  | 'RECORD_FAIL'
  | 'RECORD_DISQUALIFICATION'
  | 'SUBMIT_MANUAL_DECISION'
  | 'MANUAL_OVERRIDE';

export type WeighInAllowedActionLevel = 'PRIMARY' | 'SECONDARY' | 'DANGER';

export type WeighInCategorySummary = {
  id: string;
  name: string;
  minWeightKgExcl: number | null;
  maxWeightKgIncl: number | null;
  sortOrder: number;
};

export type WeighInAllowedAction = {
  code: WeighInAllowedActionCode;
  level: WeighInAllowedActionLevel;
  decision?: WeighInDecision;
  targetCategoryId?: string | null;
  targetCategoryName?: string | null;
  requiresDecision?: boolean;
  requiresReason?: boolean;
  requiresTargetCategory?: boolean;
};

export type WeighInOpenWindowSummary = {
  attemptId: string;
  deadlineAt: Date;
  isExpired: boolean;
};

export type WeighInLatestRecordSummary = {
  attemptId: string;
  attemptNo: number;
  decision: WeighInDecision;
  weightKg: number;
  createdAt: Date;
  operatorUserId: string | null;
  operatorDisplayName: string | null;
  reason: string | null;
  override: boolean;
};

export type WeighInDecisionPreviewResponse = {
  registrationId: string;
  eventId: string;
  eventName: string;
  policyCode: WeighInPolicyCode;
  recordingAllowed: boolean;
  recordingBlockedCode: string | null;
  measuredWeightKg: number;
  decisionState: WeighInDecisionState;
  summaryCode: string;
  policyReasonCode: string | null;
  previewDecision: WeighInDecision | null;
  previewStatus: WeighInStatus | null;
  allowedActions: WeighInAllowedAction[];
  currentCategory: WeighInCategorySummary;
  registeredCategory: WeighInCategorySummary | null;
  finalCategory: WeighInCategorySummary | null;
  nextCategory: WeighInCategorySummary | null;
  attemptsCount: number;
  overLimitKg: number | null;
  underLimitKg: number | null;
  deltaToLimitKg: number | null;
  openOneHourWindow: WeighInOpenWindowSummary | null;
  latestRecord: WeighInLatestRecordSummary | null;
};
