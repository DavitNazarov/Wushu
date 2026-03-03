import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import { Req } from '@nestjs/common';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @UseGuards(AuthGuard, CapabilityGuard)
  @RequireCapability(CAPABILITIES.CAN_MANAGE_EVENT)
  async list(@Req() req: AuthenticatedRequest) {
    const auth = req.auth!;
    return this.events.list(auth.organisationId);
  }

  @Post()
  @UseGuards(AuthGuard, CapabilityGuard)
  @RequireCapability(CAPABILITIES.CAN_MANAGE_EVENT)
  async create(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const auth = req.auth!;
    try {
      return await this.events.create({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        name: body.name,
        slug: body.slug,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        location: body.location ?? null,
      });
    } catch (e) {
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':id/lifecycle')
  @UseGuards(AuthGuard, CapabilityGuard)
  @RequireCapability(CAPABILITIES.CAN_MANAGE_EVENT)
  async transitionLifecycle(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: { targetState: string; reason?: string; override?: boolean },
  ) {
    const auth = req.auth!;
    try {
      return await this.events.transitionLifecycle({
        eventId: id,
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        targetState: body.targetState as any,
        reason: body.reason ?? null,
        allowOverride: body.override ?? false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown';
      if (msg === 'EVENT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (msg === 'INVALID_EVENT_TRANSITION' || msg === 'OVERRIDE_REASON_REQUIRED')
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
