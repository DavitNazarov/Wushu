import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import { FightsGateway } from '../fights/fights.gateway';

@Controller()
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.SCHEDULE_MANAGE)
export class ScheduleController {
  constructor(
    private readonly schedule: ScheduleService,
    private readonly gateway: FightsGateway,
  ) {}

  @Get('mats')
  async listMats(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId: string,
  ) {
    const auth = req.auth!;
    if (!eventId)
      throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);
    return this.schedule.listMats(auth.organisationId, eventId);
  }

  @Post('mats')
  async upsertMat(
    @Req() req: AuthenticatedRequest,
    @Body() body: { eventId: string; id?: string; name: string; order: number },
  ) {
    const auth = req.auth!;
    if (!body.eventId || !body.name)
      throw new HttpException('VALIDATION_ERROR', HttpStatus.BAD_REQUEST);
    try {
      const mat = await this.schedule.upsertMat({
        organisationId: auth.organisationId,
        eventId: body.eventId,
        actorUserId: auth.sub,
        id: body.id,
        name: body.name,
        order: body.order ?? 0,
      });
      this.gateway.emitScheduleUpdate(body.eventId, {
        type: 'MAT_UPSERTED',
        matId: mat.id,
      });
      return mat;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'MAT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('schedule')
  async getSchedule(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId: string,
    @Query('matId') matId?: string,
  ) {
    const auth = req.auth!;
    if (!eventId)
      throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);
    return this.schedule.getSchedule({
      organisationId: auth.organisationId,
      eventId,
      matId,
    });
  }

  @Post('schedule/auto')
  async autoSchedule(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      eventId: string;
      startTimeIso: string;
      avgBoutSeconds: number;
      bufferSeconds: number;
      restMinutes?: number;
      seed?: number;
      override?: boolean;
      reason?: string;
    },
  ) {
    const auth = req.auth!;
    try {
      const updates = await this.schedule.autoSchedule({
        organisationId: auth.organisationId,
        eventId: body.eventId,
        actorUserId: auth.sub,
        startTimeIso: body.startTimeIso,
        avgBoutSeconds: body.avgBoutSeconds ?? 180,
        bufferSeconds: body.bufferSeconds ?? 60,
        restMinutes: body.restMinutes,
        seed: body.seed,
        override: body.override ?? false,
        reason: body.reason ?? null,
      });
      this.gateway.emitScheduleUpdate(body.eventId, {
        type: 'SCHEDULE_AUTO',
        updatedFightIds: updates.map((item) => item.id),
      });
      return updates;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'EVENT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      const known = [
        'NO_MATS',
        'NO_FIGHTS',
        'NO_SCHEDULABLE_FIGHTS',
        'INVALID_START_TIME',
        'EVENT_NOT_READY_FOR_SCHEDULE',
        'EVENT_READ_ONLY',
        'OVERRIDE_REASON_REQUIRED',
        'REST_CONSTRAINT_VIOLATION',
      ];
      if (known.includes(msg))
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      throw e;
    }
  }

  @Post('schedule/move')
  async moveFight(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      fightId: string;
      toMatId: string;
      toOrder: number;
      override?: boolean;
      reason?: string;
    },
  ) {
    const auth = req.auth!;
    try {
      const moved = await this.schedule.moveFight({
        organisationId: auth.organisationId,
        fightId: body.fightId,
        actorUserId: auth.sub,
        toMatId: body.toMatId,
        toOrder: body.toOrder,
        override: body.override ?? false,
        reason: body.reason ?? null,
      });
      this.gateway.emitScheduleUpdate(moved.eventId, {
        type: 'FIGHT_MOVED',
        fightId: moved.id,
        toMatId: moved.matId,
        toOrder: moved.orderInMat,
      });
      return moved;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'FIGHT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (
        msg === 'FIGHT_NOT_SCHEDULABLE' ||
        msg === 'OVERRIDE_REASON_REQUIRED' ||
        msg === 'EVENT_NOT_READY_FOR_SCHEDULE' ||
        msg === 'EVENT_READ_ONLY' ||
        msg === 'REST_CONSTRAINT_VIOLATION'
      )
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      if (msg === 'MAT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
