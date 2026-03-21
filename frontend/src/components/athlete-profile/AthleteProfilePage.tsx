'use client';

import { notFound } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ApiError, apiGet } from '@/lib/api/client';
import type { AthleteProfileResponse } from '@/types/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { SkeletonRows } from '@/components/ui/Skeleton';
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

export function AthleteProfilePage({ athleteId, scope }: Props) {
  const t = useTranslations('athleteProfile');
  const tCommon = useTranslations('common');

  const query = useQuery({
    queryKey: ['athlete-profile', scope, athleteId],
    queryFn: () => apiGet<AthleteProfileResponse>(endpointForScope(scope, athleteId)),
    enabled: Boolean(athleteId),
  });

  if (query.error instanceof ApiError && query.error.status === 404) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader title={query.data?.athlete.fullName ?? t('title')} subtitle={t(`subtitle.${scope}`)} />

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
        <div className="space-y-6">
          <SkeletonRows rows={4} cols={2} />
          <SkeletonRows rows={4} cols={3} />
        </div>
      ) : query.data ? (
        <div className="space-y-6">
          <AthleteProfileOverview
            athlete={query.data.athlete}
            registrations={query.data.registrations}
            fights={query.data.fights}
            scope={scope}
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_360px]">
            <div className="space-y-6">
              <AthleteProfileRegistrations registrations={query.data.registrations} scope={scope} />
              <AthleteProfileCompetition athleteId={query.data.athlete.id} fights={query.data.fights} scope={scope} />
            </div>
            <div className="space-y-6">
              <AthleteProfileIdentity athlete={query.data.athlete} scope={scope} />
              {scope !== 'public' && <AthleteProfileActions scope={scope} registrations={query.data.registrations} />}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
