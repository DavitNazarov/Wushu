import { Module } from '@nestjs/common';
import { DrawService } from './draw.service';
import { DrawController } from './draw.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { DrawReadinessService } from './draw.readiness.service';
import { DrawReadinessQueryService } from './draw.readiness.queries';
import { BracketsService } from './brackets.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DrawController],
  providers: [
    DrawService,
    DrawReadinessService,
    DrawReadinessQueryService,
    BracketsService,
  ],
  exports: [DrawService, DrawReadinessService, BracketsService],
})
export class DrawModule {}
