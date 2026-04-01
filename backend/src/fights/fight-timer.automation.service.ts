import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { FightsGateway } from './fights.gateway';
import { FightsService } from './fights.service';

const TIMER_AUTOMATION_ERROR_BACKOFF_MS = 30_000;

@Injectable()
export class FightTimerAutomationService {
  private readonly logger = new Logger(FightTimerAutomationService.name);
  private isRunning = false;
  private pausedUntil = 0;

  constructor(
    private readonly fights: FightsService,
    private readonly gateway: FightsGateway,
  ) {}

  @Interval(1000)
  async advanceExpiredTimers() {
    if (this.isRunning || Date.now() < this.pausedUntil) {
      return;
    }

    this.isRunning = true;

    try {
      const transitions = await this.fights.advanceExpiredTimers();
      this.pausedUntil = 0;

      for (const transition of transitions) {
        this.gateway.emitFightUpdate(
          transition.eventId,
          transition.matId,
          transition.fight,
        );
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
    } catch (error) {
      this.pausedUntil = Date.now() + TIMER_AUTOMATION_ERROR_BACKOFF_MS;
      this.logger.error(
        `Timer automation paused for ${TIMER_AUTOMATION_ERROR_BACKOFF_MS}ms after polling failure`,
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }
}
