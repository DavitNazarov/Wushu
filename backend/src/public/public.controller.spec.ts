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
  // Medal ranking now lives in ClubsService.computeMedalsByClub; the controller
  // just sorts + hydrates the result, so we stub that one method.
  const clubs = {
    computeMedalsByClub: jest.fn(),
  };
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
    clubs as never,
    countries,
    eventCategories,
    athleteProfiles as never,
  );
  return { controller, clubs, athleteProfiles };
}

describe('PublicController tenant scoping', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listTopClubs', () => {
    it('returns an empty list and skips queries when no public org resolves', async () => {
      mockResolvePublicOrg.mockResolvedValue(null);
      const prisma = createPrismaMock();
      const { controller, clubs } = createController(prisma);

      await expect(controller.listTopClubs()).resolves.toEqual([]);
      expect(clubs.computeMedalsByClub).not.toHaveBeenCalled();
      expect(prisma.club.findMany).not.toHaveBeenCalled();
    });

    it('ranks clubs by medal tally and hydrates them org-scoped', async () => {
      mockResolvePublicOrg.mockResolvedValue(ORG);
      const prisma = createPrismaMock();
      const { controller, clubs } = createController(prisma);
      clubs.computeMedalsByClub.mockResolvedValue(
        new Map([
          ['club_1', { gold: 2, silver: 1, bronze: 0, total: 3 }],
          ['club_2', { gold: 1, silver: 0, bronze: 1, total: 2 }],
        ]),
      );
      prisma.club.findMany.mockResolvedValue([
        {
          id: 'club_1',
          name: 'Tbilisi WC',
          nameKa: null,
          city: 'Tbilisi',
          country: { name: 'GE' },
          _count: { athletes: 3 },
        },
        {
          id: 'club_2',
          name: 'Rustavi WC',
          nameKa: null,
          city: 'Rustavi',
          country: { name: 'GE' },
          _count: { athletes: 2 },
        },
      ]);

      const result = await controller.listTopClubs();

      expect(clubs.computeMedalsByClub).toHaveBeenCalledWith('org_pub');
      expect(result).toHaveLength(2);
      // club_1 has more total medals, so it ranks first.
      expect(result[0]).toMatchObject({
        id: 'club_1',
        rank: 1,
        gold: 2,
        silver: 1,
        bronze: 0,
        medals: 3,
      });
      expect(result[1]).toMatchObject({ id: 'club_2', rank: 2, medals: 2 });
      // Club hydration must be org-scoped.
      expect(prisma.club.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organisationId: 'org_pub' }),
        }),
      );
    });

    it('falls back to recent clubs with zero medals when none have medaled', async () => {
      mockResolvePublicOrg.mockResolvedValue(ORG);
      const prisma = createPrismaMock();
      const { controller, clubs } = createController(prisma);
      clubs.computeMedalsByClub.mockResolvedValue(new Map());
      prisma.club.findMany.mockResolvedValue([
        {
          id: 'club_new',
          name: 'New Club',
          nameKa: null,
          city: 'Batumi',
          country: { name: 'GE' },
          _count: { athletes: 0 },
        },
      ]);

      const result = await controller.listTopClubs();

      expect(result[0]).toMatchObject({ id: 'club_new', medals: 0, gold: 0 });
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
