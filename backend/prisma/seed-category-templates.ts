/**
 * Seeds backend-managed category options plus a few reusable built-in
 * category templates. Safe to run multiple times.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@prisma/client';
import {
  assertValidDefaultCategoryLibrary,
  DEFAULT_CATEGORY_OPTION_GROUPS,
  DEFAULT_CATEGORY_TEMPLATE_SEEDS,
} from '../src/category-templates/default-category-options';

const connectionString =
  process.env['DATABASE_URL'] ?? 'postgresql://geo:geo123@localhost:5432/geo_wushu';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({
  adapter,
} as ConstructorParameters<typeof PrismaClient>[0]);

async function upsertCategoryOptions() {
  for (const group of DEFAULT_CATEGORY_OPTION_GROUPS) {
    const upsertedGroup = await prisma.categoryOptionGroup.upsert({
      where: { code: group.code },
      update: {
        name: group.name,
        sex: group.sex,
        minAge: group.minAge,
        maxAge: group.maxAge,
        roundDurationSeconds: group.roundDurationSeconds,
        sortOrder: group.sortOrder,
        isActive: true,
      },
      create: {
        code: group.code,
        name: group.name,
        sex: group.sex,
        minAge: group.minAge,
        maxAge: group.maxAge,
        roundDurationSeconds: group.roundDurationSeconds,
        sortOrder: group.sortOrder,
        isActive: true,
      },
    });

    await prisma.categoryOption.deleteMany({
      where: {
        groupId: upsertedGroup.id,
        code: { notIn: group.options.map((option) => option.code) },
      },
    });

    for (const option of group.options) {
      await prisma.categoryOption.upsert({
        where: { code: option.code },
        update: {
          groupId: upsertedGroup.id,
          name: option.name,
          minWeightKgExcl: option.minWeightKgExcl,
          maxWeightKgIncl: option.maxWeightKgIncl,
          sortOrder: option.sortOrder,
          isActive: true,
        },
        create: {
          groupId: upsertedGroup.id,
          code: option.code,
          name: option.name,
          minWeightKgExcl: option.minWeightKgExcl,
          maxWeightKgIncl: option.maxWeightKgIncl,
          sortOrder: option.sortOrder,
          isActive: true,
        },
      });
    }
  }
}

async function replaceTemplateStructure(
  tx: Prisma.TransactionClient,
  templateId: string,
  optionGroupCodes: string[],
) {
  await tx.categoryTemplateWeight.deleteMany({
    where: { ageGroup: { categoryTemplateId: templateId } },
  });
  await tx.categoryTemplateAgeGroup.deleteMany({
    where: { categoryTemplateId: templateId },
  });

  const groups = await tx.categoryOptionGroup.findMany({
    where: { code: { in: optionGroupCodes } },
    include: {
      options: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  for (const group of groups) {
    const ageGroup = await tx.categoryTemplateAgeGroup.create({
      data: {
        categoryTemplateId: templateId,
        code: group.code,
        name: group.name,
        sex: group.sex,
        minAge: group.minAge,
        maxAge: group.maxAge,
        roundDurationSeconds: group.roundDurationSeconds,
        sortOrder: group.sortOrder,
      },
    });

    for (const option of group.options) {
      await tx.categoryTemplateWeight.create({
        data: {
          ageGroupId: ageGroup.id,
          name: option.name,
          minWeightKgExcl: option.minWeightKgExcl,
          maxWeightKgIncl: option.maxWeightKgIncl,
          sortOrder: option.sortOrder,
        },
      });
    }
  }
}

async function upsertBuiltInTemplates() {
  for (const templateSeed of DEFAULT_CATEGORY_TEMPLATE_SEEDS) {
    const existing = await prisma.categoryTemplate.findFirst({
      where: { organisationId: null, name: templateSeed.name },
      orderBy: { version: 'desc' },
    });

    const template = existing
      ? await prisma.categoryTemplate.update({
          where: { id: existing.id },
          data: {
            status: 'ACTIVE',
            definition: {
              type: 'CATEGORY_TEMPLATE',
              source: 'SYSTEM_BUILT_IN',
              optionGroupCodes: templateSeed.optionGroupCodes,
            },
          },
        })
      : await prisma.categoryTemplate.create({
          data: {
            organisationId: null,
            name: templateSeed.name,
            version: 1,
            status: 'ACTIVE',
            definition: {
              type: 'CATEGORY_TEMPLATE',
              source: 'SYSTEM_BUILT_IN',
              optionGroupCodes: templateSeed.optionGroupCodes,
            },
          },
        });

    await prisma.$transaction((tx) =>
      replaceTemplateStructure(tx, template.id, templateSeed.optionGroupCodes),
    );
  }
}

async function main() {
  assertValidDefaultCategoryLibrary();
  await upsertCategoryOptions();
  await upsertBuiltInTemplates();

  const [groupCount, optionCount, templateCount] = await Promise.all([
    prisma.categoryOptionGroup.count({ where: { isActive: true } }),
    prisma.categoryOption.count({ where: { isActive: true } }),
    prisma.categoryTemplate.count({ where: { organisationId: null } }),
  ]);

  console.log(
    `Seeded ${groupCount} category option groups, ${optionCount} options, ${templateCount} built-in category templates.`,
  );
}

async function runSeed() {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

export { main, runSeed };

if (require.main === module) {
  void runSeed();
}
