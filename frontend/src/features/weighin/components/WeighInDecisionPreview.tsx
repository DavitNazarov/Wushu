'use client';

import { useLocale } from 'next-intl';
import type { WeighInPreviewResponse } from '@/types/weighin';
import { mapDecisionPreview } from '@/features/weighin/lib/weighInDecisionMapper';

type Props = {
  preview: WeighInPreviewResponse | null;
  isLoading: boolean;
  t: (key: string, values?: Record<string, unknown>) => string;
};

const TONE_STYLES = {
  success: {
    bar: 'bg-[var(--color-success)]',
    wrap: 'border-[var(--color-success)]/30 bg-[var(--color-success)]/8',
    title: 'text-[var(--color-success)]',
    desc: 'text-[var(--color-success)]/80',
    icon: '✓',
  },
  warning: {
    bar: 'bg-amber-400',
    wrap: 'border-amber-400/30 bg-amber-400/8',
    title: 'text-amber-400',
    desc: 'text-amber-400/80',
    icon: '⚠',
  },
  danger: {
    bar: 'bg-[var(--color-danger)]',
    wrap: 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/8',
    title: 'text-[var(--color-danger)]',
    desc: 'text-[var(--color-danger)]/80',
    icon: '✕',
  },
  default: {
    bar: 'bg-[var(--color-text-muted)]',
    wrap: 'border-[var(--color-border)] bg-[var(--color-surface-alt)]',
    title: 'text-[var(--color-text)]',
    desc: 'text-[var(--color-text-muted)]',
    icon: '–',
  },
};

export function WeighInDecisionPreview({ preview, isLoading, t }: Props) {
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 py-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        <p className="text-[13px] text-[var(--color-text-muted)]">{t('decisionLoading')}</p>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="rounded-[var(--radius-input)] border border-dashed border-[var(--color-border)] px-4 py-3 text-center">
        <p className="text-[13px] text-[var(--color-text-muted)]">{t('decisionEnterWeight')}</p>
      </div>
    );
  }

  const mapped = mapDecisionPreview({ locale, preview, t });
  const tone = mapped.tone as keyof typeof TONE_STYLES;
  const styles = TONE_STYLES[tone] ?? TONE_STYLES.default;

  return (
    <div className={`flex items-start gap-3 overflow-hidden rounded-[var(--radius-input)] border px-4 py-3 ${styles.wrap}`}>
      {/* Color bar */}
      <div className={`mt-0.5 h-5 w-1 shrink-0 rounded-full ${styles.bar}`} />
      <div className="min-w-0">
        <p className={`text-[14px] font-bold leading-snug ${styles.title}`}>{mapped.title}</p>
        {mapped.description && (
          <p className={`mt-0.5 text-[12px] leading-snug ${styles.desc}`}>{mapped.description}</p>
        )}
      </div>
    </div>
  );
}
