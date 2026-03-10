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
    @Body()
    body: {
      eventId: string;
      athleteId: string;
      eventWeightCategoryId?: string;
      notes?: string;
      override?: boolean;
      reason?: string;
    },
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

    if (
      !body.eventId ||
      !body.athleteId ||
      !body.eventWeightCategoryId
    ) {
      throw new HttpException(
        'VALIDATION_ERROR: eventId, athleteId, and eventWeightCategoryId are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.registrations.create({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        eventId: body.eventId,
        athleteId: body.athleteId,
        eventWeightCategoryId: body.eventWeightCategoryId ?? null,
        notes: body.notes ?? null,
        actorClubId,
        override: body.override ?? false,
        reason: body.reason ?? null,
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
    @Body()
    body: {
      status: string;
      override?: boolean;
      reason?: string;
    },
  ) {
    const auth = req.auth!;
    const actorClubId = auth.role === 'coach' ? (auth.clubId ?? null) : null;

    try {
      return await this.registrations.setStatus({
        organisationId: auth.organisationId,
        registrationId: id,
        actorUserId: auth.sub,
        newStatus: body.status as RegistrationStatus,
        override: body.override ?? false,
        reason: body.reason ?? null,
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
    @Body()
    body: {
      eventWeightCategoryId: string;
      override?: boolean;
      reason?: string;
    },
  ) {
    const auth = req.auth!;
    const actorClubId = auth.role === 'coach' ? (auth.clubId ?? null) : null;

    if (!body.eventWeightCategoryId) {
      throw new HttpException(
        'eventWeightCategoryId_REQUIRED',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.registrations.setCategory({
        organisationId: auth.organisationId,
        registrationId: id,
        eventWeightCategoryId: body.eventWeightCategoryId,
        actorUserId: auth.sub,
        actorClubId,
        override: body.override ?? false,
        reason: body.reason ?? null,
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
