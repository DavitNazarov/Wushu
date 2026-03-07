import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { AthletesService } from './athletes.service';
import { AthletesController } from './athletes.controller';

@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  providers: [AthletesService],
  controllers: [AthletesController],
})
export class AthletesModule {}
