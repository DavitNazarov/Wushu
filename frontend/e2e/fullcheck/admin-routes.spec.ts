import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { collectErrors, summarize } from '../helpers/console';

// Crawls EVERY admin route + event sub-pages + the TV display, authenticated as
// admin (storageState). Asserts the page renders content with no uncaught page
// errors / 5xx / console errors.

type Data = { eventId: string | null; athleteId: string | null; clubId: string | null; countryId: string | null };
function data(): Data { return JSON.parse(readFileSync('e2e/.auth/fc-data.json', 'utf8')); }

const STATIC_ADMIN = [
  '/admin', '/admin/events', '/admin/athletes', '/admin/clubs', '/admin/users',
  '/admin/countries', '/admin/category-templates', '/admin/category-options',
  '/admin/rulesets', '/admin/news', '/admin/news/new', '/admin/content',
  '/admin/inbox', '/admin/integrity', '/admin/signatures', '/admin/settings',
  // legacy redirect shims (should redirect, not 500)
  '/admin/weighin', '/admin/weighin-results', '/admin/registrations',
  '/admin/brackets', '/admin/schedule', '/admin/live', '/admin/results',
];

const EVENT_SUBPAGES = ['', '/registrations', '/weigh-in', '/weighin-results', '/brackets', '/schedule', '/results', '/live'];

async function visit(page: import('@playwright/test').Page, path: string) {
  const errors = collectErrors(page);
  const resp = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(resp, `nav ${path}`).toBeTruthy();
  expect(resp!.status(), `HTTP ${path}`).toBeLessThan(400);
  await page.waitForLoadState('load').catch(() => undefined);
  // not redirected to login/no-access (auth must hold)
  expect(page.url(), `${path} must not bounce to login`).not.toContain('/login');
  const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
  expect(bodyText.trim().length, `${path} rendered text`).toBeGreaterThan(0);
  expect(summarize(errors), `client errors on ${path}`).toBe('');
}

for (const route of STATIC_ADMIN) {
  test(`admin ${route}`, async ({ page }) => { await visit(page, `/en${route}`); });
}

for (const sub of EVENT_SUBPAGES) {
  test(`admin event${sub || ' (overview)'}`, async ({ page }) => {
    const { eventId } = data();
    test.skip(!eventId, 'no event id');
    await visit(page, `/en/admin/events/${eventId}${sub}`);
  });
}

test('admin athlete detail', async ({ page }) => {
  const { athleteId } = data();
  test.skip(!athleteId, 'no athlete id');
  await visit(page, `/en/admin/athletes/${athleteId}`);
});

test('admin club detail', async ({ page }) => {
  const { clubId } = data();
  test.skip(!clubId, 'no club id');
  await visit(page, `/en/admin/clubs/${clubId}`);
});

test('admin country detail', async ({ page }) => {
  const { countryId } = data();
  test.skip(!countryId, 'no country id');
  await visit(page, `/en/admin/countries/${countryId}`);
});

test('admin TV display', async ({ page }) => {
  const { eventId } = data();
  test.skip(!eventId, 'no event id');
  await visit(page, `/en/display/${eventId}`);
});

test('admin renders in Georgian (ka) too', async ({ page }) => {
  await visit(page, '/ka/admin');
});
