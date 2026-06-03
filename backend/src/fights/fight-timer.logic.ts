import type { FightSlot, TimerPhaseEnum, TimerStateEnum } from '@prisma/client';

export const DEFAULT_ROUND_DURATION_SECONDS = 120;
export const DEFAULT_REST_DURATION_SECONDS = 60;
export const REQUIRED_ROUND_WINS = 2;
export const MAX_FIGHT_ROUNDS = 3;

export type FightTimerSnapshot = {
  state: TimerStateEnum;
  phase: TimerPhaseEnum;
  round: number;
  startedAt: Date | null;
  pausedAt: Date | null;
  pausedMs: number;
  phaseDurationSeconds: number;
  roundDurationSeconds: number;
  restDurationSeconds: number;
  redRoundWins: number;
  blueRoundWins: number;
  round1Winner: FightSlot | null;
  round2Winner: FightSlot | null;
  round3Winner: FightSlot | null;
  updatedAt: Date;
};

export function getFightRoundDurationSeconds(input: {
  roundDurationSeconds?: number | null;
  eventWeightCategory?: {
    eventAgeGroup?: {
      categoryTemplateAgeGroup?: {
        roundDurationSeconds: number;
      } | null;
    } | null;
  } | null;
}): number {
  return (
    input.roundDurationSeconds ??
    input.eventWeightCategory?.eventAgeGroup?.categoryTemplateAgeGroup
      ?.roundDurationSeconds ??
    DEFAULT_ROUND_DURATION_SECONDS
  );
}

export function getElapsedMs(
  timer: FightTimerSnapshot,
  now = new Date(),
): number {
  if (timer.state === 'RUNNING' && timer.startedAt) {
    return Math.max(
      0,
      now.getTime() - timer.startedAt.getTime() + timer.pausedMs,
    );
  }

  return Math.max(0, timer.pausedMs);
}

export function getRemainingMs(
  timer: FightTimerSnapshot,
  now = new Date(),
): number {
  return Math.max(
    0,
    timer.phaseDurationSeconds * 1000 - getElapsedMs(timer, now),
  );
}

export function isPhaseExpired(
  timer: FightTimerSnapshot,
  now = new Date(),
): boolean {
  if (timer.state !== 'RUNNING') return false;
  return getRemainingMs(timer, now) === 0;
}

export function isAwaitingRoundResult(
  timer: FightTimerSnapshot,
  now = new Date(),
): boolean {
  return (
    timer.phase === 'ROUND' &&
    timer.state === 'PAUSED' &&
    getRemainingMs(timer, now) === 0 &&
    timer.redRoundWins < REQUIRED_ROUND_WINS &&
    timer.blueRoundWins < REQUIRED_ROUND_WINS
  );
}

export function getRoundWinnerField(
  round: number,
): 'round1Winner' | 'round2Winner' | 'round3Winner' {
  if (round <= 1) return 'round1Winner';
  if (round === 2) return 'round2Winner';
  return 'round3Winner';
}

export function getRoundWinners(
  timer: FightTimerSnapshot,
): Array<FightSlot | null> {
  return [timer.round1Winner, timer.round2Winner, timer.round3Winner];
}

export function getRecordedRoundWinner(
  timer: Pick<
    FightTimerSnapshot,
    'round' | 'round1Winner' | 'round2Winner' | 'round3Winner'
  >,
  round = timer.round,
): FightSlot | null {
  return timer[getRoundWinnerField(round)] ?? null;
}

export function getFightWinnerFromRounds(
  timer: Pick<FightTimerSnapshot, 'redRoundWins' | 'blueRoundWins'>,
): FightSlot | null {
  if (timer.redRoundWins >= REQUIRED_ROUND_WINS) return 'RED';
  if (timer.blueRoundWins >= REQUIRED_ROUND_WINS) return 'BLUE';
  return null;
}

export function buildTimerView(timer: FightTimerSnapshot | null) {
  if (!timer) return null;

  return {
    state: timer.state,
    phase: timer.phase,
    currentRound: timer.round,
    phaseStartedAt: timer.startedAt,
    pausedAt: timer.pausedAt,
    elapsed: timer.pausedMs,
    phaseDurationSeconds: timer.phaseDurationSeconds,
    roundDurationSeconds: timer.roundDurationSeconds,
    restDurationSeconds: timer.restDurationSeconds,
    redRoundWins: timer.redRoundWins,
    blueRoundWins: timer.blueRoundWins,
    roundWinners: getRoundWinners(timer),
    updatedAt: timer.updatedAt,
  };
}
