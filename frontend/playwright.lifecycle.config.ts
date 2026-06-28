import { defineConfig, devices } from '@playwright/test';

// ──────────────────────────────────────────────────────────────────────────
// FULL-LIFECYCLE suite — one stateful pipeline that walks the whole platform:
//   data setup → event → registration → weigh-in → draw → publish → schedule
//   → live → results → PDF export.
//
// HYBRID coverage (see e2e/full-lifecycle/README.md):
//   • every distinct UI page/function is exercised through the real browser at
//     least once, and every edge-case branch gets its own UI assertion;
//   • bulk VOLUME (reaching 400 athletes, weighing/finishing the long tail) is
//     seeded through the REAL API with the admin auth cookie — not UI clicks.
//
// Runs against an ALREADY-RUNNING dev stack (frontend :3000 + backend :4000 +
// a LOCAL/disposable, migrated, seeded Postgres). There is intentionally NO
// webServer block — the user starts the stack. Override the target with
// E2E_BASE_URL.
//
// IMPORTANT: use `localhost`, NOT `127.0.0.1`. Next 16's dev HMR WebSocket
// rejects a non-allowed dev origin (127.0.0.1) with ERR_INVALID_HTTP_RESPONSE,
// which breaks client hydration — pages still render (a crawl falsely passes)
// but no React handler fires, so every interaction test fails.
//
// Artifacts land under the gitignored e2e/.report + e2e/.test-results (NEVER a
// non-ignored dir — Tailwind v4 scans them and corrupts globals.css).
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e/full-lifecycle',
  outputDir: './e2e/.test-results',
  // Generous: the pipeline seeds 400 athletes + drives a full live run in one
  // serial test file. Per-test budget is large because phases do real work.
  timeout: 240_000,
  expect: { timeout: 15_000 },
  // This is a single stateful pipeline — never parallelise it.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'e2e/.report/lifecycle' }],
    ['json', { outputFile: 'e2e/.report/lifecycle-results.json' }],
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
    { name: 'lf-setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'lifecycle',
      testMatch: /full-lifecycle\.spec\.ts/,
      dependencies: ['lf-setup'],
      use: { storageState: 'e2e/.auth/lifecycle-admin.json' },
    },
  ],
});
