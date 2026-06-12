import type { TimerState } from '@/types/api';

export type FightCorner = 'RED' | 'BLUE';
export type FightDisplayTone = 'live' | 'rest' | 'finished' | 'idle';
export type FightRoundSlotState = FightCorner | 'ACTIVE' | 'NEXT' | 'PENDING';

export function getFightWinnerCorner(input: {
  winnerAthleteId?: string | null;
  redAthleteId?: string | null;
  blueAthleteId?: string | null;
}): FightCorner | null {
  if (!input.winnerAthleteId) return null;
  if (input.winnerAthleteId === input.redAthleteId) return 'RED';
  if (input.winnerAthleteId === input.blueAthleteId) return 'BLUE';
  return null;
}

export function getFightDisplayTone(input: {
  timerState: TimerState | null;
  winnerAthleteId?: string | null;
}): FightDisplayTone {
  if (input.winnerAthleteId || input.timerState?.phase === 'FINISHED') {
    return 'finished';
  }
  if (input.timerState?.phase === 'REST') {
    return 'rest';
  }
  if (input.timerState?.phase === 'ROUND') {
    return 'live';
  }
  return 'idle';
}

export function getRoundSlotState(input: {
  timerState: TimerState | null;
  roundNumber: number;
}): FightRoundSlotState {
  const winner = input.timerState?.roundWinners[input.roundNumber - 1] ?? null;
  if (winner) return winner;

  if (!input.timerState) return 'PENDING';

  if (
    input.timerState.phase === 'ROUND' &&
    input.timerState.currentRound === input.roundNumber &&
    input.timerState.state !== 'FINISHED'
  ) {
    return 'ACTIVE';
  }

  if (
    input.timerState.phase === 'REST' &&
    input.timerState.currentRound + 1 === input.roundNumber &&
    input.roundNumber <= 3
  ) {
    return 'NEXT';
  }

  return 'PENDING';
}
