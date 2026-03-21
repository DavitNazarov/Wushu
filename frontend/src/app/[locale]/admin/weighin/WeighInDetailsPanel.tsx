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
  t,
  tC,
}: Props) {
  if (!selected) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
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

  return (
    <div className="space-y-3">
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
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="border-b border-[var(--color-border)] p-3">
          <WeighInAthleteSummaryCard entry={selected} preview={preview} t={t} />
        </div>
        <div className="border-b border-[var(--color-border)] p-3">
          <WeighInCategoryInfoCard
            entry={selected}
            preview={preview}
            weightInput={weightInput}
            t={t}
          />
        </div>
        <div className="border-b border-[var(--color-border)] p-3">
          <WeighInWeightInputCard
            value={weightInput}
            onChange={onWeightInputChange}
            disabled={!hasCategoryMapping}
            t={(key) => t(key)}
          />
          {hasCategoryMapping && (
            <div className="mt-3">
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
        </div>
        {hasCategoryMapping && (
          <div className="border-b border-[var(--color-border)] p-3">
            <WeighInDecisionPreview
              preview={preview}
              isLoading={previewLoading}
              t={t}
            />
          </div>
        )}
        <div className="p-3">
          <WeighInHistoryCard attempts={selected.weighIns} t={t} />
        </div>
      </div>

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
