'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/api/client';
import { localizedName } from '@/lib/bilingual';
import type { CountryDetail, ClubRow, FederationRow } from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

export default function RegionClubsPage() {
  const t = useTranslations('countries');
  const tClubs = useTranslations('clubs');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { countryId, cityId } = useParams<{ countryId: string; cityId: string }>();

  const countryQuery = useQuery({
    queryKey: ['country', countryId],
    queryFn: () => apiGet<CountryDetail>(`/api/countries/${countryId}`),
  });

  const clubsQuery = useQuery({
    queryKey: ['clubs'],
    queryFn: () => apiGet<ClubRow[]>('/api/clubs'),
  });

  const federationsQuery = useQuery({
    queryKey: ['federations', cityId],
    queryFn: () => apiGet<FederationRow[]>(`/api/federations?cityId=${cityId}`),
  });

  const city = countryQuery.data?.cities.find((r) => r.id === cityId) ?? null;
  const clubs = useMemo(
    () => (clubsQuery.data ?? []).filter((c) => c.cityId === cityId),
    [clubsQuery.data, cityId],
  );
  const federations = federationsQuery.data ?? [];

  // Group clubs under their federation; clubs with no federation are independent.
  const { byFederation, independent } = useMemo(() => {
    const grouped = new Map<string, ClubRow[]>();
    const loose: ClubRow[] = [];
    for (const club of clubs) {
      if (club.federationId) {
        const list = grouped.get(club.federationId) ?? [];
        list.push(club);
        grouped.set(club.federationId, list);
      } else {
        loose.push(club);
      }
    }
    return { byFederation: grouped, independent: loose };
  }, [clubs]);

  const countryLabel = countryQuery.data
    ? localizedName(countryQuery.data.name, countryQuery.data.nameKa, locale)
    : '';
  const regionLabel = city ? localizedName(city.name, city.nameKa, locale) : '';

  function goToClub(clubId: string) {
    router.push(`/${locale}/admin/clubs/${clubId}`);
  }

  function newClub() {
    router.push(`/${locale}/admin/clubs?countryId=${countryId}&cityId=${cityId}`);
  }

  const isLoading =
    countryQuery.isLoading || clubsQuery.isLoading || federationsQuery.isLoading;
  const error = countryQuery.error || clubsQuery.error || federationsQuery.error;

  function ClubRowItem({ club }: { club: ClubRow }) {
    return (
      <tr
        key={club.id}
        tabIndex={0}
        onClick={() => goToClub(club.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            goToClub(club.id);
          }
        }}
        className="group cursor-pointer bg-[var(--color-surface)] transition hover:bg-[var(--color-surface-alt)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-[11px] font-bold uppercase text-[var(--color-primary)] transition-transform duration-200 group-hover:scale-110">
              {localizedName(club.name, club.nameKa, locale).slice(0, 2).toUpperCase()}
            </div>
            <p className="font-medium text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
              {localizedName(club.name, club.nameKa, locale)}
            </p>
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="translate-x-0 text-[var(--color-text-muted)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)] group-hover:opacity-100">
            →
          </span>
        </td>
      </tr>
    );
  }

  function ClubTable({ rows }: { rows: ClubRow[] }) {
    return (
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
        <table className="min-w-full text-[13px]">
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.map((club) => (
              <ClubRowItem key={club.id} club={club} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1 text-[12px] text-[var(--color-text-muted)]">
        <Link href={`/${locale}/admin/countries`} className="hover:text-[var(--color-primary)] hover:underline">
          {t('backToCountries')}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/${locale}/admin/countries/${countryId}`} className="hover:text-[var(--color-primary)] hover:underline">
          {countryLabel || '…'}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-[var(--color-text)]">{regionLabel || '…'}</span>
      </nav>

      <PageHeader
        title={regionLabel || t('clubsTitle')}
        actions={<PrimaryButton onClick={newClub}>{tClubs('new')}</PrimaryButton>}
      />

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => {
            countryQuery.refetch();
            clubsQuery.refetch();
            federationsQuery.refetch();
          }}
        />
      )}

      {isLoading ? (
        <SkeletonRows rows={4} cols={2} />
      ) : clubs.length === 0 && federations.length === 0 ? (
        <EmptyState
          title={t('emptyClubsTitle')}
          description={t('emptyClubsDescription')}
          action={<PrimaryButton onClick={newClub}>{tClubs('new')}</PrimaryButton>}
        />
      ) : (
        <div className="space-y-6">
          {/* One section per federation: City → Federation → Club. */}
          {federations.map((fed) => {
            const fedClubs = byFederation.get(fed.id) ?? [];
            return (
              <section key={fed.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-[14px] font-semibold text-[var(--color-text)]">
                    {localizedName(fed.name, fed.nameKa, locale)}
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      fed.isOfficial
                        ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
                        : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    {fed.isOfficial ? tClubs('badges.official') : tClubs('badges.unofficial')}
                  </span>
                </div>
                {fedClubs.length === 0 ? (
                  <p className="px-1 text-[12px] text-[var(--color-text-muted)]">
                    {t('noClubsInFederation')}
                  </p>
                ) : (
                  <ClubTable rows={fedClubs} />
                )}
              </section>
            );
          })}

          {/* Clubs that belong directly to the city (no federation). */}
          {independent.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-[14px] font-semibold text-[var(--color-text)]">
                {federations.length > 0 ? t('independentClubs') : t('clubsTitle')}
              </h2>
              <ClubTable rows={independent} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
