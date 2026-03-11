'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusChip } from '@/components/ui/StatusChip';
import type { DashboardRecentUpdate } from './types';

type Props = {
  updates: DashboardRecentUpdate[];
  hasExactTimestamps: boolean;
};

export function CoachDashboardRecentUpdates({ updates, hasExactTimestamps }: Props) {
  const t = useTranslations('coach.dashboard.recentUpdates');
  const tRegistrations = useTranslations('registrations');
  const locale = useLocale();
  const [search, setSearch] = useState('');

  const filteredUpdates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return updates;
    return updates.filter((update) => update.searchText.includes(query));
  }, [search, updates]);

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return t('latestVisible');
    return new Date(timestamp).toLocaleString(locale, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('title')}</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {hasExactTimestamps ? t('subtitleChronological') : t('subtitleVisible')}
          </p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      {filteredUpdates.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <div className="space-y-3">
          {filteredUpdates.slice(0, 8).map((update) => (
            <Link
              key={update.id}
              href={update.href}
              className="block rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/35 p-4 transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-alt)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--color-text)]">{update.athleteName}</p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    {t(`items.${update.textKey}`, {
                      eventName: update.eventName,
                      categoryCode: update.categoryCode,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip
                    status={update.status}
                    label={tRegistrations(`status.${update.status}`)}
                    domain="registration"
                  />
                  <span className="text-[11px] text-[var(--color-text-muted)]">{formatTimestamp(update.timestamp)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
