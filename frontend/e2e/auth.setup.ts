import { test as setup } from '@playwright/test';
import { login } from './helpers/auth';
import { ADMIN, COACH, STORAGE } from './helpers/users';

// Logs in once per role and persists the auth cookies so the role projects
// start authenticated. Runs before admin/coach projects (see config deps).
setup('authenticate as admin', async ({ page }) => {
  await login(page, ADMIN);
  await page.context().storageState({ path: STORAGE.admin });
});

setup('authenticate as coach', async ({ page }) => {
  await login(page, COACH);
  await page.context().storageState({ path: STORAGE.coach });
});
