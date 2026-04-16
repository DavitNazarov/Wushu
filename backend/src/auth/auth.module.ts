import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthUserService } from './auth-user.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { CapabilityGuard } from './capability.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { RefreshTokenCleanupService } from './refresh-token-cleanup.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthUserService,
    AuthGuard,
    CapabilityGuard,
    RefreshTokenCleanupService,
  ],
  exports: [AuthService, AuthUserService, AuthGuard, CapabilityGuard],
})
export class AuthModule {}
