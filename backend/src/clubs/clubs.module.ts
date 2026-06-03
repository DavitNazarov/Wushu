import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { ClubsService } from './clubs.service';
import { ClubsController } from './clubs.controller';
import { ClubDetailsService } from './club-details.service';

// Clubs module: admin CRUD for clubs + a read-only ClubDetailsService that
// builds the public club page (roster, coaches, recent events).
// ClubsService is exported because UsersService needs to validate clubIds
// when assigning a coach to a club.
@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  providers: [ClubsService, ClubDetailsService],
  controllers: [ClubsController],
  exports: [ClubsService],
})
export class ClubsModule {}
