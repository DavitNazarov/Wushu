import { getTranslations } from 'next-intl/server';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card } from '@/components/ui/Card';

export default async function ClubsPage() {
  const tPublic = await getTranslations('public');

  const clubs = [
    {
      name: 'Geo Wushu Club',
      city: 'Tbilisi',
      coaches: ['Demo Coach'],
    },
  ];

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
          <Card key={club.name}>
            <div className="flex flex-col gap-1">
              <h2 className="text-[15px] font-semibold text-[var(--color-text)]">
                {club.name}
              </h2>
              <p className="text-[13px] text-[var(--color-text-muted)]">
                {club.city}
              </p>
              <p className="text-[13px] text-[var(--color-text-muted)]">
                {club.coaches.join(', ')}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </PublicLayout>
  );
}

