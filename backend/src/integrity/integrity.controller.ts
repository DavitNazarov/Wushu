import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IntegrityService } from './integrity.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';

@Controller('integrity')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.EVENTS_MANAGE)
export class IntegrityController {
  constructor(private readonly integrity: IntegrityService) {}

  @Get()
  async check(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId: string,
  ) {
    const auth = req.auth!;
    if (!eventId)
      throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);

    try {
      return await this.integrity.checkIssues(auth.organisationId, eventId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'EVENT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('lock')
  async lock(
    @Req() req: AuthenticatedRequest,
    @Body() body: { eventId: string; override?: boolean; reason?: string },
  ) {
    const auth = req.auth!;
    if (!body.eventId)
      throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);

    try {
      return await this.integrity.lock({
        organisationId: auth.organisationId,
        eventId: body.eventId,
        actorUserId: auth.sub,
        override: body.override ?? false,
        reason: body.reason ?? null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'EVENT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (
        msg === 'EVENT_NOT_IN_WEIGHIN' ||
        msg === 'EVENT_ALREADY_LOCKED' ||
        msg === 'INTEGRITY_ISSUES_EXIST' ||
        msg === 'OVERRIDE_REASON_REQUIRED'
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
