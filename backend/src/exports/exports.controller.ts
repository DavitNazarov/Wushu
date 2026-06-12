import {
  Body,
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import { ExportsService, type ExportType } from './exports.service';
import { PdfExportService } from './pdf/pdf-export.service';
import type { Lang } from './pdf/pdf-i18n';

function normLang(lang?: string): Lang {
  return lang === 'ka' ? 'ka' : 'en';
}

@Controller('exports')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.EXPORTS_MANAGE)
export class ExportsController {
  constructor(
    private readonly exportsService: ExportsService,
    private readonly pdfExport: PdfExportService,
  ) {}

  // ── One-click PDF exports ──────────────────────────────────────────────────
  // Each streams a freshly-rendered PDF (live data) as a download. Guarded by
  // EXPORTS_MANAGE + org-scoped via the JWT, same as the rest of this module.

  @Get(':eventId/results.pdf')
  async resultsPdf(
    @Param('eventId') eventId: string,
    @Query('lang') lang: string,
    @Query('templateId') templateId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    // The head-judge signature template is required for the results protocols.
    if (!templateId) {
      throw new HttpException(
        {
          message: 'SIGNATURE_TEMPLATE_REQUIRED',
          code: 'SIGNATURE_TEMPLATE_REQUIRED',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const l = normLang(lang);
    await this.streamPdf(res, `results-${l}.pdf`, () =>
      this.pdfExport.generateResultsPdf(
        req.auth!.organisationId,
        eventId,
        l,
        templateId,
      ),
    );
  }

  @Get(':eventId/schedule.pdf')
  async schedulePdf(
    @Param('eventId') eventId: string,
    @Query('lang') lang: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const l = normLang(lang);
    await this.streamPdf(res, `schedule-${l}.pdf`, () =>
      this.pdfExport.generateSchedulePdf(req.auth!.organisationId, eventId, l),
    );
  }

  @Get(':eventId/weighin.pdf')
  async weighinPdf(
    @Param('eventId') eventId: string,
    @Query('lang') lang: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const l = normLang(lang);
    await this.streamPdf(res, `weighin-${l}.pdf`, () =>
      this.pdfExport.generateWeighinPdf(req.auth!.organisationId, eventId, l),
    );
  }

  // Render the PDF first (so a thrown error maps to a clean HTTP status before
  // any bytes are written), then stream the buffer as an attachment.
  private async streamPdf(
    res: Response,
    filename: string,
    make: () => Promise<Buffer>,
  ): Promise<void> {
    let buffer: Buffer;
    try {
      buffer = await make();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'EVENT_NOT_FOUND') throw new NotFoundException('EVENT_NOT_FOUND');
      if (msg === 'SIGNATURE_TEMPLATE_NOT_FOUND') {
        throw new NotFoundException('SIGNATURE_TEMPLATE_NOT_FOUND');
      }
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        'PDF_GENERATION_FAILED',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
    });
    res.end(buffer);
  }

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
