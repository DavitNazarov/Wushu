'use client';

import { useTranslations } from 'next-intl';
import type { ScheduleFightRow } from '@/types/api';
import { RECOMMENDED_FIGHT_GAP, type ScheduleIssue } from '../schedule.gaps';
import { boutNumber, resolveCornerName, type BoutNumbering } from '../schedule.display';

type Props = {
  fight: ScheduleFightRow;
  index: number;
  sessionId: string;
  locale: string;
  isEditable: boolean;
  numbering: BoutNumbering;
  issues?: ScheduleIssue[];
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
  numbering,
  issues,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: Props) {
  const t = useTranslations('schedule');
  const hasError = !!issues?.some((i) => i.severity === 'error');
  const hasWarning = !!issues?.some((i) => i.severity === 'warning');

  const winnerOf = (n: number) => t('winnerOf', { n });
  const redName = resolveCornerName({
    athleteId: fight.redAthleteId,
    sourceScheduleOrder: fight.redSourceScheduleOrder,
    displayName: fight.redDisplayName,
    displayNameKa: fight.redDisplayNameKa ?? null,
    locale,
    numbering,
    winnerOf,
  });
  const blueName = resolveCornerName({
    athleteId: fight.blueAthleteId,
    sourceScheduleOrder: fight.blueSourceScheduleOrder,
    displayName: fight.blueDisplayName,
    displayNameKa: fight.blueDisplayNameKa ?? null,
    locale,
    numbering,
    winnerOf,
  });
  const badge = boutNumber(fight, numbering) ?? index + 1;

  // Error (impossible order) wins the card framing over a rest-gap warning.
  const frame = hasError
    ? 'border-[var(--color-danger)] bg-[var(--color-danger)]/10'
    : hasWarning
      ? 'border-[var(--color-warning)] bg-[var(--color-warning)]/10'
      : 'border-[var(--color-border)] bg-[var(--color-surface)]';

  const issueName = (issue: ScheduleIssue) => (issue.side === 'red' ? redName : blueName);

  return (
    <div
      draggable={isEditable}
      onDragStart={(e) => { e.stopPropagation(); onDragStart(fight.id, sessionId); }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver(e, sessionId, index); }}
      onDrop={(e) => { e.stopPropagation(); onDrop(e, sessionId, index); }}
      className={`rounded-[var(--radius-card)] border px-3 py-2 text-[12px] transition
        ${frame}
        ${isDragging ? 'opacity-40' : ''}
        ${isEditable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-alt)] text-[10px] font-bold text-[var(--color-text-muted)]">
          {badge}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[var(--color-text)]">
            {redName} <span className="text-[var(--color-text-muted)]">vs</span> {blueName}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {fight.bracketRoundLabel} · #{fight.bracketFightNumber}
          </p>
        </div>
        {hasError && (
          <span className="shrink-0 rounded-full bg-[var(--color-danger)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-danger)]">
            ✕ {t('orderErrorBadge')}
          </span>
        )}
        {!hasError && hasWarning && (
          <span className="shrink-0 rounded-full bg-[var(--color-warning)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-warning)]">
            ⚠ {t('gapBadge')}
          </span>
        )}
        {fight.liveStatus === 'RUNNING' && (
          <span className="shrink-0 rounded-full bg-[var(--color-primary)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
            LIVE
          </span>
        )}
      </div>
      {issues && issues.length > 0 && (
        <ul className={`mt-1.5 space-y-0.5 border-t pt-1.5 ${hasError ? 'border-[var(--color-danger)]/30' : 'border-[var(--color-warning)]/30'}`}>
          {issues.map((issue, i) =>
            issue.severity === 'error' ? (
              <li key={i} className="text-[11px] text-[var(--color-danger)]">
                {t('orderErrorDetail', { name: issueName(issue), bout: issue.feederBout ?? 0 })}
              </li>
            ) : (
              <li key={i} className="text-[11px] text-[var(--color-warning)]">
                {t('gapWarningDetail', {
                  name: issueName(issue),
                  gap: issue.gap ?? 0,
                  recommended: RECOMMENDED_FIGHT_GAP,
                })}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
