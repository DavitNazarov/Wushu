import { test as setup, expect } from '@playwright/test';
import { ADMIN, LIFECYCLE_STORAGE, loginViaApi } from './helpers/auth';

// Establish the admin session via the API (robust — no dependence on the
// cold-compile login-form redirect timing) and persist cookies for the
// `lifecycle` project. The real login *form* is still exercised as a UI step
// inside full-lifecycle.spec.ts. gw_auth lives 15 min and gw_refresh 7 days;
// both are saved, so the browser context auto-refreshes during the long run.
setup('admin auth (API) → storageState', async ({ request, baseURL }) => {
  const res = await loginViaApi(request, baseURL!, ADMIN);
  expect(res.ok(), await res.text()).toBeTruthy();
  await request.storageState({ path: LIFECYCLE_STORAGE });
});
