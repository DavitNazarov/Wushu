import { Module } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { RegistrationsController } from './registrations.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RegistrationBulkStatusService } from './registration-bulk-status.service';
import { RegistrationsBulkController } from './registrations-bulk.controller';

// Registrations module: athlete-to-event entry workflow.
// Two controllers because the bulk-status endpoint deals in arrays of ids
// and has a meaningfully different request shape — keeping them apart makes
// the routing surface and Zod schemas easier to follow.
//   - RegistrationsController:    single-registration CRUD
//   - RegistrationsBulkController: bulk approve/reject/withdraw
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RegistrationsController, RegistrationsBulkController],
  providers: [RegistrationsService, RegistrationBulkStatusService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
