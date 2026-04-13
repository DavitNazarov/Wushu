'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/primitives/button';
import { Label } from '@/components/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import { Textarea } from '@/components/ui/primitives/textarea';
import type {
  WeighInCategory,
  WeighInDecision,
  WeighInPreviewResponse,
} from '@/types/weighin';
import { actionLabel } from '@/features/weighin/lib/weighInDecisionMapper';

const MANUAL_DECISION_OPTIONS: WeighInDecision[] = [
  'ONE_HOUR',
  'MOVED_UP',
  'FAIL',
  'DISQUALIFIED',
];
const EMPTY_CATEGORY_VALUE = '__weighin-move-category-empty__';

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

  if (!preview) {
    return (
      <Button className="h-[56px] w-full text-[15px] font-semibold" disabled>
        {t('actionRecordWeighIn')}
      </Button>
    );
  }

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

  const primaryDisabled = isManualPrimary
    ? manualBlocked
    : isPending || !preview.recordingAllowed;

  const isDanger = primaryAction?.level === 'DANGER';

  return (
    <div className="space-y-3">
      {isManualPrimary && (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
            {t('manualDecisionLabel')}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                {t('manualDecisionLabel')}
              </Label>
              <Select
                value={manualDecision}
                onValueChange={(value) => setManualDecision(value as WeighInDecision)}
              >
                <SelectTrigger className="h-10 bg-[var(--color-surface)] px-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_DECISION_OPTIONS.map((decision) => (
                    <SelectItem key={decision} value={decision}>
                      {t(`decisionOption${decision}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {manualRequiresCategory && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t('manualTargetCategoryLabel')}
                </Label>
                <Select
                  value={manualMoveCategoryId || EMPTY_CATEGORY_VALUE}
                  onValueChange={(value) =>
                    setManualMoveCategoryId(value === EMPTY_CATEGORY_VALUE ? '' : value)
                  }
                >
                  <SelectTrigger className="h-10 bg-[var(--color-surface)] px-3">
                    <SelectValue placeholder={t('selectMoveCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_CATEGORY_VALUE}>
                      {t('selectMoveCategory')}
                    </SelectItem>
                    {moveUpCandidates.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label
                htmlFor="weighin-manual-reason"
                className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]"
              >
                {t('manualReasonLabel')}
              </Label>
              <Textarea
                id="weighin-manual-reason"
                rows={2}
                className="min-h-[72px] bg-[var(--color-surface)]"
                placeholder={t('manualReasonPlaceholder')}
                value={manualReason}
                onChange={(event) => setManualReason(event.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {primaryAction && (
          <Button
            className={`h-[56px] flex-1 text-[15px] font-semibold tracking-wide ${
              isDanger
                ? 'bg-[var(--color-danger)] hover:bg-[var(--color-danger)]/90 text-white'
                : ''
            }`}
            disabled={primaryDisabled}
            onClick={() =>
              onRecord(
                isManualPrimary
                  ? {
                      decision: manualDecision,
                      reason: manualReason.trim(),
                      nextEventWeightCategoryId:
                        manualDecision === 'MOVED_UP' ? manualMoveCategoryId : undefined,
                    }
                  : {},
              )
            }
          >
            {isPending ? t('actionSaving') : actionLabel(primaryAction, t)}
          </Button>
        )}

        {hasOverrideAction && (
          <Button
            variant="secondary"
            className="h-[56px] sm:min-w-[140px] text-[14px] font-semibold"
            onClick={onOpenOverride}
            disabled={isPending}
          >
            {t('actionManualOverride')}
          </Button>
        )}
      </div>
    </div>
  );
}
