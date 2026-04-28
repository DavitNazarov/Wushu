'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { localizedName } from '@/lib/bilingual';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusChip } from '@/components/ui/StatusChip';
import type { DashboardUpcomingEvent } from './types';

type Props = {
  events: DashboardUpcomingEvent[];
};

type FilterValue = 'all' | 'registrationOpen' | 'weighIn';

export function CoachDashboardUpcomingEvents({ events }: Props) {
  const t = useTranslations('coach.dashboard.upcomingEvents');
  const tEvents = useTranslations('admin.events');
  const locale = useLocale();
  const [filter, setFilter] = useState<FilterValue>('all');

  const filteredEvents = useMemo(() => {
    if (filter === 'registrationOpen') return events.filter((event) => event.registrationStatus === 'OPEN');
    if (filter === 'weighIn') return events.filter((event) => event.lifecycle === 'WEIGHIN' || event.lifecycle === 'WEIGH_IN_COMPLETED');
    return events;
  }, [events, filter]);

  const formatDateRange = (start: string, end: string) => {
    const startLabel = new Date(start).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
    const endLabel = new Date(end).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
    return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
  };

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('title')}</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{t('subtitle')}</p>
        </div>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as FilterValue)}
          className="h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
        >
          <option value="all">{t('filters.all')}</option>
          <option value="registrationOpen">{t('filters.registrationOpen')}</option>
          <option value="weighIn">{t('filters.weighIn')}</option>
        </select>
      </div>

      {filteredEvents.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <div className="space-y-3">
          {filteredEvents.slice(0, 6).map((event) => (
            <Link
              key={event.id}
              href={event.href}
              className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/40 p-4 transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-alt)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[var(--color-text)]">{localizedName(event.name, event.nameKa, locale)}</p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    {formatDateRange(event.competitionStartDate, event.competitionEndDate)}
                    {event.location ? ` · ${event.location}` : ''}
                  </p>
                </div>
                <StatusChip
                  status={event.lifecycle}
                  label={tEvents(`lifecycle.${event.lifecycle}` as Parameters<typeof tEvents>[0])}
                  domain="lifecycle"
                />
              </div>

              <div className="grid gap-3 text-[12px] text-[var(--color-text-muted)] sm:grid-cols-3">
                <div>
                  <span className="block text-[11px] uppercase tracking-wide">{t('cards.registrations')}</span>
                  <span className="mt-1 block text-[14px] font-medium text-[var(--color-text)]">{event.registrationsCount}</span>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wide">{t('cards.availableAthletes')}</span>
                  <span className="mt-1 block text-[14px] font-medium text-[var(--color-text)]">{event.availableAthletesCount}</span>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wide">{t('cards.registrationState')}</span>
                  <span className="mt-1 block text-[14px] font-medium text-[var(--color-text)]">{t(`registrationStatus.${event.registrationStatus}`)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
