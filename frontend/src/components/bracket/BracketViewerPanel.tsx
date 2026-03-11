'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { BracketRenderer } from './BracketRenderer';
import { RoundRobinPanel } from './RoundRobinPanel';
import { mapRoundsToBracketRendererData } from './bracketDisplayMapper';
import { usePublicBracketCategory, usePublicBracketOverview } from '@/hooks/useBracketData';
import type { AthleteSex, BracketsOverviewCategoryRow, CompetitionFormat } from '@/types/api';

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
  const tPublic = useTranslations('public');
  const overviewQuery = usePublicBracketOverview(eventSlug);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  const categories = useMemo(() => overviewQuery.data?.categories ?? [], [overviewQuery.data?.categories]);

  const ageGroups = useMemo(
    () => Array.from(new Set(categories.map((category) => category.ageGroupName))).sort(),
    [categories],
  );
  const divisions = useMemo(
    () =>
      Array.from(new Set(categories.map((category) => category.division ?? 'OPEN'))) as Array<
        AthleteSex | 'OPEN'
      >,
    [categories],
  );
  const formats = useMemo(
    () => Array.from(new Set(categories.map((category) => category.competitionFormat))) as CompetitionFormat[],
    [categories],
  );
  const categoryOptions = useMemo(
    () =>
      categories.filter((category) => {
        if (selectedAgeGroup && category.ageGroupName !== selectedAgeGroup) return false;
        if (selectedDivision && (category.division ?? 'OPEN') !== selectedDivision) return false;
        if (selectedFormat && category.competitionFormat !== selectedFormat) return false;
        return true;
      }),
    [categories, selectedAgeGroup, selectedDivision, selectedFormat],
  );

  const activeCategoryId =
    selectedCategoryId && categoryOptions.some((category) => category.id === selectedCategoryId)
      ? selectedCategoryId
      : '';

  const detailsQuery = usePublicBracketCategory({
    eventSlug,
    eventWeightCategoryId: activeCategoryId,
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
  const isRoundRobin = detailsQuery.data?.category.competitionFormat === 'ROUND_ROBIN';

  function divisionLabel(value: AthleteSex | 'OPEN') {
    if (value === 'OPEN') return tPublic('bracketDivisionOpen');
    return tPublic(`bracketDivision${value === 'MALE' ? 'Male' : 'Female'}`);
  }

  function categoryLabel(category: BracketsOverviewCategoryRow) {
    return `${category.ageGroupName} · ${divisionLabel(category.division ?? 'OPEN')} · ${category.categoryName}`;
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-4 bg-[var(--color-surface-alt)]/40">
        <div>
          <h3 className="text-[15px] font-semibold text-[var(--color-text)]">
            {tPublic('bracketFiltersTitle')}
          </h3>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {tPublic('bracketFiltersBody')}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1">
            <span className="text-[12px] font-medium text-[var(--color-text-muted)]">
              {tPublic('bracketFilterAgeGroup')}
            </span>
            <select
              value={selectedAgeGroup}
              onChange={(event) => setSelectedAgeGroup(event.target.value)}
              className="h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            >
              <option value="">{tPublic('bracketFilterAll')}</option>
              {ageGroups.map((ageGroup) => (
                <option key={ageGroup} value={ageGroup}>
                  {ageGroup}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[12px] font-medium text-[var(--color-text-muted)]">
              {tPublic('bracketFilterDivision')}
            </span>
            <select
              value={selectedDivision}
              onChange={(event) => setSelectedDivision(event.target.value)}
              className="h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            >
              <option value="">{tPublic('bracketFilterAll')}</option>
              {divisions.map((division) => (
                <option key={division} value={division}>
                  {divisionLabel(division)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[12px] font-medium text-[var(--color-text-muted)]">
              {tPublic('bracketFilterFormat')}
            </span>
            <select
              value={selectedFormat}
              onChange={(event) => setSelectedFormat(event.target.value)}
              className="h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            >
              <option value="">{tPublic('bracketFilterAll')}</option>
              {formats.map((format) => (
                <option key={format} value={format}>
                  {tBracket(`format.${format}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[12px] font-medium text-[var(--color-text-muted)]">
              {tPublic('bracketFilterCategory')}
            </span>
            <select
              value={activeCategoryId}
              onChange={(event) => setSelectedCategoryId(event.target.value)}
              className="h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            >
              <option value="">{tPublic('bracketFilterSelectCategory')}</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {!categoryOptions.length && (
        <EmptyState
          title={tPublic('bracketFiltersNoMatchTitle')}
          description={tPublic('bracketFiltersNoMatchBody')}
        />
      )}

      {categoryOptions.length > 0 && !activeCategoryId && (
        <EmptyState
          title={tPublic('bracketFilterSelectTitle')}
          description={tPublic('bracketFilterSelectBody')}
        />
      )}

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

      {activeCategoryId && detailsQuery.isLoading ? (
        <SkeletonRows rows={4} cols={4} />
      ) : activeCategoryId ? (
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
      ) : null}
      {activeCategoryId && !detailsQuery.isLoading && !detailsQuery.data && (
        <EmptyState
          title={tPublic('bracketFilterUnavailableTitle')}
          description={tPublic('bracketFilterUnavailableBody')}
        />
      )}
    </div>
  );
}
