import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

type AuditParams = {
  organisationId: string;
  eventId?: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Prisma.JsonValue | null;
  after?: Prisma.JsonValue | null;
  reason?: string | null;
  ipAddress?: string | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(params: AuditParams): Promise<void> {
    const {
      organisationId,
      eventId,
      actorUserId,
      action,
      entityType,
      entityId,
      before,
      after,
      reason,
      ipAddress,
    } = params;

    await this.prisma.auditLog.create({
      data: {
        organisationId,
        eventId,
        actorUserId: actorUserId ?? undefined,
        action,
        entityType,
        entityId,
        before: before ?? undefined,
        after: after ?? undefined,
        reason: reason ?? undefined,
        ipAddress: ipAddress ?? undefined,
      },
    });
  }
}
