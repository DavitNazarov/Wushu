import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { getServerApiUrl } from '@/lib/api';
import { localizedName } from '@/lib/bilingual';

type CountryRow = {
  id: string;
  name: string;
  nameKa: string | null;
  code: string | null;
  regionCount: number;
  clubCount: number;
};

const ACCENTS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#f97316', '#a855f7'];

export default async function CountriesPage() {
  const tPublic = await getTranslations('public');
  const locale = await getLocale();

  const url = await getServerApiUrl('/api/public/countries');
  const res = await fetch(url, { next: { revalidate: 30 } });
  const countries = (res.ok ? ((await res.json()) as CountryRow[]) : []) ?? [];

  return (
    <PublicLayout>
      <div className="space-y-16 pb-16">

        {/* hero */}
        <section className="relative flex flex-col items-center py-16 text-center">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[360px] w-[360px] rounded-full bg-[var(--color-primary)] opacity-[0.06] blur-[90px]" />
          </div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">Geography</p>
          <h1 className="max-w-[560px] text-[clamp(2rem,5vw,3.2rem)] font-extrabold leading-[1.1] tracking-tight text-[var(--color-text)]">
            {tPublic('countriesTitle')}
          </h1>
          <p className="mt-4 max-w-[420px] text-[15px] leading-relaxed text-[var(--color-text-muted)]">
            {tPublic('countriesSubtitle')}
          </p>
          {countries.length > 0 && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-1.5">
              <span className="text-[13px] font-semibold text-[var(--color-text)]">{countries.length}</span>
              <span className="text-[12px] text-[var(--color-text-muted)]">countries registered</span>
            </div>
          )}
        </section>

        {countries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] py-24 text-center">
            <p className="text-[15px] font-medium text-[var(--color-text-muted)]">No countries yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {countries.map((country, i) => {
              const accent = ACCENTS[i % ACCENTS.length];
              const displayName = localizedName(country.name, country.nameKa, locale);
              return (
                <Link
                  key={country.id}
                  href={`/${locale}/countries/${country.id}`}
                  className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 transition-all duration-200 hover:border-transparent hover:shadow-[0_4px_24px_rgba(0,0,0,0.15)]"
                >
                  {/* corner glow on hover */}
                  <div
                    className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-25"
                    style={{ background: accent }}
                  />
                  {/* flag / code badge */}
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold uppercase transition-transform duration-200 group-hover:scale-105"
                    style={{ background: `${accent}18`, color: accent }}
                  >
                    {country.code ?? displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
                      {displayName}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                      {country.regionCount} {tPublic('countryRegions').toLowerCase()} · {country.clubCount} {tPublic('countryClubs').toLowerCase()}
                    </p>
                  </div>
                  <svg className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </PublicLayout>
  );
}
