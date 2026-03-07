import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClubsService } from './clubs.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';

@Controller('clubs')
@UseGuards(AuthGuard, CapabilityGuard)
export class ClubsController {
  constructor(private readonly clubs: ClubsService) {}

  @Get()
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  async list(@Req() req: AuthenticatedRequest) {
    const auth = req.auth!;
    return this.clubs.list(auth.organisationId);
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
