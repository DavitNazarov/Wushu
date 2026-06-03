import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

// Users module: admin-only management of the User table (admins, coaches,
// judges, timekeepers). AuthModule is imported so the guard decorators on
// UsersController can resolve. UsersService is exported because AuthModule
// itself needs to look up users during login/me lookups.
@Module({
  imports: [PrismaModule, AuthModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
