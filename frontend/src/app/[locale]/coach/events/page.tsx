'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusChip } from '@/components/ui/StatusChip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import { apiGet } from '@/lib/api/client';
import { localizedName } from '@/lib/bilingual';
import type { EventRow } from '@/types/api';

const ALL_LIFECYCLE = '__all__';

const LIFECYCLE_ACCENT: Record<string, string> = {
  DRAFT: 'border-l-[var(--color-border)]',
  REG_OPEN: 'border-l-[var(--color-success)]',
  LOCKED: 'border-l-[var(--color-warning)]',
  WEIGHIN: 'border-l-[var(--color-warning)]',
  WEIGH_IN_COMPLETED: 'border-l-[var(--color-warning)]',
  DRAWN: 'border-l-[var(--color-info)]',
  PUBLISHED: 'border-l-[var(--color-primary)]',
  ACTIVE: 'border-l-[var(--color-primary)]',
  LIVE: 'border-l-[var(--color-danger)]',
  COMPLETED: 'border-l-emerald-500',
};

function lifecycleAccent(lifecycle: string) {
  return LIFECYCLE_ACCENT[lifecycle] ?? 'border-l-[var(--color-border)]';
}

export default function CoachEventsPage() {
  const t = useTranslations('coach.events');
  const tEvents = useTranslations('admin.events');
  const tDash = useTranslations('coach.dashboard.upcomingEvents');
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <Input
                type="search"
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-52 pl-9 bg-[var(--color-surface)]"
              />
            </div>
            <div className="relative flex items-center gap-1.5">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
              <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
                <SelectTrigger className="h-10 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_LIFECYCLE}>{t('filterAll')}</SelectItem>
                  {lifecycleOptions.map((lc) => (
                    <SelectItem key={lc} value={lc}>
                      {tEvents(`lifecycle.${lc}` as Parameters<typeof tEvents>[0])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
            <div
              key={event.id}
              className={`group rounded-[var(--radius-card)] border border-[var(--color-border)] border-l-4 ${lifecycleAccent(event.lifecycle)} bg-[var(--color-surface)] shadow-[var(--shadow-soft)] transition-all hover:shadow-md hover:-translate-y-[1px]`}
            >
              <div className="flex flex-col gap-3 p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[15px] font-semibold text-[var(--color-text)] leading-snug">
                    {localizedName(event.name, event.nameKa, locale)}
                  </h2>
                  <StatusChip
                    status={event.lifecycle}
                    label={tEvents(`lifecycle.${event.lifecycle}` as Parameters<typeof tEvents>[0])}
                    domain="lifecycle"
                  />
                </div>

                {/* Meta */}
                <div className="flex flex-col gap-1.5 text-[12px] text-[var(--color-text-muted)]">
                  {event.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {event.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    {new Date(event.competitionStartDate).toLocaleDateString(locale)} –{' '}
                    {new Date(event.competitionEndDate).toLocaleDateString(locale)}
                  </span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--color-border)]/50">
                  {event.registrationStatus ? (
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-wide ${
                        event.registrationStatus === 'OPEN'
                          ? 'text-[var(--color-success)]'
                          : event.registrationStatus === 'UPCOMING'
                            ? 'text-[var(--color-warning)]'
                            : 'text-[var(--color-text-muted)]'
                      }`}
                    >
                      {tDash(`registrationStatus.${event.registrationStatus}` as Parameters<typeof tDash>[0])}
                    </span>
                  ) : (
                    <span />
                  )}
                  <Link href={`/${locale}/coach/events/${event.slug}/registrations`} className="ml-auto">
                    <PrimaryButton>{t('openEvent')}</PrimaryButton>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
