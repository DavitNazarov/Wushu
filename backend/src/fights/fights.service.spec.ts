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
    expect(result?.fightId).toBe('fight_1');
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

    prisma.fight.findFirst.mockResolvedValue({
      id: 'sf1',
      organisationId: 'org_1',
      eventId: 'event_1',
      status: 'IN_PROGRESS',
      redAthleteId: 'a_red',
      blueAthleteId: 'a_blue',
      nextFightId: 'final_1',
      nextFightSlot: 'RED',
      event: { id: 'event_1', lifecycle: 'LIVE' },
    });

    prisma.fight.update
      .mockResolvedValueOnce({
        id: 'sf1',
        winnerAthleteId: 'a_red',
        loserAthleteId: 'a_blue',
        status: 'CONFIRMED',
        confirmedByUserId: 'user_1',
        nextFightId: 'final_1',
        nextFightSlot: 'RED',
      })
      .mockResolvedValueOnce({
        id: 'final_1',
        redAthleteId: 'a_red',
        blueAthleteId: 'a_other',
      });
    prisma.fight.findUnique.mockResolvedValue({
      id: 'final_1',
      status: 'QUEUED',
      redAthleteId: null,
      blueAthleteId: 'a_other',
      winnerAthleteId: null,
      loserAthleteId: null,
      winMethod: null,
      confirmedAt: null,
      timerState: null,
    });

    await service.setResult({
      organisationId: 'org_1',
      fightId: 'sf1',
      actorUserId: 'user_1',
      winner: 'RED',
      method: 'POINTS',
    });

    expect(prisma.fight.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'sf1' },
        data: expect.objectContaining({
          winnerAthleteId: 'a_red',
          loserAthleteId: 'a_blue',
          status: 'CONFIRMED',
          confirmedByUserId: 'user_1',
        }),
      }),
    );
    expect(prisma.fight.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'final_1' },
        data: { redAthleteId: 'a_red' },
      }),
    );
  });

  it('blocks result correction when the downstream fight has already moved on', async () => {
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

    prisma.fight.findUnique.mockResolvedValue({
      id: 'final_1',
      status: 'ON_DECK',
      redAthleteId: 'a_red',
      blueAthleteId: 'a_other',
      winnerAthleteId: null,
      loserAthleteId: null,
      winMethod: null,
      confirmedAt: null,
      timerState: null,
    });

    await expect(
      service.setResult({
        organisationId: 'org_1',
        fightId: 'sf1',
        actorUserId: 'user_1',
        winner: 'BLUE',
        method: 'POINTS',
        override: true,
        reason: 'attempted correction after next fight staged',
      }),
    ).rejects.toThrow('RESULT_CORRECTION_BLOCKED');

    expect(prisma.fight.update).not.toHaveBeenCalled();
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
