import { Injectable } from '@nestjs/common';
import type { Prisma, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  isEventReadOnly,
  isRegistrationMutableLifecycle,
} from '../events/lifecycle-rules';
import { ALLOWED_STATUS_TRANSITIONS } from './registrations.service';

// Only the three "decision" outcomes are reachable in bulk. We deliberately
// don't allow bulk PENDING/SUBMITTED — those should be exceptional and per-row.
const ADMIN_BULK_STATUSES: RegistrationStatus[] = [
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
];

// Per-row outcome row in the bulk response — lets the UI render a partial-
// success table ("23 updated, 4 skipped, 1 failed"). Mutually exclusive
// outcome enum with an optional errorCode for the SKIPPED/FAILED rows.
export interface BulkStatusResultRow {
  registrationId: string;
  outcome: 'UPDATED' | 'SKIPPED' | 'FAILED';
  errorCode?: string;
}

// Top-level bulk response. The three counters add up to requestedCount
// (after de-duplication of input ids).
export interface BulkStatusResponse {
  requestedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  results: BulkStatusResultRow[];
}

// Admin-only bulk status changes. Designed to do constant DB work regardless
// of input size: 1 read for all rows, then 1 updateMany + 1 createMany inside
// a single transaction. The per-row guards live in JS over the read result —
// each row produces a result outcome (UPDATED / SKIPPED / FAILED).
@Injectable()
export class RegistrationBulkStatusService {
  constructor(private readonly prisma: PrismaService) {}

  // Apply `newStatus` to every reachable registration in `registrationIds`.
  // Guards per row, in order:
  //   - row missing → FAILED REGISTRATION_NOT_FOUND
  //   - already in target status → SKIPPED ALREADY_IN_TARGET_STATUS
  //   - event is read-only → FAILED EVENT_READ_ONLY
  //   - transition is indirect AND lifecycle is locked AND no reason →
  //       FAILED OVERRIDE_REASON_REQUIRED
  // Surviving rows are updated + audited in one tx. Throws BULK_STATUS_NOT_ALLOWED
  // up-front if `newStatus` isn't one of the three admin-permitted targets.
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
      select: {
        id: true,
        status: true,
        event: { select: { id: true, lifecycle: true } },
      },
    });

    const existingById = new Map(existing.map((r) => [r.id, r]));

    const results: BulkStatusResultRow[] = [];
    const toUpdateIds: string[] = [];
    const auditRows: Prisma.AuditLogCreateManyInput[] = [];

    for (const registrationId of uniqueIds) {
      const reg = existingById.get(registrationId);

      if (!reg) {
        results.push({
          registrationId,
          outcome: 'FAILED',
          errorCode: 'REGISTRATION_NOT_FOUND',
        });
        continue;
      }

      if (reg.status === input.newStatus) {
        results.push({
          registrationId,
          outcome: 'SKIPPED',
          errorCode: 'ALREADY_IN_TARGET_STATUS',
        });
        continue;
      }

      const lifecycle = reg.event.lifecycle;
      if (isEventReadOnly(lifecycle)) {
        results.push({
          registrationId,
          outcome: 'FAILED',
          errorCode: 'EVENT_READ_ONLY',
        });
        continue;
      }

      const allowed = ALLOWED_STATUS_TRANSITIONS[reg.status] ?? [];
      const isDirect = allowed.includes(input.newStatus);
      const mutable = isRegistrationMutableLifecycle(lifecycle);

      // BF-8: mirror the single-row rule (registrations.service.setStatus). An
      // indirect transition (not in the transition table, e.g. WITHDRAWN→
      // APPROVED) OR any change once the lifecycle is no longer registration-
      // mutable requires an explicit override reason — regardless of stage.
      // Previously an indirect transition during REG_OPEN (mutable) slipped
      // through with no reason and no override flag.
      const requiresOverride = !isDirect || !mutable;
      if (requiresOverride && !input.reason) {
        results.push({
          registrationId,
          outcome: 'FAILED',
          errorCode: 'OVERRIDE_REASON_REQUIRED',
        });
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
        before: {
          id: reg.id,
          status: reg.status,
        } as unknown as Prisma.InputJsonValue,
        after: {
          id: reg.id,
          status: input.newStatus,
        } as unknown as Prisma.InputJsonValue,
        reason: input.reason ?? null,
        override: requiresOverride,
      });
    }

    if (toUpdateIds.length > 0) {
      // BF-13: guard each write with `status = <observed status>` so a row that
      // was changed concurrently (between our read and this write) becomes a
      // no-op instead of a silent lost update. Group ids by the status we read
      // so each updateMany carries the right expected-status guard. Still a
      // bounded number of statements (≤ number of distinct source statuses + 1).
      const idsByExpectedStatus = new Map<RegistrationStatus, string[]>();
      for (const id of toUpdateIds) {
        const reg = existingById.get(id)!;
        const bucket = idsByExpectedStatus.get(reg.status) ?? [];
        bucket.push(id);
        idsByExpectedStatus.set(reg.status, bucket);
      }

      const writes: Prisma.PrismaPromise<unknown>[] = [];
      for (const [expectedStatus, ids] of idsByExpectedStatus) {
        writes.push(
          this.prisma.registration.updateMany({
            where: {
              id: { in: ids },
              organisationId: input.organisationId,
              status: expectedStatus,
            },
            data: { status: input.newStatus },
          }),
        );
      }
      writes.push(this.prisma.auditLog.createMany({ data: auditRows }));
      await this.prisma.$transaction(writes);
    }

    const updatedCount = results.filter((r) => r.outcome === 'UPDATED').length;
    const skippedCount = results.filter((r) => r.outcome === 'SKIPPED').length;
    const failedCount = results.filter((r) => r.outcome === 'FAILED').length;

    return {
      requestedCount: uniqueIds.length,
      updatedCount,
      skippedCount,
      failedCount,
      results,
    };
  }
}
