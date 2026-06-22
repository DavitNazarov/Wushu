import { isFightPlayable } from './schedule-fight-candidates.logic';

// Characterization tests for the canonical, exported fight-playability rule.
// The SAME logic is currently duplicated as a private method in both
// FightsService and ScheduleService (verified byte-identical at the time of
// writing). This spec pins the rule so the Tier-2 consolidation — making
// fights + schedule share one pure helper — provably preserves which fights
// are considered runnable. A fight is playable iff: both corners filled with
// DISTINCT athletes, no winner yet, and status is one of the live/queued
// states (QUEUED | ON_DECK | IN_PROGRESS | PAUSED).

const playable = {
  redAthleteId: 'red',
  blueAthleteId: 'blue',
  winnerAthleteId: null,
  status: 'QUEUED' as const,
};

describe('isFightPlayable (characterization)', () => {
  it('is playable for a normal QUEUED bout with two distinct athletes', () => {
    expect(isFightPlayable(playable)).toBe(true);
  });

  it('is NOT playable when the red corner is empty', () => {
    expect(isFightPlayable({ ...playable, redAthleteId: null })).toBe(false);
  });

  it('is NOT playable when the blue corner is empty', () => {
    expect(isFightPlayable({ ...playable, blueAthleteId: null })).toBe(false);
  });

  it('is NOT playable when both corners are empty (placeholder node)', () => {
    expect(
      isFightPlayable({ ...playable, redAthleteId: null, blueAthleteId: null }),
    ).toBe(false);
  });

  it('is NOT playable when the same athlete is in both corners', () => {
    expect(
      isFightPlayable({ ...playable, redAthleteId: 'x', blueAthleteId: 'x' }),
    ).toBe(false);
  });

  it('is NOT playable once a winner has been recorded', () => {
    expect(isFightPlayable({ ...playable, winnerAthleteId: 'red' })).toBe(false);
  });

  it.each(['QUEUED', 'ON_DECK', 'IN_PROGRESS', 'PAUSED'] as const)(
    'is playable in the live/queued status %s',
    (status) => {
      expect(isFightPlayable({ ...playable, status })).toBe(true);
    },
  );

  it.each(['COMPLETE', 'CONFIRMED'] as const)(
    'is NOT playable in the finished status %s',
    (status) => {
      expect(isFightPlayable({ ...playable, status })).toBe(false);
    },
  );

  it('treats winnerAthleteId as optional (absent === no winner)', () => {
    expect(
      isFightPlayable({
        redAthleteId: 'red',
        blueAthleteId: 'blue',
        status: 'QUEUED',
      }),
    ).toBe(true);
  });
});
