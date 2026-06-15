import { expect, type Page } from '@playwright/test';

type Creds = { email: string; password: string };

// Drives the real login form (no API shortcut) so the flow itself is exercised.
// Waits for the post-login redirect away from /login.
export async function login(
  page: Page,
  creds: Creds,
  locale = 'en',
): Promise<void> {
  await page.goto(`/${locale}/login`);
  await page.locator('input[type="email"]').fill(creds.email);
  await page.locator('input[type="password"]').fill(creds.password);
  await page.locator('button[type="submit"]').click();

  // Successful login redirects to a role dashboard; assert we left /login.
  await expect(page).toHaveURL(
    (url) => !url.pathname.includes('/login'),
    { timeout: 20_000 },
  );
}
