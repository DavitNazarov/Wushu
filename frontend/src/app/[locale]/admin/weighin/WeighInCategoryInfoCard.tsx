'use client';

import { getResolvedWeightDefinition } from '@/lib/weighin/category';
import type { WeighInListEntry, WeighInPreviewResponse } from '@/types/weighin';

function formatRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—';
  if (min == null && max != null) return `≤ ${max} kg`;
  if (min != null && max == null) return `> ${min} kg`;
  return `> ${min} kg · ≤ ${max} kg`;
}

type Props = {
  entry: WeighInListEntry;
  preview: WeighInPreviewResponse | null;
  weightInput: string;
  t: (key: string, values?: Record<string, unknown>) => string;
};

export function WeighInCategoryInfoCard({ entry, preview, weightInput, t }: Props) {
  const registered = getResolvedWeightDefinition(entry.registeredEventWeightCategory);
  const currentWeight = getResolvedWeightDefinition(entry.eventWeightCategory);
  const current = preview?.currentCategory ?? (entry.eventWeightCategory
    ? {
        id: entry.eventWeightCategory.id,
        name: currentWeight?.name ?? entry.categoryLabel ?? entry.categoryCode,
        minWeightKgExcl: currentWeight?.minWeightKgExcl ?? null,
        maxWeightKgIncl: currentWeight?.maxWeightKgIncl ?? null,
        sortOrder: currentWeight?.sortOrder ?? 0,
      }
    : null);
  const measured = weightInput.trim() ? `${weightInput} kg` : '—';
  const registeredLabel =
    registered?.name ?? entry.categoryLabel ?? entry.categoryCode ?? '—';
  const policyLabel = t(`policy${entry.event.weighInPolicyCode}`) !==
    `policy${entry.event.weighInPolicyCode}`
    ? t(`policy${entry.event.weighInPolicyCode}`)
    : entry.event.weighInPolicyCode;

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {t('categoryComparisonTitle')}
      </h3>
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-2">
        <div>
          <dt className="text-[var(--color-text-muted)]">{t('registeredCategoryLabel')}</dt>
          <dd className="text-[var(--color-text)]">{registeredLabel}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">{t('allowedRangeLabel')}</dt>
          <dd className="text-[var(--color-text)]">
            {current ? formatRange(current.minWeightKgExcl, current.maxWeightKgIncl) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">{t('measuredWeightLabel')}</dt>
          <dd className="text-[var(--color-text)]">{measured}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">{t('deltaLabel')}</dt>
          <dd className="text-[var(--color-text)]">
            {preview?.overLimitKg != null
              ? t('deltaOver', { value: preview.overLimitKg.toFixed(1) })
              : preview?.underLimitKg != null
                ? t('deltaUnder', { value: preview.underLimitKg.toFixed(1) })
                : preview
                  ? t('deltaWithin')
                  : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">{t('finalCategoryLabel')}</dt>
          <dd className="text-[var(--color-text)]">
            {preview?.nextCategory?.name ?? current?.name ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">{t('policyLabel')}</dt>
          <dd className="text-[var(--color-text)]">{policyLabel}</dd>
        </div>
      </dl>
    </section>
  );
}
