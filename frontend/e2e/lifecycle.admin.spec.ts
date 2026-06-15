import { test, expect, type APIRequestContext } from '@playwright/test';

// Event lifecycle + draw-readiness gating, exercised on FRESH events created per
// test (unique slug) so the seeded events are never mutated. Covers the real
// EventOpsService transition rules and DrawService readiness critical codes.

const canonicalDates = () => ({
  registrationStartDate: '2026-09-01T09:00:00.000Z',
  registrationEndDate: '2026-09-10T18:00:00.000Z',
  weighInStartDate: '2026-09-14T09:00:00.000Z',
  weighInEndDate: '2026-09-14T18:00:00.000Z',
  competitionStartDate: '2026-09-15T09:00:00.000Z',
  competitionEndDate: '2026-09-16T18:00:00.000Z',
});

// Track every event created here so it can be torn down — otherwise these
// REG_OPEN events leak into the public listing and slow/clutter other specs.
const createdEventIds: string[] = [];

async function createEvent(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {},
) {
  const slug = `e2e-lc-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  const res = await request.post('/api/events', {
    data: {
      name: 'E2E Lifecycle Event',
      nameKa: 'ე2ე ცხოვრების ციკლი',
      slug,
      location: 'Tbilisi',
      dates: canonicalDates(),
      ...overrides,
    },
  });
  if (res.ok()) {
    const id = ((await res.json()) as { id?: string }).id;
    if (id) createdEventIds.push(id);
    // Re-expose the parsed body to callers (response body is single-read).
    return { res, slug, id };
  }
  return { res, slug, id: undefined as string | undefined };
}

test.afterAll(async ({ request }) => {
  for (const id of createdEventIds.splice(0)) {
    await request.delete(`/api/events/${id}`).catch(() => undefined);
  }
});

test.describe('event lifecycle — creation & validation', () => {
  test('creates a REG_OPEN event and round-trips bilingual name', async ({
    request,
  }) => {
    const { res } = await createEvent(request);
    expect(res.status(), await res.text()).toBe(201);
    const ev = (await res.json()) as {
      id: string;
      lifecycle: string;
      published: boolean;
      nameKa: string;
    };
    expect(ev.lifecycle).toBe('REG_OPEN');
    expect(ev.published).toBe(false);
    expect(ev.nameKa).toBe('ე2ე ცხოვრების ციკლი');

    const got = await request.get(`/api/events/${ev.id}`);
    expect(got.status()).toBe(200);
    expect(((await got.json()) as { id: string }).id).toBe(ev.id);
  });

  test('rejects a duplicate slug', async ({ request }) => {
    const res = await createEvent(request, { slug: 'ge-national-spring-2026' });
    expect(res.res.status()).toBe(422);
    const err = (await res.res.json()) as { issues?: { message: string }[] };
    expect(JSON.stringify(err.issues)).toMatch(/slug/i);
  });
});

test.describe('event lifecycle — transition rules', () => {
  test('an invalid skip transition is rejected', async ({ request }) => {
    const { res } = await createEvent(request);
    const { id } = (await res.json()) as { id: string };
    // REG_OPEN -> DRAWN skips LOCKED/WEIGHIN/... and must be refused.
    const t = await request.post(`/api/events/${id}/lifecycle`, {
      data: { to: 'DRAWN' },
    });
    expect(t.status()).toBe(400);
    expect(await t.text()).toContain('INVALID_EVENT_TRANSITION');
  });

  test('an unknown target state does not 500', async ({ request }) => {
    const { res } = await createEvent(request);
    const { id } = (await res.json()) as { id: string };
    const t = await request.post(`/api/events/${id}/lifecycle`, {
      data: { to: 'NOT_A_STATE' },
    });
    // Must be a client error (400-class), never an unhandled 500.
    expect(t.status()).toBeGreaterThanOrEqual(400);
    expect(t.status()).toBeLessThan(500);
  });
});

test.describe('draw readiness — gating', () => {
  test('drawing an unprepared event is refused with EVENT_NOT_LOCKED', async ({
    request,
  }) => {
    const { res } = await createEvent(request);
    const { id } = (await res.json()) as { id: string };
    const draw = await request.post('/api/draw', { data: { eventId: id } });
    expect(draw.status()).toBe(400);
    expect(await draw.text()).toContain('EVENT_NOT_LOCKED');
  });
});

test.describe('event categories — selection round-trip', () => {
  test('selecting an age group + weights persists and reads back', async ({
    request,
  }) => {
    const { res } = await createEvent(request);
    const { id } = (await res.json()) as { id: string };

    // Fresh events start with the default template and no age groups selected.
    const before = (await (
      await request.get(`/api/events/${id}/categories`)
    ).json()) as { categoryTemplateId: string; ageGroups: unknown[] };
    expect(before.ageGroups).toHaveLength(0);

    // Pull the template's real groups + weight categories.
    const template = (await (
      await request.get(
        `/api/category-templates/${before.categoryTemplateId}/categories`,
      )
    ).json()) as {
      id: string;
      weightCategories: { id: string }[];
    }[];
    test.skip(!template.length, 'template has no categories');
    const group = template[0];
    const weightIds = group.weightCategories.slice(0, 2).map((w) => w.id);

    const sel = await request.post(`/api/events/${id}/categories`, {
      data: {
        categoryTemplateId: before.categoryTemplateId,
        ageGroups: [
          { categoryTemplateGroupId: group.id, weightCategoryIds: weightIds },
        ],
      },
    });
    expect(sel.status(), await sel.text()).toBeLessThan(400);

    const after = (await (
      await request.get(`/api/events/${id}/categories`)
    ).json()) as { ageGroups: { weightCategoryIds?: string[] }[] };
    expect(after.ageGroups.length).toBeGreaterThan(0);
  });
});
