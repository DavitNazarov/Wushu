import type { CategoryTemplate, Prisma } from '@prisma/client';
import {
  getCategoryTemplateType,
  getTemplateSourceLabel,
} from './category-template.definition';

export type UsageEvent = {
  id: string;
  name: string;
  lifecycle: string;
  competitionStartDate: Date;
};

export type UsageSummary = {
  snapshotCount: number;
  eventAgeGroupCount: number;
  eventWeightCategoryCount: number;
  recentEvents: UsageEvent[];
};

export type CategoryTemplateListRecord = CategoryTemplate & {
  _count: { ageGroups: number; snapshots: number };
};

export function mapCategoryTemplateListRow(
  template: CategoryTemplateListRecord,
) {
  const type = getCategoryTemplateType(template);
  const isSystem = type !== 'CUSTOM';
  const inUse = template._count.snapshots > 0;

  return {
    id: template.id,
    name: template.name,
    version: template.version,
    status: template.status,
    type,
    sourceLabel: getTemplateSourceLabel(template.definition),
    discipline: null,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    usageCount: template._count.snapshots,
    ageGroupCount: template._count.ageGroups,
    canEdit: !isSystem,
    canDelete: !isSystem && template.status !== 'ACTIVE' && !inUse,
    deleteBlockedReason: isSystem
      ? 'SYSTEM_CATEGORY_TEMPLATE_PROTECTED'
      : template.status === 'ACTIVE'
        ? 'ACTIVE_CATEGORY_TEMPLATE_DELETE_FORBIDDEN'
        : inUse
          ? 'CATEGORY_TEMPLATE_IN_USE'
          : null,
  };
}

export function getCategoryTemplateProtectionState(
  template: CategoryTemplate,
  usage: UsageSummary,
) {
  const type = getCategoryTemplateType(template);
  const reasons: string[] = [];

  if (type !== 'CUSTOM') reasons.push('SYSTEM_CATEGORY_TEMPLATE_PROTECTED');
  if (usage.snapshotCount > 0)
    reasons.push('CATEGORY_TEMPLATE_STRUCTURE_LOCKED_BY_USAGE');
  if (template.status === 'ACTIVE') {
    reasons.push('ACTIVE_CATEGORY_TEMPLATE_DELETE_FORBIDDEN');
  }

  return {
    canEdit: type === 'CUSTOM',
    canEditStructure: type === 'CUSTOM' && usage.snapshotCount === 0,
    canDelete:
      type === 'CUSTOM' &&
      usage.snapshotCount === 0 &&
      template.status !== 'ACTIVE',
    reasonCodes: reasons,
  };
}

export function assertMutableCategoryTemplate(template: CategoryTemplate) {
  if (getCategoryTemplateType(template) !== 'CUSTOM') {
    throw new Error('SYSTEM_CATEGORY_TEMPLATE_PROTECTED');
  }
}

export async function getCategoryTemplateUsageSummary(
  prisma:
    | Prisma.TransactionClient
    | {
        eventAgeGroup: Prisma.TransactionClient['eventAgeGroup'];
        eventWeightCategory: Prisma.TransactionClient['eventWeightCategory'];
        event: Prisma.TransactionClient['event'];
      },
  categoryTemplateId: string,
): Promise<UsageSummary> {
  const [
    snapshotCount,
    eventAgeGroupCount,
    eventWeightCategoryCount,
    recentEvents,
  ] = await Promise.all([
    prisma.event.count({
      where: {
        categoryTemplateSnapshot: {
          categoryTemplateId,
        },
      },
    }),
    prisma.eventAgeGroup.count({
      where: {
        categoryTemplateAgeGroup: {
          categoryTemplateId,
        },
      },
    }),
    prisma.eventWeightCategory.count({
      where: {
        categoryTemplateWeight: {
          ageGroup: {
            categoryTemplateId,
          },
        },
      },
    }),
    prisma.event.findMany({
      where: {
        categoryTemplateSnapshot: {
          categoryTemplateId,
        },
      },
      select: {
        id: true,
        name: true,
        lifecycle: true,
        competitionStartDate: true,
      },
      orderBy: { competitionStartDate: 'desc' },
      take: 5,
    }),
  ]);

  return {
    snapshotCount,
    eventAgeGroupCount,
    eventWeightCategoryCount,
    recentEvents,
  };
}

export function sameIdSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}
