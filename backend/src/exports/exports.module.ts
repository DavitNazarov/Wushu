import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import { ExportsCleanupService } from './exports-cleanup.service';
import { AuthModule } from '../auth/auth.module';
import { DrawModule } from '../draw/draw.module';
import { ResultsModule } from '../results/results.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { SignatureTemplatesModule } from '../signature-templates/signature-templates.module';
import { PdfRenderService } from './pdf/pdf-render.service';
import { PdfExportService } from './pdf/pdf-export.service';

@Module({
  // DrawModule / ResultsModule / ScheduleModule supply the read services the
  // PDF assembler reuses (BracketsService, ResultsService, ScheduleService);
  // SignatureTemplatesModule supplies the head-judge signature for protocols.
  imports: [
    AuthModule,
    DrawModule,
    ResultsModule,
    ScheduleModule,
    SignatureTemplatesModule,
  ],
  controllers: [ExportsController],
  providers: [
    ExportsService,
    ExportsCleanupService,
    PdfRenderService,
    PdfExportService,
  ],
})
export class ExportsModule {}
