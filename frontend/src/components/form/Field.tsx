import { type ReactNode, useId } from 'react';

type FieldProps = {
  id?: string;
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  error?: ReactNode | string;
  required?: boolean;
  className?: string;
};

export function Field({ id, label, children, hint, error, required, className = '' }: FieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className={className}>
      <label
        htmlFor={fieldId}
        className="block text-[13px] font-medium text-[var(--color-text)]"
      >
        {label}
        {required && <span className="ml-0.5 text-[var(--color-error,theme(colors.red.500))]">*</span>}
      </label>
      {/* Clone children passing the id down if they're a single element */}
      <div data-field-id={fieldId}>
        {children}
      </div>
      {hint && !error && (
        <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{hint}</p>
      )}
      {error && (
        <p className="mt-0.5 text-[12px] text-red-500">{error}</p>
      )}
    </div>
  );
}
