'use client';

import { useLocale } from 'next-intl';
import { localizedName } from '@/lib/bilingual';
import { Card } from '@/components/ui/primitives/card';
import type { LiveSessionBoundary } from '@/lib/live/sessions';

type Props = {
  boundary: LiveSessionBoundary;
  onStart: (() => void) | null;
  busy?: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
};

export function LiveSessionGate({ boundary, onStart, busy, t }: Props) {
  const locale = useLocale();
  const { session, opener } = boundary;

  return (
    <Card className="overflow-hidden border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] !shadow-[var(--shadow-card)]">
      <div className="px-5 py-6 text-center sm:px-8 sm:py-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-warning)]">
          {t('sessionGateEyebrow')}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
          {session.name}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-[var(--color-text-muted)]">
          {t('sessionGateDesc')}
        </p>

        <div className="mx-auto mt-5 max-w-md rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {t('sessionGateFirstUp')}
          </p>
          <p className="mt-1.5 text-[15px] font-semibold text-[var(--color-text)]">
            {localizedName(opener.redDisplayName, opener.redDisplayNameKa, locale)}{' '}
            <span className="text-[12px] font-bold uppercase text-[var(--color-text-muted)]">
              vs
            </span>{' '}
            {localizedName(opener.blueDisplayName, opener.blueDisplayNameKa, locale)}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
            {opener.categoryName} · {opener.bracketRoundLabel}
          </p>
        </div>

        {onStart && (
          <button
            type="button"
            onClick={onStart}
            disabled={busy}
            className="mx-auto mt-5 flex h-12 w-full max-w-md items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-primary)] text-[15px] font-bold uppercase tracking-wide text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {t('startNextSession')}
          </button>
        )}
      </div>
    </Card>
  );
}
