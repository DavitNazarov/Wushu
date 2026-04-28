'use client';

import { useLocale } from 'next-intl';
import { getResolvedAgeGroup } from '@/lib/weighin/category';
import { localizedFullName } from '@/lib/bilingual';
import type { WeighInListEntry } from '@/types/weighin';
import {
  getQueueStatusMeta,
  type QueueStatusTone,
} from '@/features/weighin/lib/weighInStatusFormatter';

const STATUS_BADGE: Record<QueueStatusTone, string> = {
  default: 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] border border-[var(--color-border)]',
  success: 'bg-[var(--color-success)]/15 text-[var(--color-success)] border border-[var(--color-success)]/30',
  warning: 'bg-amber-400/15 text-amber-400 border border-amber-400/30',
  danger: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)] border border-[var(--color-danger)]/30',
};

type Props = {
  entry: WeighInListEntry;
  t: (key: string) => string;
};

export function WeighInAthleteSummaryCard({ entry, t }: Props) {
  const locale = useLocale();
  const ageGroup = getResolvedAgeGroup(entry.eventWeightCategory?.eventAgeGroup);
  const status = getQueueStatusMeta(entry);
  const divisionLabel =
    entry.athlete.sex === 'MALE'
      ? t('divisionMale')
      : entry.athlete.sex === 'FEMALE'
        ? t('divisionFemale')
        : t('divisionUnknown');
  const initials =
    (entry.athlete.firstName?.[0] ?? '').toUpperCase() +
    (entry.athlete.lastName?.[0] ?? '').toUpperCase();

  return (
    <div className="flex items-center gap-4">
      {/* Large initials avatar */}
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[18px] font-bold text-white">
        {initials}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[18px] font-bold text-[var(--color-text)] leading-tight">
            {localizedFullName(entry.athlete.firstName, entry.athlete.lastName, entry.athlete.firstNameKa, entry.athlete.lastNameKa, locale)}
          </h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_BADGE[status.tone]}`}
          >
            {t(status.labelKey)}
          </span>
        </div>
        <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
          {entry.club?.name ?? t('unknownClub')}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-[var(--color-text-muted)]">
          <span>
            <span className="font-medium text-[var(--color-text)]">{t('athleteCodeLabel')}:</span>{' '}
            {entry.athlete.documentId ?? entry.athlete.id.slice(0, 8)}
          </span>
          <span>
            <span className="font-medium text-[var(--color-text)]">{t('divisionLabel')}:</span>{' '}
            {divisionLabel}
          </span>
          {ageGroup?.name && (
            <span>
              <span className="font-medium text-[var(--color-text)]">{t('ageGroupLabel')}:</span>{' '}
              {ageGroup.name}
            </span>
          )}
          <span>
            <span className="font-medium text-[var(--color-text)]">{t('attemptShortLabel')}:</span>{' '}
            {entry.weighIns.length}
          </span>
        </div>
      </div>
    </div>
  );
}
