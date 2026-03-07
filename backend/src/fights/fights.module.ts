import { Module } from '@nestjs/common';
import { FightsService } from './fights.service';
import { FightsController } from './fights.controller';
import { FightsGateway } from './fights.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FightsController],
  providers: [FightsService, FightsGateway],
  exports: [FightsService, FightsGateway],
})
export class FightsModule {}
