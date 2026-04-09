'use client';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { ApiError } from '@/lib/api/client';
import { useClubDetails } from '@/hooks/useClubDetails';
import { ClubProfileAthletes } from './ClubProfileAthletes';
import { ClubProfileCoaches } from './ClubProfileCoaches';
import { ClubProfileInfo } from './ClubProfileInfo';
import { ClubProfileOverview } from './ClubProfileOverview';
import { ClubProfileRelatedAccounts } from './ClubProfileRelatedAccounts';

type Props = { clubId: string };

function ClubSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-48 rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="h-64 rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
          <div className="h-48 rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
        </div>
        <div className="h-96 rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
      </div>
    </div>
  );
}

export function ClubProfilePage({ clubId }: Props) {
  const t = useTranslations('clubs.detail');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const query = useClubDetails(clubId);

  if (query.error instanceof ApiError && query.error.status === 404) {
    notFound();
  }

  return (
    <div className="space-y-5">
      {/* Back link */}
      <motion.div
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Link
          href={`/${locale}/admin/clubs`}
          className="group inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          {tCommon('back')}
        </Link>
      </motion.div>

      {query.error && !(query.error instanceof ApiError && query.error.status === 404) ? (
        <AdminErrorAlert
          error={query.error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => query.refetch()}
        />
      ) : null}

      {query.isLoading ? (
        <ClubSkeleton />
      ) : query.data ? (
        <motion.div
          className="space-y-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <ClubProfileOverview club={query.data.club} overview={query.data.overview} />

          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-5">
              <ClubProfileInfo club={query.data.club} overview={query.data.overview} />
              <ClubProfileCoaches coaches={query.data.coaches} />
              <ClubProfileRelatedAccounts relatedAccounts={query.data.relatedAccounts} />
            </div>
            <ClubProfileAthletes athletes={query.data.athletes} />
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
