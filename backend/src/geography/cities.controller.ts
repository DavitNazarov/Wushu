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
import { CitiesService } from './cities.service';
import { upsertCitySchema } from './geography.schemas';

// Admin/coach city routes at `/api/cities`. Reads open to coaches (for the
// cascading city picker, optionally filtered by `?countryId=`); writes are
// admin-only.
@Controller('cities')
@UseGuards(AuthGuard, CapabilityGuard)
export class CitiesController {
  constructor(private readonly cities: CitiesService) {}

  @Get()
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  list(
    @Req() req: AuthenticatedRequest,
    @Query('countryId') countryId?: string,
  ) {
    return this.cities.list(req.auth!.organisationId, countryId || undefined);
  }

  @Post()
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async upsert(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;
    if (auth.role !== 'admin') {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }

    const parsed = upsertCitySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid city payload',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    return this.cities.upsert({
      organisationId: auth.organisationId,
      actorUserId: auth.sub,
      id: parsed.data.id,
      countryId: parsed.data.countryId,
      name: parsed.data.name,
      nameKa: parsed.data.nameKa ?? null,
    });
  }

  @Delete(':id')
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const auth = req.auth!;
    if (auth.role !== 'admin') {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
    await this.cities.remove(auth.organisationId, auth.sub, id);
    return { ok: true };
  }
}
