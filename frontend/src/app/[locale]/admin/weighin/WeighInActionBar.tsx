'use client';

import { useMemo, useState } from 'react';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import type {
  WeighInCategory,
  WeighInDecision,
  WeighInPreviewResponse,
} from '@/types/weighin';
import { actionLabel } from './weighInDecisionMapper';
import { SELECT_CLASS } from './styles';

const MANUAL_DECISION_OPTIONS: WeighInDecision[] = [
  'ONE_HOUR',
  'MOVED_UP',
  'FAIL',
  'DISQUALIFIED',
];

type Props = {
  preview: WeighInPreviewResponse | null;
  categories: WeighInCategory[];
  isPending: boolean;
  onRecord: (payload: {
    decision?: WeighInDecision;
    reason?: string;
    nextEventWeightCategoryId?: string;
  }) => void;
  onOpenOverride: () => void;
  t: (key: string, values?: Record<string, unknown>) => string;
};

export function WeighInActionBar({
  preview,
  categories,
  isPending,
  onRecord,
  onOpenOverride,
  t,
}: Props) {
  const [manualDecision, setManualDecision] = useState<WeighInDecision>('ONE_HOUR');
  const [manualReason, setManualReason] = useState('');
  const [manualMoveCategoryId, setManualMoveCategoryId] = useState('');

  const primaryAction = useMemo(
    () =>
      preview?.allowedActions.find(
        (action) => action.level === 'PRIMARY' || action.level === 'DANGER',
      ) ?? null,
    [preview],
  );
  const hasOverrideAction = preview?.allowedActions.some(
    (action) => action.code === 'MANUAL_OVERRIDE',
  );

  if (!preview) return null;

  const isManualPrimary = primaryAction?.code === 'SUBMIT_MANUAL_DECISION';
  const manualRequiresCategory = manualDecision === 'MOVED_UP';
  const manualBlocked =
    isPending ||
    !preview.recordingAllowed ||
    !manualReason.trim() ||
    (manualRequiresCategory && !manualMoveCategoryId);

  const moveUpCandidates = categories.filter(
    (category) => category.sortOrder > preview.currentCategory.sortOrder,
  );

  return (
    <section className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {t('actionTitle')}
      </h3>

      {isManualPrimary && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            className={SELECT_CLASS}
            value={manualDecision}
            onChange={(event) =>
              setManualDecision(event.target.value as WeighInDecision)
            }
          >
            {MANUAL_DECISION_OPTIONS.map((decision) => (
              <option key={decision} value={decision}>
                {t(`decisionOption${decision}`)}
              </option>
            ))}
          </select>
          {manualRequiresCategory && (
            <select
              className={SELECT_CLASS}
              value={manualMoveCategoryId}
              onChange={(event) => setManualMoveCategoryId(event.target.value)}
            >
              <option value="">{t('selectMoveCategory')}</option>
              {moveUpCandidates.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          )}
          <textarea
            rows={2}
            className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            placeholder={t('manualReasonPlaceholder')}
            value={manualReason}
            onChange={(event) => setManualReason(event.target.value)}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {primaryAction && (
          <PrimaryButton
            className={`min-h-[44px] w-full sm:w-auto ${
              primaryAction.level === 'DANGER'
                ? 'bg-[var(--color-danger)] hover:bg-[var(--color-danger)]/90'
                : ''
            }`}
            disabled={
              isManualPrimary ? manualBlocked : isPending || !preview.recordingAllowed
            }
            onClick={() =>
              onRecord(
                isManualPrimary
                  ? {
                      decision: manualDecision,
                      reason: manualReason.trim(),
                      nextEventWeightCategoryId:
                        manualDecision === 'MOVED_UP'
                          ? manualMoveCategoryId
                          : undefined,
                    }
                  : {},
              )
            }
          >
            {isPending
              ? t('actionSaving')
              : actionLabel(primaryAction, t)}
          </PrimaryButton>
        )}

        {hasOverrideAction && (
          <SecondaryButton
            className="min-h-[44px] w-full sm:w-auto"
            onClick={onOpenOverride}
            disabled={isPending}
          >
            {t('actionManualOverride')}
          </SecondaryButton>
        )}
      </div>
    </section>
  );
}
