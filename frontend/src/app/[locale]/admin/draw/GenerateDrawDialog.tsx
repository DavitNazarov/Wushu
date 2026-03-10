'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import type { DrawOverviewResponse } from '@/types/api';

type Props = {
  open: boolean;
  overview: DrawOverviewResponse | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (payload: { seed?: number; sameClubSeparation: boolean }) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

export function GenerateDrawDialog({
  open,
  overview,
  pending,
  onClose,
  onConfirm,
  t,
}: Props) {
  const [seed, setSeed] = useState('');
  const [sameClub, setSameClub] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('generateDialogTitle')}
      description={t('generateDialogDescription')}
      footer={
        <>
          <SecondaryButton onClick={onClose}>{t('cancel')}</SecondaryButton>
          <PrimaryButton
            disabled={pending || !overview}
            onClick={() =>
              onConfirm({
                seed: seed.trim() ? Number(seed) : undefined,
                sameClubSeparation: sameClub,
              })
            }
          >
            {pending ? t('actionGenerating') : t('actionGenerate')}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-3 text-[13px] text-[var(--color-text)]">
        <p>{t('generateDialogSummary')}</p>
        {overview && (
          <ul className="space-y-1 text-[12px] text-[var(--color-text-muted)]">
            <li>{t('generateDialogReadyCategories', { count: overview.summary.readyCategoriesCount })}</li>
            <li>{t('generateDialogEligibleAthletes', { count: overview.summary.eligibleAthletesCount })}</li>
            <li>{t('generateDialogBlockedCategories', { count: overview.summary.blockedCategoriesCount })}</li>
            <li>{t('generateDialogMovedUpAthletes', { count: overview.summary.movedUpAthletesCount })}</li>
          </ul>
        )}

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
      </div>
    </Modal>
  );
}
