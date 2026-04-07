'use client';

import { useLocale } from 'next-intl';
import { Card } from '@/components/ui/primitives/card';
import { InlineAlert } from '@/components/ui/InlineAlert';
import type { WeighInPreviewResponse } from '@/types/weighin';
import { mapDecisionPreview } from '@/features/weighin/lib/weighInDecisionMapper';

type Props = {
  preview: WeighInPreviewResponse | null;
  isLoading: boolean;
  t: (key: string, values?: Record<string, unknown>) => string;
};

export function WeighInDecisionPreview({ preview, isLoading, t }: Props) {
  const locale = useLocale();

  if (isLoading) {
    return (
      <Card className="p-4">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {t('decisionTitle')}
        </h3>
        <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
          {t('decisionLoading')}
        </p>
      </Card>
    );
  }

  if (!preview) {
    return (
      <Card className="p-4">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {t('decisionTitle')}
        </h3>
        <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
          {t('decisionEnterWeight')}
        </p>
      </Card>
    );
  }

  const mapped = mapDecisionPreview({ locale, preview, t });
  const variant =
    mapped.tone === 'success'
      ? 'success'
      : mapped.tone === 'warning'
      ? 'warning'
      : mapped.tone === 'danger'
      ? 'error'
      : 'info';

  return (
    <Card className="space-y-2 p-4">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {t('decisionTitle')}
      </h3>
      <InlineAlert variant={variant}>
        <div className="space-y-1">
          <p className="text-[13px] font-semibold md:hidden">
            {mapped.title} {mapped.description ? `— ${mapped.description}` : ''}
          </p>
          <p className="hidden text-[13px] font-semibold md:block">{mapped.title}</p>
          <p className="hidden text-[12px] opacity-95 md:block">{mapped.description}</p>
        </div>
      </InlineAlert>
    </Card>
  );
}
