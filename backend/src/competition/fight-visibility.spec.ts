import { isFightPlayable, isScheduleVisibleFight } from './fight-visibility';

// Characterization tests for the canonical fight-visibility rules. These were
// previously duplicated as private methods in FightsService + ScheduleService
// and again in schedule-fight-candidates.logic (all byte-identical); the specs
// pin the behaviour so that consolidation onto this one module provably keeps
// every caller's notion of "runnable" and "shown in the schedule" identical.

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

describe('isScheduleVisibleFight (characterization)', () => {
  // openingRound is fixed at 1; `round` varies per case.
  const visible = (
    fight: { redAthleteId: string | null; blueAthleteId: string | null; round: number },
    hasSourceDependencies: boolean,
  ) => isScheduleVisibleFight({ fight, openingRound: 1, hasSourceDependencies });

  it('hides a dead node (no athletes, no upstream dependency)', () => {
    expect(visible({ redAthleteId: null, blueAthleteId: null, round: 2 }, false)).toBe(
      false,
    );
  });

  it('shows a downstream placeholder (no athletes yet, but has dependencies)', () => {
    expect(visible({ redAthleteId: null, blueAthleteId: null, round: 2 }, true)).toBe(
      true,
    );
  });

  it('hides an opening-round BYE (only the red corner filled)', () => {
    expect(visible({ redAthleteId: 'a', blueAthleteId: null, round: 1 }, false)).toBe(
      false,
    );
  });

  it('hides an opening-round BYE (only the blue corner filled)', () => {
    expect(visible({ redAthleteId: null, blueAthleteId: 'b', round: 1 }, false)).toBe(
      false,
    );
  });

  it('shows a real opening-round bout (both corners filled)', () => {
    expect(visible({ redAthleteId: 'a', blueAthleteId: 'b', round: 1 }, false)).toBe(
      true,
    );
  });

  it('shows a later-round half-filled fight (BYE rule is opening-round only)', () => {
    expect(visible({ redAthleteId: 'a', blueAthleteId: null, round: 2 }, true)).toBe(
      true,
    );
  });
});
