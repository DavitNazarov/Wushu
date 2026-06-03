import { Module } from '@nestjs/common';
import { DrawService } from './draw.service';
import { DrawController } from './draw.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { DrawReadinessService } from './draw.readiness.service';
import { DrawReadinessQueryService } from './draw.readiness.queries';
import { BracketsService } from './brackets.service';

// Draw module: bracket generation + readiness preflight + bracket reads.
//   - DrawService            : runs the actual draw algorithm
//   - DrawReadinessService   : "can we draw yet?" preflight (categories ready,
//                              weigh-ins complete enough, no orphan regs).
//   - DrawReadinessQueryService: split-out reader used by readiness so the
//                              data-fetching layer can be tested separately.
//   - BracketsService        : read endpoints for already-drawn brackets +
//                              fight tree, consumed by fights/schedule modules.
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
