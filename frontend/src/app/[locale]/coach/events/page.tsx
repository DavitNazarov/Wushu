'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiGet } from '@/lib/api/client';
import type { EventRow } from '@/types/api';

import { ALL_LIFECYCLE } from './events.utils';
import { EventsFilters } from './components/EventsFilters';
import { EventCard } from './components/EventCard';

export default function CoachEventsPage() {
  const t = useTranslations('coach.events');
  const tC = useTranslations('common');
  const locale = useLocale();
  const [search, setSearch] = useState('');
  const [lifecycleFilter, setLifecycleFilter] = useState(ALL_LIFECYCLE);

  const { data: events, isLoading, error, refetch } = useQuery({
    queryKey: ['public', 'events'],
    queryFn: () => apiGet<EventRow[]>('/api/public/events'),
  });

  const lifecycleOptions = useMemo(() => {
    if (!events) return [];
    const seen = new Set<string>();
    for (const e of events) if (e.lifecycle) seen.add(e.lifecycle);
    return Array.from(seen);
  }, [events]);

  const filtered = useMemo(() => {
    if (!events) return [];
    let list = events;
    if (lifecycleFilter !== ALL_LIFECYCLE) {
      list = list.filter((e) => e.lifecycle === lifecycleFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.location?.toLowerCase().includes(q) ?? false),
      );
    }
    return list;
  }, [events, search, lifecycleFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <EventsFilters
            search={search}
            onSearchChange={setSearch}
            lifecycleFilter={lifecycleFilter}
            onLifecycleChange={setLifecycleFilter}
            lifecycleOptions={lifecycleOptions}
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
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
