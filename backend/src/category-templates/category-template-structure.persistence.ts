import type { Prisma } from '@prisma/client';
import { buildCategoryTemplateStructure } from './category-template.builder';
import { validateCategoryTemplateStructure } from './category-template-structure.validator';

export async function buildTemplateStructureFromCategoryOptions(
  prisma: Pick<Prisma.TransactionClient, 'categoryOption'>,
  categoryOptionIds: string[],
) {
  const uniqueIds = [...new Set(categoryOptionIds)];
  if (!uniqueIds.length) {
    throw new Error('AT_LEAST_ONE_CATEGORY_OPTION_REQUIRED');
  }

  const options = await prisma.categoryOption.findMany({
    where: {
      id: { in: uniqueIds },
      isActive: true,
      group: { isActive: true },
    },
    include: { group: true },
    orderBy: [{ group: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
  });

  if (options.length !== uniqueIds.length) {
    throw new Error('CATEGORY_OPTION_NOT_FOUND');
  }

  const ageGroups = buildCategoryTemplateStructure(options);
  validateCategoryTemplateStructure(ageGroups);
  return ageGroups;
}

export async function replaceTemplateStructure(
  tx: Prisma.TransactionClient,
  templateId: string,
  ageGroups: Awaited<
    ReturnType<typeof buildTemplateStructureFromCategoryOptions>
  >,
): Promise<void> {
  await tx.categoryTemplateWeight.deleteMany({
    where: { ageGroup: { categoryTemplateId: templateId } },
  });
  await tx.categoryTemplateAgeGroup.deleteMany({
    where: { categoryTemplateId: templateId },
  });

  for (
    let ageGroupIndex = 0;
    ageGroupIndex < ageGroups.length;
    ageGroupIndex += 1
  ) {
    const ageGroup = ageGroups[ageGroupIndex];
    const createdAgeGroup = await tx.categoryTemplateAgeGroup.create({
      data: {
        categoryTemplateId: templateId,
        code: ageGroup.code,
        name: ageGroup.name,
        sex: ageGroup.sex,
        minAge: ageGroup.minAge,
        maxAge: ageGroup.maxAge,
        roundDurationSeconds: ageGroup.roundDurationSeconds,
        sortOrder: ageGroup.sortOrder ?? ageGroupIndex + 1,
      },
    });

    for (
      let weightIndex = 0;
      weightIndex < ageGroup.weightCategories.length;
      weightIndex += 1
    ) {
      const weightCategory = ageGroup.weightCategories[weightIndex];
      await tx.categoryTemplateWeight.create({
        data: {
          ageGroupId: createdAgeGroup.id,
          name: weightCategory.name,
          minWeightKgExcl: weightCategory.minWeightKgExcl,
          maxWeightKgIncl: weightCategory.maxWeightKgIncl,
          sortOrder: weightCategory.sortOrder ?? weightIndex + 1,
        },
      });
    }
  }
}
