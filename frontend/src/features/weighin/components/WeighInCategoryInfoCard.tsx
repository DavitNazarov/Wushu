'use client';

import { useState } from 'react';
import { getResolvedWeightDefinition } from '@/lib/weighin/category';
import type { WeighInListEntry, WeighInPreviewResponse } from '@/types/weighin';

type Props = {
  entry: WeighInListEntry;
  preview: WeighInPreviewResponse | null;
  weightInput: string;
  t: (key: string, values?: Record<string, unknown>) => string;
};

export function WeighInCategoryInfoCard({ entry, preview, weightInput, t }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const unavailableValue = t('valueUnavailable');
  const weightUnit = t('weightUnit');
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

  const measured = weightInput.trim()
    ? t('weightDisplayValue', { value: weightInput, unit: weightUnit })
    : null;

  const registeredLabel =
    registered?.name ?? entry.categoryLabel ?? entry.categoryCode ?? unavailableValue;

  const policyLabel =
    t(`policy${entry.event.weighInPolicyCode}`) !== `policy${entry.event.weighInPolicyCode}`
      ? t(`policy${entry.event.weighInPolicyCode}`)
      : entry.event.weighInPolicyCode;

  const rangeLabel = current
    ? current.minWeightKgExcl == null && current.maxWeightKgIncl == null
      ? t('rangeUnknown')
      : current.minWeightKgExcl == null
        ? t('rangeMaxOnly', { max: current.maxWeightKgIncl, unit: weightUnit })
        : current.maxWeightKgIncl == null
          ? t('rangeMinOnly', { min: current.minWeightKgExcl, unit: weightUnit })
          : t('rangeBetween', {
              min: current.minWeightKgExcl,
              max: current.maxWeightKgIncl,
              unit: weightUnit,
            })
    : t('rangeUnknown');

  const isOver = preview?.overLimitKg != null;
  const isUnder = preview?.underLimitKg != null;
  const isWithin = preview != null && !isOver && !isUnder;

  const deltaLabel = isOver
    ? t('deltaOver', { value: preview!.overLimitKg!.toFixed(1), unit: weightUnit })
    : isUnder
      ? t('deltaUnder', { value: preview!.underLimitKg!.toFixed(1), unit: weightUnit })
      : preview
        ? t('deltaWithin')
        : null;

  const finalCategory = preview?.nextCategory?.name ?? current?.name ?? unavailableValue;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        {t('categoryComparisonTitle')}
      </p>

      {/* Primary strip: registered → limit */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('registeredCategoryLabel')}
          </span>
          <span className="text-[13px] font-bold text-[var(--color-text)]">{registeredLabel}</span>
        </div>

        <span className="text-[var(--color-text-muted)]">→</span>

        <div className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('allowedRangeLabel')}
          </span>
          <span className="text-[13px] font-bold text-[var(--color-text)]">{rangeLabel}</span>
        </div>
      </div>

      {/* Status strip — reserved height prevents layout shift when preview loads */}
      <div className="flex min-h-[34px] flex-wrap items-center gap-2">
        <div
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${
            deltaLabel
              ? isOver || isUnder
                ? 'border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10'
                : 'border-[var(--color-success)]/40 bg-[var(--color-success)]/10'
              : 'border-transparent bg-transparent'
          } ${deltaLabel ? '' : 'invisible'}`}
          aria-hidden={!deltaLabel}
        >
          <span
            className={`text-[13px] font-bold ${
              isOver || isUnder ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'
            }`}
          >
            {isWithin ? '✓' : isOver ? '▲' : '▼'} {deltaLabel ?? t('deltaWithin')}
          </span>
        </div>

        {preview?.nextCategory && preview.nextCategory.name !== current?.name && (
          <div className="flex items-center gap-1.5 rounded-full border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/8 px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
              {t('finalCategoryLabel')}
            </span>
            <span className="text-[13px] font-bold text-[var(--color-primary)]">{finalCategory}</span>
          </div>
        )}
      </div>

      {/* Expandable details (mobile toggle / always on desktop) */}
      <button
        type="button"
        onClick={() => setDetailsOpen((o) => !o)}
        className="min-h-[36px] text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] md:hidden"
      >
        {detailsOpen ? `▾ ${t('detailsHide')}` : `▸ ${t('detailsShow')}`}
      </button>

      <dl
        className={`grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-3 ${
          detailsOpen ? 'grid md:grid' : 'hidden md:grid'
        }`}
      >
        <div>
          <dt className="text-[var(--color-text-muted)]">{t('policyLabel')}</dt>
          <dd className="font-medium text-[var(--color-text)]">{policyLabel}</dd>
        </div>
        {measured && (
          <div>
            <dt className="text-[var(--color-text-muted)]">{t('measuredWeightLabel')}</dt>
            <dd className="font-medium text-[var(--color-text)]">{measured}</dd>
          </div>
        )}
        <div>
          <dt className="text-[var(--color-text-muted)]">{t('finalCategoryLabel')}</dt>
          <dd className="font-medium text-[var(--color-text)]">{finalCategory}</dd>
        </div>
      </dl>
    </div>
  );
}
