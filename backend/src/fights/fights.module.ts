import { Module } from '@nestjs/common';
import { FightsService } from './fights.service';
import { FightsController } from './fights.controller';
import { FightsGateway } from './fights.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { FightTimerAutomationService } from './fight-timer.automation.service';

// Fights module: judging + timer + per-fight real-time updates.
//   - FightsService: scoring, win method, status transitions.
//   - FightsGateway: socket.io gateway that pushes fight/schedule changes.
//   - FightTimerAutomationService: cron tick that progresses RUNNING timers
//     and auto-pauses at round-end.
// Exports FightsService + FightsGateway because schedule/ posts socket
// events through them too.
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FightsController],
  providers: [FightsService, FightsGateway, FightTimerAutomationService],
  exports: [FightsService, FightsGateway],
})
export class FightsModule {}
