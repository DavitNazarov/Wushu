'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/api/client';
import type { EventRow } from '@/types/api';

export default function CoachEventsPage() {
  const t = useTranslations('coach.events');
  const tEvents = useTranslations('admin.events');
  const tC = useTranslations('common');
  const locale = useLocale();
  const [search, setSearch] = useState('');

  const { data: events, isLoading, error, refetch } = useQuery({
    queryKey: ['public', 'events'],
    queryFn: () => apiGet<EventRow[]>('/api/public/events'),
  });

  const filtered = useMemo(() => {
    if (!events) return [];
    if (!search.trim()) return events;
    const q = search.toLowerCase();
    return events.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.location?.toLowerCase().includes(q) ?? false),
    );
  }, [events, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <input
            type="search"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-64 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        }
      />

      {error && (
        <InlineAlert
          variant="error"
          actions={
            <button onClick={() => refetch()} className="text-[13px] font-medium underline">
              {tC('retry')}
            </button>
          }
        >
          {tC('loadError')}
        </InlineAlert>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-[15px] text-[var(--color-text-muted)]">{t('emptyDescription')}</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
          {filtered.map((event) => (
            <Card key={event.id} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-[15px] font-semibold text-[var(--color-text)]">
                  {event.name}
                </h2>
                <p className="text-[13px] text-[var(--color-text-muted)]">
                  {event.location || '—'}
                </p>
                <p className="text-[12px] text-[var(--color-text-muted)]">
                  {new Date(event.competitionStartDate).toLocaleDateString(locale)} –{' '}
                  {new Date(event.competitionEndDate).toLocaleDateString(locale)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <StatusChip status={event.lifecycle} label={tEvents(`lifecycle.${event.lifecycle}` as Parameters<typeof tEvents>[0])} domain="lifecycle" />
                <Link href={`/${locale}/coach/events/${event.slug}/registrations`}>
                  <PrimaryButton>{t('openEvent')}</PrimaryButton>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
