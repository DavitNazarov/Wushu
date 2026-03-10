'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import type { BracketsOverviewResponse } from '@/types/api';

type Props = {
  open: boolean;
  overview: BracketsOverviewResponse | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (payload: { reason: string }) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  tCommon: (key: string) => string;
};

export function BracketRegenerateDialog({
  open,
  overview,
  pending,
  onClose,
  onConfirm,
  t,
  tCommon,
}: Props) {
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');

  const canSubmit = useMemo(
    () => reason.trim().length >= 5 && confirm.trim() === 'REGENERATE',
    [reason, confirm],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('regenerateDialogTitle')}
      description={t('regenerateDialogDescription')}
      footer={
        <>
          <SecondaryButton onClick={onClose}>{tCommon('cancel')}</SecondaryButton>
          <PrimaryButton
            className="!bg-[var(--color-danger)] hover:!opacity-90"
            disabled={pending || !overview || !canSubmit}
            onClick={() => onConfirm({ reason: reason.trim() })}
          >
            {pending ? t('actionRegenerating') : t('actionRegenerate')}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-3 text-[13px] text-[var(--color-text)]">
        <p>{t('regenerateDialogWarning')}</p>

        {overview && (
          <ul className="space-y-1 text-[12px] text-[var(--color-text-muted)]">
            <li>{t('publishDialogSummaryCategories', { count: overview.summary.categoriesWithBrackets })}</li>
            <li>{t('publishDialogSummaryAthletes', { count: overview.summary.totalAthletesInBrackets })}</li>
            <li>{t('publishDialogSummaryByes', { count: overview.summary.totalByes })}</li>
          </ul>
        )}

        <label className="block">
          <span className="mb-1 block text-[12px] text-[var(--color-text-muted)]">{t('reasonLabel')}</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-primary)]"
            placeholder={t('regenerateReasonPlaceholder')}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[12px] text-[var(--color-text-muted)]">{t('regenerateConfirmLabel')}</span>
          <input
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] outline-none focus:border-[var(--color-primary)]"
            placeholder="REGENERATE"
          />
        </label>
      </div>
    </Modal>
  );
}
