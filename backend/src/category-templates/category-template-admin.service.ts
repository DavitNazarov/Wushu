import type { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  getCategoryOptionIds,
  getCategoryTemplateType,
  getTemplateSourceLabel,
} from './category-template.definition';
import {
  assertMutableCategoryTemplate,
  getCategoryTemplateProtectionState,
  getCategoryTemplateUsageSummary,
  mapCategoryTemplateListRow,
  sameIdSet,
} from './category-template-admin.helpers';
import type {
  CategoryTemplateListQueryDto,
  UpdateCategoryTemplateDto,
} from './category-template.schemas';
import {
  buildTemplateStructureFromCategoryOptions,
  replaceTemplateStructure,
} from './category-template-structure.persistence';

@Injectable()
export class CategoryTemplateAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organisationId: string, query: CategoryTemplateListQueryDto) {
    const templates = await this.prisma.categoryTemplate.findMany({
      where: {
        OR: [{ organisationId }, { organisationId: null }],
        ...(query.q
          ? {
              name: {
                contains: query.q,
                mode: 'insensitive',
              },
            }
          : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        _count: {
          select: {
            ageGroups: true,
            snapshots: true,
          },
        },
      },
      orderBy: [{ organisationId: 'asc' }, { updatedAt: 'desc' }, { name: 'asc' }],
    });

    return templates
      .map((template) => mapCategoryTemplateListRow(template))
      .filter((template) => !query.type || template.type === query.type);
  }

  async getDetail(organisationId: string, categoryTemplateId: string) {
    const template = await this.prisma.categoryTemplate.findFirst({
      where: {
        id: categoryTemplateId,
        OR: [{ organisationId }, { organisationId: null }],
      },
      include: {
        ageGroups: {
          include: {
            weights: {
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!template) throw new Error('CATEGORY_TEMPLATE_NOT_FOUND');

    const usage = await getCategoryTemplateUsageSummary(this.prisma, template.id);
    const protection = getCategoryTemplateProtectionState(template, usage);

    return {
      id: template.id,
      name: template.name,
      version: template.version,
      status: template.status,
      type: getCategoryTemplateType(template),
      sourceLabel: getTemplateSourceLabel(template.definition),
      discipline: null,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      organisationId: template.organisationId,
      selectedCategoryOptionIds: getCategoryOptionIds(template.definition),
      counts: {
        ageGroups: template.ageGroups.length,
        genders: new Set(
          template.ageGroups
            .map((ageGroup) => ageGroup.sex)
            .filter((value): value is NonNullable<typeof value> => Boolean(value)),
        ).size,
        weightCategories: template.ageGroups.reduce(
          (total, ageGroup) => total + ageGroup.weights.length,
          0,
        ),
        roundsConfigured: template.ageGroups.length,
      },
      ageGroups: template.ageGroups.map((ageGroup) => ({
        id: ageGroup.id,
        code: ageGroup.code,
        name: ageGroup.name,
        sex: ageGroup.sex,
        minAge: ageGroup.minAge,
        maxAge: ageGroup.maxAge,
        roundDurationSeconds: ageGroup.roundDurationSeconds,
        sortOrder: ageGroup.sortOrder,
        weightCategories: ageGroup.weights.map((weight) => ({
          id: weight.id,
          name: weight.name,
          minWeightKgExcl: weight.minWeightKgExcl,
          maxWeightKgIncl: weight.maxWeightKgIncl,
          sortOrder: weight.sortOrder,
        })),
      })),
      usage: {
        snapshotCount: usage.snapshotCount,
        eventAgeGroupCount: usage.eventAgeGroupCount,
        eventWeightCategoryCount: usage.eventWeightCategoryCount,
        recentEvents: usage.recentEvents,
      },
      permissions: protection,
    };
  }

  async update(input: {
    organisationId: string;
    actorUserId: string;
    categoryTemplateId: string;
    dto: UpdateCategoryTemplateDto;
  }) {
    const template = await this.prisma.categoryTemplate.findFirst({
      where: {
        id: input.categoryTemplateId,
        OR: [{ organisationId: input.organisationId }, { organisationId: null }],
      },
    });

    if (!template) throw new Error('CATEGORY_TEMPLATE_NOT_FOUND');

    const usage = await getCategoryTemplateUsageSummary(this.prisma, template.id);
    assertMutableCategoryTemplate(template);

    const nextOptionIds = input.dto.categoryOptionIds
      ? [...new Set(input.dto.categoryOptionIds)]
      : getCategoryOptionIds(template.definition);
    const structureChanged =
      input.dto.categoryOptionIds !== undefined &&
      !sameIdSet(nextOptionIds, getCategoryOptionIds(template.definition));

    if (structureChanged && usage.snapshotCount > 0) {
      throw new Error('CATEGORY_TEMPLATE_STRUCTURE_LOCKED_BY_USAGE');
    }

    const ageGroups = structureChanged
      ? await buildTemplateStructureFromCategoryOptions(this.prisma, nextOptionIds)
      : null;

    return this.prisma.$transaction(async (tx) => {
      if (input.dto.status === 'ACTIVE') {
        await tx.categoryTemplate.updateMany({
          where: {
            organisationId: input.organisationId,
            status: 'ACTIVE',
            id: { not: template.id },
          },
          data: { status: 'DRAFT' },
        });
      }

      const updated = await tx.categoryTemplate.update({
        where: { id: template.id },
        data: {
          ...(input.dto.name !== undefined ? { name: input.dto.name.trim() } : {}),
          ...(input.dto.status !== undefined ? { status: input.dto.status } : {}),
          ...(input.dto.categoryOptionIds !== undefined
            ? {
                definition: {
                  type: 'CATEGORY_TEMPLATE',
                  source: 'ADMIN_DEFINED',
                  categoryOptionIds: nextOptionIds,
                } satisfies Prisma.InputJsonValue,
              }
            : {}),
        },
      });

      if (ageGroups) {
        await replaceTemplateStructure(tx, template.id, ageGroups);
      }

      await this.audit.write({
        organisationId: input.organisationId,
        actorUserId: input.actorUserId,
        action: 'CATEGORY_TEMPLATE_UPDATED',
        entityType: 'categoryTemplate',
        entityId: template.id,
        before: {
          template,
          usage,
        } as unknown as Prisma.JsonValue,
        after: {
          template: updated,
          categoryOptionIds: nextOptionIds,
          structureChanged,
        } as unknown as Prisma.JsonValue,
      });

      return updated;
    });
  }

  async remove(input: {
    organisationId: string;
    actorUserId: string;
    categoryTemplateId: string;
  }) {
    const template = await this.prisma.categoryTemplate.findFirst({
      where: {
        id: input.categoryTemplateId,
        OR: [{ organisationId: input.organisationId }, { organisationId: null }],
      },
    });

    if (!template) throw new Error('CATEGORY_TEMPLATE_NOT_FOUND');

    const usage = await getCategoryTemplateUsageSummary(this.prisma, template.id);
    assertMutableCategoryTemplate(template);
    if (template.status === 'ACTIVE') {
      throw new Error('ACTIVE_CATEGORY_TEMPLATE_DELETE_FORBIDDEN');
    }
    if (usage.snapshotCount > 0) {
      throw new Error('CATEGORY_TEMPLATE_IN_USE');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.categoryTemplate.delete({
        where: { id: template.id },
      });

      await this.audit.write({
        organisationId: input.organisationId,
        actorUserId: input.actorUserId,
        action: 'CATEGORY_TEMPLATE_DELETED',
        entityType: 'categoryTemplate',
        entityId: template.id,
        before: {
          template,
          usage,
        } as unknown as Prisma.JsonValue,
        after: null,
      });
    });
  }

}
