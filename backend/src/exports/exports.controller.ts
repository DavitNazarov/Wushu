import {
  Body,
  Controller,
  Get,
  Header,
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
import { ExportsService, type ExportType } from './exports.service';

@Controller('exports')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.EXPORTS_MANAGE)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post()
  async generate(
    @Req() req: AuthenticatedRequest,
    @Body() body: { eventId?: string; types?: ExportType[] },
  ) {
    if (!body.eventId)
      throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);
    if (!Array.isArray(body.types) || body.types.length === 0) {
      throw new HttpException('types_REQUIRED', HttpStatus.BAD_REQUEST);
    }

    const types = Array.from(new Set(body.types));
    const allowed: ExportType[] = [
      'registrations',
      'brackets',
      'schedule',
      'results',
    ];
    if (!types.every((type) => allowed.includes(type))) {
      throw new HttpException('INVALID_EXPORT_TYPE', HttpStatus.BAD_REQUEST);
    }

    try {
      const links = await this.exportsService.generate({
        organisationId: req.auth!.organisationId,
        eventId: body.eventId,
        actorUserId: req.auth!.sub,
        types,
      });
      return { links };
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

  @Get(':id/download')
  @Header('Content-Type', 'application/json; charset=utf-8')
  async download(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    // Verify the export belongs to the requesting user's organisation before
    // serving the file — prevents cross-org IDOR even with a known UUID.
    const owned = await this.exportsService.verifyExportOwnership(
      id,
      req.auth!.organisationId,
    );
    if (!owned) {
      throw new HttpException('EXPORT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    try {
      const raw = await this.exportsService.readExportFile(id);
      return JSON.parse(raw) as unknown;
    } catch {
      throw new HttpException('EXPORT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
  }
}
