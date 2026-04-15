import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
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

  @Get('schedule-sessions')
  async listSessions(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId: string,
  ) {
    const auth = req.auth!;
    if (!eventId)
      throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);
    return this.schedule.listSessions(auth.organisationId, eventId);
  }

  @Post('schedule-sessions')
  async upsertSession(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      eventId: string;
      id?: string;
      name: string;
      startTime: string;
      endTime: string;
      order: number;
    },
  ) {
    const auth = req.auth!;
    if (!body.eventId || !body.name || !body.startTime || !body.endTime)
      throw new HttpException('VALIDATION_ERROR', HttpStatus.BAD_REQUEST);
    try {
      const session = await this.schedule.upsertSession({
        organisationId: auth.organisationId,
        eventId: body.eventId,
        actorUserId: auth.sub,
        id: body.id,
        name: body.name,
        startTime: body.startTime,
        endTime: body.endTime,
        order: body.order ?? 0,
      });
      this.gateway.emitScheduleUpdate(body.eventId, {
        type: 'SESSION_UPSERTED',
        sessionId: session.id,
      });
      return session;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'SESSION_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (msg === 'INVALID_SESSION_TIMES' || msg === 'SESSION_END_BEFORE_START')
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('schedule-sessions/:id')
  async deleteSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') sessionId: string,
    @Query('eventId') eventId: string,
  ) {
    const auth = req.auth!;
    if (!eventId)
      throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);
    try {
      await this.schedule.deleteSession({
        organisationId: auth.organisationId,
        eventId,
        sessionId,
      });
      this.gateway.emitScheduleUpdate(eventId, {
        type: 'SESSION_DELETED',
        sessionId,
      });
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'SESSION_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

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

  @Post('schedule/generate')
  async generateSchedule(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      eventId: string;
      avgBoutSeconds: number;
      bufferSeconds: number;
      override?: boolean;
      reason?: string;
    },
  ) {
    const auth = req.auth!;
    if (!body.eventId) throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);
    try {
      const result = await this.schedule.generateSchedule({
        organisationId: auth.organisationId,
        eventId: body.eventId,
        actorUserId: auth.sub,
        avgBoutSeconds: body.avgBoutSeconds ?? 180,
        bufferSeconds: body.bufferSeconds ?? 60,
        override: body.override ?? false,
        reason: body.reason ?? null,
      });
      this.gateway.emitScheduleUpdate(body.eventId, { type: 'SCHEDULE_AUTO', updatedFightIds: [], matIds: [] });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'EVENT_NOT_FOUND') throw new HttpException(msg, HttpStatus.NOT_FOUND);
      const known = ['NO_SESSIONS', 'NO_SCHEDULABLE_FIGHTS', 'EVENT_NOT_READY_FOR_SCHEDULE', 'EVENT_READ_ONLY', 'OVERRIDE_REASON_REQUIRED'];
      if (known.includes(msg)) throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('schedule/move-session-fight')
  async moveFightToSession(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      fightId: string;
      toSessionId: string | null;
      insertAfterOrder: number;
      override?: boolean;
      reason?: string;
    },
  ) {
    const auth = req.auth!;
    if (!body.fightId) throw new HttpException('fightId_REQUIRED', HttpStatus.BAD_REQUEST);
    try {
      const result = await this.schedule.moveFightToSession({
        organisationId: auth.organisationId,
        fightId: body.fightId,
        actorUserId: auth.sub,
        toSessionId: body.toSessionId ?? null,
        insertAfterOrder: body.insertAfterOrder ?? 0,
        override: body.override ?? false,
        reason: body.reason ?? null,
      });
      this.gateway.emitScheduleUpdate(result.eventId, { type: 'FIGHT_MOVED', fightId: body.fightId, toMatId: null, toOrder: body.insertAfterOrder });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'FIGHT_NOT_FOUND') throw new HttpException(msg, HttpStatus.NOT_FOUND);
      const known = ['EVENT_NOT_READY_FOR_SCHEDULE', 'EVENT_READ_ONLY', 'OVERRIDE_REASON_REQUIRED'];
      if (known.includes(msg)) throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('schedule/reorder-sessions')
  async reorderSessions(
    @Req() req: AuthenticatedRequest,
    @Body() body: { eventId: string; sessionIds: string[] },
  ) {
    const auth = req.auth!;
    if (!body.eventId || !Array.isArray(body.sessionIds))
      throw new HttpException('VALIDATION_ERROR', HttpStatus.BAD_REQUEST);
    await this.schedule.reorderSessions({
      organisationId: auth.organisationId,
      eventId: body.eventId,
      actorUserId: auth.sub,
      sessionIds: body.sessionIds,
    });
    this.gateway.emitScheduleUpdate(body.eventId, { type: 'SESSION_UPSERTED', sessionId: '' });
    return { ok: true };
  }

  @Get('schedule/event')
  async getEventSchedule(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId: string,
  ) {
    const auth = req.auth!;
    if (!eventId)
      throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);
    return this.schedule.getEventSchedule({
      organisationId: auth.organisationId,
      eventId,
    });
  }

  @Post('schedule/reorder-fights')
  async updateFightOrder(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      sessionId: string;
      orderedFightIds: string[];
    },
  ) {
    const auth = req.auth!;
    if (!body.sessionId || !Array.isArray(body.orderedFightIds))
      throw new HttpException('VALIDATION_ERROR', HttpStatus.BAD_REQUEST);
    try {
      const result = await this.schedule.updateFightOrder({
        organisationId: auth.organisationId,
        sessionId: body.sessionId,
        actorUserId: auth.sub,
        orderedFightIds: body.orderedFightIds,
      });
      this.gateway.emitScheduleUpdate(result.eventId, {
        type: 'FIGHT_MOVED',
        fightId: null,
        toMatId: null,
        toOrder: null,
      });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'SESSION_NOT_FOUND' || msg === 'EVENT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      const known = ['FIGHT_IDS_MISMATCH', 'EVENT_NOT_READY_FOR_SCHEDULE', 'EVENT_READ_ONLY'];
      if (known.includes(msg))
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
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
      useSessions?: boolean;
    },
  ) {
    const auth = req.auth!;
    try {
      const result = await this.schedule.autoSchedule({
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
        useSessions: body.useSessions ?? false,
      });
      this.gateway.emitScheduleUpdate(body.eventId, {
        type: 'SCHEDULE_AUTO',
        updatedFightIds: result.updates.map((item) => item.id),
        matIds: [...new Set(result.updates.map((item) => item.matId))],
      });
      return result;
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
