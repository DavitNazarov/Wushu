import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full appearance-none rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-sm text-[var(--color-text)] caret-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
