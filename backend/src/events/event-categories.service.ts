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
    // ── 1. Guard: event exists ──────────────────────────────────────────────
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organisationId },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    // ── 2. Guard: template exists ───────────────────────────────────────────
    const template = await this.prisma.categoryTemplate.findFirst({
      where: {
        id: selection.categoryTemplateId,
        OR: [{ organisationId }, { organisationId: null }],
      },
    });
    if (!template) throw new Error('CATEGORY_TEMPLATE_NOT_FOUND');

    // ── 3. Guard: no downstream activity yet ───────────────────────────────
    const [registrationCount, weighInCount, bracketCount, fightCount] =
      await Promise.all([
        this.prisma.registration.count({ where: { eventId, organisationId } }),
        this.prisma.weighInAttempt.count({ where: { eventId, organisationId } }),
        this.prisma.bracket.count({ where: { eventId, organisationId } }),
        this.prisma.fight.count({ where: { eventId, organisationId } }),
      ]);
    if (registrationCount > 0 || weighInCount > 0 || bracketCount > 0 || fightCount > 0) {
      throw new Error('EVENT_CATEGORIES_LOCKED_AFTER_ACTIVITY');
    }

    // ── 4. Guard: at least one category selected ───────────────────────────
    const activeGroups = selection.ageGroups.filter(
      (g) => g.weightCategoryIds.length > 0,
    );
    if (activeGroups.reduce((sum, g) => sum + g.weightCategoryIds.length, 0) === 0) {
      throw new Error('AT_LEAST_ONE_CATEGORY_REQUIRED');
    }

    // ── 5. Pre-validate all template references OUTSIDE the transaction ─────
    //    Two queries instead of N²-style round-trips inside the transaction.
    const allAgeGroupIds = activeGroups.map((g) => g.categoryTemplateGroupId);
    const allWeightIds = activeGroups.flatMap((g) => g.weightCategoryIds);

    const [templateAgeGroups, templateWeights] = await Promise.all([
      this.prisma.categoryTemplateAgeGroup.findMany({
        where: {
          id: { in: allAgeGroupIds },
          categoryTemplateId: selection.categoryTemplateId,
        },
        select: { id: true },
      }),
      this.prisma.categoryTemplateWeight.findMany({
        where: { id: { in: allWeightIds } },
        select: { id: true, ageGroupId: true },
      }),
    ]);

    const validAgeGroupIds = new Set(templateAgeGroups.map((g) => g.id));
    const validWeightsByAgeGroup = new Map<string, Set<string>>();
    for (const w of templateWeights) {
      if (!validWeightsByAgeGroup.has(w.ageGroupId)) {
        validWeightsByAgeGroup.set(w.ageGroupId, new Set());
      }
      validWeightsByAgeGroup.get(w.ageGroupId)!.add(w.id);
    }

    for (const group of activeGroups) {
      if (!validAgeGroupIds.has(group.categoryTemplateGroupId)) {
        throw new Error(`INVALID_AGE_GROUP: ${group.categoryTemplateGroupId}`);
      }
      const validWeights = validWeightsByAgeGroup.get(group.categoryTemplateGroupId) ?? new Set();
      for (const wId of group.weightCategoryIds) {
        if (!validWeights.has(wId)) {
          throw new Error(`INVALID_WEIGHT_CATEGORY: ${wId}`);
        }
      }
    }

    // ── 6. Snapshot for audit ───────────────────────────────────────────────
    const before = await this.getCategories(eventId, organisationId).catch(() => null);

    // ── 7. Transaction: delete old data, upsert snapshot, batch-insert new ──
    //    Age groups are created one-at-a-time (to get their generated IDs),
    //    then all weight categories are batch-inserted in a single createMany.
    //    This is at most N age-group creates + 1 createMany — much cheaper
    //    than the previous N×M individual creates.
    await this.prisma.$transaction(
      async (tx) => {
        // Remove previous age groups (weight categories cascade via FK)
        await tx.eventAgeGroup.deleteMany({ where: { eventId } });

        // Upsert category template snapshot
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

        // Create age groups sequentially (need generated IDs for weight FK)
        const createdAgeGroups: Array<{ id: string; templateGroupId: string }> = [];
        for (const group of activeGroups) {
          const created = await tx.eventAgeGroup.create({
            data: {
              eventId,
              categoryTemplateAgeGroupId: group.categoryTemplateGroupId,
            },
            select: { id: true },
          });
          createdAgeGroups.push({
            id: created.id,
            templateGroupId: group.categoryTemplateGroupId,
          });
        }

        // Batch-insert all weight categories in one query
        const weightRows = activeGroups.flatMap((group) => {
          const ageGroup = createdAgeGroups.find(
            (ag) => ag.templateGroupId === group.categoryTemplateGroupId,
          )!;
          return group.weightCategoryIds.map((wId) => ({
            eventAgeGroupId: ageGroup.id,
            categoryTemplateWeightId: wId,
          }));
        });
        await tx.eventWeightCategory.createMany({ data: weightRows });

        // Audit log
        await this.audit.write(
          {
            organisationId,
            eventId,
            actorUserId,
            action: 'EVENT_CATEGORIES_UPDATED',
            entityType: 'event',
            entityId: eventId,
            before: before as unknown as Prisma.JsonValue,
            after: { selection } as unknown as Prisma.JsonValue,
          },
          tx,
        );
      },
      { timeout: 15_000 },
    );

    return this.getCategories(eventId, organisationId);
  }
}
