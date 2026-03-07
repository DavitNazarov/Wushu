'use client';

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  helper: string;
}

export function AutoAdvanceToggle({ checked, onChange, label, helper }: Props) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 flex-shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked}
          onChange={(e) => onChange(e.target.checked)} />
        <span className={[
          'block h-[18px] w-[18px] rounded-[4px] border transition-all duration-[120ms] ease-in-out',
          'border-[var(--color-border)] bg-[var(--color-surface)]',
          'peer-checked:scale-[1.08] peer-checked:border-[var(--color-primary)] peer-checked:bg-[var(--color-primary)]',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary)]/40',
        ].join(' ')}>
          {checked && (
            <svg className="absolute inset-0 m-auto h-[11px] w-[11px] text-white" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </span>
      <span>
        <span className="block text-[13px] text-[var(--color-text)]">{label}</span>
        <span className="mt-0.5 block text-[12px] text-[var(--color-text-muted)]">{helper}</span>
      </span>
    </label>
  );
}
