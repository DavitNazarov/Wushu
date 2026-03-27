import { FightTimerAutomationService } from './fight-timer.automation.service';

describe('FightTimerAutomationService', () => {
  it('emits fight, timer, and schedule updates for expired timer transitions', async () => {
    const fights = {
      advanceExpiredTimers: jest.fn().mockResolvedValue([
        {
          eventId: 'event_1',
          matId: null,
          fight: { id: 'fight_1', eventId: 'event_1', matId: null },
          timer: { phase: 'REST' },
          scheduleEventType: 'LIVE_REST_STARTED',
          advancedFight: null,
        },
      ]),
    };
    const gateway = {
      emitFightUpdate: jest.fn(),
      emitTimerUpdate: jest.fn(),
      emitScheduleUpdate: jest.fn(),
    };

    const service = new FightTimerAutomationService(fights as any, gateway as any);

    await service.advanceExpiredTimers();

    expect(gateway.emitFightUpdate).toHaveBeenCalledWith(
      'event_1',
      null,
      expect.objectContaining({ id: 'fight_1' }),
    );
    expect(gateway.emitTimerUpdate).toHaveBeenCalledWith(
      'event_1',
      null,
      expect.objectContaining({
        fightId: 'fight_1',
        phase: 'REST',
      }),
    );
    expect(gateway.emitScheduleUpdate).toHaveBeenCalledWith(
      'event_1',
      expect.objectContaining({
        type: 'LIVE_REST_STARTED',
        fightId: 'fight_1',
      }),
    );
  });
});
