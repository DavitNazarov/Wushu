import request from 'supertest';
import {
  createE2eTestContext,
  expectOk,
  isoOffset,
  uniqueSuffix,
  type E2eTestContext,
} from './test-context';

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

function buildEventPayload(categoryTemplateId: string, slug: string) {
  return {
    name: `Weigh-in Event ${slug}`,
    slug,
    location: 'Tbilisi',
    timezone: 'Asia/Tbilisi',
    categoryTemplateId,
    policies: {
      weighInPolicyCode: 'DIRECT_MOVE_UP',
    },
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

async function registerApproved(input: {
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
  return registration.body.id as string;
}

describeIfDb('Weigh-in move-up and override (e2e)', () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eTestContext();
  });

  afterAll(async () => {
    await ctx.destroy();
  });

  it('persists moved-up and override-approved athletes into readiness and draw placement', async () => {
    const club = await ctx.createClub();
    const categoryTemplate = await ctx.createCategoryTemplate({
      weights: [
        {
          name: '65kg',
          minWeightKgExcl: 60,
          maxWeightKgIncl: 65,
        },
        {
          name: '70kg',
          minWeightKgExcl: 65,
          maxWeightKgIncl: 70,
        },
      ],
    });

    const client = request(ctx.app.getHttpServer());
    const slug = uniqueSuffix('weighin-event');
    const event = await expectOk(
      client
        .post('/api/events')
        .send(buildEventPayload(categoryTemplate.categoryTemplateId, slug)),
    );
    const eventId = event.body.id as string;
    ctx.trackEvent(eventId);

    const categories = await expectOk(
      client.post(`/api/events/${eventId}/categories`).send({
        categoryTemplateId: categoryTemplate.categoryTemplateId,
        ageGroups: [
          {
            categoryTemplateGroupId:
              categoryTemplate.categoryTemplateAgeGroupId,
            weightCategoryIds: categoryTemplate.categoryTemplateWeightIds,
          },
        ],
      }),
    );
    const eventCategoryByName = new Map<string, string>(
      categories.body.ageGroups[0].weightCategories.map(
        (category: { id: string; name: string }) => [category.name, category.id],
      ),
    );

    const movedUpAthlete = await ctx.createAthlete({
      clubId: club.id,
      firstName: 'Move',
      lastName: 'Up',
      documentId: uniqueSuffix('move-up'),
    });
    const passed65Athlete = await ctx.createAthlete({
      clubId: club.id,
      firstName: 'Pass',
      lastName: 'Light',
      documentId: uniqueSuffix('pass-65'),
    });
    const passed70Athlete = await ctx.createAthlete({
      clubId: club.id,
      firstName: 'Pass',
      lastName: 'Heavy',
      documentId: uniqueSuffix('pass-70'),
    });
    const overrideAthlete = await ctx.createAthlete({
      clubId: club.id,
      firstName: 'Override',
      lastName: 'Approved',
      documentId: uniqueSuffix('override'),
    });

    const movedUpRegistrationId = await registerApproved({
      ctx,
      eventId,
      athleteId: movedUpAthlete.id,
      eventWeightCategoryId: eventCategoryByName.get('65kg')!,
    });
    const passed65RegistrationId = await registerApproved({
      ctx,
      eventId,
      athleteId: passed65Athlete.id,
      eventWeightCategoryId: eventCategoryByName.get('65kg')!,
    });
    const passed70RegistrationId = await registerApproved({
      ctx,
      eventId,
      athleteId: passed70Athlete.id,
      eventWeightCategoryId: eventCategoryByName.get('70kg')!,
    });
    const overrideRegistrationId = await registerApproved({
      ctx,
      eventId,
      athleteId: overrideAthlete.id,
      eventWeightCategoryId: eventCategoryByName.get('65kg')!,
    });

    await expectOk(
      client.post(`/api/events/${eventId}/lifecycle`).send({ to: 'LOCKED' }),
    );
    await expectOk(
      client.post(`/api/events/${eventId}/lifecycle`).send({ to: 'WEIGHIN' }),
    );

    await expectOk(
      client.post('/api/weighin').send({
        registrationId: movedUpRegistrationId,
        weightKg: 66.2,
      }),
    );
    await expectOk(
      client.post('/api/weighin').send({
        registrationId: passed65RegistrationId,
        weightKg: 64,
      }),
    );
    await expectOk(
      client.post('/api/weighin').send({
        registrationId: passed70RegistrationId,
        weightKg: 69,
      }),
    );
    await expectOk(
      client.post('/api/weighin').send({
        registrationId: overrideRegistrationId,
        weightKg: 67.2,
        override: true,
        reason: 'Scale discrepancy confirmed by operator',
        decision: 'PASS',
      }),
    );

    const refreshedEvent = await expectOk(client.get(`/api/events/${eventId}`));
    expect(refreshedEvent.body.lifecycle).toBe('WEIGH_IN_COMPLETED');

    const registrations = await ctx.prisma.registration.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
    });
    const movedUpRegistration = registrations.find(
      (registration) => registration.id === movedUpRegistrationId,
    );
    const overrideRegistration = registrations.find(
      (registration) => registration.id === overrideRegistrationId,
    );
    expect(movedUpRegistration?.weighInStatus).toBe('MOVED_UP');
    expect(movedUpRegistration?.eventWeightCategoryId).toBe(
      eventCategoryByName.get('70kg'),
    );
    expect(overrideRegistration?.weighInStatus).toBe('OVERRIDE_APPROVED');
    expect(overrideRegistration?.eventWeightCategoryId).toBe(
      eventCategoryByName.get('65kg'),
    );

    const readiness = await expectOk(
      client.get('/api/draw/overview').query({ eventId }),
    );
    expect(readiness.body.summary.readyCategoriesCount).toBe(2);
    expect(
      readiness.body.validation.warnings.some(
        (issue: { code: string }) => issue.code === 'MOVED_UP_ATHLETES_PRESENT',
      ),
    ).toBe(true);
    expect(
      readiness.body.validation.warnings.some(
        (issue: { code: string }) => issue.code === 'OVERRIDE_RECORDS_PRESENT',
      ),
    ).toBe(true);

    await expectOk(client.post('/api/draw').send({ eventId, seed: 21 }));

    const fights = await ctx.prisma.fight.findMany({
      where: { eventId },
      orderBy: [{ categoryCode: 'asc' }, { boutNo: 'asc' }],
    });
    expect(fights).toHaveLength(2);

    const lightFight = fights.find(
      (fight) => fight.eventWeightCategoryId === eventCategoryByName.get('65kg'),
    );
    const heavyFight = fights.find(
      (fight) => fight.eventWeightCategoryId === eventCategoryByName.get('70kg'),
    );
    expect(lightFight).toBeDefined();
    expect(heavyFight).toBeDefined();
    expect(
      [lightFight!.redAthleteId, lightFight!.blueAthleteId].sort(),
    ).toEqual([passed65Athlete.id, overrideAthlete.id].sort());
    expect(
      [heavyFight!.redAthleteId, heavyFight!.blueAthleteId].sort(),
    ).toEqual([movedUpAthlete.id, passed70Athlete.id].sort());
  });
});
