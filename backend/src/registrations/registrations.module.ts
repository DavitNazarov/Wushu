import { Module } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { RegistrationsController } from './registrations.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RegistrationBulkStatusService } from './registration-bulk-status.service';
import { RegistrationsBulkController } from './registrations-bulk.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RegistrationsController, RegistrationsBulkController],
  providers: [RegistrationsService, RegistrationBulkStatusService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
