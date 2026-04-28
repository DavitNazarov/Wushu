'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { use } from 'react';
import { notFound } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { motion } from 'framer-motion';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import { EventTabPanelFallback } from '@/components/event/EventTabPanelFallback';
import { EventStageStepper, STEPPER_STAGES } from '@/components/event/EventStageStepper';
import { EventTabs } from '@/components/event/EventTabs';
import { PublicLivePanel } from '@/components/event/PublicLivePanel';
import { usePublicEvent } from '@/hooks/usePublicApi';
import { localizedName } from '@/lib/bilingual';
import type { EventLifecycle } from '@/types/api';

type Props = { params: Promise<{ slug: string }> };

const BracketsTab = dynamic(
  () => import('@/components/event/BracketsTab').then((m) => m.BracketsTab),
  { loading: () => <EventTabPanelFallback rows={3} /> },
);
const ScheduleTab = dynamic(
  () => import('@/components/event/ScheduleTab').then((m) => m.ScheduleTab),
  { loading: () => <EventTabPanelFallback rows={4} /> },
);
const PublicResultsPanel = dynamic(
  () => import('@/components/event/PublicResultsPanel').then((m) => m.PublicResultsPanel),
  { loading: () => <EventTabPanelFallback rows={4} /> },
);
const PublicEventFaq = dynamic(
  () => import('@/components/event/PublicEventFaq').then((m) => m.PublicEventFaq),
  { loading: () => <EventTabPanelFallback rows={2} /> },
);

function fmtDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateRange(start: string, end: string, locale: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return `${s.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} – ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${s.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function LifecyclePill({ lifecycle }: { lifecycle: string }) {
  const isLive = lifecycle === 'LIVE';
  const isDone = lifecycle === 'COMPLETED';
  const cls = isLive
    ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
    : isDone
      ? 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
      : 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]';
  const label = isLive ? 'Live now' : isDone ? 'Completed' : lifecycle.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${cls}`}>
      {isLive && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-success)] opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
        </span>
      )}
      {label}
    </span>
  );
}

const CalIcon = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const PinIcon = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export default function PublicEventDetailPage({ params }: Props) {
  const tPublic = useTranslations('public');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { slug: eventSlug } = use(params);
  const { data: event, isLoading, error, refetch, isFetched } = usePublicEvent(eventSlug);

  if (isFetched && !isLoading && !event) notFound();

  return (
    <PublicLayout>
      <div className="space-y-8 py-2">

        {/* Back */}
        <Link
          href={`/${locale}/events`}
          className="group inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          <svg
            className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {tPublic('eventsTitle')}
        </Link>

        {error && (
          <InlineAlert
            variant="error"
            actions={
              <button onClick={() => refetch()} className="text-[13px] font-medium underline">
                {tCommon('retry')}
              </button>
            }
          >
            {tCommon('loadError')}
          </InlineAlert>
        )}

        {isLoading && (
          <div className="flex items-start gap-5">
            <Skeleton width="64px" height="64px" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton width="55%" height="28px" />
              <Skeleton width="40%" height="16px" />
            </div>
          </div>
        )}

        {!isLoading && event && (
          <>
            {/* Header — matches club detail page structure */}
            <motion.div
              className="flex items-start gap-5"
              initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ type: 'spring', stiffness: 150, damping: 25 }}
            >
              {/* Date badge */}
              <motion.div
                className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.05 }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {new Date(event.competitionStartDate).toLocaleDateString(locale, { month: 'short' })}
                </span>
                <span className="text-[26px] font-bold tabular-nums leading-tight text-[var(--color-text)]">
                  {new Date(event.competitionStartDate).getDate()}
                </span>
              </motion.div>

              <div className="pt-1">
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">
                  {localizedName(event.name, event.nameKa, locale)}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <LifecyclePill lifecycle={event.lifecycle} />
                  {event.location && (
                    <span className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)]">
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {event.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)]">
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {fmtDateRange(event.competitionStartDate, event.competitionEndDate, locale)}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Tabs */}
            <EventTabs
              overview={
                <div className="space-y-4">
                  {/* Lifecycle-aware banner */}
                  {event.lifecycle === 'REG_OPEN' && (
                    <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-primary)]/25 bg-[var(--color-primary-subtle)] px-4 py-3.5">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <div>
                        <p className="text-[13px] font-semibold text-[var(--color-primary)]">Registration is open</p>
                        <p className="mt-0.5 text-[12px] text-[var(--color-primary)]/80">
                          {event.registrationEndDate
                            ? `Deadline: ${fmtDate(event.registrationEndDate, locale)}. Contact your club coach to register.`
                            : 'Contact your club coach to register for this event.'}
                        </p>
                      </div>
                    </div>
                  )}
                  {event.lifecycle === 'WEIGHIN' && (
                    <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-warning)]/25 bg-[var(--color-warning-subtle)] px-4 py-3.5">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                      </svg>
                      <div>
                        <p className="text-[13px] font-semibold text-[var(--color-warning)]">Weigh-in in progress</p>
                        <p className="mt-0.5 text-[12px] text-[var(--color-warning)]/80">Athletes are currently being weighed. Brackets will be published after weigh-in completes.</p>
                      </div>
                    </div>
                  )}
                  {(event.lifecycle === 'DRAWN' || event.lifecycle === 'PUBLISHED') && (
                    <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-primary)]/25 bg-[var(--color-primary-subtle)] px-4 py-3.5">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <div>
                        <p className="text-[13px] font-semibold text-[var(--color-primary)]">Brackets are ready</p>
                        <p className="mt-0.5 text-[12px] text-[var(--color-primary)]/80">The draw has been completed. Competition begins {fmtDate(event.competitionStartDate, locale)}.</p>
                      </div>
                    </div>
                  )}
                  {event.lifecycle === 'COMPLETED' && (
                    <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 py-3.5">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-[13px] font-semibold text-[var(--color-text)]">Event completed</p>
                        <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">This event has concluded. Final results are available in the Results tab.</p>
                      </div>
                    </div>
                  )}

                  {/* Stage progress */}
                  <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                    <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                      {tPublic('stage')}
                    </h2>
                    <EventStageStepper
                      stage={event.lifecycle as EventLifecycle}
                      labels={Object.fromEntries(
                        STEPPER_STAGES.map((s) => [
                          s,
                          tPublic(`lifecycle.${s as EventLifecycle}` as Parameters<typeof tPublic>[0]),
                        ]),
                      ) as Record<EventLifecycle, string>}
                    />
                  </div>

                  {/* Event details */}
                  <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
                    {event.location && (
                      <div className="flex items-start gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
                        <span className="mt-0.5 shrink-0 text-[var(--color-text-muted)]">{PinIcon}</span>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Location</p>
                          <p className="mt-0.5 text-[14px] text-[var(--color-text)]">{event.location}</p>
                        </div>
                      </div>
                    )}
                    <div className={`flex items-start gap-3 bg-[var(--color-surface)] px-5 py-4 ${event.registrationStartDate ? 'border-b border-[var(--color-border)]' : ''}`}>
                      <span className="mt-0.5 shrink-0 text-[var(--color-text-muted)]">{CalIcon}</span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Competition dates</p>
                        <p className="mt-0.5 text-[14px] text-[var(--color-text)]">
                          {fmtDateRange(event.competitionStartDate, event.competitionEndDate, locale)}
                        </p>
                      </div>
                    </div>
                    {event.registrationStartDate && (
                      <div className="flex items-start gap-3 bg-[var(--color-surface)] px-5 py-4">
                        <span className="mt-0.5 shrink-0 text-[var(--color-text-muted)]">{CalIcon}</span>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Registration window</p>
                          <p className="mt-0.5 text-[14px] text-[var(--color-text)]">
                            {fmtDate(event.registrationStartDate, locale)}
                            {event.registrationEndDate ? ` – ${fmtDate(event.registrationEndDate, locale)}` : ''}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              }
              brackets={<BracketsTab eventSlug={eventSlug} />}
              schedule={<ScheduleTab eventSlug={eventSlug} />}
              live={<PublicLivePanel eventSlug={eventSlug} />}
              results={<PublicResultsPanel eventSlug={eventSlug} />}
              faq={<PublicEventFaq event={event} />}
            />
          </>
        )}
      </div>
    </PublicLayout>
  );
}
