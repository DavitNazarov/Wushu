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
    // Include system-level rulesets (organisationId: null) alongside org-specific ones
    return this.prisma.ruleset.findMany({
      where: {
        OR: [
          { organisationId: organisationId ?? undefined },
          { organisationId: null },
        ],
      },
      orderBy: [
        { organisationId: 'asc' },
        { name: 'asc' },
        { version: 'desc' },
      ],
    });
  }

  async getAgeGroupTree(rulesetId: string) {
    const ageGroups = await this.prisma.rulesetAgeGroup.findMany({
      where: { rulesetId },
      include: {
        weightCategories: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return ageGroups;
  }

  async create(input: {
    organisationId: string | null;
    name: string;
    definition: unknown;
    status?: RulesetStatus;
    actorUserId?: string | null;
  }) {
    const last = await this.prisma.ruleset.findFirst({
      where: {
        organisationId: input.organisationId ?? undefined,
        name: input.name,
      },
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

  async activate(input: {
    organisationId: string;
    rulesetId: string;
    actorUserId: string;
  }) {
    const ruleset = await this.prisma.ruleset.findFirst({
      where: { id: input.rulesetId, organisationId: input.organisationId },
    });
    if (!ruleset) throw new Error('RULESET_NOT_FOUND');
    if (ruleset.status === 'ACTIVE') return ruleset;

    return this.prisma.$transaction(async (tx) => {
      await tx.ruleset.updateMany({
        where: { organisationId: input.organisationId, status: 'ACTIVE' },
        data: { status: 'DRAFT' },
      });

      const updated = await tx.ruleset.update({
        where: { id: input.rulesetId },
        data: { status: 'ACTIVE' },
      });

      await this.audit.write({
        organisationId: input.organisationId,
        actorUserId: input.actorUserId,
        action: 'RULESET_ACTIVATED',
        entityType: 'ruleset',
        entityId: updated.id,
        before: ruleset as unknown as Prisma.JsonValue,
        after: updated as unknown as Prisma.JsonValue,
      });

      return updated;
    });
  }

  async getActive(organisationId: string) {
    return this.prisma.ruleset.findFirst({
      where: { organisationId, status: 'ACTIVE' },
    });
  }
}
