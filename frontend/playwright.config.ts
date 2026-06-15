import { defineConfig, devices } from '@playwright/test';

// E2E suite for the Geo Wushu public + authenticated app. Runs against an
// already-running dev stack (frontend + backend with seed data). Override the
// target with E2E_BASE_URL.
//
// Auth: the `setup` project logs in as each role once and saves storageState
// to e2e/.auth/*.json; role projects reuse it so every test starts signed in.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  // Keep run artifacts under e2e/ (gitignored). The default `test-results/`
  // sits at the frontend root, which is NOT ignored — Tailwind v4 then scans
  // the serialized RSC HTML inside error-context.md, extracts a broken class
  // candidate, and corrupts globals.css (site-wide 500). See e2e/.gitignore.
  outputDir: './e2e/.test-results',
  // Per-test timeout — generous because dev-mode first compiles are slow.
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'e2e/.report' }],
    ['json', { outputFile: 'e2e/.report/results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 12_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    // Anonymous / public — no stored auth.
    {
      name: 'public',
      testMatch: /public\.|auth\.spec\.|performance\./,
      use: { ...devices['Desktop Chrome'] },
    },

    // Admin role — signed in via storageState.
    {
      name: 'admin',
      testMatch: /admin\.spec\./,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },

    // Coach role — signed in via storageState.
    {
      name: 'coach',
      testMatch: /coach\.spec\./,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/coach.json',
      },
    },
  ],
});
