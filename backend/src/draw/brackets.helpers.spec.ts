import {
  deriveBracketCategoryStatus,
  detectCategoryIntegrityIssues,
  isEventPublished,
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

  it('maps round labels consistently', () => {
    expect(roundStageLabel(4, 4, 'SINGLE_ELIMINATION')).toBe('FINAL');
    expect(roundStageLabel(3, 4, 'SINGLE_ELIMINATION')).toBe('SEMIFINAL');
    expect(roundStageLabel(2, 4, 'SINGLE_ELIMINATION')).toBe('QUARTERFINAL');
    expect(roundStageLabel(1, 4, 'SINGLE_ELIMINATION')).toBe('ROUND_1');
    expect(roundStageLabel(1, 1, 'ROUND_ROBIN')).toBe('ROUND_ROBIN');
  });
});
