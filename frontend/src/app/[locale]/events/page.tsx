import { getTranslations } from 'next-intl/server';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card } from '@/components/ui/Card';
import { getApiUrl } from '@/lib/api';

type EventRow = { id: string; name: string; location: string | null };

export default async function PublicEventsPage() {
  const tPublic = await getTranslations('public');
  const res = await fetch(getApiUrl('/api/public/events'), { cache: 'no-store' });
  const events: EventRow[] = res.ok ? await res.json() : [];
  const hasEvents = events.length > 0;

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

        {!hasEvents && (
          <Card>
            <p className="text-[15px] text-[var(--color-text-muted)]">
              {tPublic('noEventsYet')}
            </p>
          </Card>
        )}

        {hasEvents && (
          <div className="space-y-4">
            {events.map((event) => (
              <Card key={event.id}>
                <div className="flex flex-col gap-1">
                  <h2 className="text-[15px] font-semibold text-[var(--color-text)]">
                    {event.name}
                  </h2>
                  <p className="text-[13px] text-[var(--color-text-muted)]">
                    {event.location || '—'}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
