import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type SecondaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function SecondaryButton({
  children,
  className = '',
  disabled,
  ...props
}: SecondaryButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex h-11 items-center justify-center rounded-[var(--radius-input)] border border-[var(--color-border)] bg-transparent px-4 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface-alt)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
