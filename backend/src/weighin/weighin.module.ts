import { Module } from '@nestjs/common';
import { WeighinService } from './weighin.service';
import { WeighinController } from './weighin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WeighinPreviewService } from './weighin-preview.service';
import { EventsModule } from '../events/events.module';

// Weigh-in module: admin/judge workflow for recording each athlete's actual
// weight on the day of the event.
//   - WeighinService: record + decide PASS/FAIL/MOVE_UP/REWEIGH per attempt.
//   - WeighinPreviewService: read-only "what would happen if?" for the UI
//     so a judge can see consequences (moved category, late) before committing.
// EventsModule is imported to read event policies (weigh-in window, reweigh
// cap, IWUF-strict rules) that drive both services.
@Module({
  imports: [PrismaModule, AuthModule, EventsModule],
  controllers: [WeighinController],
  providers: [WeighinService, WeighinPreviewService],
  exports: [WeighinService],
})
export class WeighinModule {}
