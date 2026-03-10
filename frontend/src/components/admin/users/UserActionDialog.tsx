'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { InlineAlert } from '@/components/ui/InlineAlert';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  errorMessage: string | null;
  tone?: 'danger' | 'warning' | 'neutral';
  onClose: () => void;
  onConfirm: () => void;
};

export function UserActionDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  errorMessage,
  tone = 'neutral',
  onClose,
  onConfirm,
}: Props) {
  const tCommon = useTranslations('common');
  const toneClass =
    tone === 'danger'
      ? 'bg-red-500 text-white hover:bg-red-400'
      : tone === 'warning'
        ? 'bg-amber-500 text-black hover:bg-amber-400'
        : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <SecondaryButton onClick={onClose}>{tCommon('cancel')}</SecondaryButton>
          <PrimaryButton
            className={toneClass}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? tCommon('loading') : confirmLabel}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {errorMessage && <InlineAlert variant="error">{errorMessage}</InlineAlert>}
        <p className="text-[13px] text-[var(--color-text-muted)]">{description}</p>
      </div>
    </Modal>
  );
}
