import { CreateEventSchema } from './event.types';

function validPayload(overrides: Partial<any> = {}) {
  return {
    name: 'Georgia Open Cup 2026',
    slug: 'georgia-open-cup-2026',
    location: 'Tbilisi',
    timezone: 'Asia/Tbilisi',
    dates: {
      range: {
        startDate: '2026-03-02',
        endDate: '2026-03-05',
      },
      registrationDays: ['2026-03-02', '2026-03-03'],
      fightDays: ['2026-03-04', '2026-03-05'],
    },
    ...overrides,
  };
}

describe('CreateEventSchema (date-only event model)', () => {
  it('accepts a valid payload', () => {
    const result = CreateEventSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it('rejects endDate < startDate', () => {
    const result = CreateEventSchema.safeParse(
      validPayload({
        dates: {
          range: {
            startDate: '2026-03-05',
            endDate: '2026-03-02',
          },
          registrationDays: ['2026-03-02'],
          fightDays: ['2026-03-05'],
        },
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join('.') === 'dates.range.endDate',
      );
      expect(issue).toBeDefined();
    }
  });

  it('rejects empty registrationDays', () => {
    const result = CreateEventSchema.safeParse(
      validPayload({
        dates: {
          range: {
            startDate: '2026-03-02',
            endDate: '2026-03-05',
          },
          registrationDays: [],
          fightDays: ['2026-03-04'],
        },
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join('.') === 'dates.registrationDays',
      );
      expect(issue).toBeDefined();
    }
  });

  it('rejects empty fightDays', () => {
    const result = CreateEventSchema.safeParse(
      validPayload({
        dates: {
          range: {
            startDate: '2026-03-02',
            endDate: '2026-03-05',
          },
          registrationDays: ['2026-03-02'],
          fightDays: [],
        },
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join('.') === 'dates.fightDays',
      );
      expect(issue).toBeDefined();
    }
  });

  it('rejects days outside range', () => {
    const result = CreateEventSchema.safeParse(
      validPayload({
        dates: {
          range: {
            startDate: '2026-03-02',
            endDate: '2026-03-05',
          },
          registrationDays: ['2026-03-01'],
          fightDays: ['2026-03-06'],
        },
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('dates.registrationDays');
      expect(paths).toContain('dates.fightDays');
    }
  });

  it('rejects registrationDays after first fight day', () => {
    const result = CreateEventSchema.safeParse(
      validPayload({
        dates: {
          range: {
            startDate: '2026-03-02',
            endDate: '2026-03-05',
          },
          registrationDays: ['2026-03-04', '2026-03-05'],
          fightDays: ['2026-03-04'],
        },
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join('.') === 'dates.registrationDays',
      );
      expect(issue).toBeDefined();
    }
  });

  it('allows same-day registration and fight day', () => {
    const result = CreateEventSchema.safeParse(
      validPayload({
        dates: {
          range: {
            startDate: '2026-03-02',
            endDate: '2026-03-02',
          },
          registrationDays: ['2026-03-02'],
          fightDays: ['2026-03-02'],
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects registration close date on event start day', () => {
    const result = CreateEventSchema.safeParse(
      validPayload({
        registrationWindow: {
          opensAt: '2026-02-20',
          closesAt: '2026-03-02',
        },
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join('.') === 'registrationWindow.closesAt',
      );
      expect(issue).toBeDefined();
    }
  });
});
