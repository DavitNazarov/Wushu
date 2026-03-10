'use client';

import Link from 'next/link';
import type { DrawOverviewResponse } from '@/types/api';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { statusBadgeClasses } from './drawReadinessMapper';

type Props = {
  locale: string;
  overview: DrawOverviewResponse;
  generating: boolean;
  regenerating: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex min-h-[44px] min-w-[150px] shrink-0 items-center justify-between gap-3 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-1.5">
      <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="text-[15px] font-semibold text-[var(--color-text)]">{value}</p>
    </div>
  );
}

export function DrawHeaderSummary({
  locale,
  overview,
  generating,
  regenerating,
  onGenerate,
  onRegenerate,
  t,
}: Props) {
  const drawStatusKey = `drawStatus.${overview.event.drawStatus}`;
  const lastGeneratedAt = overview.lastGeneration.at
    ? new Date(overview.lastGeneration.at).toLocaleString()
    : t('neverGenerated');

  const actionBlockedReason =
    overview.event.drawStatus === 'NOT_GENERATED'
      ? overview.actions.generateBlockedReasonCode
      : overview.actions.regenerateBlockedReasonCode;

  return (
    <section className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-[13px] text-[var(--color-text-muted)]">
            {t('eventLabel')}: <span className="font-medium text-[var(--color-text)]">{overview.event.name}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
            <span>{t('drawStatusLabel')}:</span>
            <span className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClasses(overview.event.drawStatus === 'NOT_GENERATED' ? 'EMPTY' : overview.event.drawStatus === 'PUBLISHED' ? 'DRAWN' : 'READY')}`}>
              {t(drawStatusKey)}
            </span>
            <span>{t('lastGeneratedAtLabel')}: <span className="text-[var(--color-text)]">{lastGeneratedAt}</span></span>
            <span>
              {t('lastGeneratedByLabel')}: <span className="text-[var(--color-text)]">{overview.lastGeneration.by?.displayName ?? t('unknownUser')}</span>
            </span>
          </div>
        </div>

        <div className="hidden flex-wrap gap-2 md:flex">
          {overview.event.drawStatus === 'NOT_GENERATED' ? (
            <PrimaryButton
              onClick={onGenerate}
              disabled={!overview.actions.canGenerate || generating}
            >
              {generating ? t('actionGenerating') : t('actionGenerate')}
            </PrimaryButton>
          ) : (
            <PrimaryButton
              onClick={onRegenerate}
              disabled={!overview.actions.canRegenerate || regenerating}
              className="!bg-[var(--color-danger)] hover:!opacity-90"
            >
              {regenerating ? t('actionRegenerating') : t('actionRegenerate')}
            </PrimaryButton>
          )}
          <Link
            href={`/${locale}/admin/brackets`}
            className="inline-flex h-11 items-center justify-center rounded-[var(--radius-input)] border border-[var(--color-border)] bg-transparent px-4 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface-alt)]"
          >
            {t('actionViewBrackets')}
          </Link>
        </div>
      </div>

      {actionBlockedReason && (
        <p className="text-[12px] text-amber-300">{t(`blockReason.${actionBlockedReason}`)}</p>
      )}

      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <StatTile
          label={t('statsEligibleAthletes')}
          value={overview.summary.eligibleAthletesCount}
        />
        <StatTile
          label={t('statsReadyCategories')}
          value={overview.summary.readyCategoriesCount}
        />
        <StatTile
          label={t('statsBlockedCategories')}
          value={overview.summary.blockedCategoriesCount}
        />
        <StatTile
          label={t('statsDrawnCategories')}
          value={overview.summary.drawnCategoriesCount}
        />
        <StatTile
          label={t('statsMovedUpAthletes')}
          value={overview.summary.movedUpAthletesCount}
        />
        <StatTile
          label={t('statsNeedsReview')}
          value={overview.summary.needsReviewCategoriesCount}
        />
        <StatTile
          label={t('statsOutstandingIssues')}
          value={overview.summary.outstandingIssuesCount}
        />
        <StatTile
          label={t('statsTotalCategories')}
          value={overview.summary.totalCategories}
        />
      </div>
    </section>
  );
}
