import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { CapabilityGuard } from './capability.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, CapabilityGuard],
  exports: [AuthService, AuthGuard, CapabilityGuard],
})
export class AuthModule {}
