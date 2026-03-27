'use client';

import type { BracketRendererRound } from './types';

type Props = {
  round: BracketRendererRound;
  title: string;
};

const ACCENT_CLASS: Record<BracketRendererRound['accent'], string> = {
  cyan: 'text-cyan-300 border-cyan-400/35',
  amber: 'text-amber-300 border-amber-400/35',
  red: 'text-red-300 border-red-400/35',
  purple: 'text-purple-300 border-purple-400/35',
  slate: 'text-slate-300 border-slate-400/35',
};

export function BracketRoundHeader({ round, title }: Props) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-semibold text-[var(--color-text)]">{title}</h3>
        <span className={`rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${ACCENT_CLASS[round.accent]}`}>
          {round.matches.length}
        </span>
      </div>
    </div>
  );
}
