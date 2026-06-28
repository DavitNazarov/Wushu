import { HttpException } from '@nestjs/common';
import type { Athlete, AthleteSex } from '@prisma/client';
import { AthletesService } from './athletes.service';

// Unit tests for AthletesService. Same mock pattern as users.service.spec.ts:
// $transaction is stubbed to invoke its callback with `prisma` as `tx`, so
// writes inside the transaction land on the mock the tests inspect.
const createPrismaMock = () => {
  const prisma: any = {
    club: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    athleteClub: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    athlete: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    registration: {
      updateMany: jest.fn(),
    },
    fight: {
      updateMany: jest.fn(),
    },
    athleteMerge: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) =>
      fn(prisma),
    ),
  };

  return prisma;
};

const createAuditMock = () => ({
  write: jest.fn(),
});

describe('AthletesService', () => {
  const organisationId = 'org_123';
  const actorUserId = 'user_123';

  // Tenant-isolation guard: a clubId that exists in another org (or not at
  // all) must surface as INVALID_CLUB, not bleed across organisations.
  it('throws INVALID_CLUB when clubId does not exist for organisation', async () => {
    const prisma = createPrismaMock();
    prisma.club.findMany.mockResolvedValue([]);
    const audit = createAuditMock();

    const service = new AthletesService(prisma, audit as any);

    expect.assertions(2);

    try {
      await service.createOrUpdate({
        organisationId,
        actorUserId,
        firstName: 'Nika',
        lastName: 'Mchedlishvili',
        dateOfBirth: new Date('2008-03-14T00:00:00.000Z'),
        documentId: 'GE-ATH-0001',
        clubId: 'nonexistent_club',
        sex: 'MALE' as AthleteSex,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      if (error instanceof HttpException) {
        expect(error.getResponse()).toEqual({
          code: 'INVALID_CLUB',
          message: 'clubId not found for organisation',
        });
      }
    }
  });

  // Happy-path sanity check: when club validation passes, create() returns
  // the inserted athlete. Mostly here to guard against future refactors
  // that accidentally narrow the return shape.
  it('creates athlete successfully when clubId is valid', async () => {
    const prisma = createPrismaMock();
    prisma.club.findMany.mockResolvedValue([{
      id: 'club_1',
      organisationId,
      name: 'Club',
      cityId: 'city_1',
      countryId: 'country_1',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const createdAthlete: Athlete = {
      id: 'athlete_1',
      organisationId,
      clubId: 'club_1',
      cityId: 'city_1',
      countryId: 'country_1',
      firstName: 'Nika',
      firstNameKa: null,
      lastName: 'Mchedlishvili',
      lastNameKa: null,
      dateOfBirth: new Date('2008-03-14T00:00:00.000Z'),
      documentId: 'GE-ATH-0001',
      sex: 'MALE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prisma.athlete.create.mockResolvedValue(createdAthlete);
    prisma.athlete.findMany.mockResolvedValue([]);

    const audit = createAuditMock();
    const service = new AthletesService(prisma, audit as any);

    const result = await service.createOrUpdate({
      organisationId,
      actorUserId,
      firstName: 'Nika',
      lastName: 'Mchedlishvili',
      dateOfBirth: new Date('2008-03-14T00:00:00.000Z'),
      documentId: 'GE-ATH-0001',
      clubId: 'club_1',
      sex: 'MALE' as AthleteSex,
    });

    expect(result.athlete.id).toBe('athlete_1');
  });

  // Coach-scope guard for merge(): a coach can only merge two athletes that
  // BOTH belong to their own club. Mixed-club merges → ATHLETE_NOT_IN_COACH_CLUB.
  it('blocks coach merge when either athlete is outside the coach club', async () => {
    const prisma = createPrismaMock();
    prisma.athlete.findFirst
      .mockResolvedValueOnce({
        id: 'athlete_primary',
        organisationId,
        clubId: 'club_1',
      })
      .mockResolvedValueOnce({
        id: 'athlete_secondary',
        organisationId,
        clubId: 'club_2',
      });
    prisma.athleteClub.findUnique.mockResolvedValue(null);

    const service = new AthletesService(prisma, createAuditMock() as any);

    await expect(
      service.merge({
        organisationId,
        actorUserId,
        actorClubId: 'club_1',
        primaryId: 'athlete_primary',
        secondaryId: 'athlete_secondary',
        reason: 'cleanup',
      }),
    ).rejects.toThrow('ATHLETE_NOT_IN_COACH_CLUB');
  });
});
