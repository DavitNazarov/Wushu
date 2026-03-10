import {
  buildEventPolicyOptions,
  resolveEventPolicies,
} from './event-policy.resolver';

describe('event-policy.resolver', () => {
  it('resolves defaults when no input is provided', () => {
    const resolved = resolveEventPolicies();

    expect(resolved.weighInPolicyCode).toBe('IWUF_STRICT_ONE_HOUR');
    expect(resolved.bronzePolicyCode).toBe('TWO_BRONZES');
    expect(resolved.restPolicyCode).toBe('MIN_15_MINUTES');
    expect(resolved.minRestMinutes).toBe(15);
    expect(resolved.publishTimingPolicyCode).toBe('IMMEDIATE_AFTER_DRAW');
    expect(resolved.reweighWindowMinutes).toBe(60);
  });

  it('enforces 60-minute window for strict IWUF policy', () => {
    expect(() =>
      resolveEventPolicies({
        weighInPolicyCode: 'IWUF_STRICT_ONE_HOUR',
        reweighWindowMinutes: 45,
      }),
    ).toThrow('IWUF_STRICT_POLICY_REQUIRES_60_MINUTE_WINDOW');
  });

  it('enforces minimum 15-minute rest for MIN_15 policy', () => {
    expect(() =>
      resolveEventPolicies({
        restPolicyCode: 'MIN_15_MINUTES',
        minRestMinutes: 10,
      }),
    ).toThrow('MIN_REST_POLICY_REQUIRES_15_MINUTES');
  });

  it('exposes all policy families with defaults', () => {
    const options = buildEventPolicyOptions();
    expect(options.families).toHaveLength(4);
    expect(options.families.map((f) => f.family)).toEqual([
      'WEIGH_IN',
      'BRONZE',
      'MIN_REST',
      'PUBLISH_TIMING',
    ]);
  });
});
