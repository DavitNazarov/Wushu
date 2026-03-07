import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { ClubsModule } from '../clubs/clubs.module';

@Module({
  imports: [PrismaModule, EventsModule, ClubsModule],
  controllers: [PublicController],
  exports: [],
})
export class PublicModule {}
