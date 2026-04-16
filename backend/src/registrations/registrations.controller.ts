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
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { RegistrationsService } from './registrations.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import type { RegistrationStatus } from '@prisma/client';

const REGISTRATION_STATUSES: RegistrationStatus[] = [
  'PENDING',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
];

const createRegistrationSchema = z.object({
  eventId: z.string().cuid(),
  athleteId: z.string().cuid(),
  eventWeightCategoryId: z.string().cuid(),
  notes: z.string().trim().max(10_000).nullable().optional(),
  override: z.boolean().optional(),
  reason: z.string().trim().max(2_000).nullable().optional(),
});

const setStatusSchema = z.object({
  status: z.string().min(1),
  override: z.boolean().optional(),
  reason: z.string().trim().max(2_000).nullable().optional(),
});

const setCategorySchema = z.object({
  eventWeightCategoryId: z.string().cuid(),
  override: z.boolean().optional(),
  reason: z.string().trim().max(2_000).nullable().optional(),
});

@Controller('registrations')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId?: string,
    @Query('clubId') clubId?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('categoryCode') categoryCode?: string,
  ) {
    const auth = req.auth!;
    const normalizedStatus = status?.trim();
    if (
      normalizedStatus &&
      !REGISTRATION_STATUSES.includes(normalizedStatus as RegistrationStatus)
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

    // Coach: ignore client clubId, use auth.clubId only
    const actorClubId = auth.role === 'coach' ? (auth.clubId ?? null) : null;
    const effectiveClubId =
      actorClubId ?? (auth.role === 'admin' ? clubId : undefined);

    return this.registrations.list({
      organisationId: auth.organisationId,
      eventId,
      clubId: effectiveClubId,
      status: normalizedStatus as RegistrationStatus | undefined,
      q: q?.trim() || undefined,
      categoryCode: categoryCode?.trim() || undefined,
      actorClubId,
    });
  }

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
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
      if (
        msg === 'INVALID_CATEGORY_FOR_EVENT' ||
        msg === 'EVENT_CATEGORIES_NOT_CONFIGURED' ||
        msg === 'EVENT_WEIGHT_CATEGORY_REQUIRED' ||
        msg === 'ATHLETE_OUT_OF_AGE_GROUP' ||
        msg === 'ATHLETE_SEX_MISMATCH_FOR_CATEGORY' ||
        msg === 'REGISTRATION_ALREADY_EXISTS' ||
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

  @Post(':id/status')
  async setStatus(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const actorClubId = auth.role === 'coach' ? (auth.clubId ?? null) : null;

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

  @Post(':id/category')
  async setCategory(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const actorClubId = auth.role === 'coach' ? (auth.clubId ?? null) : null;

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
