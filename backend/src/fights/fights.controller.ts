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
      if (advanced) {
        this.gateway.emitFightUpdate(
          advanced.eventId,
          advanced.matId,
          advanced,
        );
      }
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'FIGHT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (
        msg === 'INVALID_STATE_TRANSITION' ||
        msg === 'OVERRIDE_REASON_REQUIRED'
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
        this.gateway.emitTimerUpdate(fight.eventId, fight.matId, {
          fightId: id,
          timer,
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
        msg === 'TIMER_STALE_UPDATE'
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
      const updated = await this.fights.setResult({
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
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'FIGHT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (
        msg === 'FIGHT_ALREADY_CONFIRMED' ||
        msg === 'OVERRIDE_REASON_REQUIRED'
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
