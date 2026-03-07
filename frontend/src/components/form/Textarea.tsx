import { type TextareaHTMLAttributes } from 'react';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  ariaInvalid?: boolean;
  className?: string;
};

const BASE =
  'mt-1 w-full resize-none rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

export function Textarea({ id, ariaInvalid, className = '', ...props }: TextareaProps) {
  return (
    <textarea
      id={id}
      aria-invalid={ariaInvalid}
      className={`${BASE} ${className}`}
      {...props}
    />
  );
}
