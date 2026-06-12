'use client';

import { useLocale } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import type { WeighInAttempt } from '@/types/weighin';

const DECISION_VARIANT: Record<
  WeighInAttempt['decision'],
  'default' | 'success' | 'warning' | 'danger'
> = {
  PASS: 'success',
  MOVED_UP: 'default',
  REWEIGH: 'warning',
  ONE_HOUR: 'warning',
  FAIL: 'danger',
  DISQUALIFIED: 'danger',
};

type Props = {
  attempts: WeighInAttempt[];
  t: (key: string, values?: Record<string, unknown>) => string;
};

/**
 * Always-visible one-line glance of the athlete's most recent weigh-in attempt.
 * Sits directly above the weight input so the operator can see prior history
 * and fill the new weight without scrolling. Full audit log stays in
 * WeighInHistoryCard below the actions.
 */
export function WeighInPriorAttemptStrip({ attempts, t }: Props) {
  const locale = useLocale();
  const weightUnit = t('weightUnit');
  const last = attempts.length ? attempts[attempts.length - 1] : null;

  if (!last) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-6 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {t('priorNoneLabel')}
        </span>
        <span className="text-[12px] text-[var(--color-text-muted)]">{t('priorNoneHint')}</span>
      </div>
    );
  }

  const recordedAt = new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(
    new Date(last.createdAt),
  );

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {t('priorLastLabel')}
      </span>
      <span className="text-[15px] font-bold tabular-nums text-[var(--color-text)]">
        {t('weightDisplayValue', { value: last.weightKg, unit: weightUnit })}
      </span>
      <Badge variant={DECISION_VARIANT[last.decision]}>
        {t(`decisionOption${last.decision}`)}
      </Badge>
      <span className="text-[12px] tabular-nums text-[var(--color-text-muted)]">
        #{last.attemptNo} · {recordedAt}
      </span>
      {attempts.length > 1 && (
        <span className="text-[12px] text-[var(--color-text-muted)]">
          · {t('priorCountLabel', { count: attempts.length })}
        </span>
      )}
    </div>
  );
}
