import { Module } from '@nestjs/common';
import { WeighinService } from './weighin.service';
import { WeighinController } from './weighin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WeighinController],
  providers: [WeighinService],
  exports: [WeighinService],
})
export class WeighinModule {}
