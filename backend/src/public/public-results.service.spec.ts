import { PublicResultsService } from './public-results.service';

// Unit coverage for the public results pipeline. Two jobs:
//   1. Type-checks the service after its fight query was narrowed from
//      `include` to an explicit `select` — accessing a non-selected column is
//      a compile error, so this spec failing to build = a missed field.
//   2. Verifies every selected field actually flows through to the response
//      (names, club, method, mat, schedule order, category/age labels) plus
//      the medal tally, on a minimal CONFIRMED direct-final bracket.

const fightRow = {
  id: 'f1',
  round: 1,
  boutNo: 1,
  status: 'CONFIRMED',
  redAthleteId: 'a1',
  blueAthleteId: 'a2',
  winnerAthleteId: 'a1',
  winMethod: 'POINTS',
  notes: null,
  orderInMat: 1,
  scheduledStartTime: null,
  categoryCode: 'CAT',
  bracketId: 'b1',
  eventWeightCategoryId: 'ewc1',
  mat: { name: 'Mat 1' },
  redAthlete: {
    id: 'a1',
    firstName: 'Red',
    lastName: 'One',
    firstNameKa: null,
    lastNameKa: null,
  },
  blueAthlete: {
    id: 'a2',
    firstName: 'Blue',
    lastName: 'Two',
    firstNameKa: null,
    lastNameKa: null,
  },
  eventWeightCategory: {
    categoryTemplateWeight: { name: '60kg', sortOrder: 1 },
    eventAgeGroup: {
      categoryTemplateAgeGroup: { name: 'Adults', sortOrder: 1 },
    },
  },
  bracket: { format: 'DIRECT_FINAL' },
};

const registrationRows = [
  { athleteId: 'a1', clubId: 'c1', club: { name: 'Club A', nameKa: null } },
  { athleteId: 'a2', clubId: 'c2', club: { name: 'Club B', nameKa: null } },
];

const makeService = () => {
  const prisma = {
    fight: { findMany: jest.fn().mockResolvedValue([fightRow]) },
    registration: { findMany: jest.fn().mockResolvedValue(registrationRows) },
  };
  return {
    service: new PublicResultsService(prisma as never),
    prisma,
  };
};

describe('PublicResultsService.getEventResults', () => {
  it('projects every selected field into the results payload', async () => {
    const { service } = makeService();
    const result = await service.getEventResults({
      eventId: 'e1',
      organisationId: 'org1',
      bronzePolicyCode: 'TWO_BRONZES',
    });

    expect(result.eventId).toBe('e1');
    expect(result.categories).toHaveLength(1);

    const category = result.categories[0];
    expect(category.categoryName).toBe('60kg'); // categoryTemplateWeight.name
    expect(category.ageGroupName).toBe('Adults'); // categoryTemplateAgeGroup.name
    expect(category.resultCount).toBe(1);

    const row = category.results[0];
    expect(row.winner.athleteId).toBe('a1'); // winnerAthleteId + redAthlete
    expect(row.winner.fullName).toBe('Red One'); // redAthlete first/last
    expect(row.winner.clubName).toBe('Club A'); // registration join
    expect(row.opponent.athleteId).toBe('a2');
    expect(row.method).toBe('POINTS'); // winMethod
    expect(row.matName).toBe('Mat 1'); // mat.name
    expect(row.scheduleOrder).toBe(1); // orderInMat
    expect(typeof row.stageCode).toBe('string'); // round + bracket.format
  });

  it('awards the medal tally to the winner’s club', async () => {
    const { service } = makeService();
    const result = await service.getEventResults({
      eventId: 'e1',
      organisationId: 'org1',
      bronzePolicyCode: 'TWO_BRONZES',
    });

    const gold = result.medalTable.find((club) => club.gold > 0);
    expect(gold?.clubId).toBe('c1');
  });

  it('scopes the fight query to the org + event', async () => {
    const { service, prisma } = makeService();
    await service.getEventResults({
      eventId: 'e1',
      organisationId: 'org1',
      bronzePolicyCode: 'TWO_BRONZES',
    });
    expect(prisma.fight.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: 'org1', eventId: 'e1' },
      }),
    );
  });
});
