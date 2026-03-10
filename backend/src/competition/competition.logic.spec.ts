import {
  buildBracketOrCompetitionViewModel,
  computeCategoryResults,
  computeRoundRobinStandings,
  validateCompetitionStructure,
  type CompetitionFight,
} from './competition.logic';

describe('competition.logic', () => {
  it('handles 2-athlete direct final as one fight', () => {
    const fights: CompetitionFight[] = [
      {
        id: 'f1',
        round: 1,
        boutNo: 1,
        status: 'QUEUED',
        redAthleteId: 'a1',
        blueAthleteId: 'a2',
        winnerAthleteId: null,
      },
    ];

    const model = buildBracketOrCompetitionViewModel({
      fights,
      athletes: [
        { athleteId: 'a1', athleteName: 'A One' },
        { athleteId: 'a2', athleteName: 'A Two' },
      ],
    });

    expect(model.format).toBe('DIRECT_FINAL');
    expect(model.totalFights).toBe(1);
    expect(model.currentFight?.stageLabel).toBe('FINAL');
  });

  it('handles 3-athlete round robin with 3 pairings', () => {
    const fights: CompetitionFight[] = [
      {
        id: 'f1',
        round: 1,
        boutNo: 1,
        status: 'COMPLETE',
        redAthleteId: 'a1',
        blueAthleteId: 'a2',
        winnerAthleteId: 'a1',
      },
      {
        id: 'f2',
        round: 1,
        boutNo: 2,
        status: 'COMPLETE',
        redAthleteId: 'a1',
        blueAthleteId: 'a3',
        winnerAthleteId: 'a1',
      },
      {
        id: 'f3',
        round: 1,
        boutNo: 3,
        status: 'COMPLETE',
        redAthleteId: 'a2',
        blueAthleteId: 'a3',
        winnerAthleteId: 'a2',
      },
    ];

    const standings = computeRoundRobinStandings({
      fights,
      athletes: [
        { athleteId: 'a1', athleteName: 'A One' },
        { athleteId: 'a2', athleteName: 'A Two' },
        { athleteId: 'a3', athleteName: 'A Three' },
      ],
    });

    expect(standings).toHaveLength(3);
    expect(standings[0].athleteId).toBe('a1');
    expect(standings[0].wins).toBe(2);

    const results = computeCategoryResults({
      fights,
      athletes: [
        { athleteId: 'a1', athleteName: 'A One' },
        { athleteId: 'a2', athleteName: 'A Two' },
        { athleteId: 'a3', athleteName: 'A Three' },
      ],
    });
    expect(results.format).toBe('ROUND_ROBIN');
    expect(results.placements.map((row) => row.rank)).toEqual([1, 2, 3]);
  });

  it('shows winner placeholders for unresolved elimination final slots', () => {
    const fights: CompetitionFight[] = [
      {
        id: 'sf1',
        round: 1,
        boutNo: 1,
        status: 'QUEUED',
        redAthleteId: 'a1',
        blueAthleteId: 'a2',
        winnerAthleteId: null,
      },
      {
        id: 'sf2',
        round: 1,
        boutNo: 2,
        status: 'QUEUED',
        redAthleteId: 'a3',
        blueAthleteId: 'a4',
        winnerAthleteId: null,
      },
      {
        id: 'f1',
        round: 2,
        boutNo: 1,
        status: 'QUEUED',
        redAthleteId: null,
        blueAthleteId: null,
        winnerAthleteId: null,
      },
    ];

    const model = buildBracketOrCompetitionViewModel({
      format: 'SINGLE_ELIMINATION',
      fights,
      athletes: [
        { athleteId: 'a1', athleteName: 'A One' },
        { athleteId: 'a2', athleteName: 'A Two' },
        { athleteId: 'a3', athleteName: 'A Three' },
        { athleteId: 'a4', athleteName: 'A Four' },
      ],
    });

    const finalFight = model.queue.find((fight) => fight.id === 'f1');
    expect(finalFight?.red.kind).toBe('WINNER_PLACEHOLDER');
    expect(finalFight?.red.name).toBe('Winner of 1');
    expect(finalFight?.blue.name).toBe('Winner of 2');
  });

  it('does not flag pending elimination as needs review', () => {
    const fights: CompetitionFight[] = [
      {
        id: 'sf1',
        round: 1,
        boutNo: 1,
        status: 'COMPLETE',
        redAthleteId: 'a1',
        blueAthleteId: 'a2',
        winnerAthleteId: 'a1',
      },
      {
        id: 'sf2',
        round: 1,
        boutNo: 2,
        status: 'QUEUED',
        redAthleteId: 'a3',
        blueAthleteId: 'a4',
        winnerAthleteId: null,
      },
      {
        id: 'f1',
        round: 2,
        boutNo: 1,
        status: 'QUEUED',
        redAthleteId: 'a1',
        blueAthleteId: null,
        winnerAthleteId: null,
      },
    ];

    const validation = validateCompetitionStructure({
      format: 'SINGLE_ELIMINATION',
      fights,
      athleteIds: ['a1', 'a2', 'a3', 'a4'],
    });
    expect(validation.needsReview).toBe(false);
  });

  it('flags invalid round robin structure as needs review', () => {
    const fights: CompetitionFight[] = [
      {
        id: 'f1',
        round: 1,
        boutNo: 1,
        status: 'QUEUED',
        redAthleteId: 'a1',
        blueAthleteId: 'a2',
        winnerAthleteId: null,
      },
      {
        id: 'f2',
        round: 1,
        boutNo: 2,
        status: 'QUEUED',
        redAthleteId: 'a1',
        blueAthleteId: 'a2',
        winnerAthleteId: null,
      },
    ];

    const validation = validateCompetitionStructure({
      format: 'ROUND_ROBIN',
      fights,
      athleteIds: ['a1', 'a2', 'a3'],
    });

    expect(validation.needsReview).toBe(true);
    expect(validation.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'ROUND_ROBIN_DUPLICATE_PAIRING',
        'ROUND_ROBIN_MISSING_PAIRINGS',
      ]),
    );
  });
});
