import { FightsService } from './fights.service';

function createPrismaMock() {
  const prisma: any = {
    fight: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    timerState: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) => fn(prisma)),
  };
  return prisma;
}

const createAuditMock = () => ({
  write: jest.fn(),
});

describe('FightsService round flow', () => {
  it('finishes the fight in two rounds when the same athlete wins twice', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new FightsService(prisma, audit as any);

    const fight = {
      id: 'fight_1',
      organisationId: 'org_1',
      eventId: 'event_1',
      status: 'PAUSED',
      redAthleteId: 'red_1',
      blueAthleteId: 'blue_1',
      winnerAthleteId: null,
      nextFightId: null,
      nextFightSlot: null,
      event: { id: 'event_1', lifecycle: 'LIVE' },
      timerState: {
        fightId: 'fight_1',
        organisationId: 'org_1',
        state: 'PAUSED',
        phase: 'ROUND',
        round: 2,
        startedAt: null,
        pausedAt: new Date('2026-03-27T10:02:00.000Z'),
        pausedMs: 120_000,
        phaseDurationSeconds: 120,
        roundDurationSeconds: 120,
        restDurationSeconds: 60,
        redRoundWins: 1,
        blueRoundWins: 0,
        round1Winner: 'RED',
        round2Winner: null,
        round3Winner: null,
        updatedAt: new Date('2026-03-27T10:02:00.000Z'),
      },
    };

    prisma.fight.findFirst.mockResolvedValue(fight);
    prisma.timerState.findUnique.mockResolvedValue(fight.timerState);
    prisma.timerState.update
      .mockResolvedValueOnce({
        ...fight.timerState,
        redRoundWins: 2,
        round2Winner: 'RED',
      })
      .mockResolvedValueOnce({
        ...fight.timerState,
        state: 'FINISHED',
        phase: 'FINISHED',
        redRoundWins: 2,
        round2Winner: 'RED',
      });
    prisma.fight.update.mockResolvedValue({
      id: 'fight_1',
      eventId: 'event_1',
      matId: null,
      redAthleteId: 'red_1',
      blueAthleteId: 'blue_1',
      winnerAthleteId: 'red_1',
      status: 'CONFIRMED',
      nextFightId: null,
      nextFightSlot: null,
    });

    const result = await service.recordRoundResult({
      organisationId: 'org_1',
      fightId: 'fight_1',
      actorUserId: 'user_1',
      winner: 'RED',
    });

    expect(result.fight.winnerAthleteId).toBe('red_1');
    expect(result.fight.status).toBe('CONFIRMED');
  });

  it('starts the one-minute rest when the rounds are split 1-1', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new FightsService(prisma, audit as any);

    const fight = {
      id: 'fight_2',
      organisationId: 'org_1',
      eventId: 'event_1',
      status: 'PAUSED',
      redAthleteId: 'red_1',
      blueAthleteId: 'blue_1',
      winnerAthleteId: null,
      nextFightId: null,
      nextFightSlot: null,
      event: { id: 'event_1', lifecycle: 'LIVE' },
      timerState: {
        fightId: 'fight_2',
        organisationId: 'org_1',
        state: 'PAUSED',
        phase: 'ROUND',
        round: 2,
        startedAt: null,
        pausedAt: new Date('2026-03-27T10:02:00.000Z'),
        pausedMs: 120_000,
        phaseDurationSeconds: 120,
        roundDurationSeconds: 120,
        restDurationSeconds: 60,
        redRoundWins: 1,
        blueRoundWins: 0,
        round1Winner: 'RED',
        round2Winner: null,
        round3Winner: null,
        updatedAt: new Date('2026-03-27T10:02:00.000Z'),
      },
    };

    prisma.fight.findFirst.mockResolvedValue(fight);
    prisma.timerState.findUnique.mockResolvedValue(fight.timerState);
    prisma.timerState.update
      .mockResolvedValueOnce({
        ...fight.timerState,
        blueRoundWins: 1,
        round2Winner: 'BLUE',
      })
      .mockResolvedValueOnce({
        ...fight.timerState,
        state: 'RUNNING',
        phase: 'REST',
        blueRoundWins: 1,
        round2Winner: 'BLUE',
        phaseDurationSeconds: 60,
      });
    prisma.fight.update.mockResolvedValue({
      id: 'fight_2',
      eventId: 'event_1',
      matId: null,
      redAthleteId: 'red_1',
      blueAthleteId: 'blue_1',
      winnerAthleteId: null,
      status: 'IN_PROGRESS',
      nextFightId: null,
      nextFightSlot: null,
    });

    const result = await service.recordRoundResult({
      organisationId: 'org_1',
      fightId: 'fight_2',
      actorUserId: 'user_1',
      winner: 'BLUE',
    });

    expect(prisma.timerState.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          phase: 'REST',
          state: 'RUNNING',
          phaseDurationSeconds: 60,
        }),
      }),
    );
    expect(result.fight.status).toBe('IN_PROGRESS');
    expect(result.advanced).toBeNull();
  });

  it('starts the next round automatically when rest expires', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new FightsService(prisma, audit as any);

    const expiredRest = {
      fightId: 'fight_3',
      organisationId: 'org_1',
      state: 'RUNNING',
      phase: 'REST',
      round: 2,
      startedAt: new Date('2026-03-27T10:00:00.000Z'),
      pausedAt: null,
      pausedMs: 0,
      phaseDurationSeconds: 60,
      roundDurationSeconds: 120,
      restDurationSeconds: 60,
      redRoundWins: 1,
      blueRoundWins: 1,
      round1Winner: 'RED',
      round2Winner: 'BLUE',
      round3Winner: null,
      updatedAt: new Date('2026-03-27T10:00:00.000Z'),
      fight: {
        id: 'fight_3',
        eventId: 'event_1',
        matId: null,
        status: 'IN_PROGRESS',
      },
    };

    prisma.timerState.findMany.mockResolvedValue([expiredRest]);
    prisma.timerState.findUnique.mockResolvedValue(expiredRest);
    prisma.timerState.update.mockResolvedValue({
      ...expiredRest,
      phase: 'ROUND',
      state: 'RUNNING',
      round: 3,
      startedAt: new Date('2026-03-27T10:01:01.000Z'),
      updatedAt: new Date('2026-03-27T10:01:01.000Z'),
    });
    prisma.fight.update.mockResolvedValue({
      id: 'fight_3',
      eventId: 'event_1',
      matId: null,
      status: 'IN_PROGRESS',
    });

    const transitions = await service.advanceExpiredTimers(
      new Date('2026-03-27T10:01:01.000Z'),
    );

    expect(transitions[0]?.scheduleEventType).toBe('LIVE_NEXT_ROUND_STARTED');
    expect(transitions[0]?.timer?.currentRound).toBe(3);
  });
});
