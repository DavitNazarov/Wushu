'use client';

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

export function WeighInHistoryCard({ attempts, t }: Props) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {t('historyTitle')}
      </h3>
      {!attempts.length ? (
        <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
          {t('historyEmpty')}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {[...attempts].reverse().map((attempt) => (
            <div
              key={attempt.id}
              className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] text-[var(--color-text)]">
                  #{attempt.attemptNo} • {attempt.weightKg} kg
                </p>
                <Badge variant={DECISION_VARIANT[attempt.decision]}>
                  {t(`decisionOption${attempt.decision}`)}
                </Badge>
              </div>
              <div className="mt-1 space-y-0.5 text-[11px] text-[var(--color-text-muted)]">
                <p>
                  {t('historyAt')}: {new Date(attempt.createdAt).toLocaleString()}
                </p>
                {attempt.operator?.displayName && (
                  <p>
                    {t('historyBy')}: {attempt.operator.displayName}
                  </p>
                )}
                {attempt.override && (
                  <p>{t('historyOverrideUsed')}</p>
                )}
                {attempt.reason && <p>{t('historyReason')}: {attempt.reason}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
