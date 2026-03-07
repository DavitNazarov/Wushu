import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

export type CategorySelection = {
  rulesetId: string;
  ageGroups: Array<{
    rulesetAgeGroupId: string;
    weightCategoryIds: string[];
  }>;
};

@Injectable()
export class EventCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Returns the event's enabled age groups with their enabled weight categories
   *  and denormalized ruleset data (names, limits, round duration). */
  async getCategories(eventId: string, organisationId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organisationId },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    const ageGroups = await this.prisma.eventAgeGroup.findMany({
      where: { eventId },
      include: {
        rulesetAgeGroup: true,
        weightCategories: {
          include: { rulesetWeightCategory: true },
          orderBy: { rulesetWeightCategory: { sortOrder: 'asc' } },
        },
      },
      orderBy: { rulesetAgeGroup: { sortOrder: 'asc' } },
    });

    return {
      eventId,
      ageGroups: ageGroups.map((ag) => ({
        id: ag.id,
        rulesetAgeGroupId: ag.rulesetAgeGroupId,
        code: ag.rulesetAgeGroup.code,
        name: ag.rulesetAgeGroup.name,
        sex: ag.rulesetAgeGroup.sex,
        minAge: ag.rulesetAgeGroup.minAge,
        maxAge: ag.rulesetAgeGroup.maxAge,
        roundDurationSeconds: ag.rulesetAgeGroup.roundDurationSeconds,
        weightCategories: ag.weightCategories.map((wc) => ({
          id: wc.id,
          rulesetWeightCategoryId: wc.rulesetWeightCategoryId,
          name: wc.rulesetWeightCategory.name,
          minWeightKgExcl: wc.rulesetWeightCategory.minWeightKgExcl,
          maxWeightKgIncl: wc.rulesetWeightCategory.maxWeightKgIncl,
          sortOrder: wc.rulesetWeightCategory.sortOrder,
        })),
      })),
    };
  }

  /** Replaces all event category selections (upsert age groups, replace weight categories).
   *  Requires at least one weight category. */
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

    const totalCats = selection.ageGroups.reduce(
      (s, ag) => s + ag.weightCategoryIds.length,
      0,
    );
    if (totalCats === 0) throw new Error('AT_LEAST_ONE_CATEGORY_REQUIRED');

    const before = await this.getCategories(eventId, organisationId).catch(
      () => null,
    );

    await this.prisma.$transaction(async (tx) => {
      // Remove all existing event weight categories + age groups for this event
      const existingAgeGroups = await tx.eventAgeGroup.findMany({
        where: { eventId },
      });
      const existingAgeGroupIds = existingAgeGroups.map((ag) => ag.id);

      if (existingAgeGroupIds.length > 0) {
        await tx.eventWeightCategory.deleteMany({
          where: { eventAgeGroupId: { in: existingAgeGroupIds } },
        });
        await tx.eventAgeGroup.deleteMany({ where: { eventId } });
      }

      // Re-create from selection
      for (const agSel of selection.ageGroups) {
        if (agSel.weightCategoryIds.length === 0) continue;

        // Validate age group belongs to correct ruleset
        const rulesetAg = await tx.rulesetAgeGroup.findFirst({
          where: {
            id: agSel.rulesetAgeGroupId,
            rulesetId: selection.rulesetId,
          },
        });
        if (!rulesetAg)
          throw new Error(`INVALID_AGE_GROUP: ${agSel.rulesetAgeGroupId}`);

        const eventAg = await tx.eventAgeGroup.create({
          data: { eventId, rulesetAgeGroupId: agSel.rulesetAgeGroupId },
        });

        // Validate + create each weight category
        for (const wcId of agSel.weightCategoryIds) {
          const rwc = await tx.rulesetWeightCategory.findFirst({
            where: { id: wcId, ageGroupId: agSel.rulesetAgeGroupId },
          });
          if (!rwc) throw new Error(`INVALID_WEIGHT_CATEGORY: ${wcId}`);

          await tx.eventWeightCategory.create({
            data: {
              eventAgeGroupId: eventAg.id,
              rulesetWeightCategoryId: wcId,
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
