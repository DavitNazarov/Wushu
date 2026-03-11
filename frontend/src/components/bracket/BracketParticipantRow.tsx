'use client';

import Link from 'next/link';
import { countryToFlag } from './bracketDisplayMapper';
import type { BracketRendererParticipantSlot } from './types';

type Props = {
  slot: BracketRendererParticipantSlot;
  tBracket: (key: string, values?: Record<string, string | number | Date>) => string;
  getAthleteHref?: (athleteId: string) => string;
};

export function BracketParticipantRow({ slot, tBracket, getAthleteHref }: Props) {
  if (slot.type === 'bye') {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-input)] bg-[var(--color-surface-alt)] px-2 py-1.5">
        <span className="h-6 w-6 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]" />
        <span className="text-[12px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          {tBracket('bye')}
        </span>
      </div>
    );
  }

  if (slot.type === 'pending_winner') {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-input)] bg-[var(--color-surface-alt)] px-2 py-1.5">
        <span className="h-6 w-6 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]" />
        <span className="text-[12px] text-[var(--color-text-muted)]">
          {tBracket('winnerOfMatch', { match: slot.sourceFightNumber })}
        </span>
      </div>
    );
  }

  if (slot.type === 'empty_invalid') {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-input)] border border-red-500/25 bg-red-500/10 px-2 py-1.5">
        <span className="h-6 w-6 rounded-full border border-red-500/30 bg-[var(--color-surface)]" />
        <span className="text-[12px] text-red-300">{tBracket('emptySlot')}</span>
      </div>
    );
  }

  const participant = slot.athlete;
  const flag = countryToFlag(participant.country);
  const content = (
    <div
      className={`flex items-center gap-2 rounded-[var(--radius-input)] px-2 py-1.5 ${
        participant.winner
          ? 'bg-emerald-500/10 text-[var(--color-text)]'
          : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
      }`}
    >
      <span className="h-6 w-6 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]" />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[12px] ${participant.winner ? 'font-semibold' : ''}`}>
          {participant.name}
        </p>
        <p className="truncate text-[11px] text-[var(--color-text-muted)]">{participant.club ?? '—'}</p>
      </div>
      <div className="flex items-center gap-1">
        {flag && <span className="text-sm" aria-hidden>{flag}</span>}
        {participant.movedUp && (
          <span className="rounded-[var(--radius-pill)] border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-300">
            ↑
          </span>
        )}
      </div>
    </div>
  );

  if (!getAthleteHref) return content;

  return (
    <Link href={getAthleteHref(participant.athleteId)} className="block transition hover:opacity-90">
      {content}
    </Link>
  );
}
