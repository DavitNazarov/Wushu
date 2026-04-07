'use client';

import { Card } from '@/components/ui/primitives/card';

type LifecycleStep = {
  key: string;
  label: string;
};

type Props = {
  lifecycleSteps: LifecycleStep[];
  lifecycleIndex: number;
  stats: {
    total: number;
    passed: number;
    pending: number;
    moved: number;
    failed: number;
  };
  t: (key: string) => string;
};

export function WeighInQueueSummary({
  lifecycleSteps,
  lifecycleIndex,
  stats,
  t,
}: Props) {
  return (
    <Card className="space-y-2 p-3">
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {lifecycleSteps.map((step, index) => (
          <div
            key={step.key}
            className={`shrink-0 rounded-[var(--radius-pill)] border px-2.5 py-1 text-[11px] font-semibold ${
              index === lifecycleIndex
                ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/20 text-[var(--color-text)]'
                : index < lifecycleIndex
                  ? 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]'
            }`}
          >
            {step.label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-5">
        <p className="rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2.5 py-1 text-[var(--color-text)]">
          {t('filterAll')}: <span className="font-semibold">{stats.total}</span>
        </p>
        <p className="rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2.5 py-1 text-[var(--color-success)]">
          {t('filterPassed')}: <span className="font-semibold">{stats.passed}</span>
        </p>
        <p className="rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2.5 py-1 text-amber-300">
          {t('filterNeedsAction')}: <span className="font-semibold">{stats.pending}</span>
        </p>
        <p className="rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2.5 py-1 text-[var(--color-primary)]">
          {t('filterMoved')}: <span className="font-semibold">{stats.moved}</span>
        </p>
        <p className="rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2.5 py-1 text-[var(--color-danger)]">
          {t('filterFailed')}: <span className="font-semibold">{stats.failed}</span>
        </p>
      </div>
    </Card>
  );
}
