import type { TimerState } from '@/types/api';

function getPendingRoundWinner(timerState: TimerState | null): 'RED' | 'BLUE' | null {
  if (!timerState) return null;
  return timerState.roundWinners[timerState.currentRound - 1] ?? null;
}

export function getTimerElapsedMs(
  timerState: TimerState | null,
  nowMs = Date.now(),
): number {
  if (!timerState) return 0;
  if (timerState.state === 'RUNNING' && timerState.phaseStartedAt) {
    return Math.max(
      0,
      nowMs - new Date(timerState.phaseStartedAt).getTime() + timerState.elapsed,
    );
  }

  return Math.max(0, timerState.elapsed);
}

export function getTimerRemainingMs(
  timerState: TimerState | null,
  nowMs = Date.now(),
): number {
  if (!timerState) return 0;
  return Math.max(
    0,
    timerState.phaseDurationSeconds * 1000 - getTimerElapsedMs(timerState, nowMs),
  );
}

export function formatTimerMs(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const remainder = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function isAwaitingRoundResult(timerState: TimerState | null): boolean {
  if (!timerState) return false;
  if (timerState.redRoundWins >= 2 || timerState.blueRoundWins >= 2) return false;
  if (timerState.phase === 'REST') {
    return !getPendingRoundWinner(timerState);
  }
  return (
    timerState.phase === 'ROUND' &&
    timerState.state === 'PAUSED' &&
    getTimerRemainingMs(timerState) === 0 &&
    !getPendingRoundWinner(timerState)
  );
}

export function isNextRoundBlocked(timerState: TimerState | null): boolean {
  if (!timerState) return false;
  return (
    timerState.phase === 'REST' &&
    timerState.state === 'PAUSED' &&
    getTimerRemainingMs(timerState) === 0 &&
    !getPendingRoundWinner(timerState)
  );
}
