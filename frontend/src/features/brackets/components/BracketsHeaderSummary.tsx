'use client';

import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/primitives/button';
import { Card } from '@/components/ui/primitives/card';
import type { BracketsOverviewResponse } from '@/types/api';
import { formatDateTime } from '@/features/brackets/lib/dateFormat';

type Props = {
  overview: BracketsOverviewResponse;
  generatePending: boolean;
  publishPending: boolean;
  regeneratePending: boolean;
  exportPending: boolean;
  onGenerate: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onRegenerate: () => void;
  onExport: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="bg-[var(--color-surface-alt)] p-3 shadow-none">
      <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-1 text-[18px] font-semibold text-[var(--color-text)]">{value}</p>
    </Card>
  );
}

export function BracketsHeaderSummary({
  overview,
  generatePending,
  publishPending,
  regeneratePending,
  exportPending,
  onGenerate,
  onPublish,
  onUnpublish,
  onRegenerate,
  onExport,
  t,
}: Props) {
  const locale = useLocale();
  const hasBrackets = overview.summary.categoriesWithBrackets > 0;
  const publishBlockedReason = overview.event.published
    ? overview.actions.unpublishBlockedReasonCode
    : overview.actions.publishBlockedReasonCode;

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] text-[var(--color-text-muted)]">
            {t('eventLabel')}:{' '}
            <span className="font-medium text-[var(--color-text)]">{overview.event.name}</span>
          </p>
          <p className="text-[13px] text-[var(--color-text-muted)]">
            {t('eventStatusLabel')}:{' '}
            <span className="font-medium text-[var(--color-text)]">
              {t(`status.${overview.event.drawStatus}`)}
            </span>
          </p>
          <p className="text-[13px] text-[var(--color-text-muted)]">
            {t('lastUpdatedLabel')}:{' '}
            <span className="font-medium text-[var(--color-text)]">
              {overview.lastUpdated.at
                ? formatDateTime(locale, overview.lastUpdated.at) ?? t('valueUnavailable')
                : t('neverUpdated')}
            </span>
          </p>
          <p className="text-[13px] text-[var(--color-text-muted)]">
            {t('updatedByLabel')}:{' '}
            <span className="font-medium text-[var(--color-text)]">
              {overview.lastUpdated.by?.displayName ?? t('unknownUser')}
            </span>
          </p>
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-none xl:flex xl:flex-wrap">
          {!hasBrackets ? (
            <Button
              onClick={onGenerate}
              disabled={!overview.actions.canGenerate || generatePending}
              className="w-full xl:w-auto"
            >
              {generatePending ? t('actionGenerating') : t('actionGenerate')}
            </Button>
          ) : (
            <>
              {overview.event.published ? (
                <Button
                  onClick={onUnpublish}
                  disabled={!overview.actions.canUnpublish || publishPending}
                  className="w-full bg-[var(--color-danger)] hover:bg-[var(--color-danger)]/90 xl:w-auto"
                >
                  {publishPending ? t('actionUnpublishing') : t('actionUnpublish')}
                </Button>
              ) : (
                <Button
                  onClick={onPublish}
                  disabled={!overview.actions.canPublish || publishPending}
                  className="w-full xl:w-auto"
                >
                  {publishPending ? t('actionPublishing') : t('actionPublish')}
                </Button>
              )}

              <Button
                variant="secondary"
                onClick={onExport}
                disabled={!overview.actions.canExport || exportPending}
                className="w-full xl:w-auto"
              >
                {exportPending ? t('actionExporting') : t('actionExport')}
              </Button>

              <Button
                variant="secondary"
                onClick={onRegenerate}
                disabled={regeneratePending}
                className="w-full border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 xl:w-auto"
              >
                {regeneratePending ? t('actionRegenerating') : t('actionRegenerate')}
              </Button>
            </>
          )}
        </div>
      </div>

      {!hasBrackets && overview.actions.generateBlockedReasonCode && (
        <p className="text-[12px] text-amber-300">
          {t(`blockReason.${overview.actions.generateBlockedReasonCode}`)}
        </p>
      )}

      {hasBrackets && publishBlockedReason && (
        <p className="text-[12px] text-amber-300">
          {t(`blockReason.${publishBlockedReason}`)}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t('statsCategoriesWithBrackets')}
          value={overview.summary.categoriesWithBrackets}
        />
        <StatTile
          label={t('statsPublishedCategories')}
          value={overview.summary.publishedCategoriesCount}
        />
        <StatTile
          label={t('statsUnpublishedCategories')}
          value={overview.summary.unpublishedCategoriesCount}
        />
        <StatTile
          label={t('statsAthletesInBrackets')}
          value={overview.summary.totalAthletesInBrackets}
        />
        <StatTile label={t('statsTotalByes')} value={overview.summary.totalByes} />
        <StatTile
          label={t('statsMovedUpAthletes')}
          value={overview.summary.movedUpAthletesCount}
        />
        <StatTile
          label={t('statsNeedsReview')}
          value={overview.summary.needsReviewCategoriesCount}
        />
        <StatTile label={t('statsTotalCategories')} value={overview.summary.totalCategories} />
      </div>
    </Card>
  );
}
