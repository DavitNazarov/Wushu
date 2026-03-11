'use client';

import { useEffect, useState } from 'react';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { BracketRenderer } from './BracketRenderer';
import { RoundRobinPanel } from './RoundRobinPanel';
import { mapRoundsToBracketRendererData } from './bracketDisplayMapper';
import { usePublicBracketCategory, usePublicBracketOverview } from '@/hooks/useBracketData';

type Props = {
  eventSlug: string;
  tBracket: (key: string, values?: Record<string, string | number | Date>) => string;
  tCommon: (key: string, values?: Record<string, string | number | Date>) => string;
  emptyTitle: string;
  emptyDescription: string;
  getAthleteHref?: (athleteId: string) => string;
};

export function BracketViewerPanel({
  eventSlug,
  tBracket,
  tCommon,
  emptyTitle,
  emptyDescription,
  getAthleteHref,
}: Props) {
  const overviewQuery = usePublicBracketOverview(eventSlug);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  const categories = overviewQuery.data?.categories ?? [];

  useEffect(() => {
    if (!categories.length) {
      setSelectedCategoryId('');
      return;
    }
    if (!selectedCategoryId || !categories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const detailsQuery = usePublicBracketCategory({
    eventSlug,
    eventWeightCategoryId: selectedCategoryId,
  });

  if (overviewQuery.error) {
    return (
      <InlineAlert
        variant="error"
        actions={
          <button type="button" onClick={() => overviewQuery.refetch()} className="text-[13px] font-medium underline">
            {tCommon('retry')}
          </button>
        }
      >
        {tCommon('loadError')}
      </InlineAlert>
    );
  }

  if (overviewQuery.isLoading) {
    return <SkeletonRows rows={5} cols={4} />;
  }

  if (!categories.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const rendererData = mapRoundsToBracketRendererData(detailsQuery.data?.rounds ?? []);
  const isRoundRobin =
    detailsQuery.data?.category.competitionFormat === 'ROUND_ROBIN';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const selected = category.id === selectedCategoryId;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategoryId(category.id)}
              className={`rounded-[var(--radius-pill)] border px-3 py-1.5 text-[12px] transition ${
                selected
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/35'
              }`}
            >
              {category.categoryName}
            </button>
          );
        })}
      </div>

      {detailsQuery.error && (
        <InlineAlert
          variant="error"
          actions={
            <button type="button" onClick={() => detailsQuery.refetch()} className="text-[13px] font-medium underline">
              {tCommon('retry')}
            </button>
          }
        >
          {tCommon('loadError')}
        </InlineAlert>
      )}

      {detailsQuery.isLoading ? (
        <SkeletonRows rows={4} cols={4} />
      ) : (
        <>
          {detailsQuery.data && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-[12px] text-[var(--color-text-muted)]">
                {tBracket('metricAthletes')}: <span className="font-medium text-[var(--color-text)]">{detailsQuery.data.summary.totalAthletes}</span>
              </div>
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-[12px] text-[var(--color-text-muted)]">
                {tBracket('metricFights')}: <span className="font-medium text-[var(--color-text)]">{detailsQuery.data.summary.totalFights}</span>
              </div>
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-[12px] text-[var(--color-text-muted)]">
                {tBracket('metricByes')}: <span className="font-medium text-[var(--color-text)]">{detailsQuery.data.summary.byesCount}</span>
              </div>
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-[12px] text-[var(--color-text-muted)]">
                {tBracket('statsMovedUpAthletes')}: <span className="font-medium text-[var(--color-text)]">{detailsQuery.data.summary.movedUpAthletesCount}</span>
              </div>
            </div>
          )}

          {isRoundRobin ? (
            <RoundRobinPanel
              fights={detailsQuery.data?.fights ?? []}
              tBracket={tBracket}
              tFightStatus={(status) => tCommon(`fightStatus.${status}`)}
              getAthleteHref={getAthleteHref}
            />
          ) : (
            <BracketRenderer
              data={rendererData}
              tBracket={tBracket}
              tFightStatus={(status) => tCommon(`fightStatus.${status}`)}
              getAthleteHref={getAthleteHref}
            />
          )}
        </>
      )}
    </div>
  );
}
