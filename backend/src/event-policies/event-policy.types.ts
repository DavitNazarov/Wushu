import type {
  BronzePolicyCode,
  PublishTimingPolicyCode,
  RestPolicyCode,
  WeighInPolicyCode,
} from '@prisma/client';

export type EventPolicyInput = {
  weighInPolicyCode?: WeighInPolicyCode;
  bronzePolicyCode?: BronzePolicyCode;
  restPolicyCode?: RestPolicyCode;
  minRestMinutes?: number;
  publishTimingPolicyCode?: PublishTimingPolicyCode;
  reweighWindowMinutes?: number;
};

export type ResolvedEventPolicies = {
  weighInPolicyCode: WeighInPolicyCode;
  bronzePolicyCode: BronzePolicyCode;
  restPolicyCode: RestPolicyCode;
  minRestMinutes: number;
  publishTimingPolicyCode: PublishTimingPolicyCode;
  reweighWindowMinutes: number;
};

export const DEFAULT_EVENT_POLICIES: ResolvedEventPolicies = {
  weighInPolicyCode: 'IWUF_STRICT_ONE_HOUR',
  bronzePolicyCode: 'TWO_BRONZES',
  restPolicyCode: 'MIN_15_MINUTES',
  minRestMinutes: 15,
  publishTimingPolicyCode: 'IMMEDIATE_AFTER_DRAW',
  reweighWindowMinutes: 60,
};

type PolicyFamilyCode =
  | 'WEIGH_IN'
  | 'BRONZE'
  | 'MIN_REST'
  | 'PUBLISH_TIMING';

type PolicyOptionMeta = {
  code: string;
  labelKey: string;
  descriptionKey: string;
};

export type EventPolicyOptions = {
  families: Array<{
    family: PolicyFamilyCode;
    options: PolicyOptionMeta[];
    defaultCode: string;
  }>;
};
