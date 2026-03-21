import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClubsService } from './clubs.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import { ClubDetailsService } from './club-details.service';

@Controller('clubs')
@UseGuards(AuthGuard, CapabilityGuard)
export class ClubsController {
  constructor(
    private readonly clubs: ClubsService,
    private readonly clubDetails: ClubDetailsService,
  ) {}

  @Get()
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  async list(@Req() req: AuthenticatedRequest) {
    const auth = req.auth!;
    return this.clubs.list(auth.organisationId);
  }

  @Get(':id')
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  async getById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const auth = req.auth!;
    const detail = await this.clubDetails.getById({
      organisationId: auth.organisationId,
      clubId: id,
    });

    if (!detail) {
      throw new HttpException('CLUB_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    return detail;
  }

  @Post()
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  async upsert(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      id?: string;
      name: string;
      city?: string | null;
      country?: string | null;
    },
  ) {
    const auth = req.auth!;

    if (!body.name?.trim()) {
      throw new HttpException('VALIDATION_ERROR', HttpStatus.BAD_REQUEST);
    }

    return this.clubs.upsert({
      organisationId: auth.organisationId,
      actorUserId: auth.sub,
      id: body.id,
      name: body.name,
      city: body.city ?? null,
      country: body.country ?? null,
    });
  }
}
