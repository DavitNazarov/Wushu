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
import { parseBody } from '../common/parse-body';
import {
  upsertSessionSchema,
  upsertMatSchema,
  generateScheduleSchema,
  moveFightToSessionSchema,
  reorderSessionsSchema,
  reorderFightsSchema,
  autoScheduleSchema,
  moveFightSchema,
} from './schedule.schemas';

// Admin-only schedule routes mounted at /api/schedule*, /api/mats,
// /api/schedule-sessions. All gated by SCHEDULE_MANAGE — only admins hold it.
// After every mutation we push a socket.io event via FightsGateway so any
// open admin/mat displays refetch immediately.
@Controller()
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.SCHEDULE_MANAGE)
export class ScheduleController {
  constructor(
    private readonly schedule: ScheduleService,
    private readonly gateway: FightsGateway,
  ) {}

  // GET /api/schedule-sessions?eventId=... — list the time-slot sessions
  // (e.g. "Morning Session 09:00-12:00") an event has been split into.
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

  // POST /api/schedule-sessions — create or update a session window.
  // Body.id present → update; absent → create. Service errors:
  //   SESSION_NOT_FOUND                              → 404
  //   INVALID_SESSION_TIMES / SESSION_END_BEFORE_START → 400
  // Emits SESSION_UPSERTED over the gateway on success.
  @Post('schedule-sessions')
  async upsertSession(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;
    const parsed = parseBody(upsertSessionSchema, body);
    try {
      const session = await this.schedule.upsertSession({
        organisationId: auth.organisationId,
        eventId: parsed.eventId,
        actorUserId: auth.sub,
        id: parsed.id,
        name: parsed.name,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        order: parsed.order ?? 0,
      });
      this.gateway.emitScheduleUpdate(parsed.eventId, {
        type: 'SESSION_UPSERTED',
        sessionId: session.id,
      });
      return session;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'SESSION_NOT_FOUND' || msg === 'EVENT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (
        msg === 'INVALID_SESSION_TIMES' ||
        msg === 'SESSION_END_BEFORE_START' ||
        msg === 'EVENT_READ_ONLY' ||
        msg === 'EVENT_NOT_READY_FOR_SCHEDULE' ||
        msg === 'OVERRIDE_REASON_REQUIRED'
      )
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // DELETE /api/schedule-sessions/:id?eventId=... — drop a session. Fights
  // attached to it are detached (sessionId=null) by ScheduleService, not
  // deleted. Emits SESSION_DELETED over the gateway.
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
      if (msg === 'SESSION_NOT_FOUND' || msg === 'EVENT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (
        msg === 'EVENT_READ_ONLY' ||
        msg === 'EVENT_NOT_READY_FOR_SCHEDULE' ||
        msg === 'OVERRIDE_REASON_REQUIRED'
      )
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /api/mats?eventId=... — list the physical mats (rings) at an event.
  // Each mat is a parallel running order — fights get distributed across mats.
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

  // POST /api/mats — create or update a mat. Body.id present → update.
  // `order` controls left-to-right tab ordering in the mat-display UI.
  // Emits MAT_UPSERTED on success.
  @Post('mats')
  async upsertMat(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;
    const parsed = parseBody(upsertMatSchema, body);
    try {
      const mat = await this.schedule.upsertMat({
        organisationId: auth.organisationId,
        eventId: parsed.eventId,
        actorUserId: auth.sub,
        id: parsed.id,
        name: parsed.name,
        order: parsed.order ?? 0,
      });
      this.gateway.emitScheduleUpdate(parsed.eventId, {
        type: 'MAT_UPSERTED',
        matId: mat.id,
      });
      return mat;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'MAT_NOT_FOUND' || msg === 'EVENT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (
        msg === 'EVENT_READ_ONLY' ||
        msg === 'EVENT_NOT_READY_FOR_SCHEDULE' ||
        msg === 'OVERRIDE_REASON_REQUIRED'
      )
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /api/schedule?eventId=&matId= — current schedule view (fights with
  // mat assignment + orderInMat). Optional matId filter narrows to one mat
  // for the per-mat tab/display UIs.
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

  // POST /api/schedule/generate — bucket all unscheduled fights into the
  // event's sessions (without computing exact start times). avgBoutSeconds /
  // bufferSeconds drive per-session capacity calc. For the time-aware version
  // see /schedule/auto below.
  @Post('schedule/generate')
  async generateSchedule(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const parsed = parseBody(generateScheduleSchema, body);
    try {
      const result = await this.schedule.generateSchedule({
        organisationId: auth.organisationId,
        eventId: parsed.eventId,
        actorUserId: auth.sub,
        avgBoutSeconds: parsed.avgBoutSeconds ?? 180,
        bufferSeconds: parsed.bufferSeconds ?? 60,
        override: parsed.override ?? false,
        reason: parsed.reason ?? null,
      });
      this.gateway.emitScheduleUpdate(parsed.eventId, {
        type: 'SCHEDULE_AUTO',
        updatedFightIds: [],
        matIds: [],
      });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'EVENT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      const known = [
        'NO_SESSIONS',
        'NO_SCHEDULABLE_FIGHTS',
        'EVENT_NOT_READY_FOR_SCHEDULE',
        'EVENT_READ_ONLY',
        'OVERRIDE_REASON_REQUIRED',
      ];
      if (known.includes(msg))
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /api/schedule/move-session-fight — move a fight into/between
  // sessions (or out, when toSessionId is null). insertAfterOrder controls
  // where it lands in the new session's order.
  @Post('schedule/move-session-fight')
  async moveFightToSession(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const parsed = parseBody(moveFightToSessionSchema, body);
    try {
      const result = await this.schedule.moveFightToSession({
        organisationId: auth.organisationId,
        fightId: parsed.fightId,
        actorUserId: auth.sub,
        toSessionId: parsed.toSessionId ?? null,
        insertAfterOrder: parsed.insertAfterOrder ?? 0,
        override: parsed.override ?? false,
        reason: parsed.reason ?? null,
      });
      this.gateway.emitScheduleUpdate(result.eventId, {
        type: 'FIGHT_MOVED',
        fightId: parsed.fightId,
        toMatId: null,
        toOrder: parsed.insertAfterOrder ?? 0,
      });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'FIGHT_NOT_FOUND' || msg === 'SESSION_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      const known = [
        'EVENT_NOT_READY_FOR_SCHEDULE',
        'EVENT_READ_ONLY',
        'OVERRIDE_REASON_REQUIRED',
        'FIGHT_NOT_SCHEDULABLE',
      ];
      if (known.includes(msg))
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /api/schedule/reorder-sessions — accepts an ordered list of session
  // ids and rewrites their `order` columns to match. Drag-drop friendly: the
  // UI sends the new order after a drop.
  @Post('schedule/reorder-sessions')
  async reorderSessions(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const parsed = parseBody(reorderSessionsSchema, body);
    try {
      await this.schedule.reorderSessions({
        organisationId: auth.organisationId,
        eventId: parsed.eventId,
        actorUserId: auth.sub,
        sessionIds: parsed.sessionIds,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      // A foreign/unknown session id (cross-tenant attempt) → 404, not 500.
      if (msg === 'SESSION_NOT_FOUND' || msg === 'EVENT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (
        msg === 'EVENT_READ_ONLY' ||
        msg === 'EVENT_NOT_READY_FOR_SCHEDULE' ||
        msg === 'OVERRIDE_REASON_REQUIRED'
      )
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    this.gateway.emitScheduleUpdate(parsed.eventId, {
      type: 'SESSION_UPSERTED',
      sessionId: '',
    });
    return { ok: true };
  }

  // GET /api/schedule/event?eventId=... — composite endpoint: sessions + their
  // ordered fights in one payload, so the schedule-builder UI can render
  // everything from a single fetch.
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

  // POST /api/schedule/reorder-fights — replace the running order of fights
  // inside one session. orderedFightIds must match the session's current
  // fights exactly (else FIGHT_IDS_MISMATCH) — prevents silent drift if the
  // UI's view is stale.
  @Post('schedule/reorder-fights')
  async updateFightOrder(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const parsed = parseBody(reorderFightsSchema, body);
    try {
      const result = await this.schedule.updateFightOrder({
        organisationId: auth.organisationId,
        sessionId: parsed.sessionId,
        actorUserId: auth.sub,
        orderedFightIds: parsed.orderedFightIds,
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
      const known = [
        'FIGHT_IDS_MISMATCH',
        'EVENT_NOT_READY_FOR_SCHEDULE',
        'EVENT_READ_ONLY',
      ];
      if (known.includes(msg))
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /api/schedule/auto — full time-aware auto-scheduler. Computes
  // scheduledStartTime per fight by spreading them across mats with rest
  // constraints between bouts for the same athlete (restMinutes). seed makes
  // the assignment reproducible.
  //   NO_MATS / NO_FIGHTS / NO_SCHEDULABLE_FIGHTS / INVALID_START_TIME /
  //   EVENT_NOT_READY_FOR_SCHEDULE / EVENT_READ_ONLY /
  //   OVERRIDE_REASON_REQUIRED / REST_CONSTRAINT_VIOLATION → 400.
  @Post('schedule/auto')
  async autoSchedule(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;
    const parsed = parseBody(autoScheduleSchema, body);
    try {
      const result = await this.schedule.autoSchedule({
        organisationId: auth.organisationId,
        eventId: parsed.eventId,
        actorUserId: auth.sub,
        startTimeIso: parsed.startTimeIso,
        avgBoutSeconds: parsed.avgBoutSeconds ?? 180,
        bufferSeconds: parsed.bufferSeconds ?? 60,
        restMinutes: parsed.restMinutes,
        seed: parsed.seed,
        override: parsed.override ?? false,
        reason: parsed.reason ?? null,
        useSessions: parsed.useSessions ?? false,
      });
      this.gateway.emitScheduleUpdate(parsed.eventId, {
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

  // POST /api/schedule/move — manual single-fight relocation: move one
  // fight to a different mat + order slot. Used when admins tweak the
  // auto-generated schedule. REST_CONSTRAINT_VIOLATION returns 400 if the
  // move would violate per-athlete rest, unless override + reason are set.
  @Post('schedule/move')
  async moveFight(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;
    const parsed = parseBody(moveFightSchema, body);
    try {
      const moved = await this.schedule.moveFight({
        organisationId: auth.organisationId,
        fightId: parsed.fightId,
        actorUserId: auth.sub,
        toMatId: parsed.toMatId,
        toOrder: parsed.toOrder,
        override: parsed.override ?? false,
        reason: parsed.reason ?? null,
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
