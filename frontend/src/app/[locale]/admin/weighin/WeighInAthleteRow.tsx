'use client';

import { Badge } from '@/components/ui/Badge';
import { getResolvedAgeGroup, getResolvedWeightDefinition } from '@/lib/weighin/category';
import type { WeighInListEntry } from '@/types/weighin';
import {
  getQueueStatusMeta,
  type QueueStatusTone,
} from './weighInStatusFormatter';

const TONE_TO_BADGE_VARIANT: Record<
  QueueStatusTone,
  'default' | 'success' | 'warning' | 'danger'
> = {
  default: 'default',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

type Props = {
  entry: WeighInListEntry;
  selected: boolean;
  onSelect: (id: string) => void;
  t: (key: string) => string;
};

export function WeighInAthleteRow({ entry, selected, onSelect, t }: Props) {
  const status = getQueueStatusMeta(entry);
  const lastAttempt = entry.weighIns[entry.weighIns.length - 1] ?? null;
  const ageGroup = getResolvedAgeGroup(entry.eventWeightCategory?.eventAgeGroup);
  const registeredCategory =
    getResolvedWeightDefinition(entry.registeredEventWeightCategory)?.name ??
    entry.categoryLabel ??
    entry.categoryCode ??
    '—';

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.id)}
      className={`min-h-[44px] w-full rounded-[var(--radius-card)] border p-3 text-left transition ${
        selected
          ? 'border-[var(--color-primary)]/40 border-l-4 border-l-[var(--color-primary)] bg-[var(--color-surface-alt)] ring-1 ring-[var(--color-primary)]/20'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-alt)]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-[var(--color-text)]">
            {entry.athlete.firstName} {entry.athlete.lastName}
          </p>
          <p className="truncate text-[12px] text-[var(--color-text-muted)]">
            {entry.athlete.documentId ?? entry.athlete.id.slice(0, 8)} •{' '}
            {entry.club?.name ?? t('unknownClub')} •{' '}
            {ageGroup?.name ?? '—'} •{' '}
            {t('attemptShortLabel')}: {lastAttempt?.attemptNo ?? 0}
            {status.requiresAction ? ' • !' : ''}
          </p>
        </div>
        <Badge variant={TONE_TO_BADGE_VARIANT[status.tone]}>
          {t(status.labelKey)}
        </Badge>
      </div>
      <div className="mt-2 text-[11px] text-[var(--color-text-muted)]">
        <span>{t('registeredCategoryLabel')}: {registeredCategory}</span>
      </div>
    </button>
  );
}
