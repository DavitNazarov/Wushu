'use client';

import { getResolvedAgeGroup } from '@/lib/weighin/category';
import { Badge } from '@/components/ui/Badge';
import type { WeighInListEntry } from '@/types/weighin';

type Props = {
  entry: WeighInListEntry;
  t: (key: string) => string;
};

export function WeighInAthleteSummaryCard({ entry, t }: Props) {
  const ageGroup = getResolvedAgeGroup(entry.eventWeightCategory?.eventAgeGroup);

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {t('detailsTitle')}
      </p>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            {entry.athlete.firstName} {entry.athlete.lastName}
          </h2>
          <p className="text-[13px] text-[var(--color-text-muted)]">
            {entry.club?.name ?? t('unknownClub')}
          </p>
        </div>
        <Badge>{entry.event.name}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 text-[12px] text-[var(--color-text-muted)] sm:grid-cols-2">
        <p>{t('athleteCodeLabel')}: {entry.athlete.documentId ?? entry.athlete.id}</p>
        <p>{t('divisionLabel')}: {entry.athlete.sex ?? '—'}</p>
        <p>{t('ageGroupLabel')}: {ageGroup?.name ?? '—'}</p>
        <p>{t('attemptShortLabel')}: {entry.weighIns.length}</p>
      </div>
    </section>
  );
}
