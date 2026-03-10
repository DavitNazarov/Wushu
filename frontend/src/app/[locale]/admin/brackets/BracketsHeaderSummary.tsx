'use client';

import { RefreshCw } from 'lucide-react';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import type { BracketsOverviewResponse } from '@/types/api';
import { formatDateTime } from './dateFormat';

type Props = {
  overview: BracketsOverviewResponse;
  publishPending: boolean;
  regeneratePending: boolean;
  exportPending: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onRegenerate: () => void;
  onExport: () => void;
  onRefresh: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-1 text-[18px] font-semibold text-[var(--color-text)]">{value}</p>
    </div>
  );
}

export function BracketsHeaderSummary({
  overview,
  publishPending,
  regeneratePending,
  exportPending,
  onPublish,
  onUnpublish,
  onRegenerate,
  onExport,
  onRefresh,
  t,
}: Props) {
  const publishBlockedReason = overview.event.published
    ? overview.actions.unpublishBlockedReasonCode
    : overview.actions.publishBlockedReasonCode;

  return (
    <section className="space-y-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
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
                ? formatDateTime(overview.lastUpdated.at)
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

        <div className="flex flex-wrap gap-2">
          {overview.event.published ? (
            <PrimaryButton
              onClick={onUnpublish}
              disabled={!overview.actions.canUnpublish || publishPending}
              className="!bg-[var(--color-danger)] hover:!opacity-90"
            >
              {publishPending ? t('actionUnpublishing') : t('actionUnpublish')}
            </PrimaryButton>
          ) : (
            <PrimaryButton
              onClick={onPublish}
              disabled={!overview.actions.canPublish || publishPending}
            >
              {publishPending ? t('actionPublishing') : t('actionPublish')}
            </PrimaryButton>
          )}

          <SecondaryButton onClick={onExport} disabled={!overview.actions.canExport || exportPending}>
            {exportPending ? t('actionExporting') : t('actionExport')}
          </SecondaryButton>

          <SecondaryButton
            onClick={onRegenerate}
            disabled={overview.summary.categoriesWithBrackets <= 0 || regeneratePending}
            className="border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
          >
            {regeneratePending ? t('actionRegenerating') : t('actionRegenerate')}
          </SecondaryButton>

          <SecondaryButton onClick={onRefresh}>
            <RefreshCw className="mr-1 h-4 w-4" />
            {t('actionRefresh')}
          </SecondaryButton>

          <a
            href="#bracket-audit"
            className="inline-flex h-11 items-center justify-center rounded-[var(--radius-input)] border border-[var(--color-border)] px-4 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface-alt)]"
          >
            {t('actionViewAudit')}
          </a>
        </div>
      </div>

      {publishBlockedReason && (
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
    </section>
  );
}
