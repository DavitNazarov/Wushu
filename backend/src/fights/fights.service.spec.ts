import { FightsService } from './fights.service';

const createPrismaMock = () => {
  const prisma: any = {
    fight: {
      findFirst: jest.fn(),
    },
    timerState: {
      upsert: jest.fn(),
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
