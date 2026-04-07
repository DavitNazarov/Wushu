'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/primitives/card';
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
  const [isOpen, setIsOpen] = useState(false);
  const locale = useLocale();
  const weightUnit = t('weightUnit');

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {t('historyTitle')}
        </h3>
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="min-h-[44px] text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] md:hidden"
        >
          {isOpen ? `▾ ${t('historyHide')}` : `▸ ${t('historyShow')}`}
        </button>
      </div>
      <div className={isOpen ? 'mt-3 block md:block' : 'mt-3 hidden md:block'}>
        {!attempts.length ? (
          <p className="text-[12px] text-[var(--color-text-muted)]">
            {t('historyEmpty')}
          </p>
        ) : (
          <div className="space-y-2">
            {[...attempts].reverse().map((attempt) => (
              <div
                key={attempt.id}
                className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] text-[var(--color-text)]">
                    #{attempt.attemptNo} •{' '}
                    {t('weightDisplayValue', {
                      value: attempt.weightKg,
                      unit: weightUnit,
                    })}
                  </p>
                  <Badge variant={DECISION_VARIANT[attempt.decision]}>
                    {t(`decisionOption${attempt.decision}`)}
                  </Badge>
                </div>
                <div className="mt-1 space-y-0.5 text-[11px] text-[var(--color-text-muted)]">
                  <p>
                    {t('historyAt')}:{' '}
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(attempt.createdAt))}
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
      </div>
    </Card>
  );
}
