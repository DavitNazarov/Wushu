'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { usePublicResults } from '@/hooks/usePublicApi';
import { useRealtimeQuerySync } from '@/hooks/useRealtimeQuerySync';
import { PublicClubStandings } from './PublicClubStandings';
import { PublicResultsCategory } from './PublicResultsCategory';
import { PublicResultsViewToggle } from './PublicResultsViewToggle';

type Props = {
  eventSlug: string;
};

type ResultsView = 'categories' | 'clubs';

export function PublicResultsPanel({ eventSlug }: Props) {
  const tPublic = useTranslations('public');
  const tCommon = useTranslations('common');
  const { data, isLoading, error, refetch } = usePublicResults(eventSlug);
  const [view, setView] = useState<ResultsView>('categories');

  useRealtimeQuerySync({
    scope: 'public-results',
    eventId: data?.eventId ?? null,
    enabled: !!data?.eventId,
    queryKeys: [['public', 'results', eventSlug]],
  });

  if (error) {
    return (
      <InlineAlert
        variant="error"
        actions={
          <button onClick={() => refetch()} className="text-[13px] font-medium underline">
            {tCommon('retry')}
          </button>
        }
      >
        {tCommon('loadError')}
      </InlineAlert>
    );
  }

  if (isLoading) {
    return <SkeletonRows rows={4} cols={1} />;
  }

  if (!data || data.categories.length === 0) {
    return (
      <Card>
        <EmptyState
          title={tPublic('resultsEmptyTitle')}
          description={tPublic('resultsEmptyDescription')}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PublicResultsViewToggle value={view} onChange={setView} t={tPublic} />

      {view === 'categories' ? (
        data.categories.map((category, index) => (
          <PublicResultsCategory
            key={`${category.categoryCode}:${category.categoryName}`}
            category={category}
            defaultOpen={index === 0}
            t={tPublic}
          />
        ))
      ) : (
        <PublicClubStandings clubs={data.clubs} t={tPublic} />
      )}
    </div>
  );
}
