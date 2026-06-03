'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { Input } from '@/components/ui/primitives/input';
import { Label } from '@/components/ui/primitives/label';
import { LABEL_CLASS } from '../registrations.utils';

type Props = {
  open: boolean;
  onClose: () => void;
  reason: string;
  saving: boolean;
  onReasonChange: (v: string) => void;
  onConfirm: () => void;
};

export function WithdrawModal({ open, onClose, reason, saving, onReasonChange, onConfirm }: Props) {
  const t = useTranslations('coach.registrations');
  const tC = useTranslations('common');

  return (
    <Modal open={open} onClose={onClose} title={t('withdraw')}>
      <div className="space-y-4">
        <p className="text-[14px] text-[var(--color-text-muted)]">{t('withdrawConfirm')}</p>
        <div className="space-y-1.5">
          <Label className={LABEL_CLASS}>{t('withdrawReason')}</Label>
          <Input type="text" value={reason} onChange={(e) => onReasonChange(e.target.value)} className="h-10 bg-[var(--color-surface)]" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton onClick={onClose}>{tC('cancel')}</SecondaryButton>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="h-9 rounded-[var(--radius-input)] bg-[var(--color-danger,#ef4444)] px-4 text-[13px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {saving ? tC('loading') : t('withdraw')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
