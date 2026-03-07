'use client';

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

const MD_BREAKPOINT = 768;

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  /** 'left' for admin/coach sidebar, 'right' for public nav */
  side?: 'left' | 'right';
  /** Top offset so overlay doesn't cover header (e.g. 'top-16' = 64px) */
  overlayTop?: string;
  /** Panel width - default varies by side */
  panelWidth?: string;
  /** When false, drawer works on desktop too (e.g. for dashboard public nav) */
  hideOnDesktop?: boolean;
};

export function MobileDrawer({
  open,
  onClose,
  children,
  title,
  side = 'right',
  overlayTop = 'top-0',
  panelWidth = side === 'right' ? 'w-[min(320px,85vw)]' : 'w-[var(--sidebar-width)]',
  hideOnDesktop = true,
}: MobileDrawerProps) {
  useEffect(() => {
    if (!hideOnDesktop) return;
    function handleResize() {
      if (window.innerWidth >= MD_BREAKPOINT) onClose();
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [onClose, hideOnDesktop]);

  if (!open) return null;

  const desktopHidden = hideOnDesktop ? 'md:hidden' : '';
  const overlayClass = `fixed ${overlayTop} left-0 right-0 bottom-0 z-40 bg-black/60 ${desktopHidden}`;
  const panelPosition = side === 'right' ? 'right-0' : 'left-0';
  const panelRounded = side === 'right' ? 'rounded-bl-[var(--radius-modal)]' : 'rounded-br-[var(--radius-modal)]';
  const panelShadow =
    side === 'right'
      ? 'shadow-[-4px_4px_24px_rgba(0,0,0,0.25)]'
      : 'shadow-[4px_4px_24px_rgba(0,0,0,0.25)]';

  return (
    <>
      <div className={overlayClass} aria-hidden onClick={onClose} />
      <div
        className={`fixed ${panelPosition} top-0 z-50 ${panelWidth} max-h-dvh overflow-y-auto ${panelRounded} bg-[var(--color-surface)] border-[var(--color-border)] ${panelShadow} ${desktopHidden} ${
          side === 'right' ? 'border-l-2 border-b-2' : 'border-r-2 border-b-2'
        }`}
        aria-modal
        role="dialog"
      >
        <div
          className={`flex shrink-0 items-center border-b-2 border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 py-4 ${title ? 'justify-between' : 'justify-end'}`}
        >
          {title && (
            <span className="text-base font-bold text-[var(--color-text)]">{title}</span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-input)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-primary-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <X className="h-6 w-6" strokeWidth={2.5} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
