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
    expect(results.tieUnresolved).toBe(false);
  });

  it('flags the 3-way round-robin cycle and still assigns one medal each', () => {
    // a1 beats a2, a2 beats a3, a3 beats a1 — everyone finishes 1-1, so W-L
    // and head-to-head cannot separate them. Medals must be deterministic
    // (one gold, one silver, one bronze — never three golds) and the category
    // must be flagged for a manual federation decision.
    const fights: CompetitionFight[] = [
      {
        id: 'f1',
        round: 1,
        boutNo: 1,
        status: 'CONFIRMED',
        redAthleteId: 'a1',
        blueAthleteId: 'a2',
        winnerAthleteId: 'a1',
      },
      {
        id: 'f2',
        round: 2,
        boutNo: 2,
        status: 'CONFIRMED',
        redAthleteId: 'a2',
        blueAthleteId: 'a3',
        winnerAthleteId: 'a2',
      },
      {
        id: 'f3',
        round: 3,
        boutNo: 3,
        status: 'CONFIRMED',
        redAthleteId: 'a3',
        blueAthleteId: 'a1',
        winnerAthleteId: 'a3',
      },
    ];

    const results = computeCategoryResults({
      fights,
      athletes: [
        { athleteId: 'a1', athleteName: 'A One' },
        { athleteId: 'a2', athleteName: 'A Two' },
        { athleteId: 'a3', athleteName: 'A Three' },
      ],
    });

    expect(results.format).toBe('ROUND_ROBIN');
    expect(results.tieUnresolved).toBe(true);
    // Shared rank survives in the standings…
    expect(results.placements.map((row) => row.rank)).toEqual([1, 1, 1]);
    // …but exactly one of each medal is handed out, deterministically.
    expect(results.placements.map((row) => row.medal)).toEqual([
      'GOLD',
      'SILVER',
      'BRONZE',
    ]);
    expect(results.medalists.gold).not.toBeNull();
    expect(results.medalists.silver).not.toBeNull();
    expect(results.medalists.bronze).toHaveLength(1);
  });

  it('does not flag an incomplete round-robin pool as a tie', () => {
    const fights: CompetitionFight[] = [
      {
        id: 'f1',
        round: 1,
        boutNo: 1,
        status: 'CONFIRMED',
        redAthleteId: 'a1',
        blueAthleteId: 'a2',
        winnerAthleteId: 'a1',
      },
      {
        id: 'f2',
        round: 2,
        boutNo: 2,
        status: 'QUEUED',
        redAthleteId: 'a2',
        blueAthleteId: 'a3',
        winnerAthleteId: null,
      },
      {
        id: 'f3',
        round: 3,
        boutNo: 3,
        status: 'QUEUED',
        redAthleteId: 'a3',
        blueAthleteId: 'a1',
        winnerAthleteId: null,
      },
    ];

    const results = computeCategoryResults({
      fights,
      athletes: [
        { athleteId: 'a1', athleteName: 'A One' },
        { athleteId: 'a2', athleteName: 'A Two' },
        { athleteId: 'a3', athleteName: 'A Three' },
      ],
    });

    expect(results.isComplete).toBe(false);
    expect(results.tieUnresolved).toBe(false);
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
