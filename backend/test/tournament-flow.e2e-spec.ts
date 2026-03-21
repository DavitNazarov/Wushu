import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/global-exception.filter';
import { AuthGuard } from '../src/auth/auth.guard';
import { getCapabilitiesForRole } from '../src/auth/capabilities';
import { PrismaService } from '../src/prisma/prisma.service';

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

function isoOffset(input: { days?: number; hours?: number }): string {
  const days = input.days ?? 0;
  const hours = input.hours ?? 0;
  return new Date(
    Date.now() + days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000,
  ).toISOString();
}

async function expectOk<T extends request.Response>(promise: Promise<T>) {
  const response = await promise;
  expect([200, 201]).toContain(response.status);
  return response;
}

describeIfDb('Tournament flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let organisationId = '';
  let userId = '';
  let clubId = '';
  let categoryTemplateId = '';
  let categoryTemplateAgeGroupId = '';
  let categoryTemplateWeightId = '';
  const createdEventIds: string[] = [];
  const createdAthleteIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (ctx: { switchToHttp(): { getRequest(): Record<string, unknown> } }) => {
          const req = ctx.switchToHttp().getRequest();
          req.auth = {
            sub: userId,
            organisationId,
            role: 'admin',
            capabilities: getCapabilitiesForRole('admin'),
          };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);

    const user = await prisma.user.findFirst({
      select: { id: true, organisationId: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!user) {
      throw new Error('No user found for tournament flow e2e');
    }
    userId = user.id;
    organisationId = user.organisationId;

    const suffix = Date.now().toString();

    const club = await prisma.club.create({
      data: {
        organisationId,
        name: `Flow Club ${suffix}`,
        city: 'Tbilisi',
        country: 'GE',
      },
    });
    clubId = club.id;

    const categoryTemplate = await prisma.categoryTemplate.create({
      data: {
        organisationId,
        name: `Flow Category Template ${suffix}`,
        version: 1,
        status: 'ACTIVE',
        definition: {
          source: 'e2e',
          discipline: 'Sanda',
        },
      },
    });
    categoryTemplateId = categoryTemplate.id;

    const ageGroup = await prisma.categoryTemplateAgeGroup.create({
      data: {
        categoryTemplateId,
        code: 'adult-18-40',
        name: 'Adult',
        sex: 'MALE',
        minAge: 18,
        maxAge: 40,
        roundDurationSeconds: 120,
        sortOrder: 1,
      },
    });
    categoryTemplateAgeGroupId = ageGroup.id;

    const weightCategory = await prisma.categoryTemplateWeight.create({
      data: {
        ageGroupId: ageGroup.id,
        name: '65kg',
        minWeightKgExcl: 60,
        maxWeightKgIncl: 65,
        sortOrder: 1,
      },
    });
    categoryTemplateWeightId = weightCategory.id;
  });

  afterAll(async () => {
    if (createdEventIds.length > 0) {
      await prisma.timerState.deleteMany({
        where: { fight: { eventId: { in: createdEventIds } } },
      });
      await prisma.fight.deleteMany({ where: { eventId: { in: createdEventIds } } });
      await prisma.bracket.deleteMany({
        where: { eventId: { in: createdEventIds } },
      });
      await prisma.mat.deleteMany({ where: { eventId: { in: createdEventIds } } });
      await prisma.weighInAttempt.deleteMany({
        where: { eventId: { in: createdEventIds } },
      });
      await prisma.registration.deleteMany({
        where: { eventId: { in: createdEventIds } },
      });
      await prisma.auditLog.deleteMany({
        where: { eventId: { in: createdEventIds } },
      });
      await prisma.eventCategoryTemplateSnapshot.deleteMany({
        where: { eventId: { in: createdEventIds } },
      });
      await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
    }

    if (createdAthleteIds.length > 0) {
      await prisma.athleteMerge.deleteMany({
        where: {
          OR: [
            { primaryAthleteId: { in: createdAthleteIds } },
            { secondaryAthleteId: { in: createdAthleteIds } },
          ],
        },
      });
      await prisma.athlete.deleteMany({ where: { id: { in: createdAthleteIds } } });
    }

    if (clubId) {
      await prisma.club.deleteMany({ where: { id: clubId } });
    }
    if (categoryTemplateId) {
      await prisma.categoryTemplateWeight.deleteMany({
        where: { ageGroup: { categoryTemplateId } },
      });
      await prisma.categoryTemplateAgeGroup.deleteMany({
        where: { categoryTemplateId },
      });
      await prisma.categoryTemplate.deleteMany({
        where: { id: categoryTemplateId },
      });
    }

    await app.close();
  });

  it('runs one persisted tournament from event setup to public results', async () => {
    const suffix = Date.now().toString();

    const createEvent = await expectOk(
      request(app.getHttpServer()).post('/api/events').send({
        name: `Tournament Flow Open ${suffix}`,
        slug: `tournament-flow-open-${suffix}`,
        location: 'Tbilisi',
        timezone: 'Asia/Tbilisi',
        categoryTemplateId,
        dates: {
          registrationStartDate: isoOffset({ days: -3 }),
          registrationEndDate: isoOffset({ days: -2 }),
          weighInStartDate: isoOffset({ days: -1, hours: -4 }),
          weighInEndDate: isoOffset({ days: -1, hours: -2 }),
          competitionStartDate: isoOffset({ hours: -6 }),
          competitionEndDate: isoOffset({ days: 1 }),
        },
      }),
    );
    const eventId = createEvent.body.id as string;
    const eventSlug = createEvent.body.slug as string;
    createdEventIds.push(eventId);

    const categories = await expectOk(
      request(app.getHttpServer())
        .post(`/api/events/${eventId}/categories`)
        .send({
          categoryTemplateId,
          ageGroups: [
            {
              categoryTemplateGroupId: categoryTemplateAgeGroupId,
              weightCategoryIds: [categoryTemplateWeightId],
            },
          ],
        }),
    );
    const eventWeightCategoryId = categories.body.ageGroups[0].weightCategories[0]
      .id as string;

    const athleteNames = ['Nika', 'Luka', 'Saba', 'Dato'];
    const registrationIds: string[] = [];

    for (const [index, firstName] of athleteNames.entries()) {
      const athlete = await expectOk(
        request(app.getHttpServer())
          .post('/api/athletes')
          .send({
            clubId,
            firstName,
            lastName: `Flow${suffix}${index + 1}`,
            dateOfBirth: '2001-05-10',
            documentId: `FLOW-${suffix}-${index + 1}`,
            sex: 'MALE',
          }),
      );
      const athleteId = athlete.body.athlete.id as string;
      createdAthleteIds.push(athleteId);

      const registration = await expectOk(
        request(app.getHttpServer()).post('/api/registrations').send({
          eventId,
          athleteId,
          eventWeightCategoryId,
        }),
      );
      registrationIds.push(registration.body.id as string);

      const approved = await expectOk(
        request(app.getHttpServer())
          .post(`/api/registrations/${registration.body.id}/status`)
          .send({ status: 'APPROVED' }),
      );
      expect(approved.body.status).toBe('APPROVED');
    }

    const locked = await expectOk(
      request(app.getHttpServer())
        .post(`/api/events/${eventId}/lifecycle`)
        .send({ to: 'LOCKED' }),
    );
    expect(locked.body.lifecycle).toBe('LOCKED');

    const weighinStage = await expectOk(
      request(app.getHttpServer())
        .post(`/api/events/${eventId}/lifecycle`)
        .send({ to: 'WEIGHIN' }),
    );
    expect(weighinStage.body.lifecycle).toBe('WEIGHIN');

    for (const [index, registrationId] of registrationIds.entries()) {
      const weighin = await expectOk(
        request(app.getHttpServer()).post('/api/weighin').send({
          registrationId,
          weightKg: 61 + index,
        }),
      );
      expect(weighin.body.registration.weighInStatus).toBe('PASSED');
    }

    const automation = await expectOk(
      request(app.getHttpServer()).post(`/api/events/${eventId}/run-automation`),
    );
    expect(automation.body.event.lifecycle).toBe('WEIGH_IN_COMPLETED');

    const readiness = await expectOk(
      request(app.getHttpServer()).get('/api/draw/overview').query({ eventId }),
    );
    expect(readiness.body.summary.readyCategoriesCount).toBe(1);

    const draw = await expectOk(
      request(app.getHttpServer()).post('/api/draw').send({ eventId, seed: 17 }),
    );
    expect(draw.body.brackets).toHaveLength(1);
    expect(draw.body.brackets[0].fights).toHaveLength(3);

    const mat = await expectOk(
      request(app.getHttpServer()).post('/api/mats').send({
        eventId,
        name: 'Mat A',
        order: 1,
      }),
    );

    await expectOk(
      request(app.getHttpServer()).post('/api/schedule/auto').send({
        eventId,
        startTimeIso: new Date().toISOString(),
        avgBoutSeconds: 180,
        bufferSeconds: 60,
      }),
    );

    const initialPublicLive = await expectOk(
      request(app.getHttpServer())
        .get('/api/public/live')
        .query({ eventSlug, mat: 'mat a' }),
    );
    expect(initialPublicLive.body.selectedMatName).toBe('Mat A');
    expect(initialPublicLive.body.current).not.toBeNull();
    expect(initialPublicLive.body.current.liveStatus).toBe('UPCOMING');
    expect(initialPublicLive.body.upNext).toHaveLength(1);

    const live = await expectOk(
      request(app.getHttpServer())
        .post(`/api/events/${eventId}/lifecycle`)
        .send({ to: 'LIVE' }),
    );
    expect(live.body.lifecycle).toBe('LIVE');

    const schedule = await expectOk(
      request(app.getHttpServer()).get('/api/schedule').query({ eventId }),
    );
    const scheduledPlayableFights = schedule.body.filter(
      (row: {
        isPlayable: boolean;
        matId: string | null;
        orderInMat: number | null;
      }) => row.isPlayable && row.matId === mat.body.id && row.orderInMat != null,
    );
    expect(scheduledPlayableFights).toHaveLength(2);

    const semiFinalOneId = scheduledPlayableFights[0].id as string;
    const semiFinalTwoId = scheduledPlayableFights[1].id as string;

    await expectOk(
      request(app.getHttpServer()).post(`/api/fights/${semiFinalOneId}/start`),
    );
    await expectOk(
      request(app.getHttpServer())
        .post(`/api/fights/${semiFinalOneId}/result`)
        .send({ winner: 'RED', method: 'POINTS' }),
    );

    const publicAfterSemiOne = await expectOk(
      request(app.getHttpServer())
        .get('/api/public/mat')
        .query({ eventSlug, mat: 'MAT A' }),
    );
    expect(publicAfterSemiOne.body.mat.name).toBe('Mat A');
    expect(publicAfterSemiOne.body.now.id).toBe(semiFinalTwoId);

    await expectOk(
      request(app.getHttpServer()).post(`/api/fights/${semiFinalTwoId}/start`),
    );
    await expectOk(
      request(app.getHttpServer())
        .post(`/api/fights/${semiFinalTwoId}/result`)
        .send({ winner: 'BLUE', method: 'POINTS' }),
    );

    const scheduleFinal = await expectOk(
      request(app.getHttpServer()).post('/api/schedule/auto').send({
        eventId,
        startTimeIso: new Date().toISOString(),
        avgBoutSeconds: 180,
        bufferSeconds: 60,
      }),
    );
    expect(scheduleFinal.body).toHaveLength(1);

    const finalFightId = scheduleFinal.body[0].id as string;

    const finalFight = await expectOk(
      request(app.getHttpServer()).get(`/api/fights/${finalFightId}`),
    );
    expect(finalFight.body.redAthleteId).toBeTruthy();
    expect(finalFight.body.blueAthleteId).toBeTruthy();
    expect(finalFight.body.matId).toBe(mat.body.id);

    await expectOk(
      request(app.getHttpServer()).post(`/api/fights/${finalFightId}/start`),
    );
    await expectOk(
      request(app.getHttpServer())
        .post(`/api/fights/${finalFightId}/result`)
        .send({ winner: 'RED', method: 'POINTS' }),
    );

    const resultsSummary = await expectOk(
      request(app.getHttpServer())
        .get('/api/results/summary')
        .query({ eventId }),
    );
    expect(resultsSummary.body.categories).toHaveLength(1);
    expect(resultsSummary.body.categories[0].completionState).toBe('COMPLETED');
    expect(resultsSummary.body.categories[0].medalists.gold).not.toBeNull();

    const publicResults = await expectOk(
      request(app.getHttpServer())
        .get('/api/public/results')
        .query({ eventSlug }),
    );
    expect(publicResults.body.fights).toHaveLength(3);
    expect(publicResults.body.placements.length).toBeGreaterThan(0);
  });
});
