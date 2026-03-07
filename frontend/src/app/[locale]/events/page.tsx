'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { usePublicEvents } from '@/hooks/usePublicApi';
import type { PublicEvent } from '@/lib/api/public';

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function EventCardSkeleton() {
  return (
    <Card className="space-y-2">
      <Skeleton width="70%" height="18px" />
      <Skeleton width="50%" height="14px" />
      <Skeleton width="30%" height="12px" />
    </Card>
  );
}

export default function PublicEventsPage() {
  const tPublic = useTranslations('public');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('status');
  const { data: events, isLoading, error, refetch } = usePublicEvents();

  return (
    <PublicLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">
            {tPublic('eventsTitle')}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {tPublic('eventsSubtitle')}
          </p>
        </div>

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
            {[1, 2, 3].map((i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!isLoading && !error && (!events || events.length === 0) && (
          <Card>
            <EmptyState title={tPublic('noEventsYet')} description={undefined} />
          </Card>
        )}

        {!isLoading && !error && events && events.length > 0 && (
          <div className="space-y-4">
            {events.map((event: PublicEvent) => (
              <Card
                key={event.id}
                className="transition hover:border-[var(--color-primary)]/40"
              >
                <Link href={`/events/${event.slug}`} className="block">
                  <h2 className="text-[15px] font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)]">
                    {event.name}
                  </h2>
                  <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                    {event.location ?? '—'}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                    {formatDateRange(event.competitionStartDate, event.competitionEndDate)}
                  </p>
                  {event.lifecycle && (
                    <span className="mt-2 inline-block">
                      <Badge variant="default">
                      {tStatus(
                        (event.lifecycle === 'REG_OPEN' ? 'regOpen' : event.lifecycle.toLowerCase()) as
                          | 'regOpen'
                          | 'weighin'
                          | 'locked'
                          | 'drawn'
                          | 'published'
                          | 'live'
                          | 'completed',
                      )}
                      </Badge>
                    </span>
                  )}
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
