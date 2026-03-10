import type {
  EventLifecycle,
  WeighInDecision,
  WeighInPolicyCode,
} from './api';
export type { WeighInDecision } from './api';

export type WeighInStatus =
  | 'NOT_WEIGHED'
  | 'PASSED'
  | 'MOVED_UP'
  | 'FAILED'
  | 'OVERRIDE_APPROVED'
  | 'REWEIGH_ALLOWED'
  | 'DISQUALIFIED';

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

export type WeighInCategory = {
  id: string;
  name: string;
  minWeightKgExcl: number | null;
  maxWeightKgIncl: number | null;
  sortOrder: number;
};

export type WeighInAttempt = {
  id: string;
  attemptNo: number;
  weightKg: number;
  decision: WeighInDecision;
  policyCode: WeighInPolicyCode;
  deadlineAt: string | null;
  resolvedAt: string | null;
  resolvedAction: string | null;
  operatorUserId: string | null;
  override: boolean;
  reason: string | null;
  createdAt: string;
  operator?: {
    id: string;
    displayName: string;
    email: string;
  } | null;
};

export type WeighInListEntry = {
  id: string;
  eventId: string;
  status: string;
  weighInStatus: WeighInStatus;
  categoryCode: string;
  categoryLabel: string | null;
  createdAt?: string;
  queueNumber?: number | null;
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    documentId: string | null;
    sex: 'MALE' | 'FEMALE' | null;
  };
  club: {
    id: string;
    name: string;
  } | null;
  eventWeightCategory: {
    id: string;
    rulesetWeightCategory: {
      name: string;
      minWeightKgExcl: number | null;
      maxWeightKgIncl: number | null;
      sortOrder: number;
    };
    eventAgeGroup: {
      rulesetAgeGroup: {
        code: string;
        name: string;
        sex: 'MALE' | 'FEMALE' | null;
        minAge: number | null;
        maxAge: number | null;
        roundDurationSeconds: number;
        sortOrder: number;
      };
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
    };
  } | null;
  event: {
    id: string;
    name: string;
    lifecycle: EventLifecycle;
    weighInPolicyCode: WeighInPolicyCode;
    reweighWindowMinutes: number;
  };
  weighIns: WeighInAttempt[];
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

export type WeighInPreviewResponse = {
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
  currentCategory: WeighInCategory;
  registeredCategory: WeighInCategory | null;
  finalCategory: WeighInCategory | null;
  nextCategory: WeighInCategory | null;
  attemptsCount: number;
  overLimitKg: number | null;
  underLimitKg: number | null;
  deltaToLimitKg: number | null;
  openOneHourWindow: {
    attemptId: string;
    deadlineAt: string;
    isExpired: boolean;
  } | null;
  latestRecord: {
    attemptId: string;
    attemptNo: number;
    decision: WeighInDecision;
    weightKg: number;
    createdAt: string;
    operatorUserId: string | null;
    operatorDisplayName: string | null;
    reason: string | null;
    override: boolean;
  } | null;
};

export type WeighInRecordInput = {
  registrationId: string;
  weightKg: number;
  decision?: WeighInDecision;
  override?: boolean;
  reason?: string;
  nextEventWeightCategoryId?: string;
};

export type WeighInQueueFilter =
  | 'ALL'
  | 'NOT_WEIGHED'
  | 'PASSED'
  | 'NEEDS_ACTION'
  | 'MOVED'
  | 'FAILED';
