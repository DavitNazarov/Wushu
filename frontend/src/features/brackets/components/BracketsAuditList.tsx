'use client';

import { useLocale } from 'next-intl';
import { Card } from '@/components/ui/primitives/card';
import type { BracketsOverviewResponse } from '@/types/api';
import { formatDateTime } from '@/features/brackets/lib/dateFormat';

type Props = {
  entries: BracketsOverviewResponse['audit']['recent'];
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

export function BracketsAuditList({ entries, t }: Props) {
  const locale = useLocale();

  return (
    <Card id="bracket-audit" className="space-y-2 p-4">
      <h3 className="text-[13px] font-semibold text-[var(--color-text)]">{t('auditTitle')}</h3>
      {entries.length === 0 ? (
        <p className="text-[12px] text-[var(--color-text-muted)]">{t('auditEmpty')}</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card
              key={entry.id}
              className="bg-[var(--color-surface-alt)] p-2 text-[12px] shadow-none"
            >
              <p className="font-medium text-[var(--color-text)]">
                {t(`auditAction.${entry.action}`)}
              </p>
              <p className="text-[var(--color-text-muted)]">
                {formatDateTime(locale, entry.createdAt) ?? t('valueUnavailable')} · {entry.actorDisplayName ?? t('unknownUser')}
              </p>
              {entry.reason ? (
                <p className="text-[var(--color-text-muted)]">{t('reasonLabel')}: {entry.reason}</p>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
}
