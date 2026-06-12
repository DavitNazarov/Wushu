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
import { SkipThrottle } from '@nestjs/throttler';
import type { FightStatus, WinMethod } from '@prisma/client';
import { parseBody } from '../common/parse-body';
import {
  fightStateSchema,
  fightResultSchema,
  timerActionSchema,
  roundResultSchema,
} from './fights.schemas';

// Fights routes mounted at `/api/fights`. Gated by LIVE_RUN — admins,
// timekeepers, and judges hold it; coaches don't. After every mutating write
// we push a socket.io event so any active mat displays + live scoreboards
// refetch immediately.
//
// Exempt from BOTH throttle buckets. The operator live console is driven by
// socket fan-out: a single action (start / timer / result / round-result) emits
// several socket events (fight:update + schedule:update + timer:update, plus a
// pair for any auto-advanced next fight), and each one triggers a queue-board
// refetch. Across a busy session this blew past not just the 'short' bucket
// (10 req/10s) but the 'default' bucket (120 req/min) too, 429'ing operators
// mid-fight. These routes are already AuthGuard + CapabilityGuard(LIVE_RUN)
// protected, so per-IP request counting adds nothing as an abuse control here —
// the gate is authentication + capability, not request volume. (The frontend
// also coalesces the fan-out into a single debounced refetch; see
// useRealtimeQuerySync.) Same precedent as the soft-auth /api/auth/me route.
@SkipThrottle({ default: true, short: true })
@Controller('fights')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.LIVE_RUN)
export class FightsController {
  constructor(
    private readonly fights: FightsService,
    private readonly gateway: FightsGateway,
  ) {}

  // GET /api/fights — filterable fight list. Filters compose with AND.
  // Used by the admin fights page + auxiliary tools (a single source of truth
  // for "all fights matching X").
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

  // GET /api/fights/live/category-board — grouped-by-category live view used
  // by the public + mat-side displays. Optional eventWeightCategoryId / matId
  // narrow to a slice. EVENT_NOT_FOUND → 404.
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

  // GET /api/fights/live/queue-board — flat per-mat running-queue view
  // ("on mat now / next up"). Drives the operator queue displays.
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

  // GET /api/fights/:id — single-fight detail with athletes + scoring info.
  // 404 with FIGHT_NOT_FOUND if missing or out of org.
  @Get(':id')
  async getById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const auth = req.auth!;
    const fight = await this.fights.getById(auth.organisationId, id);
    if (!fight)
      throw new HttpException('FIGHT_NOT_FOUND', HttpStatus.NOT_FOUND);
    return fight;
  }

  // POST /api/fights/:id/state — manual lifecycle transition for a fight
  // (QUEUED → ON_DECK → IN_PROGRESS → COMPLETE → CONFIRMED). Service can also
  // auto-advance the next fight on the same mat — when it does we emit a
  // second socket update for that fight. Errors:
  //   FIGHT_NOT_FOUND                                                → 404
  //   INVALID_STATE_TRANSITION / OVERRIDE_REASON_REQUIRED /
  //   EVENT_NOT_LIVE / MAT_ALREADY_IN_PROGRESS /
  //   WINNER_REQUIRED_FOR_COMPLETE                                   → 400
  @Post(':id/state')
  async setState(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const parsed = parseBody(fightStateSchema, body);
    try {
      const { fight: updated, advanced } = await this.fights.setState({
        organisationId: auth.organisationId,
        fightId: id,
        actorUserId: auth.sub,
        to: parsed.to as FightStatus,
        override: parsed.override ?? false,
        reason: parsed.reason ?? null,
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

  // POST /api/fights/:id/start — shortcut for "go straight to IN_PROGRESS".
  // Equivalent to a state transition but with stricter guards (event must be
  // LIVE, mat must be idle). MAT_ALREADY_IN_PROGRESS if another fight is
  // currently running on the same mat.
  @Post(':id/start')
  async startFight(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
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

  // POST /api/fights/:id/finish — record the result.
  // Body carries the winner side, win method, optional notes, and override
  // flag. The service writes the winner athlete id, marks the fight COMPLETE,
  // and (if there's a next fight) PROPAGATES the winner to it. The advanced
  // result triggers a second socket update for the downstream fight.
  // Errors:
  //   FIGHT_NOT_FOUND                                           → 404
  //   RESULT_ALREADY_RECORDED / OVERRIDE_REASON_REQUIRED /
  //   EVENT_NOT_LIVE / INVALID_RESULT_STATE /
  //   RESULT_CORRECTION_BLOCKED / WINNER_NOT_PRESENT            → 400
  @Post(':id/finish')
  async finishFight(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const parsed = parseBody(fightResultSchema, body);
    try {
      const { fight: updated, advanced } = await this.fights.finishFight({
        organisationId: auth.organisationId,
        fightId: id,
        actorUserId: auth.sub,
        winner: parsed.winner,
        method: parsed.method as WinMethod,
        notes: parsed.notes ?? null,
        override: parsed.override ?? false,
        reason: parsed.reason ?? null,
        expectedUpdatedAt: parsed.expectedUpdatedAt ?? null,
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
      if (msg === 'FIGHT_STALE_UPDATE')
        throw new HttpException(msg, HttpStatus.CONFLICT);
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

  // POST /api/fights/:id/timer — drive the round timer.
  // Actions: START / PAUSE / RESUME / RESET. `round` is required for START
  // (which round are we counting?). expectedUpdatedAt enables optimistic
  // concurrency — if it doesn't match the DB timer's updatedAt, return
  // TIMER_STALE_UPDATE so two operators can't race each other into bad state.
  @Post(':id/timer')
  async timerAction(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const parsed = parseBody(timerActionSchema, body);
    try {
      const { timer, eventId, matId } = await this.fights.timerAction({
        organisationId: auth.organisationId,
        fightId: id,
        actorUserId: auth.sub,
        action: parsed.action,
        round: parsed.round,
        expectedUpdatedAt: parsed.expectedUpdatedAt ?? null,
      });

      this.gateway.emitTimerUpdate(eventId, matId, { fightId: id, timer });
      this.gateway.emitScheduleUpdate(eventId, {
        type: 'LIVE_TIMER_CHANGED',
        fightId: id,
        matId,
      });
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

  // POST /api/fights/:id/round-result — record the winner of one round
  // (multi-round fights). The service decides whether to advance to the
  // next round or end the fight based on round count + score. Returns a
  // shape including timer + advance metadata; the gateway broadcasts both
  // the current fight update AND any propagated next-fight update.
  @Post(':id/round-result')
  async recordRoundResult(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const parsed = parseBody(roundResultSchema, body);
    try {
      const result = await this.fights.recordRoundResult({
        organisationId: auth.organisationId,
        fightId: id,
        actorUserId: auth.sub,
        winner: parsed.winner,
        expectedUpdatedAt: parsed.expectedUpdatedAt ?? null,
      });

      this.gateway.emitFightUpdate(
        result.fight.eventId,
        result.fight.matId,
        result.fight,
      );
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

  // POST /api/fights/:id/result — record a CONFIRMED result. Unlike /finish
  // this is the post-confirmation save (e.g. judge correcting after a manual
  // review). Uses RESULT_ALREADY_RECORDED + RESULT_CORRECTION_BLOCKED to
  // prevent re-writing finalized results without override+reason.
  @Post(':id/result')
  async setResult(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const parsed = parseBody(fightResultSchema, body);
    try {
      const { fight: updated, advanced } = await this.fights.setResult({
        organisationId: auth.organisationId,
        fightId: id,
        actorUserId: auth.sub,
        winner: parsed.winner,
        method: parsed.method as WinMethod,
        notes: parsed.notes ?? null,
        override: parsed.override ?? false,
        reason: parsed.reason ?? null,
        expectedUpdatedAt: parsed.expectedUpdatedAt ?? null,
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
      if (msg === 'FIGHT_STALE_UPDATE')
        throw new HttpException(msg, HttpStatus.CONFLICT);
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
