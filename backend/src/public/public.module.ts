import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicCompetitionController } from './public-competition.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { ClubsModule } from '../clubs/clubs.module';
import { DrawModule } from '../draw/draw.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { AthletesModule } from '../athletes/athletes.module';
import { FightsModule } from '../fights/fights.module';
import { PublicResultsService } from './public-results.service';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    ClubsModule,
    DrawModule,
    ScheduleModule,
    AthletesModule,
    FightsModule,
  ],
  controllers: [PublicController, PublicCompetitionController],
  providers: [PublicResultsService],
  exports: [],
})
export class PublicModule {}
