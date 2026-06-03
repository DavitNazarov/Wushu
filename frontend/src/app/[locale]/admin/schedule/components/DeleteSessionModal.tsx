'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';

type Props = {
  open: boolean;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteSessionModal({ open, deleting, onClose, onConfirm }: Props) {
  const t = useTranslations('schedule');
  const tCommon = useTranslations('common');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('deleteSessionTitle')}
      description={t('deleteSessionDesc')}
      footer={
        <>
          <SecondaryButton onClick={onClose}>{tCommon('cancel')}</SecondaryButton>
          <PrimaryButton disabled={deleting} onClick={onConfirm}>
            {deleting ? tCommon('loading') : tCommon('delete')}
          </PrimaryButton>
        </>
      }
    >
      <p className="text-[13px] text-[var(--color-text-muted)]">{t('deleteSessionWarning')}</p>
    </Modal>
  );
}
