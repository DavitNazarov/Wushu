import { createHash } from 'crypto';
import type {
  DrawActionAvailability,
  DrawValidationIssue,
  DrawValidationSummary,
  DrawCategoryStatus,
  DrawOverallStatus,
} from './draw.readiness.types';
import type {
  EventLifecycle,
  RegistrationStatus,
  WeighInStatus,
} from '@prisma/client';
import { getRegistrationStatus } from '../events/event-dates.helper';
import { isWeighInComplete } from '../events/weighin-completion.helper';

// Pure decision helpers consumed by draw.readiness.compute. No DB, no DI.

// The three weigh-in outcomes that let an athlete enter the draw. FAILED /
// DISQUALIFIED / REWEIGH_ALLOWED / NOT_WEIGHED all exclude — see
// deriveExclusionReasonCode below.
export const ELIGIBLE_WEIGHIN_STATUSES = new Set<WeighInStatus>([
  'PASSED',
  'MOVED_UP',
  'OVERRIDE_APPROVED',
]);

// Registrations the readiness view considers "in play". WITHDRAWN/REJECTED
// are dropped entirely so they don't even appear in the exclusion list.
export const ACTIVE_REGISTRATION_STATUSES = new Set<RegistrationStatus>([
  'PENDING',
  'SUBMITTED',
  'APPROVED',
]);

// Maps raw state into the top-level "Draw status" label shown on the page
// header. NOT_GENERATED ⇒ no brackets exist yet. PUBLISHED ⇒ either the
// published flag is on OR the event lifecycle is past DRAWN. Otherwise
// brackets exist but aren't published yet (GENERATED).
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

// Convert the (registration, weigh-in) state pair into the stable code
// shown next to an excluded athlete. The codes are i18n keys on the
// frontend — keep them stable across releases.
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

// Decide the per-category status pill the UI renders. Priority order:
//   DRAWN ⇒ a bracket exists, end of story (overrides everything).
//   EMPTY ⇒ no athletes at all.
//   BLOCKED ⇒ critical issues OR zero eligible (a category with only
//             excluded athletes is unusable).
//   SOLO ⇒ exactly one eligible athlete — its own pill (needs a bye/auto-
//          advance decision), kept distinct from generic review warnings.
//   NEEDS_REVIEW ⇒ other warnings only — admin should look but can still draw.
//   READY ⇒ everything's clean.
// NOTE: a stored "reviewed" sign-off can promote SOLO/NEEDS_REVIEW to READY —
// that happens in computeDrawReadiness, not here (this fn is review-agnostic).
export function deriveCategoryStatus(input: {
  bracketDrawn: boolean;
  eligibleCount: number;
  excludedCount: number;
  criticalIssueCount: number;
  warningIssueCount: number;
}): DrawCategoryStatus {
  if (input.bracketDrawn) return 'DRAWN';
  if (input.eligibleCount === 0 && input.excludedCount === 0) return 'EMPTY';
  if (input.criticalIssueCount > 0 || input.eligibleCount === 0)
    return 'BLOCKED';
  if (input.eligibleCount === 1) return 'SOLO';
  if (input.warningIssueCount > 0) return 'NEEDS_REVIEW';
  return 'READY';
}

// Deterministic fingerprint of a category's eligible pool + each athlete's
// cross-age-group flag. The "Mark as reviewed" sign-off stores this; if the
// pool or any flag later changes, the recomputed signature stops matching and
// the review auto-expires (category drops back to SOLO/NEEDS_REVIEW). Sorted so
// athlete ordering never affects the hash. Shared by the compute step (to test
// validity) and the review endpoint (to stamp it).
export function computeCategoryReviewSignature(
  eligible: Array<{ registrationId: string; crossesAgeGroup: boolean }>,
): string {
  const rows = eligible
    .map((a) => `${a.registrationId}:${a.crossesAgeGroup ? 1 : 0}`)
    .sort();
  return createHash('sha256').update(rows.join('|')).digest('hex');
}

// "Is registration closed enough to safely draw?" — true once the event has
// moved past REG_OPEN, OR while in REG_OPEN if the registration window itself
// has elapsed. `now` is injectable for deterministic tests.
export function isRegistrationClosedForDraw(input: {
  lifecycle: EventLifecycle;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  now?: Date;
}): boolean {
  if (input.lifecycle !== 'REG_OPEN') return true;
  return (
    getRegistrationStatus(
      {
        lifecycle: input.lifecycle,
        registrationOpensAt: input.registrationOpensAt,
        registrationClosesAt: input.registrationClosesAt,
      },
      input.now,
    ) === 'CLOSED'
  );
}

// Lifecycle states that DEFINITIONALLY mean weigh-in is done — once we're
// past WEIGHIN, the system already locked it in. Saves us recomputing
// status-by-status in those states.
const LIFECYCLE_AFTER_WEIGHIN_DONE = new Set<EventLifecycle>([
  'WEIGH_IN_COMPLETED',
  'DRAWN',
  'PUBLISHED',
  'LIVE',
  'COMPLETED',
]);

// "Is weigh-in complete enough to draw?" — true if the lifecycle confirms it,
// otherwise checks the per-registration status array via isWeighInComplete.
export function isWeighInCompletedForDraw(input: {
  lifecycle: EventLifecycle;
  statuses: Array<WeighInStatus | null | undefined>;
}): boolean {
  if (LIFECYCLE_AFTER_WEIGHIN_DONE.has(input.lifecycle)) return true;
  return isWeighInComplete(input.statuses);
}

// Pick the first critical issue code for the "why is the button disabled?"
// label. Always shows the first critical, never a warning.
function firstIssueCode(issues: DrawValidationIssue[]): string | null {
  return issues[0]?.code ?? null;
}

// Decide whether the "Generate Draw" / "Regenerate Draw" buttons should be
// enabled and, if not, supply the disabling reason code for the tooltip.
// "Generate" only enabled at NOT_GENERATED; "Regenerate" at the other two.
export function buildActionAvailability(input: {
  drawStatus: DrawOverallStatus;
  validation: DrawValidationSummary;
}): DrawActionAvailability {
  const canGenerate =
    input.drawStatus === 'NOT_GENERATED' &&
    input.validation.critical.length === 0;

  const canRegenerate =
    input.drawStatus !== 'NOT_GENERATED' &&
    input.validation.critical.length === 0;

  return {
    canGenerate,
    canRegenerate,
    generateBlockedReasonCode: canGenerate
      ? null
      : (firstIssueCode(input.validation.critical) ??
        (input.drawStatus !== 'NOT_GENERATED'
          ? 'DRAW_ALREADY_EXISTS'
          : 'DRAW_NOT_READY')),
    regenerateBlockedReasonCode: canRegenerate
      ? null
      : (firstIssueCode(input.validation.critical) ??
        (input.drawStatus === 'NOT_GENERATED'
          ? 'DRAW_NOT_GENERATED_YET'
          : 'DRAW_NOT_READY')),
  };
}
