'use client';

import { Globe, Lock } from 'lucide-react';

type Props = {
  isPublic: boolean;
  pending: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

// Switch that makes the confirmed weigh-in weights public (visible on
// /events/:slug/weights) or private. Disabled while a toggle is in flight.
export function WeighInPublicToggle({
  isPublic,
  pending,
  disabled = false,
  onChange,
  t,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            isPublic
              ? 'bg-[var(--color-primary)]/12 text-[var(--color-primary)]'
              : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
          }`}
        >
          {isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        </span>
        <div>
          <p className="text-[13px] font-semibold text-[var(--color-text)]">
            {t('publicToggleLabel')}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {isPublic ? t('publicToggleOn') : t('publicToggleOff')}
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={isPublic}
        aria-label={t('publicToggleLabel')}
        disabled={disabled || pending}
        onClick={() => onChange(!isPublic)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          isPublic ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
            isPublic ? 'left-[1.375rem]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}
