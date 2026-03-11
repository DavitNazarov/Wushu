import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { AthletesService } from './athletes.service';
import { AthletesController } from './athletes.controller';
import { AthleteProfileService } from './athlete-profile.service';

@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  providers: [AthletesService, AthleteProfileService],
  controllers: [AthletesController],
  exports: [AthleteProfileService],
})
export class AthletesModule {}
