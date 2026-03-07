import { Test, TestingModule } from '@nestjs/testing';
import { EventStageAutomationService } from './event-stage-automation.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

const mockPrisma = {
  event: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
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

  describe('Case A: today == weighInStartDate, stage REG_OPEN, autoAdvanceStage true', () => {
    it('advances stage to WEIGHIN and writes audit log', async () => {
      const event = makeEvent();
      mockPrisma.event.findMany.mockResolvedValue([event]);
      mockPrisma.event.updateMany.mockResolvedValue({ count: 1 });

      // Patch getTodayInTimezone to return the earliest weigh-in day
      jest.spyOn(service, 'getTodayInTimezone').mockReturnValue('2026-03-05');

      const count = await service.checkAndAdvanceStages();

      expect(count).toBe(1);
      expect(mockPrisma.event.updateMany).toHaveBeenCalledWith({
        where: { id: 'evt-1', lifecycle: 'REG_OPEN' },
        data: { lifecycle: 'WEIGHIN' },
      });
      expect(mockAudit.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'EVENT_STAGE_AUTO_ADVANCED',
          before: { lifecycle: 'REG_OPEN' },
          after: { lifecycle: 'WEIGHIN' },
        }),
      );
    });
  });

  describe('Case B: today < weighInStartDate', () => {
    it('does not advance stage', async () => {
      const event = makeEvent();
      mockPrisma.event.findMany.mockResolvedValue([event]);

      jest.spyOn(service, 'getTodayInTimezone').mockReturnValue('2026-03-04');

      const count = await service.checkAndAdvanceStages();

      expect(count).toBe(0);
      expect(mockPrisma.event.updateMany).not.toHaveBeenCalled();
      expect(mockAudit.write).not.toHaveBeenCalled();
    });
  });

  describe('Case C: stage already WEIGHIN (not returned by query)', () => {
    it('returns no candidates when lifecycle != REG_OPEN', async () => {
      // The query filters lifecycle = REG_OPEN, so non-REG_OPEN events are never returned
      mockPrisma.event.findMany.mockResolvedValue([]);

      const count = await service.checkAndAdvanceStages();

      expect(count).toBe(0);
      expect(mockPrisma.event.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('Case D: weighInDays empty', () => {
    it('skips event and logs warning', async () => {
      const event = makeEvent({
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
      const event = makeEvent({ dates: null });
      mockPrisma.event.findMany.mockResolvedValue([event]);

      const count = await service.checkAndAdvanceStages();

      expect(count).toBe(0);
      expect(mockPrisma.event.updateMany).not.toHaveBeenCalled();
    });
  });
});
