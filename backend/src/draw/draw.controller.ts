import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DrawService } from './draw.service';
import { DrawReadinessService } from './draw.readiness.service';
import { BracketsService } from './brackets.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';

// Admin-only draw + bracket routes. Mixes two top-level prefixes (/api/draw
// and /api/brackets) under one controller because they share the same
// guards, capability, and audience. DRAW_RUN gates everything — admins hold
// it, coaches do not.
@Controller()
@UseGuards(AuthGuard, CapabilityGuard)
export class DrawController {
  private readonly logger = new Logger(DrawController.name);
  constructor(
    private readonly draw: DrawService,
    private readonly readiness: DrawReadinessService,
    private readonly brackets: BracketsService,
  ) {}

  // POST /api/draw — actually run the draw algorithm. Inputs:
  //   - seed             : deterministic randomness for reproducibility
  //   - sameClubSeparation: prefer not to face same-club athletes in R1
  //   - override + reason: admin escape hatch to redraw / force a draw
  //                        outside the normal preflight rules
  // Maps service errors to HTTP codes:
  //   EVENT_NOT_FOUND                                                 → 404
  //   EVENT_NOT_LOCKED / WEIGHIN_NOT_COMPLETED_FOR_DRAW,
  //   OVERRIDE_REASON_REQUIRED, NO_ELIGIBLE_REGISTRATIONS,
  //   NO_READY_CATEGORIES, DRAW_BLOCKED_CATEGORIES,
  //   DRAW_VALIDATION_FAILED, DRAW_ALREADY_EXISTS,
  //   DRAW_MUTATION_BLOCKED, EVENT_READ_ONLY                          → 400
  @Post('draw')
  @RequireCapability(CAPABILITIES.DRAW_RUN)
  async executeDraw(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      eventId: string;
      seed?: number;
      sameClubSeparation?: boolean;
      override?: boolean;
      reason?: string;
    },
  ) {
    const auth = req.auth!;
    if (!body.eventId)
      throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);

    try {
      return await this.draw.executeDraw({
        organisationId: auth.organisationId,
        eventId: body.eventId,
        actorUserId: auth.sub,
        seed: body.seed,
        sameClubSeparation: body.sameClubSeparation ?? false,
        override: body.override ?? false,
        reason: body.reason ?? null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      this.logger.error(
        'Draw executeDraw failed',
        e instanceof Error ? e.stack : String(e),
      );
      if (msg === 'EVENT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (
        msg === 'EVENT_NOT_LOCKED' ||
        msg === 'WEIGHIN_NOT_COMPLETED_FOR_DRAW' ||
        msg === 'OVERRIDE_REASON_REQUIRED' ||
        msg === 'NO_ELIGIBLE_REGISTRATIONS' ||
        msg === 'NO_READY_CATEGORIES' ||
        msg === 'DRAW_BLOCKED_CATEGORIES' ||
        msg === 'DRAW_VALIDATION_FAILED' ||
        msg === 'DRAW_ALREADY_EXISTS' ||
        msg === 'DRAW_MUTATION_BLOCKED' ||
        msg === 'EVENT_READ_ONLY'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      // SEC-6: never echo the raw internal error string to clients.
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /api/draw/reset — discard all brackets+fights for an event so the
  // admin can redraw. Always requires override+reason because it's destructive.
  //   OVERRIDE_REQUIRED / REASON_REQUIRED / DRAW_MUTATION_BLOCKED → 400
  @Post('draw/reset')
  @RequireCapability(CAPABILITIES.DRAW_RUN)
  async resetDraw(
    @Req() req: AuthenticatedRequest,
    @Body() body: { eventId: string; override: boolean; reason: string },
  ) {
    const auth = req.auth!;
    try {
      return await this.draw.resetDraw({
        organisationId: auth.organisationId,
        eventId: body.eventId,
        actorUserId: auth.sub,
        override: body.override ?? false,
        reason: body.reason ?? '',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'EVENT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (
        msg === 'OVERRIDE_REQUIRED' ||
        msg === 'REASON_REQUIRED' ||
        msg === 'DRAW_MUTATION_BLOCKED'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /api/draw/overview?eventId=... — pre-draw readiness summary.
  // Tells the admin which categories are ready, which are blocked
  // (and why), and how many athletes/registrations each has. Powers the
  // pre-draw checklist screen.
  @Get('draw/overview')
  @RequireCapability(CAPABILITIES.DRAW_RUN)
  async drawOverview(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId: string,
  ) {
    const auth = req.auth!;
    if (!eventId) {
      throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.readiness.getOverview({
        organisationId: auth.organisationId,
        eventId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'EVENT_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      // SEC-6: never echo the raw internal error string to clients.
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /api/draw/category?eventId=&eventWeightCategoryId= — per-category
  // readiness detail: full athlete list, any blockers (missing weigh-in,
  // wrong age group, etc.). Used by the per-row expansion in the
  // pre-draw checklist.
  @Get('draw/category')
  @RequireCapability(CAPABILITIES.DRAW_RUN)
  async drawCategoryDetails(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId: string,
    @Query('eventWeightCategoryId') eventWeightCategoryId: string,
  ) {
    const auth = req.auth!;
    if (!eventId || !eventWeightCategoryId) {
      throw new HttpException(
        'eventId_and_eventWeightCategoryId_REQUIRED',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.readiness.getCategoryDetails({
        organisationId: auth.organisationId,
        eventId,
        eventWeightCategoryId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'EVENT_NOT_FOUND' || msg === 'CATEGORY_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      // SEC-6: never echo the raw internal error string to clients.
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /api/draw/category/review — mark a SOLO / NEEDS_REVIEW category as
  // reviewed. Clears its flag (green "Reviewed by …") until the eligible pool
  // changes, at which point the sign-off auto-expires.
  //   EVENT_NOT_FOUND / CATEGORY_NOT_FOUND → 404 ; EVENT_READ_ONLY → 400
  @Post('draw/category/review')
  @RequireCapability(CAPABILITIES.DRAW_RUN)
  async reviewCategory(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: { eventId: string; eventWeightCategoryId: string; reason?: string },
  ) {
    const auth = req.auth!;
    if (!body.eventId || !body.eventWeightCategoryId) {
      throw new HttpException(
        'eventId_and_eventWeightCategoryId_REQUIRED',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.draw.reviewCategory({
        organisationId: auth.organisationId,
        eventId: body.eventId,
        eventWeightCategoryId: body.eventWeightCategoryId,
        actorUserId: auth.sub,
        reason: body.reason ?? null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'EVENT_NOT_FOUND' || msg === 'CATEGORY_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      if (msg === 'EVENT_READ_ONLY') {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /api/draw/category/unreview — clear a category's review sign-off so it
  // shows its raw SOLO / NEEDS_REVIEW status again.
  //   EVENT_NOT_FOUND / CATEGORY_NOT_FOUND → 404
  @Post('draw/category/unreview')
  @RequireCapability(CAPABILITIES.DRAW_RUN)
  async unreviewCategory(
    @Req() req: AuthenticatedRequest,
    @Body() body: { eventId: string; eventWeightCategoryId: string },
  ) {
    const auth = req.auth!;
    if (!body.eventId || !body.eventWeightCategoryId) {
      throw new HttpException(
        'eventId_and_eventWeightCategoryId_REQUIRED',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.draw.unreviewCategory({
        organisationId: auth.organisationId,
        eventId: body.eventId,
        eventWeightCategoryId: body.eventWeightCategoryId,
        actorUserId: auth.sub,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'EVENT_NOT_FOUND' || msg === 'CATEGORY_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /api/brackets?eventId=... — list every drawn bracket for an event.
  // Slim shape; the per-bracket full structure lives at GET /brackets/:id.
  @Get('brackets')
  @RequireCapability(CAPABILITIES.DRAW_RUN)
  async listBrackets(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId: string,
  ) {
    const auth = req.auth!;
    if (!eventId)
      throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);
    return this.draw.listBrackets(auth.organisationId, eventId);
  }

  // GET /api/brackets/overview?eventId=... — POST-draw aggregate view of every
  // drawn bracket (vs /draw/overview which is PRE-draw). Powers the
  // admin's "Brackets" page after the draw has been run.
  @Get('brackets/overview')
  @RequireCapability(CAPABILITIES.DRAW_RUN)
  async bracketsOverview(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId: string,
  ) {
    const auth = req.auth!;
    if (!eventId) {
      throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.brackets.getOverview({
        organisationId: auth.organisationId,
        eventId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'EVENT_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      // SEC-6: never echo the raw internal error string to clients.
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /api/brackets/category?eventId=&eventWeightCategoryId= — full fight
  // tree for one category. Returns the round-by-round structure the bracket
  // UI renders.
  @Get('brackets/category')
  @RequireCapability(CAPABILITIES.DRAW_RUN)
  async bracketCategoryDetails(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId: string,
    @Query('eventWeightCategoryId') eventWeightCategoryId: string,
  ) {
    const auth = req.auth!;
    if (!eventId || !eventWeightCategoryId) {
      throw new HttpException(
        'eventId_and_eventWeightCategoryId_REQUIRED',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.brackets.getCategoryDetails({
        organisationId: auth.organisationId,
        eventId,
        eventWeightCategoryId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'EVENT_NOT_FOUND' || msg === 'CATEGORY_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      // SEC-6: never echo the raw internal error string to clients.
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /api/brackets/swap — admin tool to swap two athletes between
  // bracket slots after the draw. Useful when the algorithm pairs up
  // same-club athletes the seeding policy should've prevented, or when
  // late substitutions land. SWAP_SAME_SLOT → 400 if both targets are the
  // same slot (a no-op). FIGHT_NOT_FOUND → 404.
  @Post('brackets/swap')
  @RequireCapability(CAPABILITIES.DRAW_RUN)
  async swapBracketParticipants(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      eventId: string;
      fightId1: string;
      side1: 'red' | 'blue';
      fightId2: string;
      side2: 'red' | 'blue';
    },
  ) {
    const auth = req.auth!;
    if (!body.eventId || !body.fightId1 || !body.fightId2) {
      throw new HttpException(
        'MISSING_REQUIRED_FIELDS',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      await this.brackets.swapParticipants({
        organisationId: auth.organisationId,
        eventId: body.eventId,
        actorUserId: auth.sub,
        fightId1: body.fightId1,
        side1: body.side1,
        fightId2: body.fightId2,
        side2: body.side2,
      });
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'FIGHT_NOT_FOUND' || msg === 'EVENT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (msg === 'SWAP_SAME_SLOT')
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      // BF-12: bracket is locked by lifecycle (LIVE/COMPLETED) or a started fight.
      if (msg === 'BRACKET_LOCKED')
        throw new HttpException(msg, HttpStatus.CONFLICT);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /api/brackets/:id — single-bracket detail (round-by-round fight tree).
  // BRACKET_NOT_FOUND → 404 if the id doesn't exist or isn't in this org.
  @Get('brackets/:id')
  @RequireCapability(CAPABILITIES.DRAW_RUN)
  async getBracket(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const auth = req.auth!;
    const bracket = await this.draw.getBracket(auth.organisationId, id);
    if (!bracket)
      throw new HttpException('BRACKET_NOT_FOUND', HttpStatus.NOT_FOUND);
    return bracket;
  }
}
