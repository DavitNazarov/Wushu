import { Injectable } from '@nestjs/common';
import type { Prisma, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isEventReadOnly, isRegistrationMutableLifecycle } from '../events/lifecycle-rules';
import { ALLOWED_STATUS_TRANSITIONS } from './registrations.service';

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
  constructor(private readonly prisma: PrismaService) {}

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

    // Single query: fetch all registrations + event lifecycle
    const existing = await this.prisma.registration.findMany({
      where: { organisationId: input.organisationId, id: { in: uniqueIds } },
      select: { id: true, status: true, event: { select: { id: true, lifecycle: true } } },
    });

    const existingById = new Map(existing.map((r) => [r.id, r]));

    const results: BulkStatusResultRow[] = [];
    const toUpdateIds: string[] = [];
    const auditRows: Prisma.AuditLogCreateManyInput[] = [];

    for (const registrationId of uniqueIds) {
      const reg = existingById.get(registrationId);

      if (!reg) {
        results.push({ registrationId, outcome: 'FAILED', errorCode: 'REGISTRATION_NOT_FOUND' });
        continue;
      }

      if (reg.status === input.newStatus) {
        results.push({ registrationId, outcome: 'SKIPPED', errorCode: 'ALREADY_IN_TARGET_STATUS' });
        continue;
      }

      const lifecycle = reg.event.lifecycle;
      if (isEventReadOnly(lifecycle)) {
        results.push({ registrationId, outcome: 'FAILED', errorCode: 'EVENT_READ_ONLY' });
        continue;
      }

      const allowed = ALLOWED_STATUS_TRANSITIONS[reg.status] ?? [];
      const isDirect = allowed.includes(input.newStatus);
      const mutable = isRegistrationMutableLifecycle(lifecycle);

      if (!isDirect && !mutable && !input.reason) {
        results.push({ registrationId, outcome: 'FAILED', errorCode: 'OVERRIDE_REASON_REQUIRED' });
        continue;
      }

      toUpdateIds.push(registrationId);
      results.push({ registrationId, outcome: 'UPDATED' });

      auditRows.push({
        organisationId: input.organisationId,
        eventId: reg.event.id,
        actorUserId: input.actorUserId,
        action: 'REGISTRATION_STATUS_CHANGED',
        entityType: 'registration',
        entityId: registrationId,
        before: { id: reg.id, status: reg.status } as unknown as Prisma.InputJsonValue,
        after: { id: reg.id, status: input.newStatus } as unknown as Prisma.InputJsonValue,
        reason: input.reason ?? null,
        override: !isDirect || !mutable,
      });
    }

    if (toUpdateIds.length > 0) {
      // Two queries total regardless of count: updateMany + createMany
      await this.prisma.$transaction([
        this.prisma.registration.updateMany({
          where: { id: { in: toUpdateIds } },
          data: { status: input.newStatus },
        }),
        this.prisma.auditLog.createMany({ data: auditRows }),
      ]);
    }

    const updatedCount = results.filter((r) => r.outcome === 'UPDATED').length;
    const skippedCount = results.filter((r) => r.outcome === 'SKIPPED').length;
    const failedCount = results.filter((r) => r.outcome === 'FAILED').length;

    return { requestedCount: uniqueIds.length, updatedCount, skippedCount, failedCount, results };
  }
}
