import request from 'supertest';
import {
  createE2eTestContext,
  expectOk,
  isoOffset,
  uniqueSuffix,
  type E2eTestContext,
} from './test-context';

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

function buildEventPayload(rulesetId: string, slug: string) {
  return {
    name: `Round Robin Event ${slug}`,
    slug,
    location: 'Tbilisi',
    timezone: 'Asia/Tbilisi',
    rulesetId,
    dates: {
      registrationStartDate: isoOffset({ days: -3 }),
      registrationEndDate: isoOffset({ days: -2 }),
      weighInStartDate: isoOffset({ days: -1, hours: -4 }),
      weighInEndDate: isoOffset({ days: -1, hours: -2 }),
      competitionStartDate: isoOffset({ hours: -6 }),
      competitionEndDate: isoOffset({ days: 1 }),
    },
  };
}

async function approveAndPass(input: {
  ctx: E2eTestContext;
  eventId: string;
  athleteId: string;
  eventWeightCategoryId: string;
}) {
  const client = request(input.ctx.app.getHttpServer());
  const registration = await expectOk(
    client.post('/api/registrations').send({
      eventId: input.eventId,
      athleteId: input.athleteId,
      eventWeightCategoryId: input.eventWeightCategoryId,
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
      reason: 'Allow weigh-in before lifecycle transition for round robin e2e setup',
      decision: 'PASS',
    }),
  );
}

describeIfDb('Round robin (e2e)', () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eTestContext();
  });

  afterAll(async () => {
    await ctx.destroy();
  });

  it('creates 3 round-robin fights and resolves standings without elimination propagation', async () => {
    const club = await ctx.createClub();
    const ruleset = await ctx.createRuleset({
      weights: [
        {
          name: '65kg',
          minWeightKgExcl: 60,
          maxWeightKgIncl: 65,
        },
      ],
    });

    const client = request(ctx.app.getHttpServer());
    const slug = uniqueSuffix('rr-event');
    const event = await expectOk(
      client.post('/api/events').send(buildEventPayload(ruleset.rulesetId, slug)),
    );
    const eventId = event.body.id as string;
    ctx.trackEvent(eventId);

    const categories = await expectOk(
      client.post(`/api/events/${eventId}/categories`).send({
        rulesetId: ruleset.rulesetId,
        ageGroups: [
          {
            rulesetAgeGroupId: ruleset.ageGroupId,
            weightCategoryIds: ruleset.weightCategoryIds,
          },
        ],
      }),
    );
    const eventWeightCategoryId = categories.body.ageGroups[0].weightCategories[0]
      .id as string;

    const athleteA = await ctx.createAthlete({
      clubId: club.id,
      firstName: 'Round',
      lastName: 'Alpha',
      documentId: uniqueSuffix('rr-a'),
    });
    const athleteB = await ctx.createAthlete({
      clubId: club.id,
      firstName: 'Round',
      lastName: 'Bravo',
      documentId: uniqueSuffix('rr-b'),
    });
    const athleteC = await ctx.createAthlete({
      clubId: club.id,
      firstName: 'Round',
      lastName: 'Charlie',
      documentId: uniqueSuffix('rr-c'),
    });

    await approveAndPass({
      ctx,
      eventId,
      athleteId: athleteA.id,
      eventWeightCategoryId,
    });
    await approveAndPass({
      ctx,
      eventId,
      athleteId: athleteB.id,
      eventWeightCategoryId,
    });
    await approveAndPass({
      ctx,
      eventId,
      athleteId: athleteC.id,
      eventWeightCategoryId,
    });

    await expectOk(
      client.post(`/api/events/${eventId}/lifecycle`).send({
        to: 'WEIGH_IN_COMPLETED',
        override: true,
        reason: 'Direct round-robin e2e setup',
      }),
    );

    await expectOk(client.post('/api/draw').send({ eventId, seed: 3 }));

    const fights = await ctx.prisma.fight.findMany({
      where: { eventId },
      orderBy: { boutNo: 'asc' },
    });
    expect(fights).toHaveLength(3);
    expect(fights.every((fight) => fight.round === 1)).toBe(true);
    expect(fights.every((fight) => fight.nextFightId == null)).toBe(true);
    expect(fights.every((fight) => fight.nextFightSlot == null)).toBe(true);

    await expectOk(
      client.post('/api/mats').send({
        eventId,
        name: 'Mat A',
        order: 1,
      }),
    );
    const scheduled = await expectOk(
      client.post('/api/schedule/auto').send({
        eventId,
        startTimeIso: new Date().toISOString(),
        avgBoutSeconds: 180,
        bufferSeconds: 60,
      }),
    );
    expect(scheduled.body).toHaveLength(3);

    await expectOk(
      client.post(`/api/events/${eventId}/lifecycle`).send({ to: 'LIVE' }),
    );

    for (const fight of fights) {
      let winner: 'RED' | 'BLUE';
      if (fight.redAthleteId === athleteA.id) {
        winner = 'RED';
      } else if (fight.blueAthleteId === athleteA.id) {
        winner = 'BLUE';
      } else if (
        fight.redAthleteId === athleteB.id &&
        fight.blueAthleteId === athleteC.id
      ) {
        winner = 'RED';
      } else if (
        fight.redAthleteId === athleteC.id &&
        fight.blueAthleteId === athleteB.id
      ) {
        winner = 'BLUE';
      } else {
        throw new Error(`Unexpected round-robin pairing ${fight.id}`);
      }

      await expectOk(client.post(`/api/fights/${fight.id}/start`));
      await expectOk(
        client.post(`/api/fights/${fight.id}/result`).send({
          winner,
          method: 'POINTS',
        }),
      );
    }

    const summary = await expectOk(
      client.get('/api/results/summary').query({ eventId }),
    );
    expect(summary.body.categories).toHaveLength(1);
    expect(summary.body.categories[0].competitionFormat).toBe('ROUND_ROBIN');
    expect(summary.body.categories[0].totalFights).toBe(3);
    expect(summary.body.categories[0].completedFights).toBe(3);
    expect(summary.body.categories[0].needsReview).toBe(false);
    expect(summary.body.categories[0].standings).toHaveLength(3);
    expect(summary.body.categories[0].standings[0].athleteId).toBe(athleteA.id);
    expect(summary.body.categories[0].standings[1].athleteId).toBe(athleteB.id);
    expect(summary.body.categories[0].standings[2].athleteId).toBe(athleteC.id);
  });
});
