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

// Admin + coach club routes mounted at `/api/clubs`. Coaches need read access
// for the registration UIs ("which club is this athlete from?"), so the GETs
// only require ATHLETES_MANAGE (both roles have it). Writes are admin-only —
// see the role check in upsert() below.
@Controller('clubs')
@UseGuards(AuthGuard, CapabilityGuard)
export class ClubsController {
  constructor(
    private readonly clubs: ClubsService,
    private readonly clubDetails: ClubDetailsService,
  ) {}

  // GET /api/clubs — list all clubs in the org for the admin/coach UI.
  @Get()
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  async list(@Req() req: AuthenticatedRequest) {
    const auth = req.auth!;
    return this.clubs.list(auth.organisationId);
  }

  // GET /api/clubs/:id — single-club detail (roster, coaches, recent events).
  // Delegated to ClubDetailsService so the same shape powers the public
  // /clubs/:id page.
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

  // POST /api/clubs — admin-only upsert. SEC-13: gated by EVENTS_MANAGE (only
  // admins hold it) for consistency with the rest of the app's write paths; the
  // inline role check is kept as defense in depth. READ stays open to coaches.
  @Post()
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
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
