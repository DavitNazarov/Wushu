import { computeDrawReadiness } from './draw.readiness.compute';
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
      },
    ],
    bracketCount: 0,
    drawnCategoryIds: new Set<string>(),
    registrations: [],
    recentAudit: [],
    lastGeneration: null,
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
        weighIns: [{ id: 'w1', override: false }],
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
});
