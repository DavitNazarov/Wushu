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
  override?: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type AuditClient = Pick<PrismaService, 'auditLog'> | Prisma.TransactionClient;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(params: AuditParams, tx?: AuditClient): Promise<void> {
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
      override,
      ipAddress,
      userAgent,
    } = params;

    const client = tx ?? this.prisma;
    await client.auditLog.create({
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
        override: override ?? false,
        ipAddress: ipAddress ?? undefined,
        userAgent: userAgent ?? undefined,
      },
    });
  }
}
