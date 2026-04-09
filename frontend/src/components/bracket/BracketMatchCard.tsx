'use client';

import Link from 'next/link';
import { countryToFlag } from './bracketDisplayMapper';
import type { BracketRendererMatch, BracketRendererParticipantSlot } from './types';

type Props = {
  match: BracketRendererMatch;
  tFightStatus: (key: string) => string;
  tBracket: (key: string, values?: Record<string, string | number | Date>) => string;
  getAthleteHref?: (athleteId: string) => string;
};

type SlotProps = {
  slot: BracketRendererParticipantSlot;
  tBracket: Props['tBracket'];
  getAthleteHref?: (athleteId: string) => string;
};

function SlimSlot({ slot, tBracket, getAthleteHref }: SlotProps) {
  if (slot.type === 'bye') {
    return (
      <div className="flex min-h-[38px] items-center px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          {tBracket('bye')}
        </span>
      </div>
    );
  }

  if (slot.type === 'pending_winner') {
    return (
      <div className="flex min-h-[38px] items-center px-3 py-1.5">
        <span className="text-[11px] text-[var(--color-text-muted)]">
          {tBracket('winnerOfMatch', { match: slot.sourceFightNumber })}
        </span>
      </div>
    );
  }

  if (slot.type === 'empty_invalid') {
    return (
      <div className="flex min-h-[38px] items-center px-3 py-1.5">
        <span className="text-[11px] text-red-400">{tBracket('emptySlot')}</span>
      </div>
    );
  }

  const { athlete } = slot;
  const flag = countryToFlag(athlete.country);

  const rowContent = (
    <div
      className={`flex min-h-[38px] items-center gap-2 px-3 py-1.5 transition-colors ${
        athlete.winner
          ? 'bg-emerald-500/10 text-[var(--color-text)]'
          : 'text-[var(--color-text-muted)]'
      }`}
    >
      {athlete.winner && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden />
      )}
      <span
        className={`min-w-0 flex-1 truncate text-[12px] leading-tight ${
          athlete.winner ? 'font-semibold text-[var(--color-text)]' : ''
        }`}
      >
        {athlete.name}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {flag && <span className="text-[11px]" aria-hidden>{flag}</span>}
        {athlete.movedUp && (
          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-1 py-0.5 text-[9px] text-indigo-300">
            ↑
          </span>
        )}
      </div>
    </div>
  );

  if (!getAthleteHref) return rowContent;
  return (
    <Link href={getAthleteHref(athlete.athleteId)} className="block hover:opacity-90">
      {rowContent}
    </Link>
  );
}

export function BracketMatchCard({ match, tFightStatus, tBracket, getAthleteHref }: Props) {
  return (
    <article className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Top participant */}
      <SlimSlot slot={match.participants.a} tBracket={tBracket} getAthleteHref={getAthleteHref} />

      {/* Dividing line — the "─────" separator */}
      <div className="h-px bg-[var(--color-border)]" />

      {/* Bottom participant */}
      <SlimSlot slot={match.participants.b} tBracket={tBracket} getAthleteHref={getAthleteHref} />

      {/* Footer — fight number + status */}
      <div className="flex items-center justify-between border-t border-[var(--color-border)]/60 bg-[var(--color-surface-alt)] px-2 py-0.5">
        <span className="text-[10px] font-medium text-[var(--color-text-muted)]">
          #{match.fightNumber}
        </span>
        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {tFightStatus(match.status)}
        </span>
      </div>
    </article>
  );
}
