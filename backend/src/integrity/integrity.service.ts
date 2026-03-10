import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

export type IntegrityIssue = {
  code: string;
  count: number;
  sampleIds: string[];
};

@Injectable()
export class IntegrityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async checkIssues(
    organisationId: string,
    eventId: string,
  ): Promise<IntegrityIssue[]> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organisationId },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    const registrations = await this.prisma.registration.findMany({
      where: { organisationId, eventId },
      include: {
        athlete: true,
        weighIns: { orderBy: { attemptNo: 'desc' }, take: 1 },
      },
    });

    const issues: IntegrityIssue[] = [];

    const missingCategory = registrations.filter(
      (r) => !r.categoryCode?.trim(),
    );
    if (missingCategory.length > 0) {
      issues.push({
        code: 'MISSING_CATEGORY',
        count: missingCategory.length,
        sampleIds: missingCategory.slice(0, 5).map((r) => r.id),
      });
    }

    const missingDob = registrations.filter((r) => !r.athlete.dateOfBirth);
    if (missingDob.length > 0) {
      issues.push({
        code: 'MISSING_DOB',
        count: missingDob.length,
        sampleIds: missingDob.slice(0, 5).map((r) => r.athleteId),
      });
    }

    const duplicateMap = new Map<string, string[]>();
    for (const r of registrations) {
      const a = r.athlete;
      if (!a.dateOfBirth) continue;
      const key = `${a.firstName.toLowerCase()}:${a.lastName.toLowerCase()}:${a.dateOfBirth.toISOString().slice(0, 10)}`;
      if (!duplicateMap.has(key)) duplicateMap.set(key, []);
      duplicateMap.get(key)!.push(r.athleteId);
    }

    const duplicates: string[] = [];
    for (const [, ids] of duplicateMap) {
      if (ids.length > 1) duplicates.push(...ids);
    }
    const uniqueDuplicates = [...new Set(duplicates)];
    if (uniqueDuplicates.length > 0) {
      issues.push({
        code: 'DUPLICATE_ATHLETE',
        count: uniqueDuplicates.length,
        sampleIds: uniqueDuplicates.slice(0, 5),
      });
    }

    const failWeighins = registrations.filter(
      (r) =>
        r.weighInStatus === 'FAILED' ||
        r.weighInStatus === 'DISQUALIFIED' ||
        r.weighIns[0]?.decision === 'FAIL',
    );
    if (failWeighins.length > 0) {
      issues.push({
        code: 'UNRESOLVED_FAIL_WEIGHIN',
        count: failWeighins.length,
        sampleIds: failWeighins.slice(0, 5).map((r) => r.id),
      });
    }

    const pendingWeighIn = registrations.filter((r) => {
      if (r.status === 'REJECTED' || r.status === 'WITHDRAWN') return false;
      return (
        r.weighInStatus === 'NOT_WEIGHED' ||
        r.weighInStatus === 'REWEIGH_ALLOWED'
      );
    });
    if (pendingWeighIn.length > 0) {
      issues.push({
        code: 'WEIGHIN_NOT_FINALIZED',
        count: pendingWeighIn.length,
        sampleIds: pendingWeighIn.slice(0, 5).map((r) => r.id),
      });
    }

    const unresolvedOneHour = registrations.filter(
      (r) =>
        r.weighIns[0]?.decision === 'ONE_HOUR' && !r.weighIns[0]?.resolvedAt,
    );
    if (unresolvedOneHour.length > 0) {
      issues.push({
        code: 'ONE_HOUR_UNRESOLVED',
        count: unresolvedOneHour.length,
        sampleIds: unresolvedOneHour.slice(0, 5).map((r) => r.id),
      });
    }

    return issues;
  }

  async lock(input: {
    organisationId: string;
    eventId: string;
    actorUserId: string;
    override?: boolean;
    reason?: string | null;
  }) {
    const event = await this.prisma.event.findFirst({
      where: { id: input.eventId, organisationId: input.organisationId },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    if (event.lifecycle !== 'WEIGHIN' && !input.override) {
      throw new Error('EVENT_NOT_IN_WEIGHIN');
    }

    if (event.lifecycle === 'LOCKED') throw new Error('EVENT_ALREADY_LOCKED');

    const issues = await this.checkIssues(input.organisationId, input.eventId);
    if (issues.length > 0 && !input.override) {
      throw new Error('INTEGRITY_ISSUES_EXIST');
    }

    if (input.override && !input.reason) {
      throw new Error('OVERRIDE_REASON_REQUIRED');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.event.update({
        where: { id: input.eventId },
        data: { lifecycle: 'LOCKED' },
      });

      await this.audit.write({
        organisationId: input.organisationId,
        eventId: input.eventId,
        actorUserId: input.actorUserId,
        action: 'REGISTRATION_LOCKED',
        entityType: 'event',
        entityId: input.eventId,
        before: event as unknown as Prisma.JsonValue,
        after: result as unknown as Prisma.JsonValue,
        reason: input.reason ?? null,
        override: input.override ?? false,
      });

      return result;
    });

    return { event: updated, issues };
  }
}
