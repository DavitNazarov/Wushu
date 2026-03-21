'use client';

import { type ReactNode, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  widthClassName = 'max-w-md',
}: ModalProps) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative flex w-full ${widthClassName} flex-col rounded-[var(--radius-modal)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl`} style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        {/* Header — fixed */}
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text)]">{title}</h2>
            {description && (
              <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">{children}</div>
        {/* Footer — fixed */}
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
