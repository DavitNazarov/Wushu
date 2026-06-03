import { Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { FightsModule } from '../fights/fights.module';

// Schedule module: builds and serves the per-mat fight running order.
// Imports FightsModule because ScheduleService and the gateway poke fight
// state when sessions are auto-built. Exports ScheduleService so the public
// + live displays can render the schedule too.
@Module({
  imports: [PrismaModule, AuthModule, FightsModule],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
