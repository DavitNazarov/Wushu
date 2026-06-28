import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { CoachesService } from './coaches.service';
import { CoachesController } from './coaches.controller';

// Coaches module: roster CRUD for the Club → Coach → Athlete layer.
@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  providers: [CoachesService],
  controllers: [CoachesController],
  exports: [CoachesService],
})
export class CoachesModule {}
