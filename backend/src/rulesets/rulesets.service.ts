import type { Prisma, RulesetStatus } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

@Injectable()
export class RulesetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organisationId: string | null) {
    return this.prisma.ruleset.findMany({
      where: { organisationId: organisationId ?? undefined },
      orderBy: [{ organisationId: 'asc' }, { name: 'asc' }, { version: 'desc' }],
    });
  }

  async create(input: {
    organisationId: string | null;
    name: string;
    definition: unknown;
    status?: RulesetStatus;
    actorUserId?: string | null;
  }) {
    const last = await this.prisma.ruleset.findFirst({
      where: { organisationId: input.organisationId ?? undefined, name: input.name },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.ruleset.create({
        data: {
          organisationId: input.organisationId ?? undefined,
          name: input.name,
          version: nextVersion,
          status: input.status ?? 'DRAFT',
          definition: input.definition as Prisma.InputJsonValue,
        },
      });

      await this.audit.write({
        organisationId: input.organisationId ?? '',
        actorUserId: input.actorUserId ?? null,
        action: 'RULESET_CREATED',
        entityType: 'ruleset',
        entityId: created.id,
        before: null,
        after: created as unknown as Prisma.JsonValue,
      });

      return created;
    });
  }
}
