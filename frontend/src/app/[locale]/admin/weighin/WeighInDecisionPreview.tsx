'use client';

import { InlineAlert } from '@/components/ui/InlineAlert';
import type { WeighInPreviewResponse } from '@/types/weighin';
import { mapDecisionPreview } from './weighInDecisionMapper';

type Props = {
  preview: WeighInPreviewResponse | null;
  isLoading: boolean;
  t: (key: string, values?: Record<string, unknown>) => string;
};

export function WeighInDecisionPreview({ preview, isLoading, t }: Props) {
  if (isLoading) {
    return (
      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {t('decisionTitle')}
        </h3>
        <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
          {t('decisionLoading')}
        </p>
      </section>
    );
  }

  if (!preview) {
    return (
      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {t('decisionTitle')}
        </h3>
        <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
          {t('decisionEnterWeight')}
        </p>
      </section>
    );
  }

  const mapped = mapDecisionPreview({ preview, t });
  const variant =
    mapped.tone === 'success'
      ? 'success'
      : mapped.tone === 'warning'
      ? 'warning'
      : mapped.tone === 'danger'
      ? 'error'
      : 'info';

  return (
    <section className="space-y-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {t('decisionTitle')}
      </h3>
      <InlineAlert variant={variant}>
        <div className="space-y-1">
          <p className="text-[13px] font-semibold">{mapped.title}</p>
          <p className="text-[12px] opacity-95">{mapped.description}</p>
        </div>
      </InlineAlert>
    </section>
  );
}
