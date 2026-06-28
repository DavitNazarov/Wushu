import { FightsService } from './fights.service';

const createPrismaMock = () => {
  const prisma: any = {
    event: {
      findFirst: jest.fn(),
    },
    mat: {
      findMany: jest.fn(),
    },
    fight: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      // finalizeFightResult's lost-update guard writes the result via a
      // compare-and-swap updateMany({ where: { id, status, updatedAt,
      // winnerAthleteId }}). Default { count: 1 } = "the swap matched" so the
      // happy path proceeds; tests override with { count: 0 } to exercise the
      // FIGHT_STALE_UPDATE abort.
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      // finalizeFightResult counts remaining playable fights to decide LIVE →
      // COMPLETED auto-complete; default 1 = "fights remain" so result tests
      // don't accidentally drive event completion.
      count: jest.fn().mockResolvedValue(1),
    },
    scheduleSession: {
      // computeLiveQueueBoard reads sessions to order the queue; default to none
      // so the board derives order from global fight order.
      findMany: jest.fn().mockResolvedValue([]),
    },
    timerState: {
      upsert: jest.fn().mockResolvedValue({
        fightId: 'fight_1',
        state: 'RUNNING',
        round: 1,
        startedAt: new Date('2026-03-07T10:01:00.000Z'),
        pausedAt: null,
        pausedMs: 30_000,
        updatedAt: new Date('2026-03-07T10:01:00.000Z'),
        updatedByUserId: 'user_1',
      }),
      findUnique: jest.fn(),
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

describe('FightsService timer concurrency', () => {
  it('rejects stale timer updates when expectedUpdatedAt does not match DB', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new FightsService(prisma, audit as any);

    const dbUpdatedAt = new Date('2026-03-07T10:00:00.000Z');
    prisma.fight.findFirst.mockResolvedValue({
      id: 'fight_1',
      organisationId: 'org_1',
      eventId: 'event_1',
      status: 'IN_PROGRESS',
      event: { id: 'event_1', lifecycle: 'LIVE' },
      timerState: {
        state: 'RUNNING',
        round: 1,
        startedAt: new Date('2026-03-07T09:59:00.000Z'),
        pausedAt: null,
        pausedMs: 0,
        updatedAt: dbUpdatedAt,
      },
    });

    await expect(
      service.timerAction({
        organisationId: 'org_1',
        fightId: 'fight_1',
        actorUserId: 'user_1',
        action: 'PAUSE',
        expectedUpdatedAt: '2026-03-07T09:59:59.000Z',
      }),
    ).rejects.toThrow('TIMER_STALE_UPDATE');

    expect(prisma.timerState.upsert).not.toHaveBeenCalled();
  });

  it('allows timer update when expectedUpdatedAt matches DB', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new FightsService(prisma, audit as any);

    const dbUpdatedAt = new Date('2026-03-07T10:00:00.000Z');
    prisma.fight.findFirst.mockResolvedValue({
      id: 'fight_1',
      organisationId: 'org_1',
      eventId: 'event_1',
      status: 'PAUSED',
      event: { id: 'event_1', lifecycle: 'LIVE' },
      timerState: {
        state: 'PAUSED',
        round: 1,
        startedAt: new Date('2026-03-07T09:59:00.000Z'),
        pausedAt: new Date('2026-03-07T10:00:00.000Z'),
        pausedMs: 30_000,
        updatedAt: dbUpdatedAt,
      },
    });
    prisma.timerState.findUnique.mockResolvedValue({
      fightId: 'fight_1',
      state: 'RUNNING',
      round: 1,
      startedAt: new Date('2026-03-07T10:01:00.000Z'),
      pausedAt: null,
      pausedMs: 30_000,
      updatedAt: new Date('2026-03-07T10:01:00.000Z'),
      updatedByUserId: 'user_1',
    });

    const result = await service.timerAction({
      organisationId: 'org_1',
      fightId: 'fight_1',
      actorUserId: 'user_1',
      action: 'RESUME',
      expectedUpdatedAt: dbUpdatedAt.toISOString(),
    });

    expect(prisma.timerState.upsert).toHaveBeenCalled();
    expect(result?.timer?.fightId).toBe('fight_1');
  });
});

describe('FightsService state transitions', () => {
  it('rejects override COMPLETE state when winner is missing', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new FightsService(prisma, audit as any);

    prisma.fight.findFirst.mockResolvedValue({
      id: 'fight_1',
      organisationId: 'org_1',
      eventId: 'event_1',
      status: 'IN_PROGRESS',
      winnerAthleteId: null,
      matId: null,
      event: { id: 'event_1', lifecycle: 'LIVE' },
    });

    await expect(
      service.setState({
        organisationId: 'org_1',
        fightId: 'fight_1',
        actorUserId: 'user_1',
        to: 'COMPLETE',
        override: true,
        reason: 'manual correction',
        actorCapabilities: ['RESULTS_OVERRIDE'],
      }),
    ).rejects.toThrow('WINNER_REQUIRED_FOR_COMPLETE');

    expect(prisma.fight.update).not.toHaveBeenCalled();
  });

  it('promotes a queued fight to on-deck before starting it', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new FightsService(prisma, audit as any);

    prisma.fight.findFirst.mockResolvedValue({
      id: 'fight_1',
      status: 'QUEUED',
    });

    const setStateSpy = jest
      .spyOn(service, 'setState')
      .mockResolvedValueOnce({
        fight: { id: 'fight_1', status: 'ON_DECK' } as any,
        advanced: null,
      })
      .mockResolvedValueOnce({
        fight: { id: 'fight_1', status: 'IN_PROGRESS' } as any,
        advanced: null,
      });

    const result = await service.startFight({
      organisationId: 'org_1',
      fightId: 'fight_1',
      actorUserId: 'user_1',
    });

    expect(setStateSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        organisationId: 'org_1',
        fightId: 'fight_1',
        actorUserId: 'user_1',
        to: 'ON_DECK',
      }),
    );
    expect(setStateSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        organisationId: 'org_1',
        fightId: 'fight_1',
        actorUserId: 'user_1',
        to: 'IN_PROGRESS',
      }),
    );
    expect(result.status).toBe('IN_PROGRESS');
  });
});

describe('FightsService result propagation', () => {
  it('confirms the result immediately and propagates winner to the next fight slot', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new FightsService(prisma, audit as any);

    // updatedAt the pre-transaction read observed; the compare-and-swap keys on
    // this exact value, so we assert the same instance flows into updateMany.
    const observedUpdatedAt = new Date('2026-03-07T10:00:00.000Z');
    prisma.fight.findFirst.mockResolvedValue({
      id: 'sf1',
      organisationId: 'org_1',
      eventId: 'event_1',
      status: 'IN_PROGRESS',
      redAthleteId: 'a_red',
      blueAthleteId: 'a_blue',
      winnerAthleteId: null,
      nextFightId: 'final_1',
      nextFightSlot: 'RED',
      updatedAt: observedUpdatedAt,
      event: { id: 'event_1', lifecycle: 'LIVE' },
    });

    // The CAS write succeeds (matched the observed row). Flip a flag so the
    // post-write re-fetch below returns the CONFIRMED row, mirroring the DB
    // transitioning from pre-write (winner null) to post-write (winner set).
    let swapped = false;
    prisma.fight.updateMany.mockImplementation(async () => {
      swapped = true;
      return { count: 1 };
    });

    const downstreamFinal = {
      id: 'final_1',
      status: 'QUEUED',
      redAthleteId: null,
      blueAthleteId: 'a_other',
      winnerAthleteId: null,
      loserAthleteId: null,
      winMethod: null,
      confirmedAt: null,
      timerState: null,
    };
    prisma.fight.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.id === 'sf1') {
        // Pre-swap: the in-tx hasRecordedResult re-read (winner still null).
        // Post-swap: the re-fetched CONFIRMED row the propagation path reads.
        return swapped
          ? {
              id: 'sf1',
              status: 'CONFIRMED',
              winnerAthleteId: 'a_red',
              loserAthleteId: 'a_blue',
              nextFightId: 'final_1',
              nextFightSlot: 'RED',
            }
          : { status: 'IN_PROGRESS', winnerAthleteId: null };
      }
      // Downstream next fight — read pre-tx (RESULT_CORRECTION_BLOCKED guard)
      // and again during propagation; unlocked so the winner copies in.
      return downstreamFinal;
    });
    prisma.fight.update.mockResolvedValue({
      id: 'final_1',
      redAthleteId: 'a_red',
      blueAthleteId: 'a_other',
    });

    await service.setResult({
      organisationId: 'org_1',
      fightId: 'sf1',
      actorUserId: 'user_1',
      winner: 'RED',
      method: 'POINTS',
    });

    // The result is written via the compare-and-swap, keyed on the exact
    // (status, updatedAt, winnerAthleteId: null) observed before the tx — not a
    // bare update({ where: { id }}). Exactly one swap.
    expect(prisma.fight.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.fight.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'sf1',
          status: 'IN_PROGRESS',
          updatedAt: observedUpdatedAt,
          winnerAthleteId: null,
        },
        data: expect.objectContaining({
          winnerAthleteId: 'a_red',
          loserAthleteId: 'a_blue',
          status: 'CONFIRMED',
          confirmedByUserId: 'user_1',
        }),
      }),
    );

    // The re-fetched winner propagates exactly once into the next fight's RED
    // slot — fight.update is now only the downstream copy, never the source.
    expect(prisma.fight.update).toHaveBeenCalledTimes(1);
    expect(prisma.fight.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'final_1' },
        data: { redAthleteId: 'a_red' },
      }),
    );

    // Exactly one FIGHT_RESULT_SET audit row — no duplicate finalize.
    const resultSetWrites = audit.write.mock.calls.filter(
      ([entry]: any[]) => entry.action === 'FIGHT_RESULT_SET',
    );
    expect(resultSetWrites).toHaveLength(1);
  });

  it('aborts with FIGHT_STALE_UPDATE when the compare-and-swap matches no row', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new FightsService(prisma, audit as any);

    prisma.fight.findFirst.mockResolvedValue({
      id: 'sf1',
      organisationId: 'org_1',
      eventId: 'event_1',
      status: 'IN_PROGRESS',
      redAthleteId: 'a_red',
      blueAthleteId: 'a_blue',
      winnerAthleteId: null,
      nextFightId: null,
      nextFightSlot: null,
      updatedAt: new Date('2026-03-07T10:00:00.000Z'),
      event: { id: 'event_1', lifecycle: 'LIVE' },
    });

    // The in-tx hasRecordedResult re-read still shows the fight unscored, so the
    // guard passes the row through to the CAS...
    prisma.fight.findUnique.mockResolvedValue({
      status: 'IN_PROGRESS',
      winnerAthleteId: null,
    });
    // ...but a racing submission already advanced the row, so the swap matches
    // nothing. We must abort instead of last-writer-wins overwriting the winner.
    prisma.fight.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.setResult({
        organisationId: 'org_1',
        fightId: 'sf1',
        actorUserId: 'user_1',
        winner: 'RED',
        method: 'POINTS',
      }),
    ).rejects.toThrow('FIGHT_STALE_UPDATE');

    expect(prisma.fight.updateMany).toHaveBeenCalledTimes(1);
    // Bailed before the post-swap re-fetch: no winner write, no propagation.
    expect(prisma.fight.update).not.toHaveBeenCalled();
  });

  it('refuses to mutate a finalized (CONFIRMED) fight even with RESULTS_OVERRIDE', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new FightsService(prisma, audit as any);

    prisma.fight.findFirst.mockResolvedValue({
      id: 'sf1',
      organisationId: 'org_1',
      eventId: 'event_1',
      status: 'CONFIRMED',
      redAthleteId: 'a_red',
      blueAthleteId: 'a_blue',
      winnerAthleteId: 'a_red',
      nextFightId: 'final_1',
      nextFightSlot: 'RED',
      event: { id: 'event_1', lifecycle: 'LIVE' },
    });

    // Even an admin holding RESULTS_OVERRIDE cannot rewrite a terminal result —
    // corrections must go through a dedicated audited flow, not override.
    await expect(
      service.setResult({
        organisationId: 'org_1',
        fightId: 'sf1',
        actorUserId: 'user_1',
        winner: 'BLUE',
        method: 'POINTS',
        override: true,
        reason: 'attempted correction after fight was confirmed',
        actorCapabilities: ['RESULTS_OVERRIDE'],
      }),
    ).rejects.toThrow('FIGHT_ALREADY_FINALIZED');

    expect(prisma.fight.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an override without RESULTS_OVERRIDE (LIVE_RUN is not enough)', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new FightsService(prisma, audit as any);

    prisma.fight.findFirst.mockResolvedValue({
      id: 'sf1',
      organisationId: 'org_1',
      eventId: 'event_1',
      status: 'IN_PROGRESS',
      redAthleteId: 'a_red',
      blueAthleteId: 'a_blue',
      winnerAthleteId: null,
      nextFightId: null,
      nextFightSlot: null,
      event: { id: 'event_1', lifecycle: 'WEIGH_IN_COMPLETED' },
    });

    // A judge/timekeeper holds LIVE_RUN but not RESULTS_OVERRIDE — an override
    // attempt is refused before any guard it was trying to waive is evaluated.
    await expect(
      service.setResult({
        organisationId: 'org_1',
        fightId: 'sf1',
        actorUserId: 'judge_1',
        winner: 'RED',
        method: 'POINTS',
        override: true,
        reason: 'recording before event is live',
        actorCapabilities: ['LIVE_RUN'],
      }),
    ).rejects.toThrow('OVERRIDE_NOT_PERMITTED');

    expect(prisma.fight.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('FightsService live queue board', () => {
  it('derives the current fight from global schedule order without requiring mats', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new FightsService(prisma, audit as any);

    prisma.event.findFirst.mockResolvedValue({ id: 'event_1' });
    prisma.mat.findMany.mockResolvedValue([]);
    prisma.fight.findMany.mockResolvedValue([
      {
        id: 'fight_1',
        bracketId: 'cat_a',
        categoryCode: 'A',
        eventWeightCategoryId: 'cat_a',
        round: 1,
        boutNo: 1,
        status: 'QUEUED',
        redAthleteId: 'red_1',
        blueAthleteId: 'blue_1',
        winnerAthleteId: null,
        matId: null,
        orderInMat: null,
        scheduledStartTime: new Date('2026-03-07T10:00:00.000Z'),
        redAthlete: { id: 'red_1', firstName: 'Red', lastName: 'One' },
        blueAthlete: { id: 'blue_1', firstName: 'Blue', lastName: 'One' },
        winnerAthlete: null,
        mat: null,
        timerState: null,
        winMethod: null,
        notes: null,
        eventWeightCategory: null,
      },
      {
        id: 'fight_2',
        bracketId: 'cat_a',
        categoryCode: 'A',
        eventWeightCategoryId: 'cat_a',
        round: 1,
        boutNo: 2,
        status: 'QUEUED',
        redAthleteId: 'red_2',
        blueAthleteId: 'blue_2',
        winnerAthleteId: null,
        matId: null,
        orderInMat: null,
        scheduledStartTime: new Date('2026-03-07T10:05:00.000Z'),
        redAthlete: { id: 'red_2', firstName: 'Red', lastName: 'Two' },
        blueAthlete: { id: 'blue_2', firstName: 'Blue', lastName: 'Two' },
        winnerAthlete: null,
        mat: null,
        timerState: null,
        winMethod: null,
        notes: null,
        eventWeightCategory: null,
      },
    ]);

    const result = await service.getLiveQueueBoard({
      organisationId: 'org_1',
      eventId: 'event_1',
    });

    expect(result.currentFight?.id).toBe('fight_1');
    expect(result.onDeckFight?.id).toBe('fight_2');
  });
});
