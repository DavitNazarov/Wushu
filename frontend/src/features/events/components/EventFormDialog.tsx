'use client';

import type { ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  closeOnBackdrop?: boolean;
};

export function EventFormDialog({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  contentClassName,
  closeOnBackdrop,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={footer}
      widthClassName={contentClassName ?? 'max-w-3xl'}
      closeOnBackdrop={closeOnBackdrop}
    >
      {children}
    </Modal>
  );
}
