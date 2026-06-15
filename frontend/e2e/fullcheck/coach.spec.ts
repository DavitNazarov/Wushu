import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { collectErrors, summarize } from '../helpers/console';

// Coach portal (authed as coach1@geowushu.ge) — every coach route renders, and
// the coach cannot reach admin pages (vertical authz).

type Data = { coachEventSlug: string | null };
function data(): Data { return JSON.parse(readFileSync('e2e/.auth/fc-data.json', 'utf8')); }

async function visit(page: import('@playwright/test').Page, path: string, opts: { allowRedirect?: boolean } = {}) {
  const errors = collectErrors(page);
  const resp = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(resp, `nav ${path}`).toBeTruthy();
  expect(resp!.status(), `HTTP ${path}`).toBeLessThan(500);
  await page.waitForLoadState('load').catch(() => undefined);
  if (!opts.allowRedirect) {
    expect(page.url(), `${path} must not bounce to login`).not.toContain('/login');
  }
  expect(summarize(errors), `client errors on ${path}`).toBe('');
}

for (const route of ['/coach', '/coach/athletes', '/coach/events', '/coach/me']) {
  test(`coach ${route}`, async ({ page }) => { await visit(page, `/en${route}`); });
}

for (const sub of ['/registrations', '/brackets', '/schedule', '/live']) {
  test(`coach event${sub}`, async ({ page }) => {
    const { coachEventSlug } = data();
    test.skip(!coachEventSlug, 'no coach event slug');
    await visit(page, `/en/coach/events/${coachEventSlug}${sub}`);
  });
}

test('coach is denied admin (redirected away)', async ({ page }) => {
  await page.goto('/en/admin/users', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load').catch(() => undefined);
  // coach must NOT see the admin users page — bounced to no-access or login
  expect(page.url()).toMatch(/no-access|login|\/coach/);
});

test('coach athletes list is scoped to own club', async ({ page }) => {
  // coach1 belongs to "GE Club 1"; the page should not error and should render
  // (deeper data-scoping is asserted in the API authz suite).
  await page.goto('/en/coach/athletes', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load').catch(() => undefined);
  expect(page.url()).not.toContain('/login');
  const text = (await page.locator('body').innerText().catch(() => '')) || '';
  expect(text.trim().length).toBeGreaterThan(0);
});
