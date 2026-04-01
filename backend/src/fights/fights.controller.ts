import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FightsService } from './fights.service';
import { FightsGateway } from './fights.gateway';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import type { FightStatus, WinMethod } from '@prisma/client';

@Controller('fights')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.LIVE_RUN)
export class FightsController {
  constructor(
    private readonly fights: FightsService,
    private readonly gateway: FightsGateway,
  ) {}

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId?: string,
    @Query('matId') matId?: string,
    @Query('status') status?: string,
  ) {
    const auth = req.auth!;
    return this.fights.list({
      organisationId: auth.organisationId,
      eventId,
      matId,
      status: status as FightStatus | undefined,
    });
  }

  @Get('live/category-board')
  async getLiveCategoryBoard(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId?: string,
    @Query('eventWeightCategoryId') eventWeightCategoryId?: string,
    @Query('matId') matId?: string,
  ) {
    if (!eventId) {
      throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);
    }
    const auth = req.auth!;
    try {
      return await this.fights.getLiveCategoryBoard({
        organisationId: auth.organisationId,
        eventId,
        eventWeightCategoryId,
        matId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'EVENT_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('live/queue-board')
  async getLiveQueueBoard(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId?: string,
  ) {
    if (!eventId) {
      throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);
    }
    const auth = req.auth!;
    try {
      return await this.fights.getLiveQueueBoard({
        organisationId: auth.organisationId,
        eventId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'EVENT_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const auth = req.auth!;
    const fight = await this.fights.getById(auth.organisationId, id);
    if (!fight)
      throw new HttpException('FIGHT_NOT_FOUND', HttpStatus.NOT_FOUND);
    return fight;
  }

  @Post(':id/state')
  async setState(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: { to: string; override?: boolean; reason?: string },
  ) {
    const auth = req.auth!;
    try {
      const { fight: updated, advanced } = await this.fights.setState({
        organisationId: auth.organisationId,
        fightId: id,
        actorUserId: auth.sub,
        to: body.to as FightStatus,
        override: body.override ?? false,
        reason: body.reason ?? null,
      });
      this.gateway.emitFightUpdate(updated.eventId, updated.matId, updated);
      this.gateway.emitScheduleUpdate(updated.eventId, {
        type: 'LIVE_STATE_CHANGED',
        fightId: updated.id,
      });
      if (advanced) {
        this.gateway.emitFightUpdate(
          advanced.eventId,
          advanced.matId,
          advanced,
        );
        this.gateway.emitScheduleUpdate(advanced.eventId, {
          type: 'LIVE_ADVANCED_FIGHT_UPDATED',
          fightId: advanced.id,
        });
      }
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'FIGHT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (
        msg === 'INVALID_STATE_TRANSITION' ||
        msg === 'OVERRIDE_REASON_REQUIRED' ||
        msg === 'EVENT_NOT_LIVE' ||
        msg === 'MAT_ALREADY_IN_PROGRESS' ||
        msg === 'WINNER_REQUIRED_FOR_COMPLETE'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/start')
  async startFight(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const auth = req.auth!;
    try {
      const updated = await this.fights.startFight({
        organisationId: auth.organisationId,
        fightId: id,
        actorUserId: auth.sub,
      });
      this.gateway.emitFightUpdate(updated.eventId, updated.matId, updated);
      this.gateway.emitScheduleUpdate(updated.eventId, {
        type: 'LIVE_FIGHT_STARTED',
        fightId: updated.id,
      });
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'FIGHT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (
        msg === 'INVALID_STATE_TRANSITION' ||
        msg === 'OVERRIDE_REASON_REQUIRED' ||
        msg === 'EVENT_NOT_LIVE' ||
        msg === 'MAT_ALREADY_IN_PROGRESS'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/finish')
  async finishFight(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      winner: 'RED' | 'BLUE';
      method: string;
      notes?: string;
      override?: boolean;
      reason?: string;
    },
  ) {
    const auth = req.auth!;
    try {
      const { fight: updated, advanced } = await this.fights.finishFight({
        organisationId: auth.organisationId,
        fightId: id,
        actorUserId: auth.sub,
        winner: body.winner,
        method: body.method as WinMethod,
        notes: body.notes ?? null,
        override: body.override ?? false,
        reason: body.reason ?? null,
      });
      this.gateway.emitFightUpdate(updated.eventId, updated.matId, updated);
      this.gateway.emitScheduleUpdate(updated.eventId, {
        type: 'LIVE_FIGHT_FINISHED',
        fightId: updated.id,
      });
      if (advanced) {
        this.gateway.emitFightUpdate(
          advanced.eventId,
          advanced.matId,
          advanced,
        );
        this.gateway.emitScheduleUpdate(advanced.eventId, {
          type: 'LIVE_RESULT_PROPAGATED',
          fightId: advanced.id,
        });
      }
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'FIGHT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (
        msg === 'RESULT_ALREADY_RECORDED' ||
        msg === 'OVERRIDE_REASON_REQUIRED' ||
        msg === 'EVENT_NOT_LIVE' ||
        msg === 'INVALID_RESULT_STATE' ||
        msg === 'RESULT_CORRECTION_BLOCKED' ||
        msg === 'WINNER_NOT_PRESENT'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/timer')
  async timerAction(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body()
    body: { action: string; round?: number; expectedUpdatedAt?: string },
  ) {
    const auth = req.auth!;
    try {
      const timer = await this.fights.timerAction({
        organisationId: auth.organisationId,
        fightId: id,
        actorUserId: auth.sub,
        action: body.action as 'START' | 'PAUSE' | 'RESUME' | 'RESET',
        round: body.round,
        expectedUpdatedAt: body.expectedUpdatedAt ?? null,
      });

      const fight = await this.fights.getById(auth.organisationId, id);
      if (fight) {
        this.gateway.emitFightUpdate(fight.eventId, fight.matId, fight);
        this.gateway.emitTimerUpdate(fight.eventId, fight.matId, {
          fightId: id,
          timer,
        });
        this.gateway.emitScheduleUpdate(fight.eventId, {
          type: 'LIVE_TIMER_CHANGED',
          fightId: id,
          matId: fight.matId,
        });
      }
      return timer;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'FIGHT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (
        msg === 'TIMER_NOT_RUNNING' ||
        msg === 'TIMER_NOT_PAUSED' ||
        msg === 'TIMER_STALE_UPDATE' ||
        msg === 'EVENT_NOT_LIVE' ||
        msg === 'INVALID_FIGHT_STATE_FOR_TIMER'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/round-result')
  async recordRoundResult(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: { winner: 'RED' | 'BLUE'; expectedUpdatedAt?: string },
  ) {
    const auth = req.auth!;
    try {
      const result = await this.fights.recordRoundResult({
        organisationId: auth.organisationId,
        fightId: id,
        actorUserId: auth.sub,
        winner: body.winner,
        expectedUpdatedAt: body.expectedUpdatedAt ?? null,
      });

      this.gateway.emitFightUpdate(result.fight.eventId, result.fight.matId, result.fight);
      this.gateway.emitTimerUpdate(result.fight.eventId, result.fight.matId, {
        fightId: result.fight.id,
        timer: result.timer ?? null,
      });
      this.gateway.emitScheduleUpdate(result.fight.eventId, {
        type: result.scheduleEventType,
        fightId: result.fight.id,
        matId: result.fight.matId,
      });

      if (result.advanced) {
        this.gateway.emitFightUpdate(
          result.advanced.eventId,
          result.advanced.matId,
          result.advanced,
        );
        this.gateway.emitScheduleUpdate(result.advanced.eventId, {
          type: 'LIVE_RESULT_PROPAGATED',
          fightId: result.advanced.id,
          matId: result.advanced.matId,
        });
      }

      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'FIGHT_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      if (
        msg === 'TIMER_NOT_INITIALIZED' ||
        msg === 'INVALID_TIMER_PHASE' ||
        msg === 'ROUND_STILL_RUNNING' ||
        msg === 'TIMER_STALE_UPDATE' ||
        msg === 'ROUND_RESULT_ALREADY_SET' ||
        msg === 'EVENT_NOT_LIVE' ||
        msg === 'WINNER_NOT_PRESENT'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/result')
  async setResult(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      winner: 'RED' | 'BLUE';
      method: string;
      notes?: string;
      override?: boolean;
      reason?: string;
    },
  ) {
    const auth = req.auth!;
    try {
      const { fight: updated, advanced } = await this.fights.setResult({
        organisationId: auth.organisationId,
        fightId: id,
        actorUserId: auth.sub,
        winner: body.winner,
        method: body.method as WinMethod,
        notes: body.notes ?? null,
        override: body.override ?? false,
        reason: body.reason ?? null,
      });
      this.gateway.emitFightUpdate(updated.eventId, updated.matId, updated);
      this.gateway.emitScheduleUpdate(updated.eventId, {
        type: 'LIVE_RESULT_SAVED',
        fightId: updated.id,
      });
      if (advanced) {
        this.gateway.emitFightUpdate(
          advanced.eventId,
          advanced.matId,
          advanced,
        );
        this.gateway.emitScheduleUpdate(advanced.eventId, {
          type: 'LIVE_RESULT_PROPAGATED',
          fightId: advanced.id,
        });
      }
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'FIGHT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (
        msg === 'RESULT_ALREADY_RECORDED' ||
        msg === 'OVERRIDE_REASON_REQUIRED' ||
        msg === 'EVENT_NOT_LIVE' ||
        msg === 'INVALID_RESULT_STATE' ||
        msg === 'RESULT_CORRECTION_BLOCKED' ||
        msg === 'WINNER_NOT_PRESENT'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
