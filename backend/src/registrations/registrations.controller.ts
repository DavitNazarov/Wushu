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
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { RegistrationsService } from './registrations.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import { RegistrationStatus } from '@prisma/client';

// Derived straight from the Prisma enum object — can't drift from the schema.
const registrationStatusSchema = z.enum(RegistrationStatus);

// POST /api/registrations body. notes/reason are capped at 10K/2K chars to
// keep them survivable in DB columns and to prevent unbounded inputs.
// `override` + `reason` allow admins to bypass certain registration guards
// (closed window, age-group mismatch, etc.) — the reason field is required
// in the service when override=true.
const createRegistrationSchema = z.object({
  eventId: z.string().cuid(),
  athleteId: z.string().cuid(),
  clubId: z.string().cuid().nullable().optional(),
  eventWeightCategoryId: z.string().cuid(),
  notes: z.string().trim().max(10_000).nullable().optional(),
  override: z.boolean().optional(),
  reason: z.string().trim().max(2_000).nullable().optional(),
});

// POST /api/registrations/:id/status body. status is loosely typed (string)
// at this layer; the service validates it against the RegistrationStatus enum
// and rejects invalid transitions with INVALID_STATUS_TRANSITION.
const setStatusSchema = z.object({
  status: registrationStatusSchema,
  override: z.boolean().optional(),
  reason: z.string().trim().max(2_000).nullable().optional(),
});

// POST /api/registrations/:id/category body. Used when admins move an athlete
// to a different weight class (typically after weigh-in shows the athlete
// is too heavy for their initial pick).
const setCategorySchema = z.object({
  eventWeightCategoryId: z.string().cuid(),
  override: z.boolean().optional(),
  reason: z.string().trim().max(2_000).nullable().optional(),
});

// Admin + coach single-registration routes mounted at `/api/registrations`.
// All endpoints require ATHLETES_MANAGE (granted to admins AND coaches);
// coach-only restrictions (e.g. "can't change status") live in the service.
@Controller('registrations')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  // GET /api/registrations?eventId&clubId&status&q&categoryCode
  // Filters compose with AND. Coach tenancy: a coach's clubId is forced
  // server-side so they only see their own club's registrations regardless
  // of any clubId in the querystring.
  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
    @Query('eventId') eventId?: string,
    @Query('clubId') clubId?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('categoryCode') categoryCode?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const auth = req.auth!;
    const normalizedStatus = status?.trim();
    if (
      normalizedStatus &&
      !registrationStatusSchema.safeParse(normalizedStatus).success
    ) {
      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid registrations query',
          issues: [
            {
              path: 'status',
              message: `Invalid status "${normalizedStatus}"`,
            },
          ],
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // A coach with no club must NOT fall through to an unfiltered (all-org)
    // registrations query — reject like the POST paths do (BF-1 data-leak fix).
    if (auth.role === 'coach' && !auth.clubId) {
      throw new HttpException(
        {
          code: 'COACH_NO_CLUB',
          message: 'Coach must be assigned to a club to manage registrations',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Coach: ignore client clubId, use auth.clubId only
    const actorClubId = auth.role === 'coach' ? (auth.clubId ?? null) : null;
    const effectiveClubId =
      actorClubId ?? (auth.role === 'admin' ? clubId : undefined);

    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    const parsedOffset = offset ? Number.parseInt(offset, 10) : undefined;

    const { rows, total } = await this.registrations.list({
      organisationId: auth.organisationId,
      eventId,
      clubId: effectiveClubId,
      status: normalizedStatus as RegistrationStatus | undefined,
      q: q?.trim() || undefined,
      categoryCode: categoryCode?.trim() || undefined,
      actorClubId,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      offset: Number.isFinite(parsedOffset) ? parsedOffset : undefined,
    });

    // Full filtered count for client-side page controls. Same-origin in both
    // dev (Next rewrite proxy) and prod (combined server), so the header is
    // always readable without CORS expose-headers config.
    res.setHeader('X-Total-Count', String(total));
    return rows;
  }

  // GET /api/registrations/category-codes?eventId&clubId
  // Distinct category codes for an event, powering the admin Category filter
  // dropdown without dragging the whole registration list across the wire.
  // Coach tenancy mirrors list(): a coach's own clubId is forced server-side.
  @Get('category-codes')
  async categoryCodes(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId?: string,
    @Query('clubId') clubId?: string,
  ): Promise<string[]> {
    const auth = req.auth!;

    if (!eventId) {
      throw new BadRequestException({
        code: 'EVENT_ID_REQUIRED',
        message: 'eventId is required',
      });
    }

    if (auth.role === 'coach' && !auth.clubId) {
      throw new HttpException(
        {
          code: 'COACH_NO_CLUB',
          message: 'Coach must be assigned to a club to manage registrations',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const actorClubId = auth.role === 'coach' ? (auth.clubId ?? null) : null;
    const effectiveClubId =
      actorClubId ?? (auth.role === 'admin' ? clubId : undefined);

    return this.registrations.listCategoryCodes({
      organisationId: auth.organisationId,
      eventId,
      clubId: effectiveClubId,
      actorClubId,
    });
  }

  // POST /api/registrations — create a new registration. Coaches must have a
  // clubId on their account (COACH_NO_CLUB otherwise) and can only register
  // athletes in their own club. Maps service errors to HTTP statuses:
  //   ATHLETE_NOT_FOUND | EVENT_NOT_FOUND                     → 404
  //   ATHLETE_NOT_IN_COACH_CLUB | REGISTRATION_CLOSED         → 403
  //   INVALID_CATEGORY_FOR_EVENT,
  //   EVENT_CATEGORIES_NOT_CONFIGURED,
  //   EVENT_WEIGHT_CATEGORY_REQUIRED,
  //   ATHLETE_OUT_OF_AGE_GROUP,
  //   ATHLETE_SEX_MISMATCH_FOR_CATEGORY,
  //   REGISTRATION_ALREADY_EXISTS, REGISTRATION_LOCKED,
  //   OVERRIDE_REASON_REQUIRED, EVENT_READ_ONLY               → 400
  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;
    const actorClubId = auth.role === 'coach' ? (auth.clubId ?? null) : null;

    if (auth.role === 'coach' && !actorClubId) {
      throw new HttpException(
        {
          code: 'COACH_NO_CLUB',
          message: 'Coach must be assigned to a club to create registrations',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const parsed = createRegistrationSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid registration payload',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    try {
      return await this.registrations.create({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        eventId: parsed.data.eventId,
        athleteId: parsed.data.athleteId,
        clubId: auth.role === 'coach' ? actorClubId : (parsed.data.clubId ?? null),
        eventWeightCategoryId: parsed.data.eventWeightCategoryId,
        notes: parsed.data.notes ?? null,
        actorClubId,
        override: parsed.data.override ?? false,
        reason: parsed.data.reason ?? null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'ATHLETE_NOT_FOUND' || msg === 'EVENT_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      if (msg === 'ATHLETE_NOT_IN_COACH_CLUB') {
        throw new HttpException(msg, HttpStatus.FORBIDDEN);
      }
      if (msg === 'REGISTRATION_CLOSED') {
        throw new HttpException(
          {
            code: 'REGISTRATION_CLOSED',
            message: 'Registration is not open for this event.',
          },
          HttpStatus.FORBIDDEN,
        );
      }
      if (msg === 'EVENT_CLOSED_UNOFFICIAL_CLUB') {
        throw new HttpException(
          {
            code: 'EVENT_CLOSED_UNOFFICIAL_CLUB',
            message: 'This event is closed to unofficial clubs.',
          },
          HttpStatus.FORBIDDEN,
        );
      }
      // BF-8: duplicate registration is a conflict, not a bad request — and the
      // concurrent-race P2002 (now mapped to this code in the service) must not
      // fall through to a 500.
      if (msg === 'REGISTRATION_ALREADY_EXISTS') {
        throw new HttpException(
          {
            code: 'REGISTRATION_ALREADY_EXISTS',
            message: 'This athlete is already registered for this event.',
          },
          HttpStatus.CONFLICT,
        );
      }
      if (
        msg === 'INVALID_CATEGORY_FOR_EVENT' ||
        msg === 'EVENT_CATEGORIES_NOT_CONFIGURED' ||
        msg === 'EVENT_WEIGHT_CATEGORY_REQUIRED' ||
        msg === 'ATHLETE_OUT_OF_AGE_GROUP' ||
        msg === 'ATHLETE_SEX_MISMATCH_FOR_CATEGORY' ||
        msg === 'REGISTRATION_LOCKED' ||
        msg === 'OVERRIDE_REASON_REQUIRED' ||
        msg === 'EVENT_READ_ONLY'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /api/registrations/:id/status — admin status changes (approve, reject,
  // withdraw, etc.). Coaches are blocked at the service layer:
  //   COACH_CANNOT_SET_STATUS    — coaches can withdraw, not approve/reject
  //   COACH_CANNOT_OVERRIDE      — only admins can bypass guards
  // Override moves still need a reason (OVERRIDE_REASON_REQUIRED).
  @Post(':id/status')
  async setStatus(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const actorClubId = auth.role === 'coach' ? (auth.clubId ?? null) : null;

    // A coach with no club would pass actorClubId=null and thereby skip every
    // coach restriction in the service (privilege escalation) — reject (BF-1).
    if (auth.role === 'coach' && !actorClubId) {
      throw new HttpException(
        {
          code: 'COACH_NO_CLUB',
          message: 'Coach must be assigned to a club to manage registrations',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const parsed = setStatusSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid registration status payload',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    try {
      return await this.registrations.setStatus({
        organisationId: auth.organisationId,
        registrationId: id,
        actorUserId: auth.sub,
        newStatus: parsed.data.status as RegistrationStatus,
        override: parsed.data.override ?? false,
        reason: parsed.data.reason ?? null,
        actorClubId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (
        msg === 'REGISTRATION_NOT_FOUND' ||
        msg === 'REGISTRATION_NOT_IN_COACH_CLUB'
      ) {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      if (
        msg === 'INVALID_STATUS_TRANSITION' ||
        msg === 'OVERRIDE_REASON_REQUIRED' ||
        msg === 'COACH_CANNOT_SET_STATUS' ||
        msg === 'COACH_CANNOT_OVERRIDE' ||
        msg === 'REGISTRATION_LOCKED' ||
        msg === 'EVENT_READ_ONLY'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /api/registrations/:id/category — move a registration into a
  // different weight class. Common after weigh-in shows the athlete is
  // too heavy for their initial pick — admins flip them to the higher class
  // (registeredEventWeightCategory stays unchanged so "moved up" can render).
  // Coaches cannot call this once registration is locked (COACH_CANNOT_SET_CATEGORY).
  @Post(':id/category')
  async setCategory(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const actorClubId = auth.role === 'coach' ? (auth.clubId ?? null) : null;

    // A coach with no club would pass actorClubId=null and skip coach guards
    // in the service — reject (BF-1).
    if (auth.role === 'coach' && !actorClubId) {
      throw new HttpException(
        {
          code: 'COACH_NO_CLUB',
          message: 'Coach must be assigned to a club to manage registrations',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const parsed = setCategorySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid registration category payload',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    try {
      return await this.registrations.setCategory({
        organisationId: auth.organisationId,
        registrationId: id,
        eventWeightCategoryId: parsed.data.eventWeightCategoryId,
        actorUserId: auth.sub,
        actorClubId,
        override: parsed.data.override ?? false,
        reason: parsed.data.reason ?? null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (
        msg === 'REGISTRATION_NOT_FOUND' ||
        msg === 'REGISTRATION_NOT_IN_COACH_CLUB'
      ) {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      if (
        msg === 'INVALID_CATEGORY_FOR_EVENT' ||
        msg === 'EVENT_CATEGORIES_NOT_CONFIGURED' ||
        msg === 'EVENT_WEIGHT_CATEGORY_REQUIRED' ||
        msg === 'ATHLETE_OUT_OF_AGE_GROUP' ||
        msg === 'ATHLETE_SEX_MISMATCH_FOR_CATEGORY' ||
        msg === 'COACH_CANNOT_SET_CATEGORY' ||
        msg === 'OVERRIDE_REASON_REQUIRED' ||
        msg === 'REGISTRATION_LOCKED' ||
        msg === 'EVENT_READ_ONLY'
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
