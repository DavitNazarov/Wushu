import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { getServerApiUrl } from '@/lib/api';

type Club = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
};

export default async function ClubsPage() {
  const tPublic = await getTranslations('public');
  const locale = await getLocale();

  const url = await getServerApiUrl('/api/public/clubs');
  const res = await fetch(url, { cache: 'no-store' });
  const clubs = (res.ok ? ((await res.json()) as Club[]) : []) ?? [];

  return (
    <PublicLayout>
      <div className="space-y-8 py-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">
            {tPublic('clubsTitle')}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {tPublic('clubsSubtitle')}
          </p>
        </div>

        {clubs.length === 0 ? (
          <p className="text-[14px] text-[var(--color-text-muted)]">No clubs yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((club) => (
              <Link
                key={club.id}
                href={`/${locale}/clubs/${club.id}`}
                className="group flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 transition-all duration-200 hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-alt)] hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  {/* Initials badge */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-[13px] font-bold text-[var(--color-primary)] transition-transform duration-200 group-hover:scale-110">
                    {club.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
                      {club.name}
                    </p>
                    {(club.city || club.country) && (
                      <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                        {[club.city, club.country].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <svg
                  className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-all duration-200 group-hover:translate-x-1 group-hover:text-[var(--color-primary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
