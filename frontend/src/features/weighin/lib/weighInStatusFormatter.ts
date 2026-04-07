import type { WeighInAttempt, WeighInListEntry, WeighInQueueFilter } from '@/types/weighin';

export type QueueStatusTone = 'default' | 'success' | 'warning' | 'danger';

export type QueueStatusMeta = {
  labelKey: string;
  tone: QueueStatusTone;
  requiresAction: boolean;
};

function hasOpenOneHourWindow(attempts: WeighInAttempt[]): boolean {
  return attempts.some(
    (attempt) =>
      attempt.decision === 'ONE_HOUR' &&
      attempt.resolvedAt == null &&
      attempt.deadlineAt != null &&
      new Date(attempt.deadlineAt).getTime() > Date.now(),
  );
}

export function getQueueStatusMeta(entry: WeighInListEntry): QueueStatusMeta {
  if (entry.weighInStatus === 'PASSED') {
    return { labelKey: 'statusPassed', tone: 'success', requiresAction: false };
  }
  if (entry.weighInStatus === 'MOVED_UP') {
    return { labelKey: 'statusMovedUp', tone: 'default', requiresAction: false };
  }
  if (entry.weighInStatus === 'DISQUALIFIED') {
    return {
      labelKey: 'statusDisqualified',
      tone: 'danger',
      requiresAction: false,
    };
  }
  if (entry.weighInStatus === 'FAILED') {
    return { labelKey: 'statusFailed', tone: 'danger', requiresAction: false };
  }
  if (entry.weighInStatus === 'OVERRIDE_APPROVED') {
    return {
      labelKey: 'statusOverrideUsed',
      tone: 'default',
      requiresAction: false,
    };
  }
  if (entry.weighInStatus === 'REWEIGH_ALLOWED') {
    if (hasOpenOneHourWindow(entry.weighIns)) {
      return {
        labelKey: 'statusReweighPending',
        tone: 'warning',
        requiresAction: true,
      };
    }
    return {
      labelKey: 'statusOverLimit',
      tone: 'warning',
      requiresAction: true,
    };
  }
  return {
    labelKey: 'statusNotWeighed',
    tone: 'default',
    requiresAction: false,
  };
}

export function matchesQueueFilter(
  entry: WeighInListEntry,
  filter: WeighInQueueFilter,
): boolean {
  switch (filter) {
    case 'NOT_WEIGHED':
      return entry.weighInStatus === 'NOT_WEIGHED';
    case 'PASSED':
      return entry.weighInStatus === 'PASSED';
    case 'NEEDS_ACTION':
      return entry.weighInStatus === 'REWEIGH_ALLOWED';
    case 'MOVED':
      return entry.weighInStatus === 'MOVED_UP';
    case 'FAILED':
      return (
        entry.weighInStatus === 'FAILED' ||
        entry.weighInStatus === 'DISQUALIFIED'
      );
    default:
      return true;
  }
}
