'use client';

import { notFound, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { ApiError, apiGet } from '@/lib/api/client';
import type { AthleteProfileResponse } from '@/types/api';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { AthleteProfileActions } from './AthleteProfileActions';
import { AthleteProfileCompetition } from './AthleteProfileCompetition';
import { AthleteProfileIdentity } from './AthleteProfileIdentity';
import { AthleteProfileOverview } from './AthleteProfileOverview';
import { AthleteProfileRegistrations } from './AthleteProfileRegistrations';

type Props = {
  athleteId: string;
  scope: 'admin' | 'coach' | 'public';
};

function endpointForScope(scope: Props['scope'], athleteId: string): string {
  return scope === 'public' ? `/api/public/athletes/${athleteId}` : `/api/athletes/${athleteId}`;
}

function backHref(scope: Props['scope'], locale: string): string {
  if (scope === 'admin') return `/${locale}/admin/athletes`;
  if (scope === 'coach') return `/${locale}/coach/athletes`;
  return `/${locale}/events`;
}

function BackLabel({ scope }: { scope: Props['scope'] }) {
  const t = useTranslations('athleteProfile');
  return <>{t(`backLabel.${scope}`)}</>;
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-52 rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_360px]">
        <div className="space-y-4">
          <div className="h-36 rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
          <div className="h-48 rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
        </div>
        <div className="space-y-4">
          <div className="h-56 rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
          <div className="h-32 rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
        </div>
      </div>
    </div>
  );
}

export function AthleteProfilePage({ athleteId, scope }: Props) {
  const t = useTranslations('athleteProfile');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();

  const query = useQuery({
    queryKey: ['athlete-profile', scope, athleteId],
    queryFn: () => apiGet<AthleteProfileResponse>(endpointForScope(scope, athleteId)),
    enabled: Boolean(athleteId),
  });

  if (query.error instanceof ApiError && query.error.status === 404) {
    notFound();
  }

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <motion.button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        <ArrowLeft className="h-4 w-4" />
        <BackLabel scope={scope} />
      </motion.button>

      {query.error && !(query.error instanceof ApiError && query.error.status === 404) && (
        <InlineAlert
          variant="error"
          actions={
            <button type="button" onClick={() => query.refetch()} className="text-[13px] font-medium underline">
              {tCommon('retry')}
            </button>
          }
        >
          {tCommon('loadError')}
        </InlineAlert>
      )}

      {query.isLoading ? (
        <ProfileSkeleton />
      ) : query.data ? (
        <motion.div
          className="space-y-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <AthleteProfileOverview
            athlete={query.data.athlete}
            registrations={query.data.registrations}
            fights={query.data.fights}
            scope={scope}
          />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_360px]">
            <div className="space-y-5">
              <AthleteProfileRegistrations registrations={query.data.registrations} scope={scope} />
              <AthleteProfileCompetition athleteId={query.data.athlete.id} fights={query.data.fights} scope={scope} />
            </div>
            <div className="space-y-5">
              <AthleteProfileIdentity athlete={query.data.athlete} scope={scope} />
              {scope !== 'public' && <AthleteProfileActions scope={scope} registrations={query.data.registrations} />}
            </div>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
