import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { collectErrors, summarize } from '../helpers/console';

// Real UI interactions. In dev mode React hydration lags the initial paint, so
// clicking a submit button too early triggers a NATIVE form submit (lands on
// "/login?") instead of the SPA handler. settle() waits for hydration before we
// interact. Each test gets a fresh context from storageState.
async function settle(page: Page) {
  await page.waitForLoadState('load').catch(() => undefined);
  await page.waitForTimeout(2500); // let React hydrate (dev only)
}

// Login UI (logged-out context — overrides the project's admin storageState).
test.describe('login form', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('admin can sign in through the form', async ({ page }) => {
    await page.goto('/en/login', { waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.locator('input[type="email"]').fill('admin@geowushu.ge');
    await page.locator('input[type="password"]').fill('Password123!');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL((u) => !u.pathname.includes('/login'), { timeout: 60_000 });
    await page.waitForLoadState('load').catch(() => undefined);
    expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(0);
  });

  test('bad credentials stay on /login', async ({ page }) => {
    await page.goto('/en/login', { waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.locator('input[type="email"]').fill('admin@geowushu.ge');
    await page.locator('input[type="password"]').fill('wrong-password');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain('/login');
  });
});

test('Georgian (ka) renders with html lang=ka', async ({ page }) => {
  await page.goto('/ka', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'ka');
  expect(await page.locator('body').innerText()).toMatch(/[Ⴀ-ჿ]/);
});

test('English (en) renders with html lang=en', async ({ page }) => {
  await page.goto('/en', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('public navigation: events list → event detail', async ({ page }) => {
  const { eventSlug } = JSON.parse(readFileSync('e2e/.auth/fc-data.json', 'utf8')) as { eventSlug: string };
  const errors = collectErrors(page);
  await page.goto('/en/events', { waitUntil: 'domcontentloaded' });
  await settle(page);
  // click the card that links to the known published event
  const link = page.locator(`a[href*="/events/${eventSlug}"]`).first();
  await expect(link).toBeVisible({ timeout: 20_000 });
  await link.click();
  await page.waitForURL(new RegExp(`/events/${eventSlug}`), { timeout: 30_000 });
  expect(page.url()).toContain(`/events/${eventSlug}`);
  expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(0);
  expect(summarize(errors)).toBe('');
});

test('contact form submits and persists (POST /api/forms/contact)', async ({ page }) => {
  await page.goto('/en/contact', { waitUntil: 'domcontentloaded' });
  await settle(page);
  const form = page.locator('form').first();
  await expect(form).toBeVisible({ timeout: 20_000 });
  // fill every text input (name, optional club) + email + message
  const texts = form.locator('input[type="text"]');
  const tn = await texts.count();
  for (let i = 0; i < tn; i++) await texts.nth(i).fill(i === 0 ? 'E2E Tester' : 'E2E Club');
  await form.locator('input[type="email"]').first().fill('e2e.tester@example.com');
  await form.locator('textarea').first().fill('Automated full-check contact submission.');

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/forms/contact') && r.request().method() === 'POST', { timeout: 30_000 }),
    form.locator('button[type="submit"]').click(),
  ]);
  expect(resp.status(), 'contact submission accepted').toBeLessThan(400);
  await expect(page.getByText(/thank you|received/i).first()).toBeVisible({ timeout: 10_000 });
});

test('admin logout round-trip returns to login', async ({ page }) => {
  await page.goto('/en/admin', { waitUntil: 'domcontentloaded' });
  await settle(page);
  expect(page.url()).not.toContain('/login');
  const logout = page.getByRole('button', { name: /log\s?out/i }).first();
  await expect(logout).toBeVisible({ timeout: 15_000 });
  await logout.click();
  await page.waitForURL(/\/login/, { timeout: 30_000 });
  expect(page.url()).toContain('/login');
});
