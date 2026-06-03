'use client';

import Link from 'next/link';
import { CalendarDays, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { StatusChip } from '@/components/ui/StatusChip';
import { localizedName } from '@/lib/bilingual';
import type { EventRow } from '@/types/api';
import { lifecycleAccent } from '../events.utils';

type Props = { event: EventRow; locale: string };

export function EventCard({ event, locale }: Props) {
  const t = useTranslations('coach.events');
  const tEvents = useTranslations('admin.events');
  const tDash = useTranslations('coach.dashboard.upcomingEvents');

  return (
    <div
      className={`group rounded-[var(--radius-card)] border border-[var(--color-border)] border-l-4 ${lifecycleAccent(event.lifecycle)} bg-[var(--color-surface)] shadow-[var(--shadow-soft)] transition-all hover:shadow-md hover:-translate-y-[1px]`}
    >
      <div className="flex flex-col gap-3 p-5">
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
  );
}
