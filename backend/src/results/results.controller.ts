import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import { ResultsService } from './results.service';

@Controller('results')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.RESULTS_MANAGE)
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get()
  async getResults(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId?: string,
  ) {
    if (!eventId)
      throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);

    try {
      return this.results.listForEvent(req.auth!.organisationId, eventId);
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
}
