import { HttpException } from '@nestjs/common';
import { PublicController } from './public.controller';
import { resolvePublicOrg } from '../common/public-org';

jest.mock('../common/public-org', () => ({
  resolvePublicOrg: jest.fn(),
}));

const mockResolvePublicOrg = resolvePublicOrg as jest.MockedFunction<
  typeof resolvePublicOrg
>;

const ORG = { id: 'org_pub' } as never;

function createPrismaMock() {
  return {
    fight: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    club: {
      findMany: jest.fn(),
    },
    athlete: {
      findMany: jest.fn(),
    },
    newsPost: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

function createController(prisma: ReturnType<typeof createPrismaMock>) {
  const events = {} as never;
  const clubs = {} as never;
  // The geography feature added `countries` as the 4th constructor param —
  // without it here every later argument shifts one slot left.
  const countries = {} as never;
  const eventCategories = {} as never;
  const athleteProfiles = {
    getPublicProfile: jest.fn(),
  };
  const controller = new PublicController(
    prisma as never,
    events,
    clubs,
    countries,
    eventCategories,
    athleteProfiles as never,
  );
  return { controller, athleteProfiles };
}

describe('PublicController tenant scoping', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listTopClubs', () => {
    it('returns an empty list and skips queries when no public org resolves', async () => {
      mockResolvePublicOrg.mockResolvedValue(null);
      const prisma = createPrismaMock();
      const { controller } = createController(prisma);

      await expect(controller.listTopClubs()).resolves.toEqual([]);
      expect(prisma.fight.findMany).not.toHaveBeenCalled();
      expect(prisma.club.findMany).not.toHaveBeenCalled();
    });

    it('scopes fight and club reads to the resolved organisation', async () => {
      mockResolvePublicOrg.mockResolvedValue(ORG);
      const prisma = createPrismaMock();
      prisma.fight.findMany
        .mockResolvedValueOnce([{ winnerAthlete: { clubId: 'club_1' } }])
        .mockResolvedValueOnce([]);
      prisma.club.findMany.mockResolvedValue([
        {
          id: 'club_1',
          name: 'Tbilisi WC',
          nameKa: null,
          city: 'Tbilisi',
          country: 'GE',
          _count: { athletes: 3 },
        },
      ]);
      const { controller } = createController(prisma);

      const result = await controller.listTopClubs();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'club_1', wins: 1 });
      // Both fight queries must be org-scoped.
      for (const call of prisma.fight.findMany.mock.calls) {
        expect(call[0].where.organisationId).toBe('org_pub');
      }
      // Club hydration must be org-scoped too.
      expect(prisma.club.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organisationId: 'org_pub' }),
        }),
      );
    });
  });

  describe('getNewsPost', () => {
    it('scopes the lookup to the resolved organisation', async () => {
      mockResolvePublicOrg.mockResolvedValue(ORG);
      const prisma = createPrismaMock();
      prisma.newsPost.findFirst.mockResolvedValue({ id: 'news_1' });
      const { controller } = createController(prisma);

      await controller.getNewsPost('opening-ceremony');

      expect(prisma.newsPost.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organisationId: 'org_pub',
            slug: 'opening-ceremony',
            published: true,
          }),
        }),
      );
    });

    it('throws 404 when no public org resolves', async () => {
      mockResolvePublicOrg.mockResolvedValue(null);
      const prisma = createPrismaMock();
      const { controller } = createController(prisma);

      await expect(controller.getNewsPost('x')).rejects.toThrow(HttpException);
      expect(prisma.newsPost.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('getPublicAthlete', () => {
    it('passes the resolved organisation id to the profile service', async () => {
      mockResolvePublicOrg.mockResolvedValue(ORG);
      const prisma = createPrismaMock();
      const { controller, athleteProfiles } = createController(prisma);
      athleteProfiles.getPublicProfile.mockResolvedValue({ id: 'ath_1' });

      await controller.getPublicAthlete('ath_1');

      expect(athleteProfiles.getPublicProfile).toHaveBeenCalledWith(
        'ath_1',
        'org_pub',
      );
    });

    it('throws 404 when no public org resolves', async () => {
      mockResolvePublicOrg.mockResolvedValue(null);
      const prisma = createPrismaMock();
      const { controller, athleteProfiles } = createController(prisma);

      await expect(controller.getPublicAthlete('ath_1')).rejects.toThrow(
        HttpException,
      );
      expect(athleteProfiles.getPublicProfile).not.toHaveBeenCalled();
    });
  });
});
