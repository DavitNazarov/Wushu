import type {
  Prisma,
  Ruleset,
  RulesetAgeGroup,
  RulesetStatus,
} from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import type { RulesetAgeGroupInput } from './ruleset.schemas';
import { validateRulesetStructure } from './ruleset-structure.validator';

@Injectable()
export class RulesetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organisationId: string | null) {
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
    return this.prisma.rulesetAgeGroup.findMany({
      where: { rulesetId },
      include: {
        weightCategories: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(input: {
    organisationId: string | null;
    name: string;
    definition: unknown;
    status?: RulesetStatus;
    actorUserId?: string | null;
    ageGroups?: RulesetAgeGroupInput[];
  }) {
    const last = await this.prisma.ruleset.findFirst({
      where: {
        organisationId: input.organisationId ?? undefined,
        name: input.name,
      },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    if (input.ageGroups?.length) {
      validateRulesetStructure(input.ageGroups);
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.ruleset.create({
        data: {
          organisationId: input.organisationId ?? undefined,
          name: input.name,
          version: nextVersion,
          status: input.status ?? 'DRAFT',
          definition: (input.definition ?? {}) as Prisma.InputJsonValue,
        },
      });

      if (input.ageGroups?.length) {
        await this.replaceRulesetStructure(tx, created.id, input.ageGroups);
      }

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

  async updateStructure(input: {
    organisationId: string;
    rulesetId: string;
    actorUserId: string;
    ageGroups: RulesetAgeGroupInput[];
    definition?: unknown;
    status?: RulesetStatus;
  }) {
    validateRulesetStructure(input.ageGroups);

    const existing = await this.prisma.ruleset.findFirst({
      where: {
        id: input.rulesetId,
        OR: [
          { organisationId: input.organisationId },
          { organisationId: null },
        ],
      },
      include: {
        ageGroups: {
          include: {
            weightCategories: true,
          },
        },
      },
    });
    if (!existing) throw new Error('RULESET_NOT_FOUND');

    if (existing.organisationId === null) {
      throw new Error('SYSTEM_RULESET_READ_ONLY');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedRuleset = await tx.ruleset.update({
        where: { id: input.rulesetId },
        data: {
          definition: (input.definition ?? existing.definition) as Prisma.InputJsonValue,
          status: input.status ?? existing.status,
        },
      });

      await this.replaceRulesetStructure(tx, input.rulesetId, input.ageGroups);

      await this.audit.write({
        organisationId: input.organisationId,
        actorUserId: input.actorUserId,
        action: 'RULESET_UPDATED',
        entityType: 'ruleset',
        entityId: input.rulesetId,
        before: {
          definition: existing.definition,
          status: existing.status,
          ageGroups: existing.ageGroups,
        } as unknown as Prisma.JsonValue,
        after: {
          definition: updatedRuleset.definition,
          status: updatedRuleset.status,
          ageGroups: input.ageGroups,
        } as unknown as Prisma.JsonValue,
      });

      return updatedRuleset;
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

  async getForEventSelection(organisationId: string, rulesetId: string) {
    return this.prisma.ruleset.findFirst({
      where: {
        id: rulesetId,
        OR: [{ organisationId }, { organisationId: null }],
      },
    });
  }

  private async replaceRulesetStructure(
    tx: Prisma.TransactionClient,
    rulesetId: string,
    ageGroups: RulesetAgeGroupInput[],
  ): Promise<void> {
    await tx.rulesetWeightCategory.deleteMany({
      where: { ageGroup: { rulesetId } },
    });
    await tx.rulesetAgeGroup.deleteMany({ where: { rulesetId } });

    const orderedAgeGroups = [...ageGroups].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );

    for (let agIndex = 0; agIndex < orderedAgeGroups.length; agIndex++) {
      const ageGroup = orderedAgeGroups[agIndex];
      const createdAgeGroup = await tx.rulesetAgeGroup.create({
        data: {
          rulesetId,
          code: ageGroup.code,
          name: ageGroup.name,
          sex: ageGroup.sex ?? null,
          minAge: ageGroup.minAge ?? null,
          maxAge: ageGroup.maxAge ?? null,
          roundDurationSeconds: ageGroup.roundDurationSeconds ?? 120,
          sortOrder: ageGroup.sortOrder ?? agIndex + 1,
        },
      });

      const orderedWeights = [...ageGroup.weightCategories].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
      );

      for (let wcIndex = 0; wcIndex < orderedWeights.length; wcIndex++) {
        const weightCategory = orderedWeights[wcIndex];
        await tx.rulesetWeightCategory.create({
          data: {
            ageGroupId: createdAgeGroup.id,
            name: weightCategory.name,
            minWeightKgExcl: weightCategory.minWeightKgExcl ?? null,
            maxWeightKgIncl: weightCategory.maxWeightKgIncl ?? null,
            sortOrder: weightCategory.sortOrder ?? wcIndex + 1,
          },
        });
      }
    }
  }
}
