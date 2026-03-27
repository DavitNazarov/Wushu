'use client';

import type { ScheduleFightRow } from '@/types/api';

function statusTone(status: ScheduleFightRow['liveStatus']) {
  switch (status) {
    case 'RUNNING':
      return 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]';
    case 'FINISHED':
      return 'bg-[var(--color-success)]/20 text-[var(--color-success)]';
    case 'UPCOMING':
      return 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]';
    default:
      return 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]';
  }
}

type Props = {
  fights: ScheduleFightRow[];
  fightReadyLabel: string;
  fightWaitingLabel: string;
};

export function ScheduleFightGrid({
  fights,
  fightReadyLabel,
  fightWaitingLabel,
}: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {fights.map((fight) => (
        <div
          key={fight.id}
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-[var(--color-text-muted)]">
              #{fight.orderInMat ?? fight.scheduleOrder ?? '-'}
            </div>
            <span
              className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone(
                fight.liveStatus,
              )}`}
            >
              {(fight.liveStatus ?? 'PENDING').toLowerCase()}
            </span>
          </div>

          <div className="mt-2 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
            {fight.bracketRoundLabel} • {fight.bracketFightNumber}
          </div>

          <div className="mt-2 text-[13px] font-medium text-red-400">{fight.redDisplayName}</div>
          <div className="text-[13px] font-medium text-blue-400">{fight.blueDisplayName}</div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
            <span>{fight.isPlayable ? fightReadyLabel : fightWaitingLabel}</span>
            {fight.matName && <span>• {fight.matName}</span>}
            {fight.scheduledAt && (
              <span>
                •{' '}
                {new Date(fight.scheduledAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
