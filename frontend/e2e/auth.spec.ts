import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { ADMIN, COACH } from './helpers/users';

// Runs in the anonymous 'public' project — each test starts signed out.
test.describe('authentication & authorization', () => {
  test('valid admin login reaches the admin app', async ({ page }) => {
    await login(page, ADMIN);
    await expect(page).toHaveURL(/\/(en|ka)\/admin/);
  });

  test('invalid credentials are rejected and stay on login', async ({ page }) => {
    await page.goto('/en/login');
    await page.locator('input[type="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill('definitely-wrong-pw');
    await page.locator('button[type="submit"]').click();
    // No redirect away from login.
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('anonymous visitor is redirected from /admin to login', async ({ page }) => {
    await page.goto('/en/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('anonymous visitor is redirected from /coach to login', async ({ page }) => {
    await page.goto('/en/coach');
    await expect(page).toHaveURL(/\/login/);
  });

  test('coach cannot access the admin area (vertical privilege)', async ({
    page,
  }) => {
    await login(page, COACH);
    await expect(page).toHaveURL(/\/(en|ka)\/coach/);
    // Attempt to escalate into admin.
    await page.goto('/en/admin');
    await expect(page).toHaveURL(/\/no-access|\/login/);
  });

  test('logout ends the session', async ({ page }) => {
    await login(page, ADMIN);
    await expect(page).toHaveURL(/\/admin/);

    // Find a logout control (button or link) and trigger it.
    const logout = page
      .getByRole('button', { name: /log\s?out|sign\s?out/i })
      .or(page.getByRole('link', { name: /log\s?out|sign\s?out/i }))
      .first();
    if (await logout.count()) {
      await logout.click();
      // Logout client-navigates to /login; let it settle before probing so the
      // next goto doesn't race the in-flight redirect (net::ERR_ABORTED).
      await page.waitForURL(/\/login/, { timeout: 15_000 }).catch(() => undefined);
    } else {
      // Fallback: hit the logout endpoint directly, then reload.
      await page.request.post('/api/auth/logout');
    }

    // After logout, the admin area must redirect to login again. The redirect
    // can abort the document request mid-flight, so wait on the URL, not load.
    await page.goto('/en/admin', { waitUntil: 'commit' }).catch(() => undefined);
    await expect(page).toHaveURL(/\/login/);
  });
});
