'use client';

import { useTranslations } from 'next-intl';
import type { ScheduleFightRow, ScheduleSessionRow } from '@/types/api';
import { localizedName } from '@/lib/bilingual';
import { formatTime } from '../schedule.utils';
import type { ScheduleIssue } from '../schedule.gaps';
import type { BoutNumbering } from '../schedule.display';
import type { DragFight, DropFightTarget } from '../schedule.types';
import { FightCard } from './FightCard';
import { DropZone } from './DropZone';

type Props = {
  session: ScheduleSessionRow;
  fights: ScheduleFightRow[];
  locale: string;
  isEditable: boolean;
  numbering: BoutNumbering;
  issues: Map<string, ScheduleIssue[]>;
  dragFight: DragFight | null;
  dropFightTarget: DropFightTarget | null;
  dragSessionId: string | null;
  isSessionDropTarget: boolean;
  onSessionDragStart: () => void;
  onSessionDragEnd: () => void;
  onSessionDragOver: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFightDragStart: (fightId: string, fromSessionId: string) => void;
  onFightDragEnd: () => void;
  onFightDragOver: (e: React.DragEvent, sessionId: string, insertAfterOrder: number) => void;
  onFightDrop: (e: React.DragEvent, sessionId: string, insertAfterOrder: number) => void;
};

export function SessionCard({
  session,
  fights,
  locale,
  isEditable,
  numbering,
  issues,
  dragFight,
  dropFightTarget,
  dragSessionId,
  isSessionDropTarget,
  onSessionDragStart,
  onSessionDragEnd,
  onSessionDragOver,
  onEdit,
  onDelete,
  onFightDragStart,
  onFightDragEnd,
  onFightDragOver,
  onFightDrop,
}: Props) {
  const t = useTranslations('schedule');
  const tCommon = useTranslations('common');

  return (
    <div
      draggable={isEditable && !dragFight}
      onDragStart={(e) => { if (isEditable && !dragFight) { e.stopPropagation(); onSessionDragStart(); }}}
      onDragEnd={onSessionDragEnd}
      onDragOver={(e) => { e.preventDefault(); if (dragSessionId) onSessionDragOver(); }}
      className={`rounded-[var(--radius-card)] border transition
        ${isSessionDropTarget ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-border)] bg-[var(--color-surface-alt)]'}
        ${dragSessionId === session.id ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3">
          {isEditable && (
            <span className="select-none text-[var(--color-text-muted)]">⠿</span>
          )}
          <span className="text-[13px] font-semibold text-[var(--color-text)]">
            {localizedName(session.name, session.nameKa, locale)}
          </span>
          <span className="text-[12px] text-[var(--color-text-muted)]">
            {formatTime(session.startTime)} – {formatTime(session.endTime)}
          </span>
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] text-[var(--color-text-muted)]">
            {fights.length}
          </span>
        </div>
        {isEditable && (
          <div className="flex gap-3">
            <button onClick={onEdit} className="text-[12px] text-[var(--color-primary)] hover:underline">
              {tCommon('edit')}
            </button>
            <button onClick={onDelete} className="text-[12px] text-[var(--color-danger)] hover:underline">
              {tCommon('delete')}
            </button>
          </div>
        )}
      </div>

      <div
        className="space-y-1 px-4 pb-3"
        onDragOver={(e) => { e.preventDefault(); if (dragFight && fights.length === 0) onFightDragOver(e, session.id, 0); }}
        onDrop={(e) => { if (dragFight && fights.length === 0) onFightDrop(e, session.id, 0); }}
      >
        {isEditable && dragFight && (
          <DropZone
            sessionId={session.id}
            insertAfterOrder={0}
            active={dropFightTarget?.sessionId === session.id && dropFightTarget.insertAfterOrder === 0}
            onDragOver={onFightDragOver}
            onDrop={onFightDrop}
          />
        )}

        {fights.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-[var(--color-text-muted)]">{t('emptySession')}</p>
        ) : (
          fights.map((fight, idx) => (
            <div key={fight.id}>
              <FightCard
                fight={fight}
                index={idx}
                sessionId={session.id}
                locale={locale}
                isEditable={isEditable}
                numbering={numbering}
                issues={issues.get(fight.id)}
                isDragging={dragFight?.fightId === fight.id}
                onDragStart={onFightDragStart}
                onDragEnd={onFightDragEnd}
                onDragOver={onFightDragOver}
                onDrop={onFightDrop}
              />
              {isEditable && dragFight && (
                <DropZone
                  sessionId={session.id}
                  insertAfterOrder={idx + 1}
                  active={dropFightTarget?.sessionId === session.id && dropFightTarget.insertAfterOrder === idx + 1}
                  onDragOver={onFightDragOver}
                  onDrop={onFightDrop}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
