import { getTranslations } from 'next-intl/server';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card } from '@/components/ui/Card';
import { getApiUrl } from '@/lib/api';

type Props = {
  params: Promise<{ id: string }>;
};

type EventRow = { id: string; name: string; location: string | null };

export default async function PublicEventDetailPage({ params }: Props) {
  const tPublic = await getTranslations('public');
  const { id } = await params;

  const res = await fetch(getApiUrl(`/api/public/events/${id}`), { cache: 'no-store' });
  const event: EventRow | null = res.ok ? await res.json() : null;
  const isPublished = Boolean(event);

  return (
    <PublicLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">
            {tPublic('eventDetail')}
          </h1>
          {event && (
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
              {event.name}
            </p>
          )}
        </div>

        {!isPublished && (
          <Card>
            <p className="text-[15px] text-[var(--color-text-muted)]">
              {tPublic('notPublishedDescription')}
            </p>
          </Card>
        )}

        {isPublished && event && (
          <Card>
            <p className="text-[15px] text-[var(--color-text-muted)]">
              {event.location || ' '}
            </p>
          </Card>
        )}
      </div>
    </PublicLayout>
  );
}
