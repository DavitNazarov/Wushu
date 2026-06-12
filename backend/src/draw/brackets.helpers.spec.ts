import {
  deriveBracketCategoryStatus,
  detectCategoryIntegrityIssues,
  isEventPublished,
  isSwapLockedFight,
  roundStageLabel,
} from './brackets.helpers';

// Pin behavior of the post-draw helpers — status derivation, issue detection,
// stage labels. All four functions are pure so tests are straight in/out.
describe('brackets.helpers', () => {
  it('treats lifecycle published stages as published', () => {
    expect(isEventPublished({ lifecycle: 'PUBLISHED', published: false })).toBe(
      true,
    );
    expect(isEventPublished({ lifecycle: 'LIVE', published: false })).toBe(
      true,
    );
    expect(isEventPublished({ lifecycle: 'LOCKED', published: true })).toBe(
      true,
    );
    expect(isEventPublished({ lifecycle: 'LOCKED', published: false })).toBe(
      false,
    );
  });

  it('derives empty and not-generated statuses correctly', () => {
    expect(
      deriveBracketCategoryStatus({
        hasFights: false,
        totalFights: 0,
        hasAnyBracketInEvent: false,
        eligibleAthletesCount: 0,
        completedFightsCount: 0,
        inProgressFightsCount: 0,
        hasIntegrityIssue: false,
        eventPublished: false,
      }),
    ).toBe('EMPTY');

    expect(
      deriveBracketCategoryStatus({
        hasFights: false,
        totalFights: 0,
        hasAnyBracketInEvent: false,
        eligibleAthletesCount: 4,
        completedFightsCount: 0,
        inProgressFightsCount: 0,
        hasIntegrityIssue: false,
        eventPublished: false,
      }),
    ).toBe('NOT_GENERATED');
  });

  it('derives active bracket statuses correctly', () => {
    expect(
      deriveBracketCategoryStatus({
        hasFights: true,
        totalFights: 7,
        hasAnyBracketInEvent: true,
        eligibleAthletesCount: 8,
        completedFightsCount: 7,
        inProgressFightsCount: 0,
        hasIntegrityIssue: false,
        eventPublished: false,
      }),
    ).toBe('COMPLETED');

    expect(
      deriveBracketCategoryStatus({
        hasFights: true,
        totalFights: 7,
        hasAnyBracketInEvent: true,
        eligibleAthletesCount: 8,
        completedFightsCount: 2,
        inProgressFightsCount: 1,
        hasIntegrityIssue: false,
        eventPublished: false,
      }),
    ).toBe('IN_PROGRESS');

    expect(
      deriveBracketCategoryStatus({
        hasFights: true,
        totalFights: 7,
        hasAnyBracketInEvent: true,
        eligibleAthletesCount: 8,
        completedFightsCount: 0,
        inProgressFightsCount: 0,
        hasIntegrityIssue: false,
        eventPublished: true,
      }),
    ).toBe('PUBLISHED');

    expect(
      deriveBracketCategoryStatus({
        hasFights: true,
        totalFights: 7,
        hasAnyBracketInEvent: true,
        eligibleAthletesCount: 8,
        completedFightsCount: 0,
        inProgressFightsCount: 0,
        hasIntegrityIssue: false,
        eventPublished: false,
      }),
    ).toBe('GENERATED_DRAFT');
  });

  it('does not flag a freshly-drawn bracket with a resolved BYE as in progress', () => {
    // 5 athletes → an opening BYE auto-CONFIRMED at draw time; the remaining
    // real fights are still QUEUED. The bye alone must NOT read as progress.
    const base = {
      hasFights: true as const,
      totalFights: 4,
      hasAnyBracketInEvent: true as const,
      eligibleAthletesCount: 5,
      completedFightsCount: 1, // the BYE walkover
      inProgressFightsCount: 0,
      nonByeCompletedFightsCount: 0, // ...but it's a bye, so zero real progress
      nonByeInProgressFightsCount: 0,
      hasIntegrityIssue: false,
    };

    expect(
      deriveBracketCategoryStatus({ ...base, eventPublished: false }),
    ).toBe('GENERATED_DRAFT');
    expect(deriveBracketCategoryStatus({ ...base, eventPublished: true })).toBe(
      'PUBLISHED',
    );
  });

  it('still flags a bracket as in progress once a real (non-bye) fight starts', () => {
    expect(
      deriveBracketCategoryStatus({
        hasFights: true,
        totalFights: 4,
        hasAnyBracketInEvent: true,
        eligibleAthletesCount: 5,
        completedFightsCount: 2, // 1 bye + 1 real result
        inProgressFightsCount: 0,
        nonByeCompletedFightsCount: 1,
        nonByeInProgressFightsCount: 0,
        hasIntegrityIssue: false,
        eventPublished: false,
      }),
    ).toBe('IN_PROGRESS');
  });

  it('flags integrity issues with expected codes', () => {
    const issues = detectCategoryIntegrityIssues({
      competitionFormat: 'SINGLE_ELIMINATION',
      hasFights: true,
      hasInvalidBlankFights: true,
      completeWithoutWinner: true,
      hasMissingFinalRound: true,
      duplicateAthleteInOpeningRound: true,
      duplicateAthleteInActiveFights: true,
      hasRoundRobinMissingPairings: false,
      hasRoundRobinByes: false,
    });

    const codes = issues.map((issue) => issue.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'INVALID_EMPTY_FIGHT',
        'MISSING_FIGHT_WINNER',
        'MISSING_FINAL_FIGHT',
        'DUPLICATE_OPENING_ROUND_ATHLETE',
        'DUPLICATE_ACTIVE_FIGHT_ATHLETE',
      ]),
    );
  });

  it('allows swapping byes but locks running / decided fights', () => {
    // CONFIRMED BYE (single-sided walkover) — swappable.
    expect(
      isSwapLockedFight({
        status: 'CONFIRMED',
        redAthleteId: 'a1',
        blueAthleteId: null,
      }),
    ).toBe(false);

    // Plain QUEUED fight — swappable.
    expect(
      isSwapLockedFight({
        status: 'QUEUED',
        redAthleteId: 'a1',
        blueAthleteId: 'a2',
      }),
    ).toBe(false);

    // CONFIRMED real result (both athletes) — locked.
    expect(
      isSwapLockedFight({
        status: 'CONFIRMED',
        redAthleteId: 'a1',
        blueAthleteId: 'a2',
      }),
    ).toBe(true);

    // Running fights — locked regardless of byes.
    expect(
      isSwapLockedFight({
        status: 'IN_PROGRESS',
        redAthleteId: 'a1',
        blueAthleteId: 'a2',
      }),
    ).toBe(true);
    expect(
      isSwapLockedFight({
        status: 'PAUSED',
        redAthleteId: 'a1',
        blueAthleteId: null,
      }),
    ).toBe(true);
  });

  it('maps round labels consistently', () => {
    expect(roundStageLabel(4, 4, 'SINGLE_ELIMINATION')).toBe('FINAL');
    expect(roundStageLabel(3, 4, 'SINGLE_ELIMINATION')).toBe('SEMIFINAL');
    expect(roundStageLabel(2, 4, 'SINGLE_ELIMINATION')).toBe('QUARTERFINAL');
    expect(roundStageLabel(1, 4, 'SINGLE_ELIMINATION')).toBe('ROUND_1');
    expect(roundStageLabel(1, 1, 'ROUND_ROBIN')).toBe('ROUND_ROBIN');
  });
});
