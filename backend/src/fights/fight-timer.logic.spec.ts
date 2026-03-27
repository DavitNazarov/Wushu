import {
  getRemainingMs,
  isAwaitingRoundResult,
  type FightTimerSnapshot,
} from './fight-timer.logic';

function createTimer(
  input: Partial<FightTimerSnapshot> = {},
): FightTimerSnapshot {
  return {
    state: input.state ?? 'RUNNING',
    phase: input.phase ?? 'ROUND',
    round: input.round ?? 1,
    startedAt: input.startedAt ?? new Date('2026-03-27T10:00:00.000Z'),
    pausedAt: input.pausedAt ?? null,
    pausedMs: input.pausedMs ?? 0,
    phaseDurationSeconds: input.phaseDurationSeconds ?? 120,
    roundDurationSeconds: input.roundDurationSeconds ?? 120,
    restDurationSeconds: input.restDurationSeconds ?? 60,
    redRoundWins: input.redRoundWins ?? 0,
    blueRoundWins: input.blueRoundWins ?? 0,
    round1Winner: input.round1Winner ?? null,
    round2Winner: input.round2Winner ?? null,
    round3Winner: input.round3Winner ?? null,
    updatedAt: input.updatedAt ?? new Date('2026-03-27T10:00:00.000Z'),
  };
}

describe('fight-timer.logic', () => {
  it('counts down from the configured round duration', () => {
    const timer = createTimer();
    const now = new Date('2026-03-27T10:00:30.000Z');

    expect(getRemainingMs(timer, now)).toBe(90_000);
  });

  it('detects when a round has ended and is awaiting a round winner', () => {
    const timer = createTimer({
      state: 'PAUSED',
      phase: 'ROUND',
      startedAt: null,
      pausedMs: 120_000,
    });

    expect(isAwaitingRoundResult(timer)).toBe(true);
  });
});
