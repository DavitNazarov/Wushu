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
import type { CountryDetail, ClubRow } from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

export default function RegionClubsPage() {
  const t = useTranslations('countries');
  const tClubs = useTranslations('clubs');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { countryId, regionId } = useParams<{ countryId: string; regionId: string }>();

  const countryQuery = useQuery({
    queryKey: ['country', countryId],
    queryFn: () => apiGet<CountryDetail>(`/api/countries/${countryId}`),
  });

  const clubsQuery = useQuery({
    queryKey: ['clubs'],
    queryFn: () => apiGet<ClubRow[]>('/api/clubs'),
  });

  const region = countryQuery.data?.regions.find((r) => r.id === regionId) ?? null;
  const clubs = useMemo(
    () => (clubsQuery.data ?? []).filter((c) => c.regionId === regionId),
    [clubsQuery.data, regionId],
  );

  const countryLabel = countryQuery.data
    ? localizedName(countryQuery.data.name, countryQuery.data.nameKa, locale)
    : '';
  const regionLabel = region ? localizedName(region.name, region.nameKa, locale) : '';

  function goToClub(clubId: string) {
    router.push(`/${locale}/admin/clubs/${clubId}`);
  }

  function newClub() {
    router.push(`/${locale}/admin/clubs?countryId=${countryId}&regionId=${regionId}`);
  }

  const isLoading = countryQuery.isLoading || clubsQuery.isLoading;
  const error = countryQuery.error || clubsQuery.error;

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
          }}
        />
      )}

      {isLoading ? (
        <SkeletonRows rows={4} cols={2} />
      ) : clubs.length === 0 ? (
        <EmptyState
          title={t('emptyClubsTitle')}
          description={t('emptyClubsDescription')}
          action={<PrimaryButton onClick={newClub}>{tClubs('new')}</PrimaryButton>}
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
          <table className="min-w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--color-surface-alt)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('clubsTitle')}</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{tCommon('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {clubs.map((club) => (
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
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">{localizedName(club.name, club.nameKa, locale)}</p>
                        {club.city && <p className="text-[12px] text-[var(--color-text-muted)]">{club.city}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="translate-x-0 text-[var(--color-text-muted)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)] group-hover:opacity-100">→</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
