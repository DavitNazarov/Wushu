import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Medal, Trophy } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { getServerApiUrl } from '@/lib/api';
import { localizedName } from '@/lib/bilingual';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { fetchPublicJson } from '@/lib/seo/fetchPublic';
import { JsonLd } from '@/lib/seo/jsonLd';
import { SITE_NAME, resolveSiteUrl, localeUrl } from '@/lib/seo/site';

type ClubPublicDetails = {
  club: {
    id: string;
    name: string;
    nameKa?: string | null;
    city: string | null;
    country: string | null;
  };
  coaches: { id: string; displayName: string }[];
  athletes: { id: string; name: string; nameKa?: string | null; category: string | null }[];
  medals: { gold: number; silver: number; bronze: number; total: number };
  stats: { coachCount: number; athleteCount: number };
};

const MEDAL_COLORS = { gold: '#f5b301', silver: '#9aa6b2', bronze: '#cd7f32' } as const;

type Props = {
  params: Promise<{ locale: string; clubId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, clubId } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  const data = await fetchPublicJson<ClubPublicDetails>(
    `/api/public/clubs/${clubId}`,
  );
  if (!data) {
    return buildPageMetadata({
      locale,
      path: `/clubs/${clubId}`,
      title: t('clubsTitle'),
      description: t('clubsDescription'),
    });
  }
  const name = localizedName(data.club.name, data.club.nameKa, locale);
  return buildPageMetadata({
    locale,
    path: `/clubs/${clubId}`,
    title: name,
    description: t('clubDescription', { name }),
  });
}

export default async function PublicClubPage({ params }: Props) {
  const { clubId } = await params;
  const tPublic = await getTranslations('public');
  const locale = await getLocale();

  const url = await getServerApiUrl(`/api/public/clubs/${clubId}`);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) notFound();

  const data = (await res.json()) as ClubPublicDetails;
  const { club, coaches, athletes, stats } = data;
  const medals = data.medals ?? { gold: 0, silver: 0, bronze: 0, total: 0 };

  const location = [club.city, club.country].filter(Boolean).join(', ');
  const clubDisplayName = localizedName(club.name, club.nameKa, locale);

  const siteUrl = await resolveSiteUrl();
  const clubJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: clubDisplayName,
    sport: 'Wushu',
    url: localeUrl(siteUrl, locale, `/clubs/${club.id}`),
    memberOf: { '@type': 'SportsOrganization', name: SITE_NAME, url: siteUrl },
    ...(location ? { location: { '@type': 'Place', name: location } } : {}),
    numberOfEmployees: stats.coachCount,
  };

  return (
    <PublicLayout>
      <JsonLd data={clubJsonLd} />
      <div className="space-y-8 py-2">

        {/* Back link */}
        <Link
          href={`/${locale}/clubs`}
          className="group inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          <svg className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {tPublic('clubsTitle')}
        </Link>

        {/* Club header */}
        <div className="flex items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary-subtle)] text-[20px] font-bold text-[var(--color-primary)]">
            {clubDisplayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="pt-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">
              {clubDisplayName}
            </h1>
            {location && (
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)]">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {location}
              </p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 max-w-sm">
          <StatCard value={stats.athleteCount} label={tPublic('clubAthletes')} />
          <StatCard value={stats.coachCount} label={tPublic('clubCoaches')} />
        </div>

        {/* Medals */}
        <section className="space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
            {tPublic('clubMedals')}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 max-w-2xl">
            <MedalStatCard value={medals.total} label={tPublic('resultsClubColumns.total')} />
            <MedalStatCard value={medals.gold} label={tPublic('resultsClubColumns.gold')} color={MEDAL_COLORS.gold} />
            <MedalStatCard value={medals.silver} label={tPublic('resultsClubColumns.silver')} color={MEDAL_COLORS.silver} />
            <MedalStatCard value={medals.bronze} label={tPublic('resultsClubColumns.bronze')} color={MEDAL_COLORS.bronze} />
          </div>
        </section>

        {/* Coaches */}
        {coaches.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              {tPublic('clubCoaches')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {coaches.map((coach) => (
                <div
                  key={coach.id}
                  className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 transition-colors duration-150 hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-alt)]"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-[9px] font-bold text-[var(--color-primary)]">
                    {coach.displayName.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-[13px] text-[var(--color-text)]">{coach.displayName}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Athletes */}
        {athletes.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              {tPublic('clubAthletes')} <span className="ml-1 font-normal normal-case tracking-normal">({athletes.length})</span>
            </h2>
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
              {athletes.map((athlete, i) => {
                const athleteDisplayName = localizedName(athlete.name, athlete.nameKa, locale);
                return (
                <Link
                  key={athlete.id}
                  href={`/${locale}/athletes/${athlete.id}`}
                  className={`group flex items-center justify-between px-4 py-3 transition-colors duration-150 hover:bg-[var(--color-surface-alt)] ${
                    i !== 0 ? 'border-t border-[var(--color-border)]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-surface-alt)] text-[10px] font-semibold text-[var(--color-text-muted)] transition-colors group-hover:bg-[var(--color-primary-subtle)] group-hover:text-[var(--color-primary)]">
                      {athleteDisplayName.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-[14px] text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
                      {athleteDisplayName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {athlete.category && (
                      <span className="rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2 py-0.5 text-[11px] text-[var(--color-text-muted)]">
                        {athlete.category}
                      </span>
                    )}
                    <svg
                      className="h-3.5 w-3.5 text-[var(--color-text-muted)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-[var(--color-primary)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
                );
              })}
            </div>
          </section>
        )}

        {athletes.length === 0 && coaches.length === 0 && (
          <p className="text-[14px] text-[var(--color-text-muted)]">
            No members registered yet.
          </p>
        )}
      </div>
    </PublicLayout>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <p className="text-[24px] font-bold tabular-nums text-[var(--color-text)]">{value}</p>
      <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}

// Medal tally card. A colored Medal icon flags the gold/silver/bronze cards;
// the total card (no `color`) uses the neutral trophy + primary accent.
function MedalStatCard({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color?: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="flex items-center gap-2">
        {color ? (
          <Medal className="h-5 w-5 shrink-0" style={{ color }} />
        ) : (
          <Trophy className="h-5 w-5 shrink-0 text-[var(--color-primary)]" />
        )}
        <p className="text-[24px] font-bold tabular-nums text-[var(--color-text)]">{value}</p>
      </div>
      <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}
