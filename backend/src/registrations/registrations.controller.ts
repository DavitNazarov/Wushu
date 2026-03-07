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
    // Coach: ignore client clubId, use auth.clubId only
    const actorClubId = auth.role === 'coach' ? (auth.clubId ?? null) : null;
    const effectiveClubId =
      actorClubId ?? (auth.role === 'admin' ? clubId : undefined);

    return this.registrations.list({
      organisationId: auth.organisationId,
      eventId,
      clubId: effectiveClubId,
      status: status as RegistrationStatus | undefined,
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
      categoryCode?: string;
      eventWeightCategoryId?: string;
      notes?: string;
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
      (!body.eventWeightCategoryId && !body.categoryCode)
    ) {
      throw new HttpException(
        'VALIDATION_ERROR: eventId, athleteId, and eventWeightCategoryId (or categoryCode) are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.registrations.create({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        eventId: body.eventId,
        athleteId: body.athleteId,
        categoryCode: body.categoryCode,
        eventWeightCategoryId: body.eventWeightCategoryId ?? null,
        notes: body.notes ?? null,
        actorClubId,
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
      if (msg === 'INVALID_CATEGORY_FOR_EVENT' || msg === 'CATEGORY_REQUIRED') {
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
        msg === 'COACH_CANNOT_OVERRIDE'
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
