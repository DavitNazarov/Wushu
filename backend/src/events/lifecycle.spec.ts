/**
 * Lifecycle transition logic tests (pure, no DB).
 *
 * We test the allowed-transitions map and override logic by invoking
 * transitionLifecycle via mocked Prisma + Audit, confirming that:
 * - valid direct transitions succeed
 * - invalid transitions are rejected without override
 * - invalid transitions succeed with override + reason
 * - override without reason is rejected
 */
import { Test, TestingModule } from '@nestjs/testing';
import { EventOpsService } from './event-ops.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

const FUTURE = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
const PAST = (days: number) =>
  new Date(Date.now() - 1000 * 60 * 60 * 24 * days);

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    organisationId: 'org-1',
    lifecycle: 'REG_OPEN',
    competitionStartDate: new Date(FUTURE),
    // Registration window CLOSED by default so REG_OPEN → LOCKED is allowed
    // (event-ops guards LOCKED behind getRegistrationStatus === 'CLOSED').
    registrationOpensAt: PAST(60),
    registrationClosesAt: PAST(30),
    ...overrides,
  };
}

const mockPrisma = {
  event: {
    findFirst: jest.fn(),
    update: jest.fn(),
    // transitionLifecycle uses a compare-and-swap: updateMany (guarded by the
    // lifecycle we read) + findUniqueOrThrow to return the fresh row.
    updateMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(mockPrisma)),
};

const mockAudit = {
  write: jest.fn().mockResolvedValue(undefined),
};

describe('EventOpsService – transitionLifecycle', () => {
  let service: EventOpsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventOpsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<EventOpsService>(EventOpsService);
  });

  it('transitions REG_OPEN → LOCKED directly', async () => {
    const event = makeEvent({ lifecycle: 'REG_OPEN' });
    const updated = { ...event, lifecycle: 'LOCKED' };
    mockPrisma.event.findFirst.mockResolvedValue(event);
    mockPrisma.event.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.event.findUniqueOrThrow.mockResolvedValue(updated);

    const result = await service.transitionLifecycle({
      eventId: 'evt-1',
      organisationId: 'org-1',
      actorUserId: 'user-1',
      targetState: 'LOCKED',
    });

    expect(result.lifecycle).toBe('LOCKED');
    expect(mockAudit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EVENT_LIFECYCLE_TRANSITION',
        override: false,
      }),
    );
  });

  it('rejects REG_OPEN → DRAWN (skip) without override', async () => {
    const event = makeEvent({ lifecycle: 'REG_OPEN' });
    mockPrisma.event.findFirst.mockResolvedValue(event);

    await expect(
      service.transitionLifecycle({
        eventId: 'evt-1',
        organisationId: 'org-1',
        actorUserId: 'user-1',
        targetState: 'DRAWN',
      }),
    ).rejects.toThrow('INVALID_EVENT_TRANSITION');
  });

  it('allows REG_OPEN → DRAWN with override + reason', async () => {
    const event = makeEvent({ lifecycle: 'REG_OPEN' });
    const updated = { ...event, lifecycle: 'DRAWN' };
    mockPrisma.event.findFirst.mockResolvedValue(event);
    mockPrisma.event.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.event.findUniqueOrThrow.mockResolvedValue(updated);

    const result = await service.transitionLifecycle({
      eventId: 'evt-1',
      organisationId: 'org-1',
      actorUserId: 'user-1',
      targetState: 'DRAWN',
      allowOverride: true,
      reason: 'admin forced skip for demo',
    });

    expect(result.lifecycle).toBe('DRAWN');
    expect(mockAudit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EVENT_LIFECYCLE_OVERRIDE',
        override: true,
      }),
    );
  });

  it('throws EVENT_LIFECYCLE_CONFLICT when another transition won the race', async () => {
    const event = makeEvent({ lifecycle: 'REG_OPEN' });
    mockPrisma.event.findFirst.mockResolvedValue(event);
    // CAS finds zero rows still in the lifecycle we validated against.
    mockPrisma.event.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.transitionLifecycle({
        eventId: 'evt-1',
        organisationId: 'org-1',
        actorUserId: 'user-1',
        targetState: 'LOCKED',
      }),
    ).rejects.toThrow('EVENT_LIFECYCLE_CONFLICT');
  });

  it('rejects override without reason', async () => {
    const event = makeEvent({ lifecycle: 'REG_OPEN' });
    mockPrisma.event.findFirst.mockResolvedValue(event);

    await expect(
      service.transitionLifecycle({
        eventId: 'evt-1',
        organisationId: 'org-1',
        actorUserId: 'user-1',
        targetState: 'DRAWN',
        allowOverride: true,
      }),
    ).rejects.toThrow('OVERRIDE_REASON_REQUIRED');
  });

  it('throws EVENT_NOT_FOUND for missing event', async () => {
    mockPrisma.event.findFirst.mockResolvedValue(null);

    await expect(
      service.transitionLifecycle({
        eventId: 'evt-missing',
        organisationId: 'org-1',
        actorUserId: 'user-1',
        targetState: 'WEIGHIN',
      }),
    ).rejects.toThrow('EVENT_NOT_FOUND');
  });

  it('rejects LIVE before competitionStartDate without override', async () => {
    const event = makeEvent({
      lifecycle: 'PUBLISHED',
      competitionStartDate: new Date(Date.now() + 1000 * 60 * 60 * 48),
    });
    mockPrisma.event.findFirst.mockResolvedValue(event);

    await expect(
      service.transitionLifecycle({
        eventId: 'evt-1',
        organisationId: 'org-1',
        actorUserId: 'user-1',
        targetState: 'LIVE',
      }),
    ).rejects.toThrow('COMPETITION_NOT_STARTED');
  });

  it('all valid sequential transitions pass without override', async () => {
    const transitions: [string, string][] = [
      ['REG_OPEN', 'LOCKED'],
      ['LOCKED', 'WEIGHIN'],
      ['WEIGHIN', 'WEIGH_IN_COMPLETED'],
      ['WEIGH_IN_COMPLETED', 'DRAWN'],
      ['DRAWN', 'PUBLISHED'],
      ['PUBLISHED', 'LIVE'],
      ['LIVE', 'COMPLETED'],
    ];

    for (const [from, to] of transitions) {
      jest.clearAllMocks();
      const event = makeEvent({
        lifecycle: from,
        competitionStartDate: new Date(Date.now() - 1000), // past
      });
      const updated = { ...event, lifecycle: to };
      mockPrisma.event.findFirst.mockResolvedValue(event);
      mockPrisma.event.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.event.findUniqueOrThrow.mockResolvedValue(updated);

      const result = await service.transitionLifecycle({
        eventId: 'evt-1',
        organisationId: 'org-1',
        actorUserId: 'user-1',
        targetState: to as Parameters<
          typeof service.transitionLifecycle
        >[0]['targetState'],
      });

      expect(result.lifecycle).toBe(to);
    }
  });
});

describe('EventOpsService – setPublished', () => {
  let service: EventOpsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventOpsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<EventOpsService>(EventOpsService);
  });

  it('unpublishing from PUBLISHED moves lifecycle back to DRAWN', async () => {
    const existing = makeEvent({ lifecycle: 'PUBLISHED', published: true });
    const updated = { ...existing, lifecycle: 'DRAWN', published: false };
    mockPrisma.event.findFirst.mockResolvedValue(existing);
    mockPrisma.event.update.mockResolvedValue(updated);

    const result = await service.setPublished(
      'evt-1',
      'org-1',
      false,
      'user-1',
    );
    expect(result?.published).toBe(false);
    expect(result?.lifecycle).toBe('DRAWN');
    expect(mockPrisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt-1' },
        data: { published: false, lifecycle: 'DRAWN' },
      }),
    );
  });

  it('publishing from DRAWN moves lifecycle to PUBLISHED', async () => {
    const existing = makeEvent({ lifecycle: 'DRAWN', published: false });
    const updated = { ...existing, lifecycle: 'PUBLISHED', published: true };
    mockPrisma.event.findFirst.mockResolvedValue(existing);
    mockPrisma.event.update.mockResolvedValue(updated);

    const result = await service.setPublished('evt-1', 'org-1', true, 'user-1');
    expect(result?.published).toBe(true);
    expect(result?.lifecycle).toBe('PUBLISHED');
    expect(mockPrisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt-1' },
        data: { published: true, lifecycle: 'PUBLISHED' },
      }),
    );
  });
});
