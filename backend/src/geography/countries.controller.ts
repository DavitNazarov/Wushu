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
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import { CountriesService } from './countries.service';
import { upsertCountrySchema } from './geography.schemas';

// Admin/coach country routes at `/api/countries`. GETs are open to coaches
// (ATHLETES_MANAGE) so the club/athlete forms can populate their country
// pickers; writes are admin-only (EVENTS_MANAGE + inline role check), matching
// the clubs controller convention.
@Controller('countries')
@UseGuards(AuthGuard, CapabilityGuard)
export class CountriesController {
  constructor(private readonly countries: CountriesService) {}

  @Get()
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  list(@Req() req: AuthenticatedRequest) {
    return this.countries.list(req.auth!.organisationId);
  }

  @Get(':id')
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  async getById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const detail = await this.countries.getById(req.auth!.organisationId, id);
    if (!detail) {
      throw new HttpException(
        { code: 'COUNTRY_NOT_FOUND', message: 'Country not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    return detail;
  }

  @Post()
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async upsert(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;
    if (auth.role !== 'admin') {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }

    const parsed = upsertCountrySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid country payload',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    return this.countries.upsert({
      organisationId: auth.organisationId,
      actorUserId: auth.sub,
      id: parsed.data.id,
      name: parsed.data.name,
      nameKa: parsed.data.nameKa ?? null,
      code: parsed.data.code ?? null,
    });
  }

  @Delete(':id')
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const auth = req.auth!;
    if (auth.role !== 'admin') {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
    await this.countries.remove(auth.organisationId, auth.sub, id);
    return { ok: true };
  }
}
