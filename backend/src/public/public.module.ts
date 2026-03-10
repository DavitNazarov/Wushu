import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { ClubsModule } from '../clubs/clubs.module';
import { DrawModule } from '../draw/draw.module';
import { ScheduleModule } from '../schedule/schedule.module';

@Module({
  imports: [PrismaModule, EventsModule, ClubsModule, DrawModule, ScheduleModule],
  controllers: [PublicController],
  exports: [],
})
export class PublicModule {}
