'use client';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { ApiError } from '@/lib/api/client';
import { useClubDetails } from '@/hooks/useClubDetails';
import { formatClubDate, formatClubLocation } from './clubProfile.utils';
import { ClubProfileAthletes } from './ClubProfileAthletes';
import { ClubProfileCoaches } from './ClubProfileCoaches';
import { ClubProfileInfo } from './ClubProfileInfo';
import { ClubProfileOverview } from './ClubProfileOverview';
import { ClubProfileRelatedAccounts } from './ClubProfileRelatedAccounts';

type Props = {
  clubId: string;
};

export function ClubProfilePage({ clubId }: Props) {
  const t = useTranslations('clubs.detail');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const query = useClubDetails(clubId);

  if (query.error instanceof ApiError && query.error.status === 404) {
    notFound();
  }

  const metadata = query.data
    ? [
        formatClubLocation(
          query.data.club.city,
          query.data.club.country,
          t('locationMissing'),
        ),
        formatClubDate(query.data.club.createdAt, locale),
      ].join(' · ')
    : t('subtitle');

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${locale}/admin/clubs`}
          className="mb-2 inline-flex text-[12px] text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
        >
          ← {tCommon('back')}
        </Link>
        <PageHeader
          title={query.data?.club.name ?? t('title')}
          subtitle={metadata}
        />
      </div>

      {query.error &&
      !(query.error instanceof ApiError && query.error.status === 404) ? (
        <AdminErrorAlert
          error={query.error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => query.refetch()}
        />
      ) : null}

      {query.isLoading ? (
        <div className="space-y-6">
          <SkeletonRows rows={2} cols={4} />
          <SkeletonRows rows={5} cols={6} />
        </div>
      ) : query.data ? (
        <div className="space-y-6">
          <ClubProfileOverview
            club={query.data.club}
            overview={query.data.overview}
          />

          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-6">
              <ClubProfileInfo
                club={query.data.club}
                overview={query.data.overview}
              />
              <ClubProfileCoaches coaches={query.data.coaches} />
              <ClubProfileRelatedAccounts
                relatedAccounts={query.data.relatedAccounts}
              />
            </div>
            <ClubProfileAthletes athletes={query.data.athletes} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
