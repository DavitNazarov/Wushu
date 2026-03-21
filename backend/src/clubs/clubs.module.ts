import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { ClubsService } from './clubs.service';
import { ClubsController } from './clubs.controller';
import { ClubDetailsService } from './club-details.service';

@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  providers: [ClubsService, ClubDetailsService],
  controllers: [ClubsController],
  exports: [ClubsService],
})
export class ClubsModule {}
