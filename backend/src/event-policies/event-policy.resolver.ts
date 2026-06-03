import type { Event } from '@prisma/client';
import {
  DEFAULT_EVENT_POLICIES,
  type EventPolicyInput,
  type EventPolicyOptions,
  type ResolvedEventPolicies,
} from './event-policy.types';

export function resolveEventPolicies(
  input?: EventPolicyInput | null,
): ResolvedEventPolicies {
  const resolved: ResolvedEventPolicies = {
    ...DEFAULT_EVENT_POLICIES,
    ...(input ?? {}),
  };

  if (
    !Number.isInteger(resolved.minRestMinutes) ||
    resolved.minRestMinutes <= 0
  ) {
    throw new Error('INVALID_MIN_REST_MINUTES');
  }
  if (
    !Number.isInteger(resolved.reweighWindowMinutes) ||
    resolved.reweighWindowMinutes <= 0
  ) {
    throw new Error('INVALID_REWEIGH_WINDOW_MINUTES');
  }

  if (
    resolved.restPolicyCode === 'MIN_15_MINUTES' &&
    resolved.minRestMinutes < 15
  ) {
    throw new Error('MIN_REST_POLICY_REQUIRES_15_MINUTES');
  }

  if (
    resolved.weighInPolicyCode === 'IWUF_STRICT_ONE_HOUR' &&
    resolved.reweighWindowMinutes !== 60
  ) {
    throw new Error('IWUF_STRICT_POLICY_REQUIRES_60_MINUTE_WINDOW');
  }

  return resolved;
}

export function readEventPolicies(
  event: Pick<
    Event,
    | 'weighInPolicyCode'
    | 'bronzePolicyCode'
    | 'restPolicyCode'
    | 'minRestMinutes'
    | 'publishTimingPolicyCode'
    | 'reweighWindowMinutes'
  >,
): ResolvedEventPolicies {
  return resolveEventPolicies({
    weighInPolicyCode: event.weighInPolicyCode,
    bronzePolicyCode: event.bronzePolicyCode,
    restPolicyCode: event.restPolicyCode,
    minRestMinutes: event.minRestMinutes,
    publishTimingPolicyCode: event.publishTimingPolicyCode,
    reweighWindowMinutes: event.reweighWindowMinutes,
  });
}

export function buildEventPolicyOptions(): EventPolicyOptions {
  return {
    families: [
      {
        family: 'WEIGH_IN',
        defaultCode: DEFAULT_EVENT_POLICIES.weighInPolicyCode,
        options: [
          {
            code: 'IWUF_STRICT_ONE_HOUR',
            labelKey: 'eventPolicy.weighin.iwufStrict.label',
            descriptionKey: 'eventPolicy.weighin.iwufStrict.description',
          },
          {
            code: 'MOVE_UP_AFTER_FAILED_REWEIGH',
            labelKey: 'eventPolicy.weighin.moveUpAfterFailed.label',
            descriptionKey: 'eventPolicy.weighin.moveUpAfterFailed.description',
          },
          {
            code: 'DIRECT_MOVE_UP',
            labelKey: 'eventPolicy.weighin.directMoveUp.label',
            descriptionKey: 'eventPolicy.weighin.directMoveUp.description',
          },
          {
            code: 'MANUAL_ADMIN_DECISION',
            labelKey: 'eventPolicy.weighin.manualAdmin.label',
            descriptionKey: 'eventPolicy.weighin.manualAdmin.description',
          },
        ],
      },
      {
        family: 'BRONZE',
        defaultCode: DEFAULT_EVENT_POLICIES.bronzePolicyCode,
        options: [
          {
            code: 'TWO_BRONZES',
            labelKey: 'eventPolicy.bronze.twoBronzes.label',
            descriptionKey: 'eventPolicy.bronze.twoBronzes.description',
          },
        ],
      },
      {
        family: 'MIN_REST',
        defaultCode: DEFAULT_EVENT_POLICIES.restPolicyCode,
        options: [
          {
            code: 'MIN_15_MINUTES',
            labelKey: 'eventPolicy.rest.min15.label',
            descriptionKey: 'eventPolicy.rest.min15.description',
          },
        ],
      },
      {
        family: 'PUBLISH_TIMING',
        defaultCode: DEFAULT_EVENT_POLICIES.publishTimingPolicyCode,
        options: [
          {
            code: 'IMMEDIATE_AFTER_DRAW',
            labelKey: 'eventPolicy.publish.immediateAfterDraw.label',
            descriptionKey:
              'eventPolicy.publish.immediateAfterDraw.description',
          },
          {
            code: 'MANUAL_PUBLISH_LATER',
            labelKey: 'eventPolicy.publish.manualLater.label',
            descriptionKey: 'eventPolicy.publish.manualLater.description',
          },
          {
            code: 'COMPETITION_DAY_ONLY',
            labelKey: 'eventPolicy.publish.competitionDayOnly.label',
            descriptionKey:
              'eventPolicy.publish.competitionDayOnly.description',
          },
        ],
      },
    ],
  };
}
