import { defineConfig, devices } from '@playwright/test';

// "Check EVERYTHING" suite — exhaustive Playwright pass over the whole app:
//   fc-api          full event lifecycle through the REAL API (every endpoint)
//   fc-public       crawl every public route, both locales, assert no errors
//   fc-admin        crawl every admin route + event sub-pages (authed)
//   fc-coach        coach portal + own-club scoping
//   fc-interactions real UI flows (locale switch, contact form, admin CRUD, logout)
//
// Runs against an already-running stack (default the isolated :3100 / :4100 with
// the bootstrapped admin + coach1@geowushu.ge + published full event). Override
// with E2E_BASE_URL. Artifacts go under the gitignored e2e/.report + .test-results
// (NEVER a non-ignored dir — Tailwind v4 scans them and corrupts globals.css).
//
// IMPORTANT: use `localhost`, NOT `127.0.0.1`. Next 16's dev HMR WebSocket
// rejects a non-allowed dev origin (127.0.0.1) with ERR_INVALID_HTTP_RESPONSE,
// which breaks client hydration — every page still RENDERS (so the crawl falsely
// passes) but no React handler fires, so all form/button interaction tests fail.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3100';

export default defineConfig({
  testDir: './e2e/fullcheck',
  outputDir: './e2e/.test-results',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'e2e/.report/fullcheck' }],
    ['json', { outputFile: 'e2e/.report/fullcheck-results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    ...devices['Desktop Chrome'],
  },
  projects: [
    { name: 'fc-setup', testMatch: /auth\.setup\.ts/ },
    { name: 'fc-api', testMatch: /api-pipeline\.spec\.ts/, dependencies: ['fc-setup'], use: { storageState: 'e2e/.auth/fc-admin.json' } },
    { name: 'fc-public', testMatch: /public-routes\.spec\.ts/, dependencies: ['fc-setup'] },
    { name: 'fc-admin', testMatch: /admin-routes\.spec\.ts/, dependencies: ['fc-setup'], use: { storageState: 'e2e/.auth/fc-admin.json' } },
    { name: 'fc-coach', testMatch: /coach\.spec\.ts/, dependencies: ['fc-setup'], use: { storageState: 'e2e/.auth/fc-coach.json' } },
    { name: 'fc-interactions', testMatch: /interactions\.spec\.ts/, dependencies: ['fc-setup'], use: { storageState: 'e2e/.auth/fc-admin.json' } },
  ],
});
