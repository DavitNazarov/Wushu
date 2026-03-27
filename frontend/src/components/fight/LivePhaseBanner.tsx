'use client';

import type { FightDisplayTone } from '@/lib/live/fightPresentation';

type Props = {
  eyebrow: string;
  headline: string;
  timerDisplay?: string | null;
  timerLabel?: string;
  detail?: string | null;
  tone: FightDisplayTone;
};

const TONE_STYLES: Record<FightDisplayTone, string> = {
  live:
    'border-[var(--color-primary)]/40 bg-[linear-gradient(135deg,var(--color-primary-subtle),rgba(15,23,42,0.08))] text-[var(--color-text)]',
  rest:
    'border-[var(--color-warning)]/45 bg-[linear-gradient(135deg,var(--color-warning-subtle),rgba(15,23,42,0.08))] text-[var(--color-text)]',
  finished:
    'border-[var(--color-success)]/45 bg-[linear-gradient(135deg,var(--color-success-subtle),rgba(15,23,42,0.08))] text-[var(--color-text)]',
  idle:
    'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)]',
};

export function LivePhaseBanner({
  eyebrow,
  headline,
  timerDisplay,
  timerLabel,
  detail,
  tone,
}: Props) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border px-5 py-4 shadow-[var(--shadow-card)] ${TONE_STYLES[tone]}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
            {eyebrow}
          </p>
          <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {headline}
          </h3>
          {detail ? (
            <p className="text-[13px] text-[var(--color-text-muted)]">{detail}</p>
          ) : null}
        </div>

        {timerDisplay ? (
          <div className="min-w-[132px] rounded-[var(--radius-card)] border border-current/10 bg-black/10 px-4 py-3 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
              {timerLabel}
            </p>
            <p className="mt-1 font-mono text-4xl font-bold leading-none sm:text-5xl">
              {timerDisplay}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
