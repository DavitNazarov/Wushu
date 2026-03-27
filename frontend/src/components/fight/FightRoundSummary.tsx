'use client';

import type { TimerState } from '@/types/api';
import { getRoundSlotState, type FightRoundSlotState } from '@/lib/live/fightPresentation';

type Props = {
  timerState: TimerState | null;
  t: (key: string, values?: Record<string, string | number>) => string;
};

function stateClasses(state: FightRoundSlotState): string {
  if (state === 'RED') {
    return 'border-[var(--color-danger)]/50 bg-[var(--color-danger-subtle)] text-[var(--color-text)]';
  }
  if (state === 'BLUE') {
    return 'border-sky-500/50 bg-sky-500/12 text-[var(--color-text)]';
  }
  if (state === 'ACTIVE') {
    return 'border-[var(--color-primary)]/55 bg-[var(--color-primary-subtle)] text-[var(--color-text)]';
  }
  if (state === 'NEXT') {
    return 'border-[var(--color-warning)]/50 bg-[var(--color-warning-subtle)] text-[var(--color-text)]';
  }
  return 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]';
}

function stateLabel(
  state: FightRoundSlotState,
  t: Props['t'],
): string {
  if (state === 'RED') return t('roundWonByRed');
  if (state === 'BLUE') return t('roundWonByBlue');
  if (state === 'ACTIVE') return t('roundActive');
  if (state === 'NEXT') return t('roundNext');
  return t('roundPending');
}

export function FightRoundSummary({ timerState, t }: Props) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/45 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            {t('roundSummary')}
          </p>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {t('roundWinsSummary', {
              red: timerState?.redRoundWins ?? 0,
              blue: timerState?.blueRoundWins ?? 0,
            })}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((roundNumber) => {
          const roundState = getRoundSlotState({ timerState, roundNumber });

          return (
            <div
              key={roundNumber}
              className={`rounded-[var(--radius-card)] border px-4 py-3 ${stateClasses(roundState)}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                {t('roundShort', { round: roundNumber })}
              </p>
              <p className="mt-2 text-lg font-semibold">{stateLabel(roundState, t)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
