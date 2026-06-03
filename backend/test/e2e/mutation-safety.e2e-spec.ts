import request from 'supertest';
import {
  createE2eTestContext,
  expectClientError,
  expectOk,
  isoOffset,
  uniqueSuffix,
  type E2eTestContext,
} from './test-context';

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

async function setupSingleElimEvent(input: {
  ctx: E2eTestContext;
  athleteCount: number;
  publishTimingPolicyCode?: 'IMMEDIATE_AFTER_DRAW' | 'MANUAL_PUBLISH_LATER';
  schedule?: boolean;
}) {
  const { ctx } = input;
  const client = request(ctx.app.getHttpServer());
  const club = await ctx.createClub();
  const categoryTemplate = await ctx.createCategoryTemplate({
    weights: [{ name: '65kg', minWeightKgExcl: 60, maxWeightKgIncl: 65 }],
  });
  const slug = uniqueSuffix('safety-event');
  const event = await expectOk(
    client.post('/api/events').send({
      name: `Safety Event ${slug}`,
      slug,
      location: 'Tbilisi',
      timezone: 'Asia/Tbilisi',
      categoryTemplateId: categoryTemplate.categoryTemplateId,
      policies: input.publishTimingPolicyCode
        ? { publishTimingPolicyCode: input.publishTimingPolicyCode }
        : undefined,
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
  const eventId = event.body.id as string;
  ctx.trackEvent(eventId);
  const categories = await expectOk(
    client.post(`/api/events/${eventId}/categories`).send({
      categoryTemplateId: categoryTemplate.categoryTemplateId,
      ageGroups: [
        {
          categoryTemplateGroupId: categoryTemplate.categoryTemplateAgeGroupId,
          weightCategoryIds: categoryTemplate.categoryTemplateWeightIds,
        },
      ],
    }),
  );
  const eventWeightCategoryId = categories.body.ageGroups[0].weightCategories[0]
    .id as string;
  for (let index = 0; index < input.athleteCount; index += 1) {
    const athlete = await ctx.createAthlete({
      clubId: club.id,
      firstName: `Safety${index + 1}`,
      lastName: 'Athlete',
      documentId: uniqueSuffix(`safety-athlete-${index + 1}`),
    });
    const registration = await expectOk(
      client.post('/api/registrations').send({
        eventId,
        athleteId: athlete.id,
        eventWeightCategoryId,
      }),
    );
    await expectOk(
      client
        .post(`/api/registrations/${registration.body.id}/status`)
        .send({ status: 'APPROVED' }),
    );
    await expectOk(
      client.post('/api/weighin').send({
        registrationId: registration.body.id,
        weightKg: 64,
        override: true,
        reason:
          'Allow weigh-in before lifecycle transition for safety e2e setup',
        decision: 'PASS',
      }),
    );
  }
  await expectOk(
    client.post(`/api/events/${eventId}/lifecycle`).send({
      to: 'WEIGH_IN_COMPLETED',
      override: true,
      reason: 'Direct mutation-safety e2e setup',
    }),
  );
  await expectOk(client.post('/api/draw').send({ eventId, seed: 9 }));
  let matId: string | null = null;
  if (input.schedule) {
    const mat = await expectOk(
      client.post('/api/mats').send({
        eventId,
        name: 'Mat A',
        order: 1,
      }),
    );
    matId = mat.body.id as string;
    await expectOk(
      client.post('/api/schedule/auto').send({
        eventId,
        startTimeIso: new Date().toISOString(),
        avgBoutSeconds: 180,
        bufferSeconds: 60,
      }),
    );
  }
  return { client, eventId, eventSlug: slug, eventWeightCategoryId, matId };
}

describeIfDb('Mutation safety (e2e)', () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eTestContext();
  });

  afterAll(async () => {
    await ctx.destroy();
  });

  it('blocks redraw after a fight result is already recorded and leaves fights unchanged', async () => {
    const { client, eventId } = await setupSingleElimEvent({
      ctx,
      athleteCount: 4,
      publishTimingPolicyCode: 'MANUAL_PUBLISH_LATER',
    });
    const fightsBefore = await ctx.prisma.fight.findMany({
      where: { eventId },
      orderBy: [{ round: 'asc' }, { boutNo: 'asc' }],
    });
    const firstFight = fightsBefore.find((fight) => fight.round === 1)!;

    await expectOk(
      client.post(`/api/fights/${firstFight.id}/result`).send({
        winner: 'RED',
        method: 'POINTS',
        override: true,
        reason: 'Record result without entering LIVE for safety check',
      }),
    );
    const redraw = await expectClientError(
      client.post('/api/draw').send({
        eventId,
        seed: 12,
        override: true,
        reason: 'Attempt unsafe redraw after progress',
      }),
      [400, 409],
    );
    expect(redraw.text || redraw.body).toBeTruthy();
    const fightsAfter = await ctx.prisma.fight.findMany({
      where: { eventId },
      orderBy: [{ round: 'asc' }, { boutNo: 'asc' }],
    });
    expect(fightsAfter.map((fight) => fight.id)).toEqual(
      fightsBefore.map((fight) => fight.id),
    );
    expect(
      fightsAfter.find((fight) => fight.id === firstFight.id)?.winnerAthleteId,
    ).toBeTruthy();
  });

  it('hides unpublished competition data and blocks redraw after publish and LIVE start', async () => {
    const { client, eventId, eventSlug } = await setupSingleElimEvent({
      ctx,
      athleteCount: 4,
      publishTimingPolicyCode: 'MANUAL_PUBLISH_LATER',
      schedule: true,
    });
    await expectClientError(
      client.get('/api/public/brackets/overview').query({ eventSlug }),
      [404],
    );
    await expectClientError(
      client.get('/api/public/schedule').query({ eventSlug }),
      [404],
    );
    await expectClientError(
      client.get('/api/public/live').query({ eventSlug, mat: 'Mat A' }),
      [404],
    );
    await expectClientError(
      client.get('/api/public/results').query({ eventSlug }),
      [404],
    );
    const fightIdsBefore = (
      await ctx.prisma.fight.findMany({
        where: { eventId },
        orderBy: [{ round: 'asc' }, { boutNo: 'asc' }],
        select: { id: true },
      })
    ).map((fight) => fight.id);
    await expectOk(
      client.post(`/api/events/${eventId}/publish`).send({ published: true }),
    );
    await expectClientError(
      client.post('/api/draw').send({
        eventId,
        seed: 13,
        override: true,
        reason: 'Attempt redraw after publish',
      }),
      [400, 409],
    );
    await expectOk(
      client.post(`/api/events/${eventId}/lifecycle`).send({ to: 'LIVE' }),
    );
    await expectClientError(
      client.post('/api/draw').send({
        eventId,
        seed: 14,
        override: true,
        reason: 'Attempt redraw after LIVE start',
      }),
      [400, 409],
    );
    const fightIdsAfter = (
      await ctx.prisma.fight.findMany({
        where: { eventId },
        orderBy: [{ round: 'asc' }, { boutNo: 'asc' }],
        select: { id: true },
      })
    ).map((fight) => fight.id);
    expect(fightIdsAfter).toEqual(fightIdsBefore);
  });

  it('blocks result correction after a downstream fight has been touched', async () => {
    const { client, eventId } = await setupSingleElimEvent({
      ctx,
      athleteCount: 4,
      publishTimingPolicyCode: 'MANUAL_PUBLISH_LATER',
      schedule: true,
    });
    await expectOk(
      client.post(`/api/events/${eventId}/lifecycle`).send({
        to: 'LIVE',
        override: true,
        reason: 'Allow live safety test without publish dependency',
      }),
    );
    const initialFights = await ctx.prisma.fight.findMany({
      where: { eventId },
      orderBy: [{ round: 'asc' }, { boutNo: 'asc' }],
    });
    const semiFinals = initialFights.filter((fight) => fight.round === 1);
    for (const fight of semiFinals) {
      await expectOk(client.post(`/api/fights/${fight.id}/start`));
      await expectOk(
        client.post(`/api/fights/${fight.id}/result`).send({
          winner: 'RED',
          method: 'POINTS',
        }),
      );
    }
    await expectOk(
      client.post('/api/schedule/auto').send({
        eventId,
        startTimeIso: new Date().toISOString(),
        avgBoutSeconds: 180,
        bufferSeconds: 60,
      }),
    );
    const finalFight = await ctx.prisma.fight.findFirst({
      where: { eventId, round: 2 },
    });
    expect(finalFight?.redAthleteId).toBeTruthy();
    expect(finalFight?.blueAthleteId).toBeTruthy();
    await expectOk(client.post(`/api/fights/${finalFight!.id}/start`));
    const semiOneBefore = await ctx.prisma.fight.findUnique({
      where: { id: semiFinals[0].id },
    });
    const finalBefore = await ctx.prisma.fight.findUnique({
      where: { id: finalFight!.id },
    });
    const correction = await expectClientError(
      client.post(`/api/fights/${semiFinals[0].id}/result`).send({
        winner: 'BLUE',
        method: 'POINTS',
        override: true,
        reason: 'Attempt correction after final touched',
      }),
      [400, 409],
    );
    expect(correction.text || correction.body).toBeTruthy();
    const semiOneAfter = await ctx.prisma.fight.findUnique({
      where: { id: semiFinals[0].id },
    });
    const finalAfter = await ctx.prisma.fight.findUnique({
      where: { id: finalFight!.id },
    });
    expect(semiOneAfter?.winnerAthleteId).toBe(semiOneBefore?.winnerAthleteId);
    expect(finalAfter?.redAthleteId).toBe(finalBefore?.redAthleteId);
    expect(finalAfter?.blueAthleteId).toBe(finalBefore?.blueAthleteId);
  });

  it('rejects duplicate concurrent starts for the same fight', async () => {
    const { client, eventId } = await setupSingleElimEvent({
      ctx,
      athleteCount: 4,
      publishTimingPolicyCode: 'MANUAL_PUBLISH_LATER',
      schedule: true,
    });
    await expectOk(
      client.post(`/api/events/${eventId}/lifecycle`).send({
        to: 'LIVE',
        override: true,
        reason:
          'Allow duplicate-start safety verification without publish dependency',
      }),
    );

    const firstFight = await ctx.prisma.fight.findFirst({
      where: { eventId, round: 1 },
      orderBy: { boutNo: 'asc' },
      select: { id: true },
    });
    expect(firstFight?.id).toBeTruthy();

    const [firstStart, secondStart] = await Promise.all([
      client.post(`/api/fights/${firstFight!.id}/start`),
      client.post(`/api/fights/${firstFight!.id}/start`),
    ]);

    expect([firstStart.status, secondStart.status].sort()).toEqual([201, 400]);

    const runningFights = await ctx.prisma.fight.findMany({
      where: { eventId, status: 'IN_PROGRESS' },
      select: { id: true },
    });
    expect(runningFights).toEqual([{ id: firstFight!.id }]);
  });
});
