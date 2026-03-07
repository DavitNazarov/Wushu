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
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';

@Controller()
@UseGuards(AuthGuard, CapabilityGuard)
export class DrawController {
  private readonly logger = new Logger(DrawController.name);
  constructor(private readonly draw: DrawService) {}

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
      if (msg === 'EVENT_NOT_LOCKED' || msg === 'OVERRIDE_REASON_REQUIRED') {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        msg || 'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

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
      if (msg === 'OVERRIDE_REQUIRED' || msg === 'REASON_REQUIRED') {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

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
