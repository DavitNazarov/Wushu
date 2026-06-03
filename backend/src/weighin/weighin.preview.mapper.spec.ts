import { mapPreviewStateFromOutcome } from './weighin.preview.mapper';

// Pin the policy-outcome → UI-state mapping so accidental edits to the action
// lists in weighin.preview.mapper don't silently change what buttons appear.
describe('weigh-in preview mapper', () => {
  it('maps pass outcomes to AUTO_PASS', () => {
    const mapped = mapPreviewStateFromOutcome({
      alreadyRecorded: false,
      manualPolicy: false,
      outcome: {
        decision: 'PASS',
        weighInStatus: 'PASSED',
        moveToCategoryId: null,
        deadlineAt: null,
        reason: 'WEIGHT_IN_REGISTERED_CATEGORY',
      },
      nextCategory: null,
    });

    expect(mapped.decisionState).toBe('AUTO_PASS');
    expect(mapped.allowedActions[0]?.code).toBe('RECORD_WEIGH_IN');
  });

  it('maps move-up outcomes with target category', () => {
    const mapped = mapPreviewStateFromOutcome({
      alreadyRecorded: false,
      manualPolicy: false,
      outcome: {
        decision: 'MOVED_UP',
        weighInStatus: 'MOVED_UP',
        moveToCategoryId: 'c2',
        deadlineAt: null,
        reason: 'DIRECT_MOVE_UP_TO_NEXT_CATEGORY',
      },
      nextCategory: {
        id: 'c2',
        name: '56kg',
        minWeightKgExcl: 52,
        maxWeightKgIncl: 56,
        sortOrder: 2,
      },
    });

    expect(mapped.decisionState).toBe('MOVE_UP_AVAILABLE');
    expect(mapped.allowedActions[0]?.code).toBe('MOVE_UP');
    expect(mapped.allowedActions[0]?.targetCategoryName).toBe('56kg');
  });

  it('maps final records to ALREADY_RECORDED', () => {
    const mapped = mapPreviewStateFromOutcome({
      alreadyRecorded: true,
      manualPolicy: false,
      outcome: null,
      nextCategory: null,
    });

    expect(mapped.decisionState).toBe('ALREADY_RECORDED');
    expect(mapped.allowedActions).toHaveLength(1);
    expect(mapped.allowedActions[0]?.code).toBe('MANUAL_OVERRIDE');
  });
});
