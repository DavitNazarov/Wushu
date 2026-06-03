import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { EventOpsService } from './event-ops.service';
import { EventStageAutomationService } from './event-stage-automation.service';
import { EventCategoriesService } from './event-categories.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import { CreateEventSchema, UpdateEventSchema } from './event.types';
import type { EventLifecycle } from '@prisma/client';
import { EventCategorySelectionSchema } from './event-category-selection.schema';

// Narrow type-guard for Prisma-style errors that carry a `.code` like 'P2002'
// (unique constraint violation). Used so we can map DB constraint hits to
// nice 422 VALIDATION_ERROR responses instead of leaking 500s.
function hasCode(err: unknown, code: string): boolean {
  if (!err || typeof err !== 'object') return false;
  if (!('code' in err)) return false;
  return (err as { code?: unknown }).code === code;
}

// Admin-only event management routes mounted at `/api/events`.
// Every method here is gated by AuthGuard (requires a valid JWT cookie) and
// CapabilityGuard with EVENTS_MANAGE — so coaches/judges cannot reach these.
@Controller('events')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.EVENTS_MANAGE)
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly eventOps: EventOpsService,
    private readonly stageAutomation: EventStageAutomationService,
    private readonly eventCategories: EventCategoriesService,
  ) {}

  // GET /api/events — list every event in the caller's organisation.
  // Tenant isolation comes from auth.organisationId, which is pulled from
  // the JWT by AuthGuard, never from query/body input.
  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const auth = req.auth!;
    return this.events.list(auth.organisationId);
  }

  /** Admin: immediately run the stage-automation check for all eligible events. */
  // POST /api/events/stage-automation/run — manual trigger of the cron job that
  // auto-advances events through their lifecycle (REG_OPEN → LOCKED → ...).
  // Returns the count of events that actually advanced.
  @Post('stage-automation/run')
  @HttpCode(HttpStatus.OK)
  async runStageAutomation(@Req() req: AuthenticatedRequest) {
    const auth = req.auth!;
    const advanced = await this.stageAutomation.checkAndAdvanceStages(
      auth.organisationId,
    );
    return { advanced };
  }

  /**
   * Admin: run stage-automation for ONE specific event and return the updated
   * event+summary so the frontend can update immediately from the response.
   */
  // POST /api/events/:id/run-automation — single-event variant of the route above.
  // Saves a roundtrip on the admin UI: do the check, get the result, refresh
  // the page state, all in one request/response cycle.
  @Post(':id/run-automation')
  @HttpCode(HttpStatus.OK)
  async runEventAutomation(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const auth = req.auth!;
    // maybeAutoAdvanceById is called inside getById, so a single getById call
    // checks, advances if needed, then returns the fresh event.
    const event = await this.events.getById(id, auth.organisationId);
    if (!event)
      throw new HttpException('EVENT_NOT_FOUND', HttpStatus.NOT_FOUND);
    const summary = await this.eventOps.getEventSummary(
      id,
      auth.organisationId,
    );
    return { event, summary };
  }

  // GET /api/events/:id — single-event read. 404s with EVENT_NOT_FOUND if the
  // event doesn't exist OR if it belongs to a different organisation (we don't
  // differentiate, to avoid leaking cross-tenant existence).
  @Get(':id')
  async getById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const auth = req.auth!;
    const event = await this.events.getById(id, auth.organisationId);
    if (!event)
      throw new HttpException('EVENT_NOT_FOUND', HttpStatus.NOT_FOUND);
    return event;
  }

  // GET /api/events/:id/summary — event + computed summary (registration counts,
  // weigh-in stats, etc.). The summary is expensive enough to warrant its own
  // route rather than always bundling it with the basic getById response.
  @Get(':id/summary')
  async getSummary(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const auth = req.auth!;
    const event = await this.events.getById(id, auth.organisationId);
    if (!event)
      throw new HttpException('EVENT_NOT_FOUND', HttpStatus.NOT_FOUND);
    const summary = await this.eventOps.getEventSummary(
      id,
      auth.organisationId,
    );
    return { event, summary };
  }

  // POST /api/events — create a new event in the caller's organisation.
  // Body shape is validated by CreateEventSchema (Zod). Returns 422
  // VALIDATION_ERROR with field-level issues on validation failure,
  // and maps known service errors (slug conflict, missing category template,
  // policy violations) to the appropriate HTTP status codes.
  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;

    const parsed = CreateEventSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));

      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid event payload',
          issues,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    try {
      return await this.events.create(
        auth.organisationId,
        auth.sub,
        parsed.data,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown';
      if (msg === 'SLUG_ALREADY_IN_USE' || hasCode(e, 'P2002')) {
        throw new HttpException(
          {
            code: 'VALIDATION_ERROR',
            message: 'Invalid event payload',
            issues: [
              {
                path: 'slug',
                message: 'Slug is already in use',
              },
            ],
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (msg === 'CATEGORY_TEMPLATE_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      if (msg === 'CATEGORY_TEMPLATE_SELECTION_REQUIRED') {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      if (
        msg === 'INVALID_MIN_REST_MINUTES' ||
        msg === 'INVALID_REWEIGH_WINDOW_MINUTES' ||
        msg === 'MIN_REST_POLICY_REQUIRES_15_MINUTES' ||
        msg === 'IWUF_STRICT_POLICY_REQUIRES_60_MINUTE_WINDOW'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw e;
    }
  }

  // PATCH /api/events/:id — partial update of event metadata/policies.
  // Same error-mapping pattern as create(): Zod issues become 422, business
  // rule violations become 400, missing entity becomes 404, slug conflicts
  // (Prisma P2002) become 422 with a field-targeted message.
  @Patch(':id')
  async updateEvent(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;

    const parsed = UpdateEventSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      throw new HttpException(
        { code: 'VALIDATION_ERROR', message: 'Invalid event payload', issues },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    try {
      return await this.events.update(
        id,
        auth.organisationId,
        auth.sub,
        parsed.data,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown';
      if (msg === 'EVENT_NOT_FOUND')
        throw new HttpException('EVENT_NOT_FOUND', HttpStatus.NOT_FOUND);
      if (
        msg === 'INVALID_MIN_REST_MINUTES' ||
        msg === 'INVALID_REWEIGH_WINDOW_MINUTES' ||
        msg === 'MIN_REST_POLICY_REQUIRES_15_MINUTES' ||
        msg === 'IWUF_STRICT_POLICY_REQUIRES_60_MINUTE_WINDOW'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      if (hasCode(e, 'P2002')) {
        throw new HttpException(
          {
            code: 'VALIDATION_ERROR',
            message: 'Invalid event payload',
            issues: [{ path: 'slug', message: 'Slug is already in use' }],
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      throw e;
    }
  }

  // DELETE /api/events/:id — hard delete of an event and its cascade
  // (registrations, brackets, fights, schedule sessions). Returns 204
  // No Content on success. Delegated to EventOpsService.deleteEvent which
  // handles the multi-table cleanup in a transaction.
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEvent(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const auth = req.auth!;
    try {
      await this.eventOps.deleteEvent(id, auth.organisationId, auth.sub);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown';
      if (msg === 'EVENT_NOT_FOUND')
        throw new HttpException('EVENT_NOT_FOUND', HttpStatus.NOT_FOUND);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /api/events/:id/lifecycle — manual lifecycle state transition
  // (REG_OPEN → LOCKED → WEIGHIN → ... → COMPLETED).
  // Accepts either `to` or `targetState` for legacy compatibility, and an
  // `override` flag plus `reason` for admin force-transitions that bypass
  // the normal guard rules. INVALID_EVENT_TRANSITION → 400; OVERRIDE_REASON_REQUIRED
  // → 400 to force admins to document override actions.
  @Post(':id/lifecycle')
  async transitionLifecycle(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      to?: string;
      targetState?: string;
      reason?: string;
      override?: boolean;
    },
  ) {
    const auth = req.auth!;
    const target = (body.to ?? body.targetState) as string;
    try {
      return await this.eventOps.transitionLifecycle({
        eventId: id,
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        targetState: target as EventLifecycle,
        reason: body.reason ?? null,
        allowOverride: body.override ?? false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown';
      if (msg === 'EVENT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (
        msg === 'INVALID_EVENT_TRANSITION' ||
        msg === 'OVERRIDE_REASON_REQUIRED' ||
        msg === 'REGISTRATION_STILL_OPEN' ||
        msg === 'COMPETITION_NOT_STARTED'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /api/events/:id/publish — toggle the public-visibility flag on/off.
  // Independent of the lifecycle state machine — admins may publish a DRAFT
  // event or un-publish a LIVE one without changing its lifecycle status.
  @Post(':id/publish')
  async setPublished(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: { published: boolean },
  ) {
    const auth = req.auth!;
    const event = await this.eventOps.setPublished(
      id,
      auth.organisationId,
      body.published,
      auth.sub,
    );
    if (!event)
      throw new HttpException('EVENT_NOT_FOUND', HttpStatus.NOT_FOUND);
    return event;
  }

  // GET /api/events/:id/categories — return the category selection (weight
  // classes / divisions) configured for this event. Sourced from
  // EventCategoriesService which joins event-categories with their templates.
  @Get(':id/categories')
  async getCategories(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const auth = req.auth!;
    try {
      return await this.eventCategories.getCategories(id, auth.organisationId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown';
      if (msg === 'EVENT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /api/events/:id/categories — replace the event's category selection.
  // Returns EVENT_CATEGORIES_LOCKED_AFTER_ACTIVITY if registrations/brackets
  // already exist (mutating categories after that would invalidate downstream
  // bracket draws). Requires at least one category in the payload.
  @Post(':id/categories')
  async setCategories(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const parsed = EventCategorySelectionSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid event category payload',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    try {
      return await this.eventCategories.setCategories(
        id,
        auth.organisationId,
        auth.sub,
        parsed.data,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown';
      if (msg === 'EVENT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (msg === 'CATEGORY_TEMPLATE_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      if (
        msg === 'EVENT_CATEGORIES_LOCKED_AFTER_ACTIVITY' ||
        msg === 'AT_LEAST_ONE_CATEGORY_REQUIRED' ||
        msg.startsWith('INVALID_')
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
