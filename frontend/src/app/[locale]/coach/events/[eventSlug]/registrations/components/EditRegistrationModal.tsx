'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Label } from '@/components/ui/primitives/label';
import { CategoryPicker } from '@/components/registration/CategoryPicker';
import type { RegistrationRow } from '@/types/api';
import { athleteInitials, athleteName, LABEL_CLASS } from '../registrations.utils';

type Props = {
  reg: RegistrationRow | null;
  onClose: () => void;
  eventSlug: string;
  locale: string;
  ageGroupId: string;
  weightCategoryId: string;
  saving: boolean;
  onAgeGroupChange: (id: string) => void;
  onWeightCategoryChange: (id: string) => void;
  onSave: () => void;
  onWithdraw: () => void;
};

export function EditRegistrationModal({
  reg,
  onClose,
  eventSlug,
  locale,
  ageGroupId,
  weightCategoryId,
  saving,
  onAgeGroupChange,
  onWeightCategoryChange,
  onSave,
  onWithdraw,
}: Props) {
  const t = useTranslations('coach.registrations');
  const tReg = useTranslations('registrations');
  const tC = useTranslations('common');

  return (
    <Modal open={!!reg} onClose={onClose} title={reg ? athleteName(reg, locale) : ''}>
      {reg && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-[12px] font-semibold uppercase text-[var(--color-primary)]">
              {athleteInitials(reg)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[var(--color-text)]">{athleteName(reg, locale)}</p>
              <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                {reg.categoryCode} · <StatusChip status={reg.status} label={tReg(`status.${reg.status}`)} domain="registration" />
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className={LABEL_CLASS}>{t('pickCategory')}</Label>
            <CategoryPicker
              eventSlug={eventSlug}
              ageGroupId={ageGroupId}
              weightCategoryId={weightCategoryId}
              onAgeGroupChange={onAgeGroupChange}
              onWeightCategoryChange={onWeightCategoryChange}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              onClick={(e) => { e.preventDefault(); onWithdraw(); }}
              className="text-[12px] font-medium text-[var(--color-danger,#ef4444)] opacity-70 hover:opacity-100"
            >
              {t('withdraw')}
            </button>
            <div className="flex gap-2">
              <SecondaryButton onClick={onClose}>{tC('cancel')}</SecondaryButton>
              <button
                onClick={onSave}
                disabled={!weightCategoryId || saving}
                className="h-9 rounded-[var(--radius-input)] bg-[var(--color-primary)] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
              >
                {saving ? tC('loading') : tC('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
