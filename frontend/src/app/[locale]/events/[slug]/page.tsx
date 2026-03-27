'use client';

import dynamic from 'next/dynamic';
import { use } from 'react';
import { notFound } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { EventTabPanelFallback } from '@/components/event/EventTabPanelFallback';
import { EventStageStepper, STEPPER_STAGES } from '@/components/event/EventStageStepper';
import { EventTabs } from '@/components/event/EventTabs';
import { PublicLivePanel } from '@/components/event/PublicLivePanel';
import { usePublicEvent } from '@/hooks/usePublicApi';
import type { EventLifecycle } from '@/types/api';

type Props = { params: Promise<{ slug: string }> };

const BracketsTab = dynamic(
  () => import('@/components/event/BracketsTab').then((module) => module.BracketsTab),
  { loading: () => <EventTabPanelFallback rows={3} /> },
);

const ScheduleTab = dynamic(
  () => import('@/components/event/ScheduleTab').then((module) => module.ScheduleTab),
  { loading: () => <EventTabPanelFallback rows={4} /> },
);

const PublicResultsPanel = dynamic(
  () => import('@/components/event/PublicResultsPanel').then((module) => module.PublicResultsPanel),
  { loading: () => <EventTabPanelFallback rows={4} /> },
);

const PublicEventFaq = dynamic(
  () => import('@/components/event/PublicEventFaq').then((module) => module.PublicEventFaq),
  { loading: () => <EventTabPanelFallback rows={2} /> },
);

function formatDateRange(start: string, end: string, locale: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })} – ${e.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export default function PublicEventDetailPage({ params }: Props) {
  const tPublic = useTranslations('public');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { slug: eventSlug } = use(params);
  const { data: event, isLoading, error, refetch, isFetched } = usePublicEvent(eventSlug);

  if (isFetched && !isLoading && !event) {
    notFound();
  }

  return (
    <PublicLayout>
      <div className="space-y-6">
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
          <div className="space-y-4">
            <Skeleton width="60%" height="28px" />
            <Skeleton width="80%" height="18px" />
          </div>
        )}

        {!isLoading && event && (
          <>
            <div>
              <h1 className="text-2xl font-semibold text-[var(--color-text)]">
                {event.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusChip
                  status={event.lifecycle}
                  label={tPublic(`lifecycle.${event.lifecycle as EventLifecycle}` as Parameters<typeof tPublic>[0])}
                  domain="lifecycle"
                />
                <span className="text-[13px] text-[var(--color-text-muted)]">
                  {event.location ?? ''}
                </span>
                {event.location && (
                  <span className="text-[var(--color-text-muted)]">·</span>
                )}
                <span className="text-[13px] text-[var(--color-text-muted)]">
                  {formatDateRange(
                    event.competitionStartDate,
                    event.competitionEndDate,
                    locale,
                  )}
                </span>
              </div>
            </div>

            {/* Lifecycle stepper — driven purely from event.lifecycle */}
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
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

            <EventTabs
              overview={
                <Card>
                  <div className="space-y-2 text-[15px] text-[var(--color-text)]">
                    {event.location && (
                      <p>
                        <span className="font-medium text-[var(--color-text-muted)]">
                          {tPublic('eventDetail')}:{' '}
                        </span>
                        {event.location}
                      </p>
                    )}
                    <p>
                      {formatDateRange(
                        event.competitionStartDate,
                        event.competitionEndDate,
                        locale,
                      )}
                    </p>
                  </div>
                </Card>
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
