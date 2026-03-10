import { Test, TestingModule } from '@nestjs/testing';
import { EventStageAutomationService } from './event-stage-automation.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

const mockPrisma = {
  event: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  registration: {
    findMany: jest.fn(),
  },
};

const mockAudit = {
  write: jest.fn(),
};

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    name: 'Test Event',
    timezone: 'Asia/Tbilisi',
    lifecycle: 'REG_OPEN',
    registrationClosesAt: new Date('2026-03-04T00:00:00.000Z'),
    registrationEndDate: new Date('2026-03-04T00:00:00.000Z'),
    weighInStartDate: new Date('2026-03-05T00:00:00.000Z'),
    autoAdvanceStage: true,
    organisationId: 'org-1',
    dates: {
      registrationDays: ['2026-03-05', '2026-03-06'],
      fightDays: ['2026-03-07'],
    },
    ...overrides,
  };
}

describe('EventStageAutomationService', () => {
  let service: EventStageAutomationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.registration.findMany.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventStageAutomationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<EventStageAutomationService>(
      EventStageAutomationService,
    );
  });

  describe('Case A: registration close passed, stage REG_OPEN, autoAdvanceStage true', () => {
    it('advances stage to LOCKED and writes audit log', async () => {
      const event = makeEvent();
      mockPrisma.event.findMany.mockResolvedValue([event]);
      mockPrisma.event.updateMany.mockResolvedValue({ count: 1 });

      const count = await service.checkAndAdvanceStages();

      expect(count).toBe(1);
      expect(mockPrisma.event.updateMany).toHaveBeenCalledWith({
        where: { id: 'evt-1', lifecycle: 'REG_OPEN' },
        data: { lifecycle: 'LOCKED' },
      });
      expect(mockAudit.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'EVENT_STAGE_AUTO_ADVANCED',
          before: { lifecycle: 'REG_OPEN' },
          after: { lifecycle: 'LOCKED' },
        }),
      );
    });
  });

  describe('Case B: registration close not passed', () => {
    it('does not advance stage', async () => {
      const event = makeEvent({
        registrationClosesAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      mockPrisma.event.findMany.mockResolvedValue([event]);

      const count = await service.checkAndAdvanceStages();

      expect(count).toBe(0);
      expect(mockPrisma.event.updateMany).not.toHaveBeenCalled();
      expect(mockAudit.write).not.toHaveBeenCalled();
    });
  });

  describe('Case C: stage already WEIGHIN (returned by query, no completion yet)', () => {
    it('returns no candidates when lifecycle != REG_OPEN', async () => {
      mockPrisma.event.findMany.mockResolvedValue([
        makeEvent({ lifecycle: 'WEIGHIN' }),
      ]);
      mockPrisma.registration.findMany.mockResolvedValue([
        { id: 'r1', weighInStatus: 'PASSED' },
        { id: 'r2', weighInStatus: 'REWEIGH_ALLOWED' },
      ]);

      const count = await service.checkAndAdvanceStages();

      expect(count).toBe(0);
      expect(mockPrisma.event.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('Case D: weighInDays empty', () => {
    it('skips event and logs warning', async () => {
      const event = makeEvent({
        lifecycle: 'LOCKED',
        weighInStartDate: null,
        dates: { registrationDays: [], fightDays: ['2026-03-07'] },
      });
      mockPrisma.event.findMany.mockResolvedValue([event]);

      const warnSpy = jest
        .spyOn(service['logger'], 'warn')
        .mockImplementation(() => undefined);

      const count = await service.checkAndAdvanceStages();

      expect(count).toBe(0);
      expect(mockPrisma.event.updateMany).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('Concurrency: conditional update returns count=0', () => {
    it('does not double-count when another instance already advanced', async () => {
      const event = makeEvent();
      mockPrisma.event.findMany.mockResolvedValue([event]);
      // Simulate another instance already did the update
      mockPrisma.event.updateMany.mockResolvedValue({ count: 0 });

      jest.spyOn(service, 'getTodayInTimezone').mockReturnValue('2026-03-05');

      const count = await service.checkAndAdvanceStages();

      expect(count).toBe(0);
      expect(mockAudit.write).not.toHaveBeenCalled();
    });
  });

  describe('Missing dates object', () => {
    it('skips event when dates is null', async () => {
      const event = makeEvent({
        dates: null,
        registrationClosesAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      mockPrisma.event.findMany.mockResolvedValue([event]);

      const count = await service.checkAndAdvanceStages();

      expect(count).toBe(0);
      expect(mockPrisma.event.updateMany).not.toHaveBeenCalled();
    });
  });
});
