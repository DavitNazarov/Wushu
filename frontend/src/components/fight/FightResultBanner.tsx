'use client';

import type { FightCorner } from '@/lib/live/fightPresentation';

type Props = {
  title: string;
  winnerName: string;
  winnerCorner: FightCorner | null;
  methodLabel: string | null;
  notes?: string | null;
  compact?: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const CORNER_STYLES: Record<NonNullable<FightCorner>, string> = {
  RED: 'border-[var(--color-danger)]/45 bg-[var(--color-danger-subtle)]',
  BLUE: 'border-sky-500/45 bg-sky-500/12',
};

export function FightResultBanner({
  title,
  winnerName,
  winnerCorner,
  methodLabel,
  notes,
  compact = false,
  t,
}: Props) {
  const style = winnerCorner ? CORNER_STYLES[winnerCorner] : 'border-[var(--color-success)]/45 bg-[var(--color-success-subtle)]';
  const winnerSide =
    winnerCorner === 'RED' ? t('red') : winnerCorner === 'BLUE' ? t('blue') : null;

  return (
    <div className={`rounded-[var(--radius-card)] border px-4 py-4 ${style}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={`${compact ? 'text-lg' : 'text-2xl'} font-semibold text-[var(--color-text)]`}>
            {winnerName}
          </p>
          {winnerSide ? (
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
              {t('winnerCorner', { side: winnerSide })}
            </p>
          ) : null}
        </div>

        {methodLabel ? (
          <div className="rounded-[var(--radius-pill)] border border-current/10 bg-black/10 px-3 py-2 text-[13px] font-medium text-[var(--color-text)]">
            {t('wonByMethod', { method: methodLabel })}
          </div>
        ) : null}
      </div>

      {notes ? (
        <p className="mt-3 text-[13px] text-[var(--color-text-muted)]">
          {t('resultNotes')}: {notes}
        </p>
      ) : null}
    </div>
  );
}
