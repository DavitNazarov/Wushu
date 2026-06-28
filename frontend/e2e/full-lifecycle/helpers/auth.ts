import { expect, type APIRequestContext, type Page } from '@playwright/test';

// Admin credentials from the standard mock-data seed (SEED_MOCK_DATA=1). The
// same admin is reused for the UI `page` and the API `request` seeding context.
export const ADMIN = {
  email: 'admin@geowushu.ge',
  password: 'Password123!',
};

export const LIFECYCLE_STORAGE = 'e2e/.auth/lifecycle-admin.json';

type Creds = { email: string; password: string };

// State-changing requests carrying an Origin must match the CORS allow-list
// (OriginCheckMiddleware). Playwright's APIRequestContext does not set Origin
// by default, so we pass it explicitly to mirror a real browser POST.
export async function loginViaApi(
  request: APIRequestContext,
  baseURL: string,
  creds: Creds = ADMIN,
) {
  return request.post('/api/auth/login', {
    data: creds,
    headers: { origin: baseURL },
  });
}

// Drives the real login *form* (no API shortcut) so the flow itself is covered.
// Used once in the pipeline to satisfy "exercise every UI function". Dev-mode
// hydration lags first paint, so we wait for load before interacting.
export async function loginViaForm(
  page: Page,
  creds: Creds = ADMIN,
  locale = 'en',
): Promise<void> {
  await page.goto(`/${locale}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load').catch(() => undefined);
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"]').fill(creds.email);
  await page.locator('input[type="password"]').fill(creds.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL((url) => !url.pathname.includes('/login'), {
    timeout: 60_000,
  });
}
