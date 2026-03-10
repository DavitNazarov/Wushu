import { DrawService } from './draw.service';

function createPrismaMock() {
  return {
    event: {
      findFirst: jest.fn(),
    },
    bracket: {
      count: jest.fn(),
    },
    fight: {
      findFirst: jest.fn(),
    },
    timerState: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;
}

function createAuditMock() {
  return {
    write: jest.fn(),
  };
}

function createReadinessMock() {
  return {
    getOverview: jest.fn(),
  };
}

describe('DrawService safety guards', () => {
  it('blocks redraw when bracket activity has already progressed', async () => {
    const prisma = createPrismaMock();
    prisma.event.findFirst.mockResolvedValue({
      id: 'event_1',
      organisationId: 'org_1',
      lifecycle: 'DRAWN',
      published: false,
      publishTimingPolicyCode: 'MANUAL_PUBLISH_LATER',
    });
    prisma.bracket.count.mockResolvedValue(1);
    prisma.fight.findFirst.mockResolvedValue({ id: 'fight_1' });

    const service = new DrawService(
      prisma,
      createAuditMock() as any,
      createReadinessMock() as any,
    );

    await expect(
      service.executeDraw({
        organisationId: 'org_1',
        eventId: 'event_1',
        actorUserId: 'user_1',
        override: true,
        reason: 'attempt redraw',
      }),
    ).rejects.toThrow('DRAW_MUTATION_BLOCKED');
  });

  it('blocks draw reset while the event is still publicly published', async () => {
    const prisma = createPrismaMock();
    prisma.event.findFirst.mockResolvedValue({
      id: 'event_1',
      organisationId: 'org_1',
      lifecycle: 'PUBLISHED',
      published: true,
    });
    prisma.fight.findFirst.mockResolvedValue(null);
    prisma.timerState.findFirst.mockResolvedValue(null);

    const service = new DrawService(
      prisma,
      createAuditMock() as any,
      createReadinessMock() as any,
    );

    await expect(
      service.resetDraw({
        organisationId: 'org_1',
        eventId: 'event_1',
        actorUserId: 'user_1',
        override: true,
        reason: 'attempt reset',
      }),
    ).rejects.toThrow('DRAW_MUTATION_BLOCKED');
  });
});
