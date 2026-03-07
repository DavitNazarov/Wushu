import { type SelectHTMLAttributes } from 'react';

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> & {
  id: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaInvalid?: boolean;
  className?: string;
};

const BASE =
  'mt-1 h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

export function Select({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  name,
  ariaInvalid,
  className = '',
}: SelectProps) {
  return (
    <select
      id={id}
      name={name}
      value={value ?? ''}
      disabled={disabled}
      aria-invalid={ariaInvalid}
      className={`${BASE} ${className}`}
      onChange={(e) => onChange(e.target.value)}
    >
      {placeholder !== undefined && (
        <option value="">{placeholder}</option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
