import { HttpException } from '@nestjs/common';
import type { Athlete, AthleteSex } from '@prisma/client';
import { AthletesService } from './athletes.service';

const createPrismaMock = () => {
  const prisma: any = {
    club: {
      findFirst: jest.fn(),
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

  it('throws INVALID_CLUB when clubId does not exist for organisation', async () => {
    const prisma = createPrismaMock();
    prisma.club.findFirst.mockResolvedValue(null);
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

  it('creates athlete successfully when clubId is valid', async () => {
    const prisma = createPrismaMock();
    prisma.club.findFirst.mockResolvedValue({
      id: 'club_1',
      organisationId,
      name: 'Club',
      city: null,
      country: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const createdAthlete: Athlete = {
      id: 'athlete_1',
      organisationId,
      clubId: 'club_1',
      firstName: 'Nika',
      lastName: 'Mchedlishvili',
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
