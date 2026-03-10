'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import type { DrawOverviewResponse } from '@/types/api';

type Props = {
  open: boolean;
  overview: DrawOverviewResponse | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    reason: string;
    seed?: number;
    sameClubSeparation: boolean;
  }) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

export function RegenerateDrawDialog({
  open,
  overview,
  pending,
  onClose,
  onConfirm,
  t,
}: Props) {
  const [reason, setReason] = useState('');
  const [seed, setSeed] = useState('');
  const [sameClub, setSameClub] = useState(false);
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
          <SecondaryButton onClick={onClose}>{t('cancel')}</SecondaryButton>
          <PrimaryButton
            className="!bg-[var(--color-danger)] hover:!opacity-90"
            disabled={pending || !overview || !canSubmit}
            onClick={() =>
              onConfirm({
                reason: reason.trim(),
                seed: seed.trim() ? Number(seed) : undefined,
                sameClubSeparation: sameClub,
              })
            }
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
            <li>{t('generateDialogReadyCategories', { count: overview.summary.readyCategoriesCount })}</li>
            <li>{t('generateDialogEligibleAthletes', { count: overview.summary.eligibleAthletesCount })}</li>
            <li>{t('generateDialogBlockedCategories', { count: overview.summary.blockedCategoriesCount })}</li>
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
          <span className="mb-1 block text-[12px] text-[var(--color-text-muted)]">{t('seedLabel')}</span>
          <input
            type="number"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
            className="h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] outline-none focus:border-[var(--color-primary)]"
            placeholder={t('seedOptional')}
          />
        </label>

        <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            checked={sameClub}
            onChange={(event) => setSameClub(event.target.checked)}
          />
          {t('sameClubSeparation')}
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
