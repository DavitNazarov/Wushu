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
import { CoachesService } from './coaches.service';
import { upsertCoachSchema } from './coaches.schemas';

// Coach roster routes at `/api/coaches`. Reads open to coaches (cascading
// picker, optionally filtered by `?clubId=`); writes are admin-only.
@Controller('coaches')
@UseGuards(AuthGuard, CapabilityGuard)
export class CoachesController {
  constructor(private readonly coaches: CoachesService) {}

  @Get()
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  list(@Req() req: AuthenticatedRequest, @Query('clubId') clubId?: string) {
    return this.coaches.list(req.auth!.organisationId, clubId || undefined);
  }

  @Post()
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  async upsert(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;
    if (auth.role !== 'admin') {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }

    const parsed = upsertCoachSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid coach payload',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    return this.coaches.upsert({
      organisationId: auth.organisationId,
      actorUserId: auth.sub,
      id: parsed.data.id,
      firstName: parsed.data.firstName,
      firstNameKa: parsed.data.firstNameKa ?? null,
      lastName: parsed.data.lastName ?? '',
      lastNameKa: parsed.data.lastNameKa ?? null,
      nationality: parsed.data.nationality ?? null,
      clubId: parsed.data.clubId ?? null,
    });
  }

  @Delete(':id')
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const auth = req.auth!;
    if (auth.role !== 'admin') {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
    await this.coaches.remove(auth.organisationId, auth.sub, id);
    return { ok: true };
  }
}
