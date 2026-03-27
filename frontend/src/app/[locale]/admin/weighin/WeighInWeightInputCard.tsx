'use client';

import { useRef } from 'react';

type Props = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onEnter?: () => void;
  t: (key: string) => string;
};

const CLEAR_DELAY_MS = 450;

function normalizeWeightInput(value: string): string {
  const stripped = value.replace(/[^0-9.]/g, '');
  const [rawInteger = '', rawDecimal = ''] = stripped.split('.');
  const integer = rawInteger.slice(0, 3);
  const decimal = rawDecimal.slice(0, 1);
  const hasDecimal = stripped.includes('.');

  if (!integer && !decimal && !hasDecimal) return '';
  if (hasDecimal) return `${integer || '0'}.${decimal}`;
  return integer;
}

function canAppendCharacter(value: string, nextChar: '.' | `${number}`): boolean {
  if (nextChar === '.') {
    return value.length > 0 && !value.includes('.');
  }

  if (!value.includes('.')) {
    return value.replace(/\D/g, '').length < 3;
  }

  const [integer = '', decimal = ''] = value.split('.');
  if (decimal.length >= 1) return false;
  return integer.replace(/\D/g, '').length <= 3;
}

type WeightNumpadProps = {
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
};

function WeightNumpad({ disabled, value, onChange }: WeightNumpadProps) {
  const clearTimeoutRef = useRef<number | null>(null);
  const clearTriggeredRef = useRef(false);
  const hasDecimal = value.includes('.');

  const appendValue = (nextChar: '.' | `${number}`) => {
    if (disabled || !canAppendCharacter(value, nextChar)) return;
    onChange(value + nextChar);
  };

  const backspace = () => {
    if (disabled || clearTriggeredRef.current) return;
    onChange(value.slice(0, -1));
  };

  const clearAll = () => {
    if (disabled) return;
    clearTriggeredRef.current = true;
    onChange('');
  };

  const startClearTimer = () => {
    if (disabled) return;
    clearTriggeredRef.current = false;
    clearTimeoutRef.current = window.setTimeout(() => {
      clearAll();
    }, CLEAR_DELAY_MS);
  };

  const stopClearTimer = () => {
    if (clearTimeoutRef.current != null) {
      window.clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
  };

  const numpadButtonClass =
    'min-h-[56px] rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[24px] font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)] disabled:opacity-60';

  return (
    <div className="mt-3 grid grid-cols-3 gap-2 md:hidden">
      {(['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0'] as const).map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled || (key === '.' && hasDecimal)}
          onClick={() => appendValue(key)}
          className={numpadButtonClass}
        >
          {key}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled || value.length === 0}
        onMouseDown={startClearTimer}
        onMouseUp={stopClearTimer}
        onMouseLeave={stopClearTimer}
        onTouchStart={startClearTimer}
        onTouchEnd={stopClearTimer}
        onTouchCancel={stopClearTimer}
        onClick={() => {
          stopClearTimer();
          backspace();
          clearTriggeredRef.current = false;
        }}
        className={numpadButtonClass}
      >
        ⌫
      </button>
    </div>
  );
}

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
  const displayValue = hasValue ? `${value} kg` : '0.0 kg';

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {t('weightInputTitle')}
      </h3>
      <div className="mt-3 hidden items-center gap-2 md:flex">
        <div className="relative w-full max-w-[220px]">
          <input
            value={value}
            type="number"
            step="0.1"
            inputMode="decimal"
            disabled={disabled}
            autoFocus
            onChange={(event) => onChange(normalizeWeightInput(event.target.value))}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || !onEnter) return;
              event.preventDefault();
              onEnter();
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
      <div className="mt-3 md:hidden">
        <div
          className={`rounded-[var(--radius-input)] border px-3 py-4 text-center ${
            invalid
              ? 'border-[var(--color-danger)]'
              : 'border-[var(--color-border)]'
          }`}
        >
          <p className="text-[32px] font-semibold text-[var(--color-text)]">
            {displayValue}
          </p>
        </div>
        <WeightNumpad
          disabled={disabled}
          value={value}
          onChange={onChange}
        />
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
