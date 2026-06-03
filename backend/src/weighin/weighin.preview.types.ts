import type {
  WeighInDecision,
  WeighInPolicyCode,
  WeighInStatus,
} from '@prisma/client';

// JSON contract types for POST /api/weighin/preview. The frontend consumes
// these directly via TanStack Query — keep them in sync with the actual
// response shape produced by WeighinPreviewService.preview.

// One-of states the preview UI can render. The state determines which
// allowedActions are emitted by mapPreviewStateFromOutcome.
export type WeighInDecisionState =
  | 'AUTO_PASS'
  | 'REWEIGH_ALLOWED'
  | 'MOVE_UP_AVAILABLE'
  | 'DISQUALIFY_REQUIRED'
  | 'MANUAL_DECISION_REQUIRED'
  | 'ALREADY_RECORDED';

// Stable string codes for buttons. The UI keys i18n / icon / handler
// dispatch on these codes — changing one means changing the frontend too.
export type WeighInAllowedActionCode =
  | 'RECORD_WEIGH_IN'
  | 'RECORD_REWEIGH'
  | 'MOVE_UP'
  | 'RECORD_FAIL'
  | 'RECORD_DISQUALIFICATION'
  | 'SUBMIT_MANUAL_DECISION'
  | 'MANUAL_OVERRIDE';

// Severity hint used by the UI button system.
export type WeighInAllowedActionLevel = 'PRIMARY' | 'SECONDARY' | 'DANGER';

// Slim category projection sent for currentCategory / registeredCategory /
// finalCategory / nextCategory fields in the preview response.
export type WeighInCategorySummary = {
  id: string;
  name: string;
  minWeightKgExcl: number | null;
  maxWeightKgIncl: number | null;
  sortOrder: number;
};

// One render-able button. requires* flags say which form controls to enable;
// the targetCategory* fields populate the move-up dropdown's pre-selection.
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

// Open ONE_HOUR reweigh window snapshot. isExpired is precomputed so the
// frontend doesn't need to re-do the time comparison locally.
export type WeighInOpenWindowSummary = {
  attemptId: string;
  deadlineAt: Date;
  isExpired: boolean;
};

// Slim summary of the most recent committed attempt — shown in the preview
// "last attempt" panel so operators can see when/who recorded what.
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

// Top-level response from POST /api/weighin/preview. Carries everything the
// preview panel needs to render without any second roundtrip — the policy
// state, the action set, all four contextual categories, and metric hints.
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
