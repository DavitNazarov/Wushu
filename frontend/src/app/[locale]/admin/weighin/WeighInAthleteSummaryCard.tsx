'use client';

import { Badge } from '@/components/ui/Badge';
import type { WeighInListEntry, WeighInPreviewResponse } from '@/types/weighin';

type Props = {
  entry: WeighInListEntry;
  preview: WeighInPreviewResponse | null;
  t: (key: string) => string;
};

export function WeighInAthleteSummaryCard({ entry, preview, t }: Props) {
  const currentCategory =
    entry.eventWeightCategory?.rulesetWeightCategory.name ??
    entry.categoryLabel ??
    entry.categoryCode ??
    '—';
  const registeredCategory =
    entry.registeredEventWeightCategory?.rulesetWeightCategory.name ??
    entry.categoryLabel ??
    entry.categoryCode ??
    '—';
  const finalCategory = preview?.nextCategory?.name ?? currentCategory;
  const policyLabel = t(`policy${entry.event.weighInPolicyCode}`) !==
    `policy${entry.event.weighInPolicyCode}`
    ? t(`policy${entry.event.weighInPolicyCode}`)
    : entry.event.weighInPolicyCode;

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
        <p>{t('ageGroupLabel')}: {entry.eventWeightCategory?.eventAgeGroup.rulesetAgeGroup.name ?? '—'}</p>
        <p>{t('registeredCategoryLabel')}: {registeredCategory}</p>
        <p>{t('finalCategoryLabel')}: {finalCategory}</p>
        <p>{t('policyLabel')}: {policyLabel}</p>
      </div>
    </section>
  );
}
