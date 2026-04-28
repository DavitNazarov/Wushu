import {
  BadRequestException,
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
import { upsertClubSchema } from './clubs.schemas';

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
  async upsert(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;

    if (auth.role !== 'admin') {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }

    const parsed = upsertClubSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid club payload',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    return this.clubs.upsert({
      organisationId: auth.organisationId,
      actorUserId: auth.sub,
      id: parsed.data.id,
      name: parsed.data.name,
      nameKa: parsed.data.nameKa ?? null,
      city: parsed.data.city ?? null,
      country: parsed.data.country ?? null,
    });
  }
}

