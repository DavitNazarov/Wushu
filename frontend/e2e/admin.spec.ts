import { test, expect } from '@playwright/test';
import { collectErrors, summarize } from './helpers/console';

// Every top-level admin page. Smoke goal: renders without a client crash or
// 5xx, and the page stays inside /admin (no bounce to login/no-access).
const ADMIN_ROUTES = [
  '/en/admin',
  '/en/admin/events',
  '/en/admin/athletes',
  '/en/admin/clubs',
  '/en/admin/countries',
  '/en/admin/users',
  '/en/admin/category-templates',
  '/en/admin/category-options',
  '/en/admin/rulesets',
  '/en/admin/weighin',
  '/en/admin/weighin-results',
  '/en/admin/registrations',
  '/en/admin/brackets',
  '/en/admin/schedule',
  '/en/admin/live',
  '/en/admin/results',
  '/en/admin/news',
  '/en/admin/content',
  '/en/admin/inbox',
  '/en/admin/integrity',
  '/en/admin/signatures',
  '/en/admin/settings',
];

test.describe('admin — page smoke', () => {
  for (const route of ADMIN_ROUTES) {
    test(`renders ${route}`, async ({ page }) => {
      const errors = collectErrors(page);
      const resp = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(resp!.status(), `bad status for ${route}`).toBeLessThan(400);
      // Stayed authenticated (didn't bounce out of /admin).
      await expect(page).toHaveURL(/\/admin/);
      await expect(page.locator('body')).not.toBeEmpty();
      await page.waitForLoadState('networkidle').catch(() => undefined);
      expect(
        errors.pageErrors.length === 0 && errors.badResponses.length === 0,
        `client errors on ${route}:\n${summarize(errors)}`,
      ).toBeTruthy();
    });
  }
});

test.describe('admin — data loads', () => {
  test('athletes registry returns seeded rows via authed API', async ({
    request,
  }) => {
    const res = await request.get('/api/athletes?limit=500');
    expect(res.status()).toBe(200);
    const rows = (await res.json()) as unknown[];
    expect(rows.length, 'seed has athletes').toBeGreaterThan(0);
  });

  test('events list loads and an event detail opens with sub-pages', async ({
    page,
    request,
  }) => {
    const res = await request.get('/api/events');
    expect(res.status()).toBe(200);
    const events = (await res.json()) as { id: string }[];
    expect(events.length, 'seed has events').toBeGreaterThan(0);
    const eventId = events[0].id;

    const subPages = [
      `/en/admin/events/${eventId}`,
      `/en/admin/events/${eventId}/registrations`,
      `/en/admin/events/${eventId}/brackets`,
      `/en/admin/events/${eventId}/schedule`,
      `/en/admin/events/${eventId}/results`,
    ];
    for (const route of subPages) {
      const errors = collectErrors(page);
      const resp = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(resp!.status(), `bad status for ${route}`).toBeLessThan(400);
      await expect(page).toHaveURL(/\/admin/);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      expect(
        errors.pageErrors.length === 0 && errors.badResponses.length === 0,
        `client errors on ${route}:\n${summarize(errors)}`,
      ).toBeTruthy();
    }
  });

  test('admin dashboard renders without falling back to an error state', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/en/admin', { waitUntil: 'networkidle' });
    // The dashboard should show real content, not an error boundary.
    await expect(page.locator('body')).not.toContainText(/application error/i);
    expect(errors.pageErrors, summarize(errors)).toHaveLength(0);
  });
});
