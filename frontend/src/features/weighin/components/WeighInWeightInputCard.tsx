'use client';

import { useRef } from 'react';
import { Input } from '@/components/ui/primitives/input';

type Props = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onEnter?: () => void;
  t: (key: string, values?: Record<string, unknown>) => string;
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

  const numBtn =
    'flex h-[58px] items-center justify-center rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[22px] font-semibold text-[var(--color-text)] transition active:scale-95 hover:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)] disabled:opacity-50 select-none touch-manipulation';

  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0'] as const;

  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled || (key === '.' && hasDecimal)}
          onClick={() => appendValue(key)}
          className={numBtn}
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
        className={numBtn}
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
  const weightUnit = t('weightUnit');
  const weightPlaceholder = t('weightInputPlaceholder');

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        {t('weightInputTitle')}
      </p>

      {/* Desktop input */}
      <div className="hidden md:block">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-[280px]">
            <Input
              value={value}
              type="text"
              inputMode="decimal"
              disabled={disabled}
              autoFocus
              onChange={(event) => onChange(normalizeWeightInput(event.target.value))}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || !onEnter) return;
                event.preventDefault();
                onEnter();
              }}
              className={`h-[72px] bg-[var(--color-surface)] px-4 pr-14 text-[36px] font-bold tracking-tight ${
                invalid
                  ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/30'
                  : 'border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/30'
              } [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
              placeholder={weightPlaceholder}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-medium text-[var(--color-text-muted)]">
              {weightUnit}
            </span>
          </div>
          <p className="text-[12px] text-[var(--color-text-muted)]">
            {t('weightInputHint')}
          </p>
        </div>
        {invalid && (
          <p className="mt-1.5 text-[12px] text-[var(--color-danger)]">
            {t('weightValidation')}
          </p>
        )}
      </div>

      {/* Mobile display + numpad */}
      <div className="md:hidden">
        <div
          className={`rounded-[var(--radius-input)] border-2 px-4 py-5 text-center transition-colors ${
            invalid
              ? 'border-[var(--color-danger)] bg-[var(--color-danger)]/5'
              : hasValue
                ? 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/5'
                : 'border-[var(--color-border)] bg-[var(--color-surface-alt)]'
          }`}
        >
          <p
            className={`text-[48px] font-bold leading-none tracking-tight ${
              hasValue ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'
            }`}
          >
            {hasValue ? value : weightPlaceholder}
          </p>
          <p className="mt-1 text-[14px] font-medium text-[var(--color-text-muted)]">
            {weightUnit}
          </p>
        </div>
        {invalid && (
          <p className="mt-1.5 text-[12px] text-[var(--color-danger)]">
            {t('weightValidation')}
          </p>
        )}
        <WeightNumpad disabled={disabled} value={value} onChange={onChange} />
      </div>
    </div>
  );
}
