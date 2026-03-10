'use client';

import { use } from 'react';
import { notFound } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { EventStageStepper, STEPPER_STAGES } from '@/components/event/EventStageStepper';
import { EventTabs } from '@/components/event/EventTabs';
import { BracketsTab } from '@/components/event/BracketsTab';
import { ScheduleTab } from '@/components/event/ScheduleTab';
import { MatTab } from '@/components/event/MatTab';
import { usePublicEvent } from '@/hooks/usePublicApi';
import type { PublicEvent } from '@/lib/api/public';
import type { EventLifecycle } from '@/types/api';

type Props = { params: Promise<{ slug: string }> };

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export default function PublicEventDetailPage({ params }: Props) {
  const tPublic = useTranslations('public');
  const tCommon = useTranslations('common');
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
                {(event as PublicEvent).name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusChip
                  status={(event as PublicEvent).lifecycle}
                  label={tPublic(`lifecycle.${(event as PublicEvent).lifecycle as EventLifecycle}` as Parameters<typeof tPublic>[0])}
                  domain="lifecycle"
                />
                <span className="text-[13px] text-[var(--color-text-muted)]">
                  {(event as PublicEvent).location ?? ''}
                </span>
                {(event as PublicEvent).location && (
                  <span className="text-[var(--color-text-muted)]">·</span>
                )}
                <span className="text-[13px] text-[var(--color-text-muted)]">
                  {formatDateRange(
                    (event as PublicEvent).competitionStartDate,
                    (event as PublicEvent).competitionEndDate,
                  )}
                </span>
              </div>
            </div>

            {/* Lifecycle stepper — driven purely from event.lifecycle */}
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <EventStageStepper
                stage={(event as PublicEvent).lifecycle as EventLifecycle}
                labels={Object.fromEntries(
                  STEPPER_STAGES.map((s) => [
                    s,
                    tPublic(`lifecycle.${s as EventLifecycle}` as Parameters<typeof tPublic>[0]),
                  ]),
                ) as Record<EventLifecycle, string>}
              />
            </div>

            <EventTabs
              eventSlug={eventSlug}
              overview={
                <Card>
                  <div className="space-y-2 text-[15px] text-[var(--color-text)]">
                    {(event as PublicEvent).location && (
                      <p>
                        <span className="font-medium text-[var(--color-text-muted)]">
                          {tPublic('eventDetail')}:{' '}
                        </span>
                        {(event as PublicEvent).location}
                      </p>
                    )}
                    <p>
                      {formatDateRange(
                        (event as PublicEvent).competitionStartDate,
                        (event as PublicEvent).competitionEndDate,
                      )}
                    </p>
                  </div>
                </Card>
              }
              brackets={<BracketsTab eventSlug={eventSlug} />}
              schedule={<ScheduleTab eventSlug={eventSlug} />}
              mat={<MatTab eventSlug={eventSlug} />}
            />
          </>
        )}
      </div>
    </PublicLayout>
  );
}
