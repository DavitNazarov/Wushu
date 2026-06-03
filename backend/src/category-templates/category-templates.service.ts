import type { CategoryTemplate, Prisma, RulesetStatus } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildTemplateStructureFromCategoryOptions,
  replaceTemplateStructure,
} from './category-template-structure.persistence';

type CategoryTemplateCreateInput = {
  organisationId: string;
  name: string;
  categoryOptionIds: string[];
  status?: RulesetStatus;
  actorUserId: string;
};

@Injectable()
export class CategoryTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organisationId: string | null) {
    return this.prisma.categoryTemplate.findMany({
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

  async listCategoryOptions() {
    return this.prisma.categoryOptionGroup.findMany({
      where: { isActive: true },
      include: {
        options: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getCategoryTree(organisationId: string, categoryTemplateId: string) {
    const template = await this.getAccessibleTemplate(
      organisationId,
      categoryTemplateId,
    );
    if (!template) throw new Error('CATEGORY_TEMPLATE_NOT_FOUND');

    const ageGroups = await this.prisma.categoryTemplateAgeGroup.findMany({
      where: { categoryTemplateId: template.id },
      include: {
        weights: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return ageGroups.map(({ weights, ...ageGroup }) => ({
      ...ageGroup,
      weightCategories: weights,
    }));
  }

  async create(input: CategoryTemplateCreateInput) {
    const ageGroups = await buildTemplateStructureFromCategoryOptions(
      this.prisma,
      input.categoryOptionIds,
    );

    const last = await this.prisma.categoryTemplate.findFirst({
      where: {
        organisationId: input.organisationId,
        name: input.name,
      },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.categoryTemplate.create({
        data: {
          organisationId: input.organisationId,
          name: input.name,
          version: nextVersion,
          status: input.status ?? 'ACTIVE',
          definition: {
            type: 'CATEGORY_TEMPLATE',
            source: 'ADMIN_DEFINED',
            categoryOptionIds: [...new Set(input.categoryOptionIds)],
          } satisfies Prisma.InputJsonValue,
        },
      });

      await replaceTemplateStructure(tx, created.id, ageGroups);

      await this.audit.write({
        organisationId: input.organisationId,
        actorUserId: input.actorUserId,
        action: 'CATEGORY_TEMPLATE_CREATED',
        entityType: 'categoryTemplate',
        entityId: created.id,
        before: null,
        after: {
          template: created,
          categoryOptionIds: [...new Set(input.categoryOptionIds)],
        } as unknown as Prisma.JsonValue,
      });

      return created;
    });
  }

  async activate(input: {
    organisationId: string;
    categoryTemplateId: string;
    actorUserId: string;
  }) {
    const template = await this.prisma.categoryTemplate.findFirst({
      where: {
        id: input.categoryTemplateId,
        organisationId: input.organisationId,
      },
    });
    if (!template) throw new Error('CATEGORY_TEMPLATE_NOT_FOUND');
    if (template.status === 'ACTIVE') return template;

    return this.prisma.$transaction(async (tx) => {
      await tx.categoryTemplate.updateMany({
        where: { organisationId: input.organisationId, status: 'ACTIVE' },
        data: { status: 'DRAFT' },
      });

      const updated = await tx.categoryTemplate.update({
        where: { id: input.categoryTemplateId },
        data: { status: 'ACTIVE' },
      });

      await this.audit.write({
        organisationId: input.organisationId,
        actorUserId: input.actorUserId,
        action: 'CATEGORY_TEMPLATE_ACTIVATED',
        entityType: 'categoryTemplate',
        entityId: updated.id,
        before: template as unknown as Prisma.JsonValue,
        after: updated as unknown as Prisma.JsonValue,
      });

      return updated;
    });
  }

  async getActive(organisationId: string) {
    const orgTemplate = await this.prisma.categoryTemplate.findFirst({
      where: { organisationId, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    });
    if (orgTemplate) return orgTemplate;

    return this.prisma.categoryTemplate.findFirst({
      where: { organisationId: null, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getForEventSelection(
    organisationId: string,
    categoryTemplateId: string,
  ) {
    return this.getAccessibleTemplate(organisationId, categoryTemplateId);
  }

  private async getAccessibleTemplate(
    organisationId: string,
    categoryTemplateId: string,
  ): Promise<CategoryTemplate | null> {
    return this.prisma.categoryTemplate.findFirst({
      where: {
        id: categoryTemplateId,
        OR: [{ organisationId }, { organisationId: null }],
      },
    });
  }
}
