/**
 * Seeds default IWUF 2024 Sanda templates as reusable system rules.
 * Safe to run multiple times.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env['DATABASE_URL'] ?? 'postgresql://geo:geo123@localhost:5432/geo_wushu';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({
  adapter,
} as ConstructorParameters<typeof PrismaClient>[0]);

type WeightCategorySeed = {
  name: string;
  minExcl: number | null;
  maxIncl: number | null;
};

type AgeGroupSeed = {
  code: string;
  name: string;
  minAge: number;
  maxAge: number;
  sortOrder: number;
  roundDurationSeconds: number;
  weights: WeightCategorySeed[];
};

function buildWeightCategories(boundaries: number[], openTop = false): WeightCategorySeed[] {
  const categories: WeightCategorySeed[] = [];
  for (let i = 0; i < boundaries.length; i++) {
    const upper = boundaries[i];
    const lower = i === 0 ? null : boundaries[i - 1];
    categories.push({
      name: `${upper}kg`,
      minExcl: lower,
      maxIncl: upper,
    });
  }

  if (openTop) {
    const lower = boundaries[boundaries.length - 1] ?? null;
    categories.push({
      name: `+${lower}kg`,
      minExcl: lower,
      maxIncl: null,
    });
  }

  return categories;
}

const AGE_GROUPS: AgeGroupSeed[] = [
  {
    code: 'children-9-11',
    name: 'Children',
    minAge: 9,
    maxAge: 11,
    sortOrder: 1,
    roundDurationSeconds: 90,
    weights: buildWeightCategories([26, 28, 30, 32, 34, 36, 39, 42, 45, 48]),
  },
  {
    code: 'junior-12-14',
    name: 'Junior',
    minAge: 12,
    maxAge: 14,
    sortOrder: 2,
    roundDurationSeconds: 120,
    weights: buildWeightCategories([39, 42, 45, 48, 52, 56, 60, 64, 68, 72]),
  },
  {
    code: 'youth-15-17',
    name: 'Youth',
    minAge: 15,
    maxAge: 17,
    sortOrder: 3,
    roundDurationSeconds: 120,
    weights: buildWeightCategories([48, 52, 56, 60, 65, 70, 75, 80, 85, 90]),
  },
  {
    code: 'adult-18-40',
    name: 'Adult',
    minAge: 18,
    maxAge: 40,
    sortOrder: 4,
    roundDurationSeconds: 120,
    weights: buildWeightCategories(
      [48, 52, 56, 60, 65, 70, 75, 80, 85, 90, 100],
      true,
    ),
  },
];

async function main() {
  const rulesetName = 'IWUF 2024 Sanda (Default)';

  console.log(`Seeding ruleset: ${rulesetName}`);

  const existing = await prisma.ruleset.findFirst({
    where: { organisationId: null, name: rulesetName },
  });

  const ruleset = existing
    ? await prisma.ruleset.update({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          definition: {
            source: 'IWUF',
            edition: '2024',
            discipline: 'Sanda',
            builtIn: true,
          },
        },
      })
    : await prisma.ruleset.create({
        data: {
          organisationId: null,
          name: rulesetName,
          version: 1,
          status: 'ACTIVE',
          definition: {
            source: 'IWUF',
            edition: '2024',
            discipline: 'Sanda',
            builtIn: true,
          },
        },
      });

  // Full replace for deterministic default template updates.
  await prisma.rulesetWeightCategory.deleteMany({
    where: { ageGroup: { rulesetId: ruleset.id } },
  });
  await prisma.rulesetAgeGroup.deleteMany({ where: { rulesetId: ruleset.id } });

  for (const ageGroup of AGE_GROUPS) {
    const createdAgeGroup = await prisma.rulesetAgeGroup.create({
      data: {
        rulesetId: ruleset.id,
        code: ageGroup.code,
        name: ageGroup.name,
        sex: null,
        minAge: ageGroup.minAge,
        maxAge: ageGroup.maxAge,
        roundDurationSeconds: ageGroup.roundDurationSeconds,
        sortOrder: ageGroup.sortOrder,
      },
    });

    for (let i = 0; i < ageGroup.weights.length; i++) {
      const weight = ageGroup.weights[i];
      await prisma.rulesetWeightCategory.create({
        data: {
          ageGroupId: createdAgeGroup.id,
          name: weight.name,
          minWeightKgExcl: weight.minExcl,
          maxWeightKgIncl: weight.maxIncl,
          sortOrder: i + 1,
        },
      });
    }
  }

  const totalCategories = AGE_GROUPS.reduce(
    (sum, ageGroup) => sum + ageGroup.weights.length,
    0,
  );
  console.log(
    `Done. Age groups: ${AGE_GROUPS.length}. Weight categories: ${totalCategories}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
