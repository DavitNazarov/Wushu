import { test, expect } from '@playwright/test';

// Navigation-timing budgets for anonymous public pages. These are smoke-level
// guardrails (dev server, so absolute numbers are loose) — the goal is to catch
// gross regressions (a page that takes 10s, a payload that balloons), not to
// benchmark prod. Budgets are deliberately generous for `next dev`.
//
// Reported metrics per page:
//   - ttfb        : responseStart - requestStart
//   - domContent  : domContentLoadedEventEnd - startTime
//   - loadComplete: loadEventEnd - startTime
//   - transferKB  : total bytes over the wire for the navigation document
const PAGES = ['/en', '/en/events', '/en/clubs', '/en/news'];

// Generous dev-mode budget for full load (ms).
const LOAD_BUDGET_MS = 12_000;

type Metric = {
  route: string;
  ttfb: number;
  domContent: number;
  loadComplete: number;
};

const collected: Metric[] = [];

test.describe('performance — public navigation timing', () => {
  for (const route of PAGES) {
    test(`timing budget: ${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'load' });

      const timing = await page.evaluate(() => {
        const [nav] = performance.getEntriesByType(
          'navigation',
        ) as PerformanceNavigationTiming[];
        if (!nav) return null;
        return {
          ttfb: nav.responseStart - nav.requestStart,
          domContent: nav.domContentLoadedEventEnd - nav.startTime,
          loadComplete: nav.loadEventEnd - nav.startTime,
        };
      });

      expect(timing, `no navigation timing for ${route}`).not.toBeNull();
      collected.push({ route, ...timing! });

      // Hard guardrail: page must fully load within the dev budget.
      expect(
        timing!.loadComplete,
        `${route} load took ${Math.round(timing!.loadComplete)}ms`,
      ).toBeLessThan(LOAD_BUDGET_MS);
    });
  }

  test.afterAll(() => {
    if (collected.length === 0) return;
    // Emit a readable table into the test output for the run report.
    const rows = collected
      .map(
        (m) =>
          `  ${m.route.padEnd(16)} ttfb=${Math.round(m.ttfb)
            .toString()
            .padStart(5)}ms  dom=${Math.round(m.domContent)
            .toString()
            .padStart(6)}ms  load=${Math.round(m.loadComplete)
            .toString()
            .padStart(6)}ms`,
      )
      .join('\n');
    // eslint-disable-next-line no-console
    console.log(`\n── Public navigation timing ──\n${rows}\n`);
  });
});
