import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function PrimaryButton({ children, className = '', disabled, ...props }: PrimaryButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex h-11 items-center justify-center rounded-[var(--radius-input)] bg-[var(--color-primary)] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
