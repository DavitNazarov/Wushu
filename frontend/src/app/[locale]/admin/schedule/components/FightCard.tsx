'use client';

import { localizedName } from '@/lib/bilingual';
import type { ScheduleFightRow } from '@/types/api';

type Props = {
  fight: ScheduleFightRow;
  index: number;
  sessionId: string;
  locale: string;
  isEditable: boolean;
  isGapViolation: boolean;
  isDragging: boolean;
  onDragStart: (fightId: string, fromSessionId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, sessionId: string, insertAfterOrder: number) => void;
  onDrop: (e: React.DragEvent, sessionId: string, insertAfterOrder: number) => void;
};

export function FightCard({
  fight,
  index,
  sessionId,
  locale,
  isEditable,
  isGapViolation,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: Props) {
  return (
    <div
      draggable={isEditable}
      onDragStart={(e) => { e.stopPropagation(); onDragStart(fight.id, sessionId); }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver(e, sessionId, index); }}
      onDrop={(e) => { e.stopPropagation(); onDrop(e, sessionId, index); }}
      className={`flex items-center gap-2 rounded-[var(--radius-card)] border bg-[var(--color-surface)] px-3 py-2 text-[12px] transition
        ${isGapViolation ? 'border-[var(--color-warning)]' : 'border-[var(--color-border)]'}
        ${isDragging ? 'opacity-40' : ''}
        ${isEditable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-alt)] text-[10px] font-bold text-[var(--color-text-muted)]">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[var(--color-text)]">
          {localizedName(fight.redDisplayName, fight.redDisplayNameKa, locale)} <span className="text-[var(--color-text-muted)]">vs</span> {localizedName(fight.blueDisplayName, fight.blueDisplayNameKa, locale)}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {fight.bracketRoundLabel} · #{fight.bracketFightNumber}
        </p>
      </div>
      {isGapViolation && (
        <span className="shrink-0 rounded-full bg-[var(--color-warning)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-warning)]">
          ⚠ gap
        </span>
      )}
      {fight.liveStatus === 'RUNNING' && (
        <span className="shrink-0 rounded-full bg-[var(--color-primary)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
          LIVE
        </span>
      )}
    </div>
  );
}
