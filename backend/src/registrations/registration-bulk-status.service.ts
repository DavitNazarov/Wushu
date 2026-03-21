import { Injectable } from '@nestjs/common';
import type { RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrationsService } from './registrations.service';

const ADMIN_BULK_STATUSES: RegistrationStatus[] = [
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
];

export interface BulkStatusResultRow {
  registrationId: string;
  outcome: 'UPDATED' | 'SKIPPED' | 'FAILED';
  errorCode?: string;
}

export interface BulkStatusResponse {
  requestedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  results: BulkStatusResultRow[];
}

@Injectable()
export class RegistrationBulkStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registrations: RegistrationsService,
  ) {}

  async setStatus(input: {
    organisationId: string;
    registrationIds: string[];
    actorUserId: string;
    newStatus: RegistrationStatus;
    reason?: string | null;
  }): Promise<BulkStatusResponse> {
    if (!ADMIN_BULK_STATUSES.includes(input.newStatus)) {
      throw new Error('BULK_STATUS_NOT_ALLOWED');
    }

    const uniqueIds = [...new Set(input.registrationIds)];
    const existing = await this.prisma.registration.findMany({
      where: {
        organisationId: input.organisationId,
        id: { in: uniqueIds },
      },
      select: {
        id: true,
        status: true,
      },
    });

    const existingById = new Map(existing.map((registration) => [registration.id, registration]));
    const results: BulkStatusResultRow[] = [];

    for (const registrationId of uniqueIds) {
      const registration = existingById.get(registrationId);
      if (!registration) {
        results.push({
          registrationId,
          outcome: 'FAILED',
          errorCode: 'REGISTRATION_NOT_FOUND',
        });
        continue;
      }

      if (registration.status === input.newStatus) {
        results.push({
          registrationId,
          outcome: 'SKIPPED',
          errorCode: 'ALREADY_IN_TARGET_STATUS',
        });
        continue;
      }

      try {
        await this.registrations.setStatus({
          organisationId: input.organisationId,
          registrationId,
          actorUserId: input.actorUserId,
          newStatus: input.newStatus,
          reason: input.reason ?? null,
        });
        results.push({
          registrationId,
          outcome: 'UPDATED',
        });
      } catch (error) {
        results.push({
          registrationId,
          outcome: 'FAILED',
          errorCode: error instanceof Error ? error.message : 'UNKNOWN',
        });
      }
    }

    const updatedCount = results.filter((result) => result.outcome === 'UPDATED').length;
    const skippedCount = results.filter((result) => result.outcome === 'SKIPPED').length;
    const failedCount = results.filter((result) => result.outcome === 'FAILED').length;

    return {
      requestedCount: uniqueIds.length,
      updatedCount,
      skippedCount,
      failedCount,
      results,
    };
  }
}
