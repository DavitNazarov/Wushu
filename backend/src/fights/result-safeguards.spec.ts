import {
  hasRecordedResult,
  isDownstreamFightLocked,
} from './result-safeguards';

// Characterization tests — they pin the CURRENT behaviour of the two
// result-safety predicates so the Tier-2 unification (centralising winner
// propagation across draw.service + fights.service) cannot silently change
// what counts as "already has a result" or "downstream fight is locked".
//
// isDownstreamFightLocked is the guard the fights.service propagation path
// uses but the draw.service copy does NOT — locking it here is the safety net
// for that consolidation. Do not "improve" these expectations; if a future
// change must alter them, that is a deliberate decision and the test should be
// updated in the same change with a reason.

describe('hasRecordedResult (characterization)', () => {
  const base = { status: 'QUEUED' as const, winnerAthleteId: null };

  it('is true when a winner is recorded, regardless of status', () => {
    expect(hasRecordedResult({ ...base, winnerAthleteId: 'ath_1' })).toBe(true);
  });

  it('is true when status is COMPLETE even without a winner', () => {
    expect(hasRecordedResult({ status: 'COMPLETE', winnerAthleteId: null })).toBe(
      true,
    );
  });

  it('is true when status is CONFIRMED even without a winner', () => {
    expect(
      hasRecordedResult({ status: 'CONFIRMED', winnerAthleteId: null }),
    ).toBe(true);
  });

  it('is false for a fresh QUEUED fight with no winner', () => {
    expect(hasRecordedResult(base)).toBe(false);
  });

  it('is false for an ON_DECK/IN_PROGRESS fight with no winner', () => {
    expect(
      hasRecordedResult({ status: 'ON_DECK', winnerAthleteId: null }),
    ).toBe(false);
    expect(
      hasRecordedResult({ status: 'IN_PROGRESS', winnerAthleteId: null }),
    ).toBe(false);
  });
});

describe('isDownstreamFightLocked (characterization)', () => {
  // A pristine, safe-to-overwrite downstream slot: still QUEUED, no result
  // fields, timer idle.
  const open = {
    status: 'QUEUED' as const,
    winnerAthleteId: null,
    loserAthleteId: null,
    winMethod: null,
    confirmedAt: null,
    timerState: { state: 'IDLE' as const },
  };

  it('is UNLOCKED for a pristine QUEUED slot with an idle timer', () => {
    expect(isDownstreamFightLocked(open)).toBe(false);
  });

  it('is UNLOCKED when the timer is missing entirely', () => {
    expect(isDownstreamFightLocked({ ...open, timerState: null })).toBe(false);
  });

  it('is UNLOCKED when the timer has FINISHED but nothing was recorded', () => {
    expect(
      isDownstreamFightLocked({ ...open, timerState: { state: 'FINISHED' } }),
    ).toBe(false);
  });

  it.each(['ON_DECK', 'IN_PROGRESS', 'PAUSED', 'COMPLETE', 'CONFIRMED'] as const)(
    'is LOCKED once status has moved past QUEUED (%s)',
    (status) => {
      expect(isDownstreamFightLocked({ ...open, status })).toBe(true);
    },
  );

  it('is LOCKED when a winner has already been propagated in', () => {
    expect(isDownstreamFightLocked({ ...open, winnerAthleteId: 'ath_1' })).toBe(
      true,
    );
  });

  it('is LOCKED when a loser has already been propagated in', () => {
    expect(isDownstreamFightLocked({ ...open, loserAthleteId: 'ath_2' })).toBe(
      true,
    );
  });

  it('is LOCKED when a win method is already set', () => {
    expect(isDownstreamFightLocked({ ...open, winMethod: 'POINTS' })).toBe(true);
  });

  it('is LOCKED when the fight has been confirmed', () => {
    expect(
      isDownstreamFightLocked({ ...open, confirmedAt: new Date() }),
    ).toBe(true);
  });

  it.each(['RUNNING', 'PAUSED'] as const)(
    'is LOCKED when the timer is already active (%s)',
    (state) => {
      expect(isDownstreamFightLocked({ ...open, timerState: { state } })).toBe(
        true,
      );
    },
  );
});
