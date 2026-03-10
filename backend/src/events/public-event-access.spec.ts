import {
  canDiscoverEventPublicly,
  canViewCompetitionDataPublicly,
} from './public-event-access';

function makeEvent(overrides: Partial<{
  published: boolean;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  lifecycle: string;
}> = {}) {
  return {
    published: false,
    registrationOpensAt: null,
    registrationClosesAt: null,
    lifecycle: 'LOCKED',
    ...overrides,
  };
}

describe('public-event-access', () => {
  const now = new Date('2026-03-09T10:00:00.000Z');

  it('allows published events to be discovered', () => {
    expect(
      canDiscoverEventPublicly(
        makeEvent({
          published: true,
        }),
        now,
      ),
    ).toBe(true);
  });

  it('allows unpublished events while registration is upcoming', () => {
    expect(
      canDiscoverEventPublicly(
        makeEvent({
          registrationOpensAt: new Date('2026-03-10T09:00:00.000Z'),
          registrationClosesAt: new Date('2026-03-20T09:00:00.000Z'),
          lifecycle: 'REG_OPEN',
        }),
        now,
      ),
    ).toBe(true);
  });

  it('allows unpublished legacy REG_OPEN events to be discovered', () => {
    expect(
      canDiscoverEventPublicly(
        makeEvent({
          lifecycle: 'REG_OPEN',
        }),
        now,
      ),
    ).toBe(true);
  });

  it('hides unpublished closed events', () => {
    expect(
      canDiscoverEventPublicly(
        makeEvent({
          registrationOpensAt: new Date('2026-03-01T09:00:00.000Z'),
          registrationClosesAt: new Date('2026-03-05T09:00:00.000Z'),
          lifecycle: 'LOCKED',
        }),
        now,
      ),
    ).toBe(false);
  });

  it('exposes competition data only after publish', () => {
    expect(
      canViewCompetitionDataPublicly(makeEvent({ published: true })),
    ).toBe(true);
    expect(
      canViewCompetitionDataPublicly(makeEvent({ published: false })),
    ).toBe(false);
  });
});
