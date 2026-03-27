import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { FightsGateway } from './fights.gateway';
import { FightsService } from './fights.service';

@Injectable()
export class FightTimerAutomationService {
  constructor(
    private readonly fights: FightsService,
    private readonly gateway: FightsGateway,
  ) {}

  @Interval(1000)
  async advanceExpiredTimers() {
    const transitions = await this.fights.advanceExpiredTimers();

    for (const transition of transitions) {
      this.gateway.emitFightUpdate(transition.eventId, transition.matId, transition.fight);
      this.gateway.emitTimerUpdate(transition.eventId, transition.matId, {
        fightId: transition.fight.id,
        timer: transition.timer,
        phase: transition.timer?.phase ?? null,
      });
      this.gateway.emitScheduleUpdate(transition.eventId, {
        type: transition.scheduleEventType,
        fightId: transition.fight.id,
        matId: transition.matId,
      });

      if (transition.advancedFight) {
        this.gateway.emitFightUpdate(
          transition.advancedFight.eventId,
          transition.advancedFight.matId,
          transition.advancedFight,
        );
        this.gateway.emitScheduleUpdate(transition.advancedFight.eventId, {
          type: 'LIVE_RESULT_PROPAGATED',
          fightId: transition.advancedFight.id,
          matId: transition.advancedFight.matId,
        });
      }
    }
  }
}
