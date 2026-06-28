import { HttpException } from '@nestjs/common';
import { ClubsService } from './clubs.service';

// Unit tests for ClubsService.upsert — focused on the Country/City wiring:
// countryId is derived from the chosen city, and changing a club's city
// cascades the denormalised city/country onto its coaches + athletes.
// Same mock pattern as the other service specs: $transaction runs its callback
// with `prisma` as `tx`.
const createPrismaMock = () => {
  const prisma: any = {
    city: { findFirst: jest.fn() },
    club: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: { updateMany: jest.fn() },
    coach: { updateMany: jest.fn() },
    athlete: { updateMany: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) =>
      fn(prisma),
    ),
  };
  return prisma;
};

const createAuditMock = () => ({ write: jest.fn() });

describe('ClubsService.upsert', () => {
  const organisationId = 'org_1';
  const actorUserId = 'user_1';

  it('rejects with CITY_NOT_FOUND when the city is not in the org', async () => {
    const prisma = createPrismaMock();
    prisma.city.findFirst.mockResolvedValue(null);
    const service = new ClubsService(prisma, createAuditMock() as any);

    expect.assertions(2);
    try {
      await service.upsert({
        organisationId,
        actorUserId,
        name: 'Dragon Club',
        cityId: 'city_missing',
        isOfficial: true,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      if (error instanceof HttpException) {
        expect((error.getResponse() as { code: string }).code).toBe(
          'CITY_NOT_FOUND',
        );
      }
    }
  });

  it('derives countryId from the city when creating a club', async () => {
    const prisma = createPrismaMock();
    prisma.city.findFirst.mockResolvedValue({
      id: 'city_1',
      countryId: 'country_1',
    });
    prisma.club.create.mockResolvedValue({
      id: 'club_1',
      cityId: 'city_1',
      countryId: 'country_1',
    });
    const service = new ClubsService(prisma, createAuditMock() as any);

    await service.upsert({
      organisationId,
      actorUserId,
      name: 'Dragon Club',
      cityId: 'city_1',
      isOfficial: true,
    });

    expect(prisma.club.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cityId: 'city_1',
        countryId: 'country_1',
      }),
    });
    // No existing club → no cascade.
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.athlete.updateMany).not.toHaveBeenCalled();
  });

  it('cascades city/country to coaches + athletes when a club is moved to a new city', async () => {
    const prisma = createPrismaMock();
    prisma.city.findFirst.mockResolvedValue({
      id: 'city_new',
      countryId: 'country_new',
    });
    prisma.club.findFirst.mockResolvedValue({
      id: 'club_1',
      cityId: 'city_old',
      countryId: 'country_old',
    });
    prisma.club.update.mockResolvedValue({
      id: 'club_1',
      cityId: 'city_new',
      countryId: 'country_new',
    });
    const service = new ClubsService(prisma, createAuditMock() as any);

    await service.upsert({
      organisationId,
      actorUserId,
      id: 'club_1',
      name: 'Dragon Club',
      cityId: 'city_new',
      isOfficial: true,
    });

    const expected = {
      where: { clubId: 'club_1' },
      data: { cityId: 'city_new', countryId: 'country_new' },
    };
    expect(prisma.user.updateMany).toHaveBeenCalledWith(expected);
    expect(prisma.athlete.updateMany).toHaveBeenCalledWith(expected);
  });
});
