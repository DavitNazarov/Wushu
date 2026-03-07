/**
 * Seeds the official Georgian Sanda ruleset with structured age groups and weight categories.
 * Safe to run multiple times — uses upsert logic on the ruleset name.
 *
 * Run:  npx ts-node --project tsconfig.json prisma/seed-official-ruleset.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env['DATABASE_URL'] ?? 'postgresql://geo:geo123@localhost:5432/geo_wushu';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

type WC = { name: string; minExcl: number | null; maxIncl: number | null };

function buildCategories(boundaries: (number | null)[]): WC[] {
  const cats: WC[] = [];
  for (let i = 0; i < boundaries.length; i++) {
    const lower = boundaries[i - 1] ?? null;
    const upper = boundaries[i];
    const name = upper === null ? `+${boundaries[i - 1]}kg` : `${upper}kg`;
    cats.push({ name, minExcl: lower, maxIncl: upper });
  }
  return cats;
}

const SENIOR_MEN_WC = buildCategories([48, 52, 56, 60, 65, 70, 75, 80, 85, 90, null]);
const SENIOR_WOMEN_WC = buildCategories([48, 52, 56, 60, 65, 70, 75, null]);
const JUNIOR_BOYS_WC = buildCategories([42, 45, 48, 52, 56, 60, 65, 70, 75, null]);
const JUNIOR_GIRLS_WC = buildCategories([40, 42, 45, 48, 52, 56, 60, null]);
const CHILDREN_BOYS_WC = buildCategories([32, 36, 40, 44, 48, 52, null]);
const CHILDREN_GIRLS_WC = buildCategories([30, 34, 38, 42, 46, null]);

const AGE_GROUPS = [
  {
    code: 'senior-men',
    name: 'Senior Men',
    sex: 'MALE' as const,
    minAge: 18,
    maxAge: null,
    roundDurationSeconds: 120,
    sortOrder: 1,
    weightCategories: SENIOR_MEN_WC,
  },
  {
    code: 'senior-women',
    name: 'Senior Women',
    sex: 'FEMALE' as const,
    minAge: 18,
    maxAge: null,
    roundDurationSeconds: 120,
    sortOrder: 2,
    weightCategories: SENIOR_WOMEN_WC,
  },
  {
    code: 'junior-boys',
    name: 'Junior Boys',
    sex: 'MALE' as const,
    minAge: 15,
    maxAge: 17,
    roundDurationSeconds: 120,
    sortOrder: 3,
    weightCategories: JUNIOR_BOYS_WC,
  },
  {
    code: 'junior-girls',
    name: 'Junior Girls',
    sex: 'FEMALE' as const,
    minAge: 15,
    maxAge: 17,
    roundDurationSeconds: 120,
    sortOrder: 4,
    weightCategories: JUNIOR_GIRLS_WC,
  },
  {
    code: 'children-boys',
    name: 'Children Boys',
    sex: 'MALE' as const,
    minAge: 12,
    maxAge: 14,
    roundDurationSeconds: 90,
    sortOrder: 5,
    weightCategories: CHILDREN_BOYS_WC,
  },
  {
    code: 'children-girls',
    name: 'Children Girls',
    sex: 'FEMALE' as const,
    minAge: 12,
    maxAge: 14,
    roundDurationSeconds: 90,
    sortOrder: 6,
    weightCategories: CHILDREN_GIRLS_WC,
  },
];

async function main() {
  console.log('Seeding official Georgian Sanda ruleset...');

  // Upsert the ruleset header (system-level, no organisationId)
  const existing = await prisma.ruleset.findFirst({
    where: { organisationId: null, name: 'Official Georgian Sanda' },
  });

  const ruleset = existing
    ? await prisma.ruleset.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', updatedAt: new Date() },
      })
    : await prisma.ruleset.create({
        data: {
          organisationId: null,
          name: 'Official Georgian Sanda',
          version: 1,
          status: 'ACTIVE',
          definition: { sport: 'Sanda', country: 'GEO', year: 2026 },
        },
      });

  console.log(`Ruleset id: ${ruleset.id}`);

  for (const ag of AGE_GROUPS) {
    const ageGroup = await prisma.rulesetAgeGroup.upsert({
      where: { rulesetId_code: { rulesetId: ruleset.id, code: ag.code } },
      create: {
        rulesetId: ruleset.id,
        code: ag.code,
        name: ag.name,
        sex: ag.sex,
        minAge: ag.minAge,
        maxAge: ag.maxAge,
        roundDurationSeconds: ag.roundDurationSeconds,
        sortOrder: ag.sortOrder,
      },
      update: {
        name: ag.name,
        sex: ag.sex,
        minAge: ag.minAge,
        maxAge: ag.maxAge,
        roundDurationSeconds: ag.roundDurationSeconds,
        sortOrder: ag.sortOrder,
      },
    });

    // Remove old weight categories (full replace)
    await prisma.rulesetWeightCategory.deleteMany({ where: { ageGroupId: ageGroup.id } });

    for (let i = 0; i < ag.weightCategories.length; i++) {
      const wc = ag.weightCategories[i];
      await prisma.rulesetWeightCategory.create({
        data: {
          ageGroupId: ageGroup.id,
          name: wc.name,
          minWeightKgExcl: wc.minExcl,
          maxWeightKgIncl: wc.maxIncl,
          sortOrder: i + 1,
        },
      });
    }

    console.log(`  ${ag.name}: ${ag.weightCategories.length} categories`);
  }

  const totalWC = AGE_GROUPS.reduce((s, ag) => s + ag.weightCategories.length, 0);
  console.log(`Done. Seeded ${AGE_GROUPS.length} age groups, ${totalWC} weight categories.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
