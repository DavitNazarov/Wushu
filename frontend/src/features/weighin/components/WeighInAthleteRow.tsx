'use client';

import { getResolvedAgeGroup, getResolvedWeightDefinition } from '@/lib/weighin/category';
import type { WeighInListEntry } from '@/types/weighin';
import {
  getQueueStatusMeta,
  type QueueStatusTone,
} from '@/features/weighin/lib/weighInStatusFormatter';

const STATUS_STYLES: Record<QueueStatusTone, { dot: string; badge: string }> = {
  default: {
    dot: 'bg-[var(--color-text-muted)]',
    badge: 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] border border-[var(--color-border)]',
  },
  success: {
    dot: 'bg-[var(--color-success)]',
    badge: 'bg-[var(--color-success)]/15 text-[var(--color-success)] border border-[var(--color-success)]/30',
  },
  warning: {
    dot: 'bg-amber-400',
    badge: 'bg-amber-400/15 text-amber-400 border border-amber-400/30',
  },
  danger: {
    dot: 'bg-[var(--color-danger)]',
    badge: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)] border border-[var(--color-danger)]/30',
  },
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
  const categoryName =
    getResolvedWeightDefinition(entry.registeredEventWeightCategory)?.name ??
    entry.categoryLabel ??
    entry.categoryCode ??
    t('valueUnavailable');
  const styles = STATUS_STYLES[status.tone];
  const sexInitial =
    entry.athlete.sex === 'MALE' ? 'M' : entry.athlete.sex === 'FEMALE' ? 'F' : '?';

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.id)}
      className={`group w-full rounded-[var(--radius-card)] border text-left transition-all duration-150 ${
        selected
          ? 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/8 shadow-sm ring-1 ring-[var(--color-primary)]/25'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-surface-alt)]'
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Avatar initials */}
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
            selected
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
          }`}
        >
          {entry.athlete.firstName?.[0]?.toUpperCase() ?? '?'}
          {entry.athlete.lastName?.[0]?.toUpperCase() ?? ''}
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[14px] font-semibold text-[var(--color-text)] leading-snug">
              {entry.athlete.firstName} {entry.athlete.lastName}
            </p>
            {status.requiresAction && (
              <span className="shrink-0 text-amber-400 text-[13px]">!</span>
            )}
          </div>
          <p className="truncate text-[11px] text-[var(--color-text-muted)] mt-0.5">
            {entry.club?.name ?? t('unknownClub')}
            {ageGroup?.name ? ` · ${ageGroup.name}` : ''}
            {' · '}
            <span className="font-medium text-[var(--color-text-muted)]">{sexInitial}</span>
            {' · '}
            {categoryName}
          </p>
        </div>

        {/* Status + attempt */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles.badge}`}>
            {t(status.labelKey)}
          </span>
          {lastAttempt != null && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              #{lastAttempt.attemptNo} · {lastAttempt.weightKg} {t('weightUnit')}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
