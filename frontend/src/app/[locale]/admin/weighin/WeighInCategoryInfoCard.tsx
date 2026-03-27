'use client';

import { useState } from 'react';
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
  const [detailsOpen, setDetailsOpen] = useState(false);
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
  const deltaLabel =
    preview?.overLimitKg != null
      ? t('deltaOver', { value: preview.overLimitKg.toFixed(1) })
      : preview?.underLimitKg != null
        ? t('deltaUnder', { value: preview.underLimitKg.toFixed(1) })
        : preview
          ? t('deltaWithin')
          : '—';
  const deltaToneClass =
    preview?.overLimitKg != null || preview?.underLimitKg != null
      ? 'text-[var(--color-danger)]'
      : preview
        ? 'text-[var(--color-success)]'
        : 'text-[var(--color-text)]';
  const summaryCells = [
    {
      key: 'allowed-range',
      label: t('allowedRangeLabel'),
      value: current ? formatRange(current.minWeightKgExcl, current.maxWeightKgIncl) : '—',
      valueClassName: 'text-[var(--color-text)]',
    },
    {
      key: 'delta',
      label: t('deltaLabel'),
      value: deltaLabel,
      valueClassName: deltaToneClass,
    },
    {
      key: 'final-category',
      label: t('finalCategoryLabel'),
      value: preview?.nextCategory?.name ?? current?.name ?? '—',
      valueClassName: 'text-[var(--color-text)]',
    },
  ];

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {t('categoryComparisonTitle')}
      </h3>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {summaryCells.map((cell) => (
          <div
            key={cell.key}
            className="rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {cell.label}
            </p>
            <p className={`mt-1 text-[13px] font-semibold ${cell.valueClassName}`}>
              {cell.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 md:hidden">
        <button
          type="button"
          onClick={() => setDetailsOpen((currentOpen) => !currentOpen)}
          className="min-h-[44px] text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
        >
          {detailsOpen ? `▾ ${t('detailsHide')}` : `▸ ${t('detailsShow')}`}
        </button>
      </div>

      <dl className={`mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-2 ${detailsOpen ? 'block md:grid' : 'hidden md:grid'}`}>
        <div>
          <dt className="text-[var(--color-text-muted)]">{t('registeredCategoryLabel')}</dt>
          <dd className="text-[var(--color-text)]">{registeredLabel}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">{t('policyLabel')}</dt>
          <dd className="text-[var(--color-text)]">{policyLabel}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">{t('measuredWeightLabel')}</dt>
          <dd className="text-[var(--color-text)]">{measured}</dd>
        </div>
      </dl>
    </section>
  );
}
