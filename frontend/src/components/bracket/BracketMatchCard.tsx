'use client';

import { useState } from 'react';
import Link from 'next/link';
import { countryToFlag } from './bracketDisplayMapper';
import type { BracketRendererMatch, BracketRendererParticipantSlot } from './types';

type DragInfo = { fightId: string; side: 'a' | 'b'; athleteId: string };

type Props = {
  match: BracketRendererMatch;
  tFightStatus: (key: string) => string;
  tBracket: (key: string, values?: Record<string, string | number | Date>) => string;
  getAthleteHref?: (athleteId: string) => string;
  editMode?: boolean;
  onDragStart?: (info: DragInfo) => void;
  onDrop?: (info: { fightId: string; side: 'a' | 'b' }) => void;
};

type SlotProps = {
  slot: BracketRendererParticipantSlot;
  corner: 'red' | 'blue';
  tBracket: Props['tBracket'];
  getAthleteHref?: (athleteId: string) => string;
  editMode?: boolean;
  fightId?: string;
  side?: 'a' | 'b';
  onDragStart?: (info: { fightId: string; side: 'a' | 'b'; athleteId: string }) => void;
  onDrop?: (info: { fightId: string; side: 'a' | 'b' }) => void;
};

function SlimSlot({ slot, corner, tBracket, getAthleteHref, editMode, fightId, side, onDragStart, onDrop }: SlotProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const cornerDot = corner === 'red'
    ? 'bg-red-500'
    : 'bg-blue-500';

  const cornerLabel = (
    <span className={`mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${cornerDot}`} aria-hidden />
  );

  if (slot.type === 'bye') {
    return (
      <div className="flex min-h-[38px] items-center px-3 py-1.5">
        {cornerLabel}
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          {tBracket('bye')}
        </span>
      </div>
    );
  }

  if (slot.type === 'pending_winner') {
    return (
      <div className="flex min-h-[38px] items-center px-3 py-1.5">
        {cornerLabel}
        <span className="text-[11px] text-[var(--color-text-muted)]">
          {tBracket('winnerOfMatch', { match: slot.sourceFightNumber })}
        </span>
      </div>
    );
  }

  if (slot.type === 'empty_invalid') {
    return (
      <div className="flex min-h-[38px] items-center px-3 py-1.5">
        {cornerLabel}
        <span className="text-[11px] text-red-400">{tBracket('emptySlot')}</span>
      </div>
    );
  }

  const { athlete } = slot;
  const flag = countryToFlag(athlete.country);
  const isDroppable = editMode && slot.type === 'athlete';

  const rowContent = (
    <div
      draggable={editMode && slot.type === 'athlete'}
      onDragStart={editMode && slot.type === 'athlete' && fightId && side ? (e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.({ fightId, side, athleteId: athlete.athleteId });
      } : undefined}
      onDragOver={isDroppable ? (e) => { e.preventDefault(); setIsDragOver(true); } : undefined}
      onDragLeave={isDroppable ? () => setIsDragOver(false) : undefined}
      onDrop={isDroppable && fightId && side ? (e) => {
        e.preventDefault();
        setIsDragOver(false);
        onDrop?.({ fightId, side });
      } : undefined}
      className={`flex min-h-[38px] items-center gap-2 px-3 py-1.5 transition-colors ${
        athlete.winner
          ? 'bg-emerald-500/10 text-[var(--color-text)]'
          : 'text-[var(--color-text-muted)]'
      } ${editMode ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragOver ? 'ring-1 ring-inset ring-[var(--color-primary)]' : ''}`}
    >
      {cornerLabel}
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

  if (!getAthleteHref || editMode) return rowContent;
  return (
    <Link href={getAthleteHref(athlete.athleteId)} className="block hover:opacity-90">
      {rowContent}
    </Link>
  );
}

export function BracketMatchCard({ match, tFightStatus, tBracket, getAthleteHref, editMode, onDragStart, onDrop }: Props) {
  return (
    <article className={`overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] ${editMode ? 'ring-1 ring-[var(--color-primary)]/20' : ''}`}>
      {/* Top participant — Red corner */}
      <SlimSlot
        slot={match.participants.a}
        corner="red"
        tBracket={tBracket}
        getAthleteHref={getAthleteHref}
        editMode={editMode}
        fightId={match.id}
        side="a"
        onDragStart={onDragStart}
        onDrop={onDrop}
      />

      {/* Dividing line */}
      <div className="h-px bg-[var(--color-border)]" />

      {/* Bottom participant — Blue corner */}
      <SlimSlot
        slot={match.participants.b}
        corner="blue"
        tBracket={tBracket}
        getAthleteHref={getAthleteHref}
        editMode={editMode}
        fightId={match.id}
        side="b"
        onDragStart={onDragStart}
        onDrop={onDrop}
      />

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
