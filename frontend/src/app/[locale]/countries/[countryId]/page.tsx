import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { getServerApiUrl } from '@/lib/api';
import { localizedName } from '@/lib/bilingual';

type CountryPublicDetail = {
  id: string;
  name: string;
  nameKa: string | null;
  code: string | null;
  regions: { id: string; name: string; nameKa: string | null; clubCount: number }[];
  clubs: {
    id: string;
    name: string;
    nameKa: string | null;
    city: string | null;
    region: { id: string; name: string; nameKa: string | null } | null;
  }[];
};

type Props = {
  params: Promise<{ countryId: string }>;
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default async function PublicCountryPage({ params }: Props) {
  const { countryId } = await params;
  const tPublic = await getTranslations('public');
  const locale = await getLocale();

  const url = await getServerApiUrl(`/api/public/countries/${countryId}`);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) notFound();

  const country = (await res.json()) as CountryPublicDetail;
  const displayName = localizedName(country.name, country.nameKa, locale);

  return (
    <PublicLayout>
      <div className="space-y-8 py-2">

        {/* Back link */}
        <Link
          href={`/${locale}/countries`}
          className="group inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          <svg className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {tPublic('countriesTitle')}
        </Link>

        {/* Country header */}
        <div className="flex items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary-subtle)] text-[15px] font-bold uppercase text-[var(--color-primary)]">
            {country.code ?? displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="pt-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">
              {displayName}
            </h1>
            {country.code && (
              <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">ISO: {country.code}</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <StatCard value={country.regions.length} label={tPublic('countryRegions')} />
          <StatCard value={country.clubs.length} label={tPublic('countryClubs')} />
        </div>

        {/* Regions */}
        {country.regions.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              {tPublic('countryRegions')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {country.regions.map((region) => {
                const regionName = localizedName(region.name, region.nameKa, locale);
                return (
                  <div
                    key={region.id}
                    className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5"
                  >
                    <span className="text-[13px] text-[var(--color-text)]">{regionName}</span>
                    {region.clubCount > 0 && (
                      <span className="rounded-full bg-[var(--color-surface-alt)] px-1.5 py-0.5 text-[11px] tabular-nums text-[var(--color-text-muted)]">
                        {region.clubCount}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Clubs */}
        {country.clubs.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              {tPublic('countryClubs')} <span className="ml-1 font-normal normal-case tracking-normal">({country.clubs.length})</span>
            </h2>
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
              {country.clubs.map((club, i) => {
                const clubName = localizedName(club.name, club.nameKa, locale);
                const regionName = club.region
                  ? localizedName(club.region.name, club.region.nameKa, locale)
                  : null;
                return (
                  <Link
                    key={club.id}
                    href={`/${locale}/clubs/${club.id}`}
                    className={`group flex items-center justify-between px-4 py-3 transition-colors duration-150 hover:bg-[var(--color-surface-alt)] ${
                      i !== 0 ? 'border-t border-[var(--color-border)]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-surface-alt)] text-[10px] font-semibold text-[var(--color-text-muted)] transition-colors group-hover:bg-[var(--color-primary-subtle)] group-hover:text-[var(--color-primary)]">
                        {initials(clubName)}
                      </div>
                      <div>
                        <span className="text-[14px] text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
                          {clubName}
                        </span>
                        {(club.city || regionName) && (
                          <p className="text-[12px] text-[var(--color-text-muted)]">
                            {[club.city, regionName].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <svg
                      className="h-3.5 w-3.5 text-[var(--color-text-muted)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-[var(--color-primary)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {country.clubs.length === 0 && country.regions.length === 0 && (
          <p className="text-[14px] text-[var(--color-text-muted)]">No regions or clubs registered yet.</p>
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
