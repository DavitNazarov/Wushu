import {
  buildMedalTable,
  buildPlacementsFromConfirmedFights,
} from './results.logic';

describe('results.logic', () => {
  it('builds placements from confirmed single-elimination fights', () => {
    const fights = [
      {
        id: 'f1',
        categoryCode: 'Senior Men 60kg',
        round: 1,
        boutNo: 1,
        winnerAthleteId: 'a1',
        redAthleteId: 'a1',
        blueAthleteId: 'a2',
      },
      {
        id: 'f2',
        categoryCode: 'Senior Men 60kg',
        round: 1,
        boutNo: 2,
        winnerAthleteId: 'a3',
        redAthleteId: 'a3',
        blueAthleteId: 'a4',
      },
      {
        id: 'f3',
        categoryCode: 'Senior Men 60kg',
        round: 2,
        boutNo: 1,
        winnerAthleteId: 'a1',
        redAthleteId: 'a1',
        blueAthleteId: 'a3',
      },
    ];

    const placements = buildPlacementsFromConfirmedFights(fights);
    expect(placements).toHaveLength(1);
    expect(placements[0]).toEqual({
      categoryCode: 'Senior Men 60kg',
      goldAthleteId: 'a1',
      silverAthleteId: 'a3',
      bronzeAthleteIds: ['a2', 'a4'],
    });
  });

  it('builds medal table by club', () => {
    const placements = [
      {
        categoryCode: 'Senior Men 60kg',
        goldAthleteId: 'a1',
        silverAthleteId: 'a3',
        bronzeAthleteIds: ['a2', 'a4'],
      },
    ];
    const athleteClubById = new Map([
      ['a1', { clubId: 'c1', clubName: 'Club 1' }],
      ['a2', { clubId: 'c2', clubName: 'Club 2' }],
      ['a3', { clubId: 'c1', clubName: 'Club 1' }],
      ['a4', { clubId: 'c3', clubName: 'Club 3' }],
    ]);

    const medalTable = buildMedalTable({ placements, athleteClubById });

    expect(medalTable[0]).toEqual({
      clubId: 'c1',
      clubName: 'Club 1',
      gold: 1,
      silver: 1,
      bronze: 0,
      total: 2,
    });
    expect(medalTable).toHaveLength(3);
  });
});
