import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { getServerApiUrl } from '@/lib/api';
import { localizedFullName, localizedName } from '@/lib/bilingual';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { fetchPublicJson } from '@/lib/seo/fetchPublic';
import { JsonLd } from '@/lib/seo/jsonLd';
import { SITE_NAME, resolveSiteUrl, localeUrl } from '@/lib/seo/site';
import type {
  AthleteProfileFightRow,
  AthleteProfileRegistrationRow,
  AthleteProfileResponse,
} from '@/types/api';

type Props = {
  params: Promise<{ locale: string; athleteId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, athleteId } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  const data = await fetchPublicJson<AthleteProfileResponse>(
    `/api/public/athletes/${athleteId}`,
  );
  if (!data) {
    return buildPageMetadata({
      locale,
      path: `/athletes/${athleteId}`,
      title: t('athleteTitleSuffix'),
      description: t('defaultDescription'),
      index: false,
    });
  }
  const name = localizedFullName(
    data.athlete.firstName,
    data.athlete.lastName,
    data.athlete.firstNameKa,
    data.athlete.lastNameKa,
    locale,
  );
  return buildPageMetadata({
    locale,
    path: `/athletes/${athleteId}`,
    title: `${name} — ${t('athleteTitleSuffix')}`,
    ogTitle: `${name} | ${SITE_NAME}`,
    description: t('athleteDescription', { name }),
    type: 'profile',
  });
}

// ─── helpers ────────────────────────────────────────────────────────────────

function outcome(fight: AthleteProfileFightRow, athleteId: string): 'win' | 'loss' | 'pending' {
  if (!fight.winnerAthleteId) return 'pending';
  return fight.winnerAthleteId === athleteId ? 'win' : 'loss';
}

function fmtDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

function sortedDesc<T extends { competitionStartDate?: string; scheduledStartTime?: string | null }>(
  arr: T[],
  key: keyof T,
): T[] {
  return [...arr].sort((a, b) => {
    const at = new Date((a[key] as string) ?? 0).getTime();
    const bt = new Date((b[key] as string) ?? 0).getTime();
    return bt - at;
  });
}

// ─── sub-components ─────────────────────────────────────────────────────────

function StatCard({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <p className="text-[22px] font-bold tabular-nums text-[var(--color-text)]">{value}</p>
      <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}

const MEDAL_TONE: Record<'gold' | 'silver' | 'bronze' | 'other', { text: string; chip: string }> = {
  gold: { text: 'text-[var(--color-medal-gold)]', chip: 'bg-[var(--color-medal-gold-subtle)]' },
  silver: { text: 'text-[var(--color-medal-silver)]', chip: 'bg-[var(--color-medal-silver-subtle)]' },
  bronze: { text: 'text-[var(--color-medal-bronze)]', chip: 'bg-[var(--color-medal-bronze-subtle)]' },
  other: { text: 'text-[var(--color-text-muted)]', chip: 'bg-[var(--color-surface-alt)]' },
};

function MedalCard({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: 'gold' | 'silver' | 'bronze' | 'other';
}) {
  const { text, chip } = MEDAL_TONE[tone];
  const dimmed = value === 0;
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${chip} ${dimmed ? 'opacity-40' : ''}`}>
        <svg className={`h-4 w-4 ${text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="8" r="6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className={`text-[22px] font-bold tabular-nums leading-none ${dimmed ? 'text-[var(--color-text-muted)]' : text}`}>
          {value}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{label}</p>
      </div>
    </div>
  );
}

function LifecyclePill({ lifecycle }: { lifecycle: string }) {
  const isLive = lifecycle === 'LIVE';
  const isDone = lifecycle === 'COMPLETED';
  const cls = isLive
    ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
    : isDone
      ? 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
      : 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]';
  const label = isLive
    ? 'Live'
    : isDone
      ? 'Completed'
      : lifecycle.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  return (
    <span
      className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

function OutcomePill({
  value,
  method,
}: {
  value: 'win' | 'loss' | 'pending';
  method: string | null;
}) {
  if (value === 'win')
    return (
      <span className="rounded-[var(--radius-pill)] bg-[var(--color-success-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-success)]">
        W{method ? ` · ${method}` : ''}
      </span>
    );
  if (value === 'loss')
    return (
      <span className="rounded-[var(--radius-pill)] bg-[var(--color-danger-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-danger)]">
        L{method ? ` · ${method}` : ''}
      </span>
    );
  return (
    <span className="rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
      Pending
    </span>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function PublicAthleteProfilePage({ params }: Props) {
  const { athleteId } = await params;
  const locale = await getLocale();

  const url = await getServerApiUrl(`/api/public/athletes/${athleteId}`);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) notFound();

  const { athlete, registrations, fights, medals } = (await res.json()) as AthleteProfileResponse;

  const wins = fights.filter((f) => outcome(f, athlete.id) === 'win').length;
  const losses = fights.filter((f) => outcome(f, athlete.id) === 'loss').length;

  const sortedRegs = sortedDesc(
    registrations as (AthleteProfileRegistrationRow & { competitionStartDate: string })[],
    'competitionStartDate',
  );
  const sortedFights = sortedDesc(
    fights.map((f) => ({ ...f, scheduledStartTime: f.scheduledStartTime ?? '' })),
    'scheduledStartTime',
  );

  const location = [athlete.club?.city, athlete.club?.country].filter(Boolean).join(', ');
  const backHref = athlete.club?.id ? `/${locale}/clubs/${athlete.club.id}` : `/${locale}/clubs`;
  const backLabel = athlete.club ? localizedName(athlete.club.name, athlete.club.nameKa, locale) : 'Clubs';

  const athleteFullName = localizedFullName(
    athlete.firstName,
    athlete.lastName,
    athlete.firstNameKa,
    athlete.lastNameKa,
    locale,
  );
  const siteUrl = await resolveSiteUrl();
  const athleteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: athleteFullName,
    url: localeUrl(siteUrl, locale, `/athletes/${athlete.id}`),
    ...(athlete.club
      ? {
          memberOf: {
            '@type': 'SportsTeam',
            name: localizedName(athlete.club.name, athlete.club.nameKa, locale),
          },
        }
      : {}),
    knowsAbout: 'Wushu',
    nationality: athlete.club?.country ?? undefined,
  };

  return (
    <PublicLayout>
      <JsonLd data={athleteJsonLd} />
      <div className="space-y-8 py-2">

        {/* Back */}
        <Link
          href={backHref}
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
          {backLabel}
        </Link>

        {/* Header */}
        <div className="flex items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary-subtle)] text-[20px] font-bold text-[var(--color-primary)]">
            {athlete.firstName.charAt(0)}
            {athlete.lastName.charAt(0)}
          </div>
          <div className="space-y-2 pt-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">
              {localizedFullName(athlete.firstName, athlete.lastName, athlete.firstNameKa, athlete.lastNameKa, locale)}
            </h1>
            <div className="flex flex-wrap gap-2">
              {athlete.club && (
                <Link
                  href={`/${locale}/clubs/${athlete.club.id}`}
                  className="group flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[12px] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
                >
                  {/* building icon */}
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {localizedName(athlete.club.name, athlete.club.nameKa, locale)}
                </Link>
              )}
              {location && (
                <span className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[12px] text-[var(--color-text-muted)]">
                  {/* pin icon */}
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {location}
                </span>
              )}
              {athlete.sex && (
                <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[12px] text-[var(--color-text-muted)]">
                  {athlete.sex === 'MALE' ? 'Male' : 'Female'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid max-w-xs grid-cols-3 gap-3">
          <StatCard value={fights.length} label="Fights" />
          <StatCard value={`${wins}–${losses}`} label="Record" />
          <StatCard value={registrations.length} label="Events" />
        </div>

        {/* Medals */}
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Medals &amp; placements
            </h2>
            {medals.total > 0 && (
              <span className="rounded-full bg-[var(--color-medal-gold-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-medal-gold)]">
                {medals.total} {medals.total === 1 ? 'medal' : 'medals'}
              </span>
            )}
          </div>
          <div className="grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            <MedalCard tone="gold" value={medals.gold} label="Gold" />
            <MedalCard tone="silver" value={medals.silver} label="Silver" />
            <MedalCard tone="bronze" value={medals.bronze} label="Bronze" />
            <MedalCard tone="other" value={medals.other} label="Other places" />
          </div>
        </section>

        {/* Events / Registrations */}
        {sortedRegs.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Events
            </h2>
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
              {sortedRegs.map((reg, i) => (
                <Link
                  key={reg.id}
                  href={`/${locale}/events/${reg.eventSlug}`}
                  className={`group flex items-center justify-between px-4 py-3 transition-colors duration-150 hover:bg-[var(--color-surface-alt)] ${
                    i !== 0 ? 'border-t border-[var(--color-border)]' : ''
                  }`}
                >
                  <div className="min-w-0 pr-4">
                    <p className="truncate text-[14px] font-medium text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
                      {reg.eventName}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                      {fmtDate(reg.competitionStartDate, locale)}
                      {reg.ageGroupName ? ` · ${reg.ageGroupName}` : ''}
                      {reg.finalWeightCategoryName ? ` · ${reg.finalWeightCategoryName}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <LifecyclePill lifecycle={reg.eventLifecycle} />
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
              ))}
            </div>
          </section>
        )}

        {/* Fight history */}
        {sortedFights.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                Fight history
              </h2>
              <span className="rounded-full bg-[var(--color-primary-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
                {wins}W · {losses}L
              </span>
            </div>
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
              {sortedFights.map((fight, i) => {
                const result = outcome(fight, athlete.id);
                return (
                  <div
                    key={fight.id}
                    className={`flex items-center justify-between gap-4 px-4 py-3 ${
                      i !== 0 ? 'border-t border-[var(--color-border)]' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[var(--color-text)]">
                        {fight.eventName}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                        Round {fight.round}, Bout {fight.boutNo}
                        {fight.opponentName ? (
                          <> · <span>vs {fight.opponentName}</span></>
                        ) : null}
                        {fight.matName ? ` · ${fight.matName}` : ''}
                        {fight.scheduledStartTime ? ` · ${fmtDate(fight.scheduledStartTime, locale)}` : ''}
                      </p>
                    </div>
                    <OutcomePill value={result} method={fight.winMethod} />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {fights.length === 0 && registrations.length === 0 && (
          <p className="text-[14px] text-[var(--color-text-muted)]">
            No competition history yet.
          </p>
        )}

      </div>
    </PublicLayout>
  );
}
