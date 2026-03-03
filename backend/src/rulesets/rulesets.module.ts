import { Module } from '@nestjs/common';
import { RulesetsService } from './rulesets.service';
import { RulesetsController } from './rulesets.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RulesetsController],
  providers: [RulesetsService],
})
export class RulesetsModule {}
