'use client';

import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { getCompactErrorMessage } from '@/lib/api/error';
import { toWeighInCategoryList } from '@/lib/weighin/category';
import type {
  WeighInCategory,
  WeighInDecision,
  WeighInListEntry,
  WeighInPreviewResponse,
} from '@/types/weighin';
import { WeighInAthleteSummaryCard } from './WeighInAthleteSummaryCard';
import { WeighInCategoryInfoCard } from './WeighInCategoryInfoCard';
import { WeighInWeightInputCard } from './WeighInWeightInputCard';
import { WeighInDecisionPreview } from './WeighInDecisionPreview';
import { WeighInActionBar } from './WeighInActionBar';
import { WeighInHistoryCard } from './WeighInHistoryCard';
import { WeighInPriorAttemptStrip } from './WeighInPriorAttemptStrip';

function toCategoryList(entry: WeighInListEntry | null): WeighInCategory[] {
  return toWeighInCategoryList(entry);
}

type Props = {
  selected: WeighInListEntry | null;
  preview: WeighInPreviewResponse | null;
  previewError: unknown;
  previewLoading: boolean;
  weightInput: string;
  recordError: unknown;
  isRecordPending: boolean;
  onWeightInputChange: (value: string) => void;
  onRecord: (payload: {
    decision?: WeighInDecision;
    reason?: string;
    nextEventWeightCategoryId?: string;
  }) => void;
  isReconcilingCategory: boolean;
  onReconcileCategory: () => void;
  onOpenOverride: () => void;
  isOverrideOpen: boolean;
  t: (key: string, values?: Record<string, unknown>) => string;
  tC: (key: string) => string;
};

export function WeighInDetailsPanel({
  selected,
  preview,
  previewError,
  previewLoading,
  weightInput,
  recordError,
  isRecordPending,
  onWeightInputChange,
  onRecord,
  isReconcilingCategory,
  onReconcileCategory,
  onOpenOverride,
  isOverrideOpen,
  t,
  tC,
}: Props) {
  if (!selected) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8">
        <EmptyState
          title={t('selectAthleteTitle')}
          description={t('selectAthleteDescription')}
        />
      </div>
    );
  }

  const categories = toCategoryList(selected);
  const canPreview = weightInput.trim().length > 0;
  const hasCategoryMapping = Boolean(selected.eventWeightCategory);
  const primaryAction =
    preview?.allowedActions.find(
      (action) => action.level === 'PRIMARY' || action.level === 'DANGER',
    ) ?? null;
  const canSubmitOnEnter =
    hasCategoryMapping &&
    !previewLoading &&
    !isRecordPending &&
    !isOverrideOpen &&
    preview != null &&
    preview.recordingAllowed &&
    primaryAction?.code != null &&
    primaryAction.code !== 'SUBMIT_MANUAL_DECISION';

  return (
    <div className="space-y-3">
      {/* Missing category mapping warning */}
      {!selected.eventWeightCategory && (
        <InlineAlert
          variant="warning"
          actions={
            <button
              type="button"
              onClick={onReconcileCategory}
              disabled={isReconcilingCategory}
              className="rounded border border-amber-500/40 px-2 py-1 text-[12px] text-amber-300 disabled:opacity-60"
            >
              {isReconcilingCategory
                ? t('reconcileCategoryInProgress')
                : t('reconcileCategoryAction')}
            </button>
          }
        >
          <div className="space-y-1">
            <p>{t('missingCategoryMappingWarning')}</p>
            <p className="text-[12px] opacity-90">{t('missingCategoryMappingHelp')}</p>
          </div>
        </InlineAlert>
      )}

      {/* Unified detail card */}
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">

        {/* 1 — Athlete header */}
        <div className="rounded-t-[var(--radius-card)] border-b border-[var(--color-border)] px-4 pb-[19px] pt-[60px]">
          <WeighInAthleteSummaryCard entry={selected} t={t} />
        </div>

        {/* 2 — Category range strip */}
        <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 px-4 py-3">
          <WeighInCategoryInfoCard
            entry={selected}
            preview={preview}
            weightInput={weightInput}
            t={t}
          />
        </div>

        {/* 2.5 — Prior weigh-in glance (always visible) */}
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <WeighInPriorAttemptStrip attempts={selected.weighIns} t={t} />
        </div>

        {/* 3 — Weight input (hero) */}
        <div className="border-b border-[var(--color-border)] px-4 py-4">
          <WeighInWeightInputCard
            value={weightInput}
            onChange={onWeightInputChange}
            disabled={!hasCategoryMapping}
            onEnter={canSubmitOnEnter ? () => onRecord({}) : undefined}
            t={(key) => t(key)}
          />
        </div>

        {/* 4 — Decision preview (always visible when category mapped) */}
        {hasCategoryMapping && (
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <WeighInDecisionPreview
              preview={preview}
              isLoading={previewLoading}
              t={t}
            />
          </div>
        )}

        {/* 5 — Action buttons */}
        {hasCategoryMapping && (
          <div className="border-b border-[var(--color-border)] px-4 py-4">
            <WeighInActionBar
              preview={preview}
              categories={categories}
              isPending={isRecordPending}
              onRecord={onRecord}
              onOpenOverride={onOpenOverride}
              t={t}
            />
          </div>
        )}

        {/* 6 — Attempt history */}
        <div className="rounded-b-[var(--radius-card)] px-4 py-3">
          <WeighInHistoryCard attempts={selected.weighIns} t={t} />
        </div>
      </div>

      {/* Errors */}
      {previewError != null && canPreview && (
        <InlineAlert variant="error">
          {getCompactErrorMessage(previewError, tC('error'))}
        </InlineAlert>
      )}
      {recordError != null && (
        <InlineAlert variant="error">
          {getCompactErrorMessage(recordError, tC('error'))}
        </InlineAlert>
      )}
    </div>
  );
}
