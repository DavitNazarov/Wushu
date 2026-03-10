'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import type { WeighInCategory, WeighInDecision } from '@/types/weighin';
import { SELECT_CLASS } from './styles';

const OVERRIDE_DECISIONS: WeighInDecision[] = [
  'PASS',
  'ONE_HOUR',
  'MOVED_UP',
  'FAIL',
  'DISQUALIFIED',
];

type Props = {
  open: boolean;
  categories: WeighInCategory[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    decision: WeighInDecision;
    reason: string;
    nextEventWeightCategoryId?: string;
  }) => void;
  t: (key: string, values?: Record<string, unknown>) => string;
};

export function WeighInOverrideDialog({
  open,
  categories,
  isPending,
  onClose,
  onSubmit,
  t,
}: Props) {
  const [decision, setDecision] = useState<WeighInDecision>('PASS');
  const [reason, setReason] = useState('');
  const [targetCategoryId, setTargetCategoryId] = useState('');

  useEffect(() => {
    if (!open) {
      setDecision('PASS');
      setReason('');
      setTargetCategoryId('');
    }
  }, [open]);

  const requiresCategory = decision === 'MOVED_UP';
  const blocked =
    isPending || !reason.trim() || (requiresCategory && !targetCategoryId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('overrideTitle')}
      description={t('overrideDescription')}
      footer={
        <>
          <SecondaryButton onClick={onClose}>{t('overrideCancel')}</SecondaryButton>
          <PrimaryButton
            disabled={blocked}
            onClick={() =>
              onSubmit({
                decision,
                reason: reason.trim(),
                nextEventWeightCategoryId: requiresCategory
                  ? targetCategoryId
                  : undefined,
              })
            }
          >
            {isPending ? t('actionSaving') : t('overrideApply')}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[12px] text-[var(--color-text-muted)]">
            {t('overrideDecisionLabel')}
          </label>
          <select
            value={decision}
            onChange={(event) =>
              setDecision(event.target.value as WeighInDecision)
            }
            className={SELECT_CLASS}
          >
            {OVERRIDE_DECISIONS.map((row) => (
              <option key={row} value={row}>
                {t(`decisionOption${row}`)}
              </option>
            ))}
          </select>
        </div>
        {requiresCategory && (
          <div className="space-y-1">
            <label className="text-[12px] text-[var(--color-text-muted)]">
              {t('overrideTargetCategoryLabel')}
            </label>
            <select
              value={targetCategoryId}
              onChange={(event) => setTargetCategoryId(event.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">{t('selectMoveCategory')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-[12px] text-[var(--color-text-muted)]">
            {t('overrideReasonLabel')}
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            placeholder={t('overrideReasonPlaceholder')}
          />
        </div>
      </div>
    </Modal>
  );
}
