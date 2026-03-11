import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { ClubsModule } from '../clubs/clubs.module';
import { DrawModule } from '../draw/draw.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { AthletesModule } from '../athletes/athletes.module';

@Module({
  imports: [PrismaModule, EventsModule, ClubsModule, DrawModule, ScheduleModule, AthletesModule],
  controllers: [PublicController],
  exports: [],
})
export class PublicModule {}
