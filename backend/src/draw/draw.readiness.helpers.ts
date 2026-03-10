import type {
  DrawActionAvailability,
  DrawValidationIssue,
  DrawValidationSummary,
  DrawCategoryStatus,
  DrawOverallStatus,
} from './draw.readiness.types';
import type { EventLifecycle, RegistrationStatus, WeighInStatus } from '@prisma/client';
import { getRegistrationStatus } from '../events/event-dates.helper';
import { isWeighInComplete } from '../events/weighin-completion.helper';

export const ELIGIBLE_WEIGHIN_STATUSES = new Set<WeighInStatus>([
  'PASSED',
  'MOVED_UP',
  'OVERRIDE_APPROVED',
]);

export const ACTIVE_REGISTRATION_STATUSES = new Set<RegistrationStatus>([
  'PENDING',
  'SUBMITTED',
  'APPROVED',
]);

export function deriveDrawOverallStatus(input: {
  bracketCount: number;
  eventLifecycle: EventLifecycle;
  published: boolean;
}): DrawOverallStatus {
  if (input.bracketCount === 0) return 'NOT_GENERATED';
  if (input.published) return 'PUBLISHED';
  if (
    input.eventLifecycle === 'PUBLISHED' ||
    input.eventLifecycle === 'LIVE' ||
    input.eventLifecycle === 'COMPLETED'
  ) {
    return 'PUBLISHED';
  }
  return 'GENERATED';
}

export function deriveExclusionReasonCode(input: {
  registrationStatus: RegistrationStatus;
  weighInStatus: WeighInStatus;
}): string {
  if (input.registrationStatus !== 'APPROVED') {
    return 'REGISTRATION_NOT_APPROVED';
  }

  if (input.weighInStatus === 'NOT_WEIGHED') return 'WEIGHIN_NOT_COMPLETED';
  if (input.weighInStatus === 'REWEIGH_ALLOWED') return 'REWEIGH_PENDING';
  if (input.weighInStatus === 'FAILED') return 'WEIGHIN_FAILED';
  if (input.weighInStatus === 'DISQUALIFIED') return 'WEIGHIN_DISQUALIFIED';

  return 'INELIGIBLE_STATUS';
}

export function deriveCategoryStatus(input: {
  bracketDrawn: boolean;
  eligibleCount: number;
  excludedCount: number;
  criticalIssueCount: number;
  warningIssueCount: number;
}): DrawCategoryStatus {
  if (input.bracketDrawn) return 'DRAWN';
  if (input.eligibleCount === 0 && input.excludedCount === 0) return 'EMPTY';
  if (input.criticalIssueCount > 0 || input.eligibleCount === 0) return 'BLOCKED';
  if (input.warningIssueCount > 0) return 'NEEDS_REVIEW';
  return 'READY';
}

export function isRegistrationClosedForDraw(input: {
  lifecycle: EventLifecycle;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  now?: Date;
}): boolean {
  if (input.lifecycle !== 'REG_OPEN') return true;
  return getRegistrationStatus(
    {
      lifecycle: input.lifecycle,
      registrationOpensAt: input.registrationOpensAt,
      registrationClosesAt: input.registrationClosesAt,
    },
    input.now,
  ) === 'CLOSED';
}

const LIFECYCLE_AFTER_WEIGHIN_DONE = new Set<EventLifecycle>([
  'WEIGH_IN_COMPLETED',
  'DRAWN',
  'PUBLISHED',
  'LIVE',
  'COMPLETED',
]);

export function isWeighInCompletedForDraw(input: {
  lifecycle: EventLifecycle;
  statuses: Array<WeighInStatus | null | undefined>;
}): boolean {
  if (LIFECYCLE_AFTER_WEIGHIN_DONE.has(input.lifecycle)) return true;
  return isWeighInComplete(input.statuses);
}

function firstIssueCode(issues: DrawValidationIssue[]): string | null {
  return issues[0]?.code ?? null;
}

export function buildActionAvailability(input: {
  drawStatus: DrawOverallStatus;
  validation: DrawValidationSummary;
}): DrawActionAvailability {
  const canGenerate =
    input.drawStatus === 'NOT_GENERATED' && input.validation.critical.length === 0;

  const canRegenerate =
    input.drawStatus !== 'NOT_GENERATED' && input.validation.critical.length === 0;

  return {
    canGenerate,
    canRegenerate,
    generateBlockedReasonCode: canGenerate
      ? null
      : firstIssueCode(input.validation.critical) ??
        (input.drawStatus !== 'NOT_GENERATED' ? 'DRAW_ALREADY_EXISTS' : 'DRAW_NOT_READY'),
    regenerateBlockedReasonCode: canRegenerate
      ? null
      : firstIssueCode(input.validation.critical) ??
        (input.drawStatus === 'NOT_GENERATED'
          ? 'DRAW_NOT_GENERATED_YET'
          : 'DRAW_NOT_READY'),
  };
}
