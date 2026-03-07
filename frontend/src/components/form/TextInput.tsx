import { type InputHTMLAttributes } from 'react';

type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  id: string;
  type?: 'text' | 'email' | 'password' | 'search' | 'url' | 'tel';
  ariaInvalid?: boolean;
  className?: string;
};

const BASE =
  'mt-1 h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

export function TextInput({ id, type = 'text', ariaInvalid, className = '', ...props }: TextInputProps) {
  return (
    <input
      id={id}
      type={type}
      aria-invalid={ariaInvalid}
      className={`${BASE} ${className}`}
      {...props}
    />
  );
}
