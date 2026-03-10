'use client';

type Props = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onEnter?: () => void;
  t: (key: string) => string;
};

export function WeighInWeightInputCard({
  value,
  disabled,
  onChange,
  onEnter,
  t,
}: Props) {
  const parsed = Number(value);
  const hasValue = value.trim().length > 0;
  const invalid = hasValue && (!Number.isFinite(parsed) || parsed <= 0);

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {t('weightInputTitle')}
      </h3>
      <div className="mt-3 flex items-center gap-2">
        <div className="relative w-full max-w-[220px]">
          <input
            value={value}
            type="number"
            step="0.1"
            inputMode="decimal"
            disabled={disabled}
            autoFocus
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && onEnter) onEnter();
            }}
            className={`h-16 w-full rounded-[var(--radius-input)] border bg-[var(--color-surface)] px-3 pr-12 text-[32px] font-semibold text-[var(--color-text)] outline-none focus:ring-2 md:text-[28px] ${
              invalid
                ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/30'
                : 'border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/30'
            }`}
            placeholder="0.0"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[var(--color-text-muted)]">
            kg
          </span>
        </div>
      </div>
      {invalid ? (
        <p className="mt-2 text-[12px] text-[var(--color-danger)]">
          {t('weightValidation')}
        </p>
      ) : (
        <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
          {t('weightInputHint')}
        </p>
      )}
    </section>
  );
}
