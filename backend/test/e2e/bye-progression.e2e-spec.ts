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
    name: `BYE Event ${slug}`,
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

async function createApprovedRegistration(input: {
  ctx: E2eTestContext;
  eventId: string;
  eventWeightCategoryId: string;
  athleteId: string;
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
  return registration.body.id as string;
}

describeIfDb('BYE progression (e2e)', () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eTestContext();
  });

  afterAll(async () => {
    await ctx.destroy();
  });

  it('auto-confirms a single-elimination BYE and propagates the athlete downstream', async () => {
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
    const slug = uniqueSuffix('bye-event');
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

    for (let index = 0; index < 7; index += 1) {
      const athlete = await ctx.createAthlete({
        clubId: club.id,
        firstName: `Bye${index + 1}`,
        lastName: 'Athlete',
        documentId: uniqueSuffix(`bye-athlete-${index + 1}`),
      });
      const registrationId = await createApprovedRegistration({
        ctx,
        eventId,
        eventWeightCategoryId,
        athleteId: athlete.id,
      });
      await expectOk(
        client.post('/api/weighin').send({
          registrationId,
          weightKg: 64,
          override: true,
          reason: 'Allow weigh-in before lifecycle transition for BYE e2e setup',
          decision: 'PASS',
        }),
      );
    }

    await expectOk(
      client.post(`/api/events/${eventId}/lifecycle`).send({
        to: 'WEIGH_IN_COMPLETED',
        override: true,
        reason: 'Direct BYE e2e setup',
      }),
    );

    const draw = await expectOk(
      client.post('/api/draw').send({ eventId, seed: 11 }),
    );
    expect(draw.body.brackets).toHaveLength(1);

    const fights = await ctx.prisma.fight.findMany({
      where: { eventId },
      orderBy: [{ round: 'asc' }, { boutNo: 'asc' }],
    });

    expect(fights).toHaveLength(7);
    const byeFights = fights.filter(
      (fight) =>
        (fight.redAthleteId == null) !== (fight.blueAthleteId == null) &&
        fight.status === 'CONFIRMED' &&
        fight.winnerAthleteId != null,
    );
    expect(byeFights).toHaveLength(1);

    const byeFight = byeFights[0];
    expect(byeFight.nextFightId).toBeTruthy();
    expect(byeFight.winMethod).toBe('WO');

    const downstreamFight = await ctx.prisma.fight.findUnique({
      where: { id: byeFight.nextFightId! },
    });
    expect(downstreamFight).not.toBeNull();
    expect(
      downstreamFight!.redAthleteId === byeFight.winnerAthleteId ||
        downstreamFight!.blueAthleteId === byeFight.winnerAthleteId,
    ).toBe(true);

    const mat = await expectOk(
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

    const schedule = await expectOk(
      client.get('/api/schedule').query({ eventId }),
    );
    expect(
      schedule.body.some((row: { id: string }) => row.id === byeFight.id),
    ).toBe(false);
    expect(
      schedule.body.some(
        (row: { redDisplayName: string; blueDisplayName: string }) =>
          row.redDisplayName === 'BYE' || row.blueDisplayName === 'BYE',
      ),
    ).toBe(false);

    const scheduledOnMat = schedule.body.filter(
      (row: { matId: string | null; isPlayable: boolean }) =>
        row.matId === mat.body.id && row.isPlayable,
    );
    expect(scheduledOnMat).toHaveLength(3);
  });
});
