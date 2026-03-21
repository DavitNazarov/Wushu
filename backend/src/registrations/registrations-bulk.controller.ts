import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RegistrationStatus } from '@prisma/client';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import { RegistrationBulkStatusService } from './registration-bulk-status.service';

const ALLOWED_BULK_STATUSES: RegistrationStatus[] = [
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
];

@Controller('registrations')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
export class RegistrationsBulkController {
  constructor(private readonly bulkStatus: RegistrationBulkStatusService) {}

  @Post('bulk-status')
  async setBulkStatus(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      registrationIds?: string[];
      status?: string;
      reason?: string;
    },
  ) {
    const auth = req.auth!;

    if (auth.role !== 'admin') {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }

    if (
      !Array.isArray(body.registrationIds) ||
      body.registrationIds.length === 0 ||
      !body.registrationIds.every(
        (registrationId) =>
          typeof registrationId === 'string' && registrationId.trim().length > 0,
      )
    ) {
      throw new HttpException(
        'VALIDATION_ERROR: registrationIds must be a non-empty string array',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      !body.status ||
      !ALLOWED_BULK_STATUSES.includes(body.status as RegistrationStatus)
    ) {
      throw new HttpException(
        'VALIDATION_ERROR: invalid bulk status',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.bulkStatus.setStatus({
      organisationId: auth.organisationId,
      registrationIds: body.registrationIds,
      actorUserId: auth.sub,
      newStatus: body.status as RegistrationStatus,
      reason: body.reason?.trim() || null,
    });
  }
}
