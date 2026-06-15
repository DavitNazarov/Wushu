import { test, expect } from '@playwright/test';
import { collectErrors, summarize } from './helpers/console';

// Runs in the 'coach' project (coach storageState).
const COACH_ROUTES = [
  '/en/coach',
  '/en/coach/athletes',
  '/en/coach/events',
  '/en/coach/me',
];

test.describe('coach — portal', () => {
  for (const route of COACH_ROUTES) {
    test(`renders ${route}`, async ({ page }) => {
      const errors = collectErrors(page);
      const resp = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(resp!.status(), `bad status for ${route}`).toBeLessThan(400);
      await expect(page).toHaveURL(/\/coach/);
      await expect(page.locator('body')).not.toBeEmpty();
      await page.waitForLoadState('networkidle').catch(() => undefined);
      expect(
        errors.pageErrors.length === 0 && errors.badResponses.length === 0,
        `client errors on ${route}:\n${summarize(errors)}`,
      ).toBeTruthy();
    });
  }
});

test.describe('coach — own-club scoping', () => {
  test('athlete list is scoped to the coach club only', async ({ request }) => {
    // Coach athletes endpoint forces the coach's own clubId server-side.
    const res = await request.get('/api/athletes?limit=500');
    expect(res.status()).toBe(200);
    const rows = (await res.json()) as { club?: { name?: string } | null }[];
    expect(rows.length, 'coach has athletes').toBeGreaterThan(0);
    const clubNames = new Set(
      rows.map((r) => r.club?.name ?? 'none').filter((n) => n !== 'none'),
    );
    // A coach is bound to a single club — every athlete returned shares it.
    expect(
      clubNames.size,
      `coach saw athletes from multiple clubs: ${[...clubNames].join(', ')}`,
    ).toBeLessThanOrEqual(1);
  });

  test('coach cannot call an admin-only endpoint', async ({ request }) => {
    // Users admin is EVENTS_MANAGE (admin only) — coach must be forbidden.
    const res = await request.get('/api/admin/users');
    expect([401, 403]).toContain(res.status());
  });

  test('coach cannot reach an admin page in the browser', async ({ page }) => {
    await page.goto('/en/admin/users');
    await expect(page).toHaveURL(/\/no-access|\/login/);
  });
});
