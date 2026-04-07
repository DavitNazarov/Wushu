'use client';

import { useLocale } from 'next-intl';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Card } from '@/components/ui/primitives/card';
import { SkeletonRows } from '@/components/ui/Skeleton';
import {
  BracketRenderer,
  RoundRobinPanel,
  mapRoundsToBracketRendererData,
} from '@/components/bracket';
import type { BracketCategoryDetailsResponse } from '@/types/api';
import {
  bracketStatusBadgeClasses,
  issueSeverityClass,
} from '@/features/brackets/lib/bracketDisplayMapper';
import { BracketFightList } from './BracketFightList';
import { BracketAthleteList } from './BracketAthleteList';

type Props = {
  details: BracketCategoryDetailsResponse | null;
  isLoading: boolean;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  tFightStatus: (key: string, values?: Record<string, string | number | Date>) => string;
};

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="bg-[var(--color-surface-alt)] p-3 shadow-none">
      <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-1 text-[16px] font-semibold text-[var(--color-text)]">{value}</p>
    </Card>
  );
}

export function BracketDetailsPanel({ details, isLoading, t, tFightStatus }: Props) {
  const locale = useLocale();

  if (isLoading) {
    return (
      <Card className="space-y-3 p-4">
        <SkeletonRows rows={5} cols={4} />
      </Card>
    );
  }

  if (!details) {
    return (
      <Card className="p-6 text-[13px] text-[var(--color-text-muted)]">
        {t('selectCategoryPrompt')}
      </Card>
    );
  }

  const statusVariant =
    details.category.status === 'NEEDS_REVIEW'
      ? 'error'
      : details.category.status === 'IN_PROGRESS'
        ? 'warning'
        : 'info';
  const rendererData = mapRoundsToBracketRendererData(details.rounds);
  const isRoundRobin = details.category.competitionFormat === 'ROUND_ROBIN';

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[18px] font-semibold text-[var(--color-text)]">
            {details.category.categoryName}
          </p>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {details.category.ageGroupName}
            {details.category.division ? ` · ${details.category.division}` : ''}
          </p>
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
            {t('categoryPublicationLabel')}: {t(`publication.${details.category.publicationStatus}`)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
            {t('formatLabel')}: {t(`format.${details.category.competitionFormat}`)}
          </p>
        </div>

        <span
          className={`rounded-[var(--radius-pill)] px-2.5 py-1 text-[12px] font-semibold ${bracketStatusBadgeClasses(details.category.status)}`}
        >
          {t(`status.${details.category.status}`)}
        </span>
      </div>

      <InlineAlert variant={statusVariant}>
        <div className="space-y-1">
          <p className="text-[13px] font-semibold">{t(`status.${details.category.status}`)}</p>
          <p className="text-[12px]">
            {t('categorySummaryLine', {
              athletes: details.summary.totalAthletes,
              fights: details.summary.totalFights,
              byes: details.summary.byesCount,
              movedUp: details.summary.movedUpAthletesCount,
            })}
          </p>
        </div>
      </InlineAlert>

      {details.category.issues.length > 0 && (
        <Card className="space-y-2 bg-[var(--color-surface-alt)] p-3 shadow-none">
          <p className="text-[12px] font-semibold text-[var(--color-text)]">{t('issuesTitle')}</p>
          <div className="flex flex-wrap gap-2">
            {details.category.issues.map((issue) => (
              <span
                key={`${issue.code}-${issue.severity}`}
                className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] ${issueSeverityClass(issue)}`}
              >
                {t(`issueCode.${issue.code}`)}
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={t('metricAthletes')} value={details.summary.totalAthletes} />
        <Metric label={t('metricFights')} value={details.summary.totalFights} />
        <Metric label={t('metricByes')} value={details.summary.byesCount} />
        <Metric label={t('metricInProgress')} value={details.summary.inProgressFights} />
        <Metric label={t('metricCompleted')} value={details.summary.completedFights} />
        <Metric label={t('metricSemifinals')} value={details.summary.semifinalCount} />
        <Metric label={t('metricFinals')} value={details.summary.finalCount} />
        <Metric label={t('metricBronzePolicy')} value={t('bronzePolicyTwoBronzes')} />
      </div>

      <div className="space-y-2">
        <h3 className="text-[13px] font-semibold text-[var(--color-text)]">
          {isRoundRobin ? t('roundRobinTitle') : t('bracketViewerTitle')}
        </h3>
        {isRoundRobin ? (
          <RoundRobinPanel
            fights={details.fights}
            tBracket={t}
            tFightStatus={(status) => tFightStatus(status)}
            getAthleteHref={(athleteId) => `/${locale}/admin/athletes/${athleteId}`}
          />
        ) : (
          <BracketRenderer
            data={rendererData}
            tBracket={t}
            tFightStatus={(status) => tFightStatus(status)}
            getAthleteHref={(athleteId) => `/${locale}/admin/athletes/${athleteId}`}
          />
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-[13px] font-semibold text-[var(--color-text)]">{t('fightListTitle')}</h3>
        <BracketFightList fights={details.fights} t={t} tFightStatus={tFightStatus} />
      </div>

      <div className="space-y-2">
        <h3 className="text-[13px] font-semibold text-[var(--color-text)]">{t('athletePoolTitle')}</h3>
        <BracketAthleteList
          eligible={details.athletes.eligible}
          excluded={details.athletes.excluded}
          t={t}
        />
      </div>
    </Card>
  );
}
