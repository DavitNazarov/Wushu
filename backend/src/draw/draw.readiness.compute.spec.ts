import { computeDrawReadiness } from './draw.readiness.compute';
import { computeCategoryReviewSignature } from './draw.readiness.helpers';
import type { DrawReadinessContext } from './draw.readiness.queries';

// Unit tests for the readiness compute step. Since computeDrawReadiness is
// pure, tests build a DrawReadinessContext by hand and assert on the
// resulting overview / category map.

// Baseline fixture: LOCKED event, one weight category, IMMEDIATE_AFTER_DRAW
// policy. Individual tests spread + override fields to exercise edge cases.
function makeBaseContext(): DrawReadinessContext {
  return {
    event: {
      id: 'ev1',
      name: 'Test Event',
      lifecycle: 'LOCKED',
      registrationOpensAt: null,
      registrationClosesAt: null,
      published: false,
      publishTimingPolicyCode: 'IMMEDIATE_AFTER_DRAW',
      weighInResultsPublic: false,
    },
    categories: [
      {
        id: 'cat1',
        categoryTemplateWeight: {
          name: '60kg',
          sortOrder: 1,
        },
        eventAgeGroup: {
          categoryTemplateAgeGroup: {
            code: 'ADULT',
            name: 'Adult',
            sex: 'MALE',
          },
        },
        drawReviewedAt: null,
        drawReviewedById: null,
        drawReviewSignature: null,
        drawReviewedBy: null,
      },
    ],
    bracketCount: 0,
    drawnCategoryIds: new Set<string>(),
    registrations: [],
    recentAudit: [],
    lastGeneration: null,
  };
}

// Builders for the multi-category trigger-rule cases.
function cat(
  id: string,
  ageCode: string,
  name = '60kg',
  sortOrder = 1,
  review?: {
    drawReviewedAt?: Date | null;
    drawReviewSignature?: string | null;
    drawReviewedByName?: string | null;
  },
): DrawReadinessContext['categories'][number] {
  return {
    id,
    categoryTemplateWeight: { name, sortOrder },
    eventAgeGroup: {
      categoryTemplateAgeGroup: { code: ageCode, name: ageCode, sex: 'MALE' },
    },
    drawReviewedAt: review?.drawReviewedAt ?? null,
    drawReviewedById: review?.drawReviewedAt ? 'admin1' : null,
    drawReviewSignature: review?.drawReviewSignature ?? null,
    drawReviewedBy: review?.drawReviewedByName
      ? { displayName: review.drawReviewedByName }
      : null,
  };
}

function reg(
  over: Partial<DrawReadinessContext['registrations'][number]> & {
    id: string;
    eventWeightCategoryId: string;
    registeredEventWeightCategoryId: string;
  },
): DrawReadinessContext['registrations'][number] {
  return {
    id: over.id,
    athleteId: `${over.id}-ath`,
    status: 'APPROVED',
    weighInStatus: 'PASSED',
    eventWeightCategoryId: over.eventWeightCategoryId,
    registeredEventWeightCategoryId: over.registeredEventWeightCategoryId,
    athlete: {
      id: `${over.id}-ath`,
      firstName: 'Test',
      lastName: 'Athlete',
      documentId: `${over.id}-doc`,
    },
    club: { name: 'Club' },
    eventWeightCategory: { categoryTemplateWeight: { name: 'final' } },
    registeredEventWeightCategory: { categoryTemplateWeight: { name: 'reg' } },
    weighIns: [{ id: `${over.id}-w`, override: false, weightKg: 60 }],
    ...over,
  };
}

describe('draw readiness compute', () => {
  it('marks category ready when approved athlete passed weigh-in', () => {
    const context = makeBaseContext();
    context.registrations = [
      {
        id: 'reg1',
        athleteId: 'ath1',
        status: 'APPROVED',
        weighInStatus: 'PASSED',
        eventWeightCategoryId: 'cat1',
        registeredEventWeightCategoryId: 'cat1',
        athlete: {
          id: 'ath1',
          firstName: 'Giorgi',
          lastName: 'Beridze',
          documentId: 'GE-ATH-0001',
        },
        club: { name: 'Top Team' },
        eventWeightCategory: {
          categoryTemplateWeight: { name: '60kg' },
        },
        registeredEventWeightCategory: {
          categoryTemplateWeight: { name: '60kg' },
        },
        weighIns: [{ id: 'w1', override: false, weightKg: 59.4 }],
      },
    ];

    const result = computeDrawReadiness(context);

    expect(result.overview.summary.readyCategoriesCount).toBe(1);
    expect(result.overview.summary.blockedCategoriesCount).toBe(0);
    expect(result.overview.actions.canGenerate).toBe(true);
  });

  it('blocks draw when athlete in category is not weighed', () => {
    const context = makeBaseContext();
    context.registrations = [
      {
        id: 'reg1',
        athleteId: 'ath1',
        status: 'APPROVED',
        weighInStatus: 'NOT_WEIGHED',
        eventWeightCategoryId: 'cat1',
        registeredEventWeightCategoryId: 'cat1',
        athlete: {
          id: 'ath1',
          firstName: 'Saba',
          lastName: 'Jikia',
          documentId: 'GE-ATH-0002',
        },
        club: { name: 'Top Team' },
        eventWeightCategory: {
          categoryTemplateWeight: { name: '60kg' },
        },
        registeredEventWeightCategory: {
          categoryTemplateWeight: { name: '60kg' },
        },
        weighIns: [],
      },
    ];

    const result = computeDrawReadiness(context);

    expect(result.overview.summary.blockedCategoriesCount).toBe(1);
    expect(
      result.overview.validation.critical.some(
        (i) => i.code === 'BLOCKED_CATEGORIES_PRESENT',
      ),
    ).toBe(true);
    expect(result.overview.actions.canGenerate).toBe(false);
  });

  it('switches draw status when brackets already exist', () => {
    const context = makeBaseContext();
    context.bracketCount = 1;

    const result = computeDrawReadiness(context);

    expect(result.overview.event.drawStatus).toBe('GENERATED');
    expect(result.overview.actions.canGenerate).toBe(false);
  });

  it('does not flag review for an override-approved athlete', () => {
    const context = makeBaseContext();
    context.registrations = [
      reg({
        id: 'r1',
        eventWeightCategoryId: 'cat1',
        registeredEventWeightCategoryId: 'cat1',
      }),
      reg({
        id: 'r2',
        eventWeightCategoryId: 'cat1',
        registeredEventWeightCategoryId: 'cat1',
        weighInStatus: 'OVERRIDE_APPROVED',
        weighIns: [{ id: 'r2-w', override: true, weightKg: 61.2 }],
      }),
    ];

    const result = computeDrawReadiness(context);

    expect(result.overview.categories[0].readinessStatus).toBe('READY');
    expect(
      result.overview.validation.warnings.some((i) =>
        i.code.startsWith('OVERRIDE'),
      ),
    ).toBe(false);
  });

  it('does not flag a same-age-group move-up', () => {
    const context = makeBaseContext();
    context.categories = [
      cat('cat1', 'ADULT', '60kg', 1),
      cat('cat2', 'ADULT', '65kg', 2),
    ];
    context.registrations = [
      // moved cat1 -> cat2, both ADULT
      reg({
        id: 'r1',
        eventWeightCategoryId: 'cat2',
        registeredEventWeightCategoryId: 'cat1',
      }),
      reg({
        id: 'r2',
        eventWeightCategoryId: 'cat2',
        registeredEventWeightCategoryId: 'cat2',
      }),
    ];

    const result = computeDrawReadiness(context);
    const cat2 = result.overview.categories.find((c) => c.id === 'cat2')!;

    expect(cat2.readinessStatus).toBe('READY');
    expect(cat2.hasAgeGroupMove).toBe(false);
    expect(cat2.hasMovedUpAthletes).toBe(true);
  });

  it('flags a cross-age-group move-up as needs review', () => {
    const context = makeBaseContext();
    context.categories = [
      cat('cat1', 'ADULT', '60kg', 1),
      cat('cat3', 'JUNIOR', '60kg', 1),
    ];
    context.registrations = [
      // JUNIOR registration moved up into the ADULT category
      reg({
        id: 'r1',
        eventWeightCategoryId: 'cat1',
        registeredEventWeightCategoryId: 'cat3',
      }),
      reg({
        id: 'r2',
        eventWeightCategoryId: 'cat1',
        registeredEventWeightCategoryId: 'cat1',
      }),
    ];

    const result = computeDrawReadiness(context);
    const cat1 = result.overview.categories.find((c) => c.id === 'cat1')!;

    expect(cat1.readinessStatus).toBe('NEEDS_REVIEW');
    expect(cat1.hasAgeGroupMove).toBe(true);
    expect(
      result.overview.validation.warnings.some(
        (i) => i.code === 'AGE_GROUP_MOVE_ATHLETES_PRESENT',
      ),
    ).toBe(true);
  });

  it('marks a one-athlete pool as SOLO', () => {
    const context = makeBaseContext();
    context.registrations = [
      reg({
        id: 'r1',
        eventWeightCategoryId: 'cat1',
        registeredEventWeightCategoryId: 'cat1',
      }),
    ];

    const result = computeDrawReadiness(context);

    expect(result.overview.categories[0].readinessStatus).toBe('SOLO');
    expect(result.overview.summary.soloCategoriesCount).toBe(1);
    expect(
      result.overview.validation.warnings.some(
        (i) => i.code === 'ONE_ATHLETE_POOLS_PRESENT',
      ),
    ).toBe(true);
  });

  it('promotes a reviewed category to READY while the signature matches', () => {
    const context = makeBaseContext();
    context.registrations = [
      reg({
        id: 'r1',
        eventWeightCategoryId: 'cat1',
        registeredEventWeightCategoryId: 'cat1',
      }),
    ];
    // A solo pool that has been signed off against its current single-athlete pool.
    const signature = computeCategoryReviewSignature([
      { registrationId: 'r1', crossesAgeGroup: false },
    ]);
    context.categories = [
      cat('cat1', 'ADULT', '60kg', 1, {
        drawReviewedAt: new Date(),
        drawReviewSignature: signature,
        drawReviewedByName: 'Admin User',
      }),
    ];

    const result = computeDrawReadiness(context);
    const c = result.overview.categories[0];

    expect(c.readinessStatus).toBe('READY');
    expect(c.reviewed).toBe(true);
    expect(c.reviewedByName).toBe('Admin User');
    expect(result.overview.summary.soloCategoriesCount).toBe(0);
  });

  it('auto-expires a review whose signature no longer matches the pool', () => {
    const context = makeBaseContext();
    context.registrations = [
      reg({
        id: 'r1',
        eventWeightCategoryId: 'cat1',
        registeredEventWeightCategoryId: 'cat1',
      }),
    ];
    context.categories = [
      cat('cat1', 'ADULT', '60kg', 1, {
        drawReviewedAt: new Date(),
        drawReviewSignature: 'stale-signature-from-an-older-pool',
        drawReviewedByName: 'Admin User',
      }),
    ];

    const result = computeDrawReadiness(context);
    const c = result.overview.categories[0];

    expect(c.readinessStatus).toBe('SOLO');
    expect(c.reviewed).toBe(false);
  });
});
