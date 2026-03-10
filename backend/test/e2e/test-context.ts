import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/global-exception.filter';
import { AuthGuard } from '../../src/auth/auth.guard';
import { getCapabilitiesForRole } from '../../src/auth/capabilities';
import { PrismaService } from '../../src/prisma/prisma.service';

type AthleteSeed = {
  firstName: string;
  lastName: string;
  documentId: string;
  sex?: 'MALE' | 'FEMALE' | null;
  dateOfBirth?: string;
  clubId?: string | null;
};

type WeightCategorySeed = {
  name: string;
  minWeightKgExcl: number | null;
  maxWeightKgIncl: number | null;
  sortOrder?: number;
};

type RulesetSeed = {
  name?: string;
  ageGroupCode?: string;
  ageGroupName?: string;
  sex?: 'MALE' | 'FEMALE' | null;
  minAge?: number;
  maxAge?: number;
  roundDurationSeconds?: number;
  weights: WeightCategorySeed[];
};

export type E2eTestContext = {
  app: INestApplication<App>;
  prisma: PrismaService;
  organisationId: string;
  userId: string;
  trackEvent: (eventId: string) => void;
  createClub: (name?: string) => Promise<{ id: string; name: string }>;
  createRuleset: (
    input: RulesetSeed,
  ) => Promise<{
    rulesetId: string;
    ageGroupId: string;
    weightCategoryIds: string[];
    weightCategoryIdsByName: Map<string, string>;
  }>;
  createAthlete: (input: AthleteSeed) => Promise<{ id: string }>;
  destroy: () => Promise<void>;
};

export function uniqueSuffix(prefix = 'e2e'): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${random}`;
}

export function isoOffset(input: {
  days?: number;
  hours?: number;
  minutes?: number;
}): string {
  const days = input.days ?? 0;
  const hours = input.hours ?? 0;
  const minutes = input.minutes ?? 0;
  return new Date(
    Date.now() +
      days * 24 * 60 * 60 * 1000 +
      hours * 60 * 60 * 1000 +
      minutes * 60 * 1000,
  ).toISOString();
}

export async function expectOk<T extends request.Response>(promise: Promise<T>) {
  const response = await promise;
  expect([200, 201]).toContain(response.status);
  return response;
}

export async function expectClientError<T extends request.Response>(
  promise: Promise<T>,
  allowedStatuses: number[] = [400, 404, 409],
) {
  const response = await promise;
  expect(allowedStatuses).toContain(response.status);
  return response;
}

export async function createE2eTestContext(): Promise<E2eTestContext> {
  const authState = {
    userId: '',
    organisationId: '',
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(AuthGuard)
    .useValue({
      canActivate: (ctx: {
        switchToHttp(): { getRequest(): Record<string, unknown> };
      }) => {
        const req = ctx.switchToHttp().getRequest();
        req.auth = {
          sub: authState.userId,
          organisationId: authState.organisationId,
          role: 'admin',
          capabilities: getCapabilitiesForRole('admin'),
        };
        return true;
      },
    })
    .compile();

  const app = moduleFixture.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.init();

  const prisma = app.get(PrismaService);
  const user = await prisma.user.findFirst({
    select: { id: true, organisationId: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!user) {
    throw new Error('No user found for DB-backed e2e setup');
  }

  authState.userId = user.id;
  authState.organisationId = user.organisationId;

  const trackedEventIds: string[] = [];
  const trackedAthleteIds: string[] = [];
  const trackedClubIds: string[] = [];
  const trackedRulesetIds: string[] = [];

  return {
    app,
    prisma,
    organisationId: authState.organisationId,
    userId: authState.userId,
    trackEvent(eventId: string) {
      trackedEventIds.push(eventId);
    },
    async createClub(name = `Club ${uniqueSuffix('club')}`) {
      const club = await prisma.club.create({
        data: {
          organisationId: authState.organisationId,
          name,
          city: 'Tbilisi',
          country: 'GE',
        },
      });
      trackedClubIds.push(club.id);
      return { id: club.id, name: club.name };
    },
    async createRuleset(input: RulesetSeed) {
      const ruleset = await prisma.ruleset.create({
        data: {
          organisationId: authState.organisationId,
          name: input.name ?? `Ruleset ${uniqueSuffix('ruleset')}`,
          version: 1,
          status: 'ACTIVE',
          definition: {
            source: 'e2e',
            discipline: 'Sanda',
          },
        },
      });
      trackedRulesetIds.push(ruleset.id);

      const ageGroup = await prisma.rulesetAgeGroup.create({
        data: {
          rulesetId: ruleset.id,
          code: input.ageGroupCode ?? 'adult-18-40',
          name: input.ageGroupName ?? 'Adult',
          sex: input.sex ?? 'MALE',
          minAge: input.minAge ?? 18,
          maxAge: input.maxAge ?? 40,
          roundDurationSeconds: input.roundDurationSeconds ?? 120,
          sortOrder: 1,
        },
      });

      const weightCategoryIdsByName = new Map<string, string>();
      const weightCategoryIds: string[] = [];
      for (const [index, weight] of input.weights.entries()) {
        const created = await prisma.rulesetWeightCategory.create({
          data: {
            ageGroupId: ageGroup.id,
            name: weight.name,
            minWeightKgExcl: weight.minWeightKgExcl,
            maxWeightKgIncl: weight.maxWeightKgIncl,
            sortOrder: weight.sortOrder ?? index + 1,
          },
        });
        weightCategoryIds.push(created.id);
        weightCategoryIdsByName.set(weight.name, created.id);
      }

      return {
        rulesetId: ruleset.id,
        ageGroupId: ageGroup.id,
        weightCategoryIds,
        weightCategoryIdsByName,
      };
    },
    async createAthlete(input: AthleteSeed) {
      const athlete = await prisma.athlete.create({
        data: {
          organisationId: authState.organisationId,
          clubId: input.clubId ?? null,
          firstName: input.firstName,
          lastName: input.lastName,
          documentId: input.documentId,
          sex: input.sex ?? 'MALE',
          dateOfBirth: new Date(
            `${input.dateOfBirth ?? '2001-05-10'}T00:00:00.000Z`,
          ),
        },
      });
      trackedAthleteIds.push(athlete.id);
      return { id: athlete.id };
    },
    async destroy() {
      if (trackedEventIds.length > 0) {
        await prisma.timerState.deleteMany({
          where: { fight: { eventId: { in: trackedEventIds } } },
        });
        await prisma.fight.deleteMany({
          where: { eventId: { in: trackedEventIds } },
        });
        await prisma.bracket.deleteMany({
          where: { eventId: { in: trackedEventIds } },
        });
        await prisma.mat.deleteMany({
          where: { eventId: { in: trackedEventIds } },
        });
        await prisma.weighInAttempt.deleteMany({
          where: { eventId: { in: trackedEventIds } },
        });
        await prisma.registration.deleteMany({
          where: { eventId: { in: trackedEventIds } },
        });
        await prisma.auditLog.deleteMany({
          where: { eventId: { in: trackedEventIds } },
        });
        await prisma.eventRulesetSnapshot.deleteMany({
          where: { eventId: { in: trackedEventIds } },
        });
        await prisma.event.deleteMany({
          where: { id: { in: trackedEventIds } },
        });
      }

      if (trackedAthleteIds.length > 0) {
        await prisma.athleteMerge.deleteMany({
          where: {
            OR: [
              { primaryAthleteId: { in: trackedAthleteIds } },
              { secondaryAthleteId: { in: trackedAthleteIds } },
            ],
          },
        });
        await prisma.athlete.deleteMany({
          where: { id: { in: trackedAthleteIds } },
        });
      }

      if (trackedClubIds.length > 0) {
        await prisma.club.deleteMany({
          where: { id: { in: trackedClubIds } },
        });
      }

      if (trackedRulesetIds.length > 0) {
        await prisma.rulesetWeightCategory.deleteMany({
          where: { ageGroup: { rulesetId: { in: trackedRulesetIds } } },
        });
        await prisma.rulesetAgeGroup.deleteMany({
          where: { rulesetId: { in: trackedRulesetIds } },
        });
        await prisma.ruleset.deleteMany({
          where: { id: { in: trackedRulesetIds } },
        });
      }

      await app.close();
    },
  };
}
