import { getTranslations } from 'next-intl/server';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card } from '@/components/ui/Card';
import { getServerApiUrl } from '@/lib/api';

type Club = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
};

export default async function ClubsPage() {
  const tPublic = await getTranslations('public');

  const url = await getServerApiUrl('/api/public/clubs');
  const res = await fetch(url, {
    // Public, but avoid stale content during events
    cache: 'no-store',
  });

  const clubs = (res.ok ? ((await res.json()) as Club[]) : []) ?? [];

  return (
    <PublicLayout>
      <div className="space-y-6 py-2">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">
            {tPublic('clubsTitle')}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {tPublic('clubsSubtitle')}
          </p>
        </div>

        {clubs.map((club) => (
          <Card key={club.id}>
            <div className="flex flex-col gap-1">
              <h2 className="text-[15px] font-semibold text-[var(--color-text)]">
                {club.name}
              </h2>
              <p className="text-[13px] text-[var(--color-text-muted)]">
                {club.city ?? ' '}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </PublicLayout>
  );
}

