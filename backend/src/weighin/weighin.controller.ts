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
import { WeighinService } from './weighin.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import type { WeighInDecision } from '@prisma/client';

@Controller('weighin')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.WEIGHIN_RUN)
export class WeighinController {
  constructor(private readonly weighin: WeighinService) {}

  @Get()
  async search(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId: string,
    @Query('q') q?: string,
  ) {
    const auth = req.auth!;
    if (!eventId)
      throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);
    return this.weighin.search({
      organisationId: auth.organisationId,
      eventId,
      q,
    });
  }

  @Post()
  async record(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      registrationId: string;
      weightKg: number;
      decision: string;
      override?: boolean;
      reason?: string;
    },
  ) {
    const auth = req.auth!;

    if (!body.registrationId || body.weightKg == null || !body.decision) {
      throw new HttpException('VALIDATION_ERROR', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.weighin.record({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        registrationId: body.registrationId,
        weightKg: body.weightKg,
        decision: body.decision as WeighInDecision,
        override: body.override ?? false,
        reason: body.reason ?? null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'REGISTRATION_NOT_FOUND' || msg === 'EVENT_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      if (
        msg === 'EVENT_NOT_IN_WEIGHIN' ||
        msg === 'OVERRIDE_REASON_REQUIRED' ||
        msg === 'WEIGHT_EXCEEDS_CATEGORY_LIMIT' ||
        msg === 'WEIGHT_WITHIN_LIMITS_CANNOT_FAIL'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw e;
    }
  }

  @Post(':id/resolve')
  async resolveOneHour(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      action: 'MOVE_UP' | 'DQ';
      nextEventWeightCategoryId?: string;
      newCategoryCode?: string;
      reason?: string;
    },
  ) {
    const auth = req.auth!;
    if (!body.action)
      throw new HttpException('action_REQUIRED', HttpStatus.BAD_REQUEST);
    try {
      return await this.weighin.resolveOneHour({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        attemptId: id,
        action: body.action,
        nextEventWeightCategoryId: body.nextEventWeightCategoryId ?? null,
        newCategoryCode: body.newCategoryCode,
        reason: body.reason ?? null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'ATTEMPT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (msg === 'ALREADY_RESOLVED')
        throw new HttpException(msg, HttpStatus.CONFLICT);
      if (
        msg === 'INVALID_MOVE_UP_CATEGORY' ||
        msg === 'NO_HIGHER_CATEGORY_AVAILABLE' ||
        msg === 'MOVE_UP_CATEGORY_REQUIRED'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw e;
    }
  }
}
