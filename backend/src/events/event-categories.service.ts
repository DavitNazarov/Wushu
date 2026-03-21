import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export type CategorySelection = {
  categoryTemplateId: string;
  ageGroups: Array<{
    categoryTemplateGroupId: string;
    weightCategoryIds: string[];
  }>;
};

@Injectable()
export class EventCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getCategories(eventId: string, organisationId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organisationId },
      include: {
        categoryTemplateSnapshot: { select: { categoryTemplateId: true } },
      },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    const ageGroups = await this.prisma.eventAgeGroup.findMany({
      where: { eventId },
      include: {
        categoryTemplateAgeGroup: true,
        weightCategories: {
          include: { categoryTemplateWeight: true },
          orderBy: { categoryTemplateWeight: { sortOrder: 'asc' } },
        },
      },
      orderBy: { categoryTemplateAgeGroup: { sortOrder: 'asc' } },
    });

    return {
      eventId,
      categoryTemplateId: event.categoryTemplateSnapshot?.categoryTemplateId ?? null,
      ageGroups: ageGroups.map((ageGroup) => ({
        id: ageGroup.id,
        categoryTemplateGroupId: ageGroup.categoryTemplateAgeGroupId,
        code: ageGroup.categoryTemplateAgeGroup.code,
        name: ageGroup.categoryTemplateAgeGroup.name,
        sex: ageGroup.categoryTemplateAgeGroup.sex,
        minAge: ageGroup.categoryTemplateAgeGroup.minAge,
        maxAge: ageGroup.categoryTemplateAgeGroup.maxAge,
        roundDurationSeconds: ageGroup.categoryTemplateAgeGroup.roundDurationSeconds,
        weightCategories: ageGroup.weightCategories.map((weightCategory) => ({
          id: weightCategory.id,
          categoryTemplateCategoryId: weightCategory.categoryTemplateWeightId,
          name: weightCategory.categoryTemplateWeight.name,
          minWeightKgExcl: weightCategory.categoryTemplateWeight.minWeightKgExcl,
          maxWeightKgIncl: weightCategory.categoryTemplateWeight.maxWeightKgIncl,
          sortOrder: weightCategory.categoryTemplateWeight.sortOrder,
        })),
      })),
    };
  }

  async setCategories(
    eventId: string,
    organisationId: string,
    actorUserId: string,
    selection: CategorySelection,
  ) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organisationId },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    const template = await this.prisma.categoryTemplate.findFirst({
      where: {
        id: selection.categoryTemplateId,
        OR: [{ organisationId }, { organisationId: null }],
      },
    });
    if (!template) throw new Error('CATEGORY_TEMPLATE_NOT_FOUND');

    const [registrationCount, weighInCount, bracketCount, fightCount] =
      await Promise.all([
        this.prisma.registration.count({ where: { eventId, organisationId } }),
        this.prisma.weighInAttempt.count({ where: { eventId, organisationId } }),
        this.prisma.bracket.count({ where: { eventId, organisationId } }),
        this.prisma.fight.count({ where: { eventId, organisationId } }),
      ]);
    if (
      registrationCount > 0 ||
      weighInCount > 0 ||
      bracketCount > 0 ||
      fightCount > 0
    ) {
      throw new Error('EVENT_CATEGORIES_LOCKED_AFTER_ACTIVITY');
    }

    const totalCategories = selection.ageGroups.reduce(
      (sum, ageGroup) => sum + ageGroup.weightCategoryIds.length,
      0,
    );
    if (totalCategories === 0) throw new Error('AT_LEAST_ONE_CATEGORY_REQUIRED');

    const before = await this.getCategories(eventId, organisationId).catch(() => null);

    await this.prisma.$transaction(async (tx) => {
      const existingAgeGroups = await tx.eventAgeGroup.findMany({
        where: { eventId },
      });
      const existingAgeGroupIds = existingAgeGroups.map((ageGroup) => ageGroup.id);

      if (existingAgeGroupIds.length > 0) {
        await tx.eventWeightCategory.deleteMany({
          where: { eventAgeGroupId: { in: existingAgeGroupIds } },
        });
        await tx.eventAgeGroup.deleteMany({ where: { eventId } });
      }

      await tx.eventCategoryTemplateSnapshot.upsert({
        where: { eventId },
        update: {
          categoryTemplateId: template.id,
          version: template.version,
          snapshot: template.definition as Prisma.InputJsonValue,
        },
        create: {
          eventId,
          categoryTemplateId: template.id,
          version: template.version,
          snapshot: template.definition as Prisma.InputJsonValue,
        },
      });

      for (const ageGroupSelection of selection.ageGroups) {
        if (ageGroupSelection.weightCategoryIds.length === 0) continue;

        const templateAgeGroup = await tx.categoryTemplateAgeGroup.findFirst({
          where: {
            id: ageGroupSelection.categoryTemplateGroupId,
            categoryTemplateId: selection.categoryTemplateId,
          },
        });
        if (!templateAgeGroup) {
          throw new Error(
            `INVALID_AGE_GROUP: ${ageGroupSelection.categoryTemplateGroupId}`,
          );
        }

        const eventAgeGroup = await tx.eventAgeGroup.create({
          data: {
            eventId,
            categoryTemplateAgeGroupId: ageGroupSelection.categoryTemplateGroupId,
          },
        });

        for (const weightCategoryId of ageGroupSelection.weightCategoryIds) {
          const templateWeightCategory = await tx.categoryTemplateWeight.findFirst({
            where: {
              id: weightCategoryId,
              ageGroupId: ageGroupSelection.categoryTemplateGroupId,
            },
          });
          if (!templateWeightCategory) {
            throw new Error(`INVALID_WEIGHT_CATEGORY: ${weightCategoryId}`);
          }

          await tx.eventWeightCategory.create({
            data: {
              eventAgeGroupId: eventAgeGroup.id,
              categoryTemplateWeightId: weightCategoryId,
            },
          });
        }
      }

      await this.audit.write({
        organisationId,
        eventId,
        actorUserId,
        action: 'EVENT_CATEGORIES_UPDATED',
        entityType: 'event',
        entityId: eventId,
        before: before as unknown as Prisma.JsonValue,
        after: { selection } as unknown as Prisma.JsonValue,
      });
    });

    return this.getCategories(eventId, organisationId);
  }
}
