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

// PENDING/SUBMITTED aren't valid bulk targets — moving a stack of regs back
// to a draft state would be a footgun. Only the three "decision" outcomes
// are reachable via the bulk endpoint.
const ALLOWED_BULK_STATUSES: RegistrationStatus[] = [
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
];

// Admin-only bulk operations on registrations. Mounted under the same
// `/api/registrations` prefix as the single-row controller but kept in its
// own class so the request shape (array of ids) and admin-only gating
// stay obvious.
@Controller('registrations')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
export class RegistrationsBulkController {
  constructor(private readonly bulkStatus: RegistrationBulkStatusService) {}

  // POST /api/registrations/bulk-status — flip many registrations at once.
  // Hand-validates the body (rather than Zod) because the shape is small
  // and the controller is admin-only. Forbids non-admin callers explicitly
  // even though the capability already excludes them — defense in depth
  // since coaches do hold ATHLETES_MANAGE for the single-row endpoints.
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
          typeof registrationId === 'string' &&
          registrationId.trim().length > 0,
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
