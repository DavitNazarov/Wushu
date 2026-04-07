'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { use } from 'react';
import { notFound } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import { EventTabPanelFallback } from '@/components/event/EventTabPanelFallback';
import { EventStageStepper, STEPPER_STAGES } from '@/components/event/EventStageStepper';
import { EventTabs } from '@/components/event/EventTabs';
import { PublicLivePanel } from '@/components/event/PublicLivePanel';
import { usePublicEvent } from '@/hooks/usePublicApi';
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
            <div className="flex items-start gap-5">
              {/* Date badge */}
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {new Date(event.competitionStartDate).toLocaleDateString(locale, { month: 'short' })}
                </span>
                <span className="text-[26px] font-bold tabular-nums leading-tight text-[var(--color-text)]">
                  {new Date(event.competitionStartDate).getDate()}
                </span>
              </div>

              <div className="pt-1">
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">
                  {event.name}
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
            </div>

            {/* Tabs */}
            <EventTabs
              overview={
                <div className="space-y-4">
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
