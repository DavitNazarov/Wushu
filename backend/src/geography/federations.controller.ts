import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import { FederationsService } from './federations.service';
import { upsertFederationSchema } from './geography.schemas';

// Admin/coach federation routes at `/api/federations`. Reads open to coaches
// (cascading picker, optionally filtered by `?cityId=`); writes are admin-only.
@Controller('federations')
@UseGuards(AuthGuard, CapabilityGuard)
export class FederationsController {
  constructor(private readonly federations: FederationsService) {}

  @Get()
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  list(@Req() req: AuthenticatedRequest, @Query('cityId') cityId?: string) {
    return this.federations.list(req.auth!.organisationId, cityId || undefined);
  }

  @Post()
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async upsert(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;
    if (auth.role !== 'admin') {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }

    const parsed = upsertFederationSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid federation payload',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    return this.federations.upsert({
      organisationId: auth.organisationId,
      actorUserId: auth.sub,
      id: parsed.data.id,
      cityId: parsed.data.cityId,
      name: parsed.data.name,
      nameKa: parsed.data.nameKa ?? null,
      isOfficial: parsed.data.isOfficial,
    });
  }

  @Delete(':id')
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const auth = req.auth!;
    if (auth.role !== 'admin') {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
    await this.federations.remove(auth.organisationId, auth.sub, id);
    return { ok: true };
  }
}
