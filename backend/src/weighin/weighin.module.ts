import { Module } from '@nestjs/common';
import { WeighinService } from './weighin.service';
import { WeighinController } from './weighin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WeighinPreviewService } from './weighin-preview.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, AuthModule, EventsModule],
  controllers: [WeighinController],
  providers: [WeighinService, WeighinPreviewService],
  exports: [WeighinService],
})
export class WeighinModule {}
