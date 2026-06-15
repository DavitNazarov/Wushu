import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { collectErrors, summarize } from '../helpers/console';

// Crawls EVERY public route in BOTH locales, asserting: navigation succeeds
// (<400), no uncaught page errors / 5xx / console errors (filtered), and the
// page rendered real content. Dynamic ids come from fc-data.json (setup).

type Data = {
  eventSlug: string | null; clubId: string | null; countryId: string | null;
  athleteId: string | null; matName: string | null; newsSlug: string | null;
};
function data(): Data {
  return JSON.parse(readFileSync('e2e/.auth/fc-data.json', 'utf8'));
}

// route templates → builder. optional=true skips when its id is missing.
const ROUTES: Array<{ name: string; build: (d: Data) => string | null; optional?: boolean }> = [
  { name: 'home', build: () => '' },
  { name: 'events', build: () => '/events' },
  { name: 'event detail', build: (d) => (d.eventSlug ? `/events/${d.eventSlug}` : null) },
  { name: 'event brackets', build: (d) => (d.eventSlug ? `/events/${d.eventSlug}/brackets` : null) },
  { name: 'event schedule', build: (d) => (d.eventSlug ? `/events/${d.eventSlug}/schedule` : null) },
  { name: 'event live', build: (d) => (d.eventSlug ? `/events/${d.eventSlug}/live` : null) },
  { name: 'event results', build: (d) => (d.eventSlug ? `/events/${d.eventSlug}/results` : null) },
  { name: 'clubs', build: () => '/clubs' },
  { name: 'club detail', build: (d) => (d.clubId ? `/clubs/${d.clubId}` : null), optional: true },
  { name: 'countries', build: () => '/countries' },
  { name: 'country detail', build: (d) => (d.countryId ? `/countries/${d.countryId}` : null), optional: true },
  { name: 'athlete profile', build: (d) => (d.athleteId ? `/athletes/${d.athleteId}` : null), optional: true },
  { name: 'news', build: () => '/news' },
  { name: 'news detail', build: (d) => (d.newsSlug ? `/news/${d.newsSlug}` : null), optional: true },
  { name: 'rules', build: () => '/rules' },
  { name: 'contact', build: () => '/contact' },
  { name: 'about', build: () => '/about' },
  { name: 'mat board', build: (d) => (d.eventSlug && d.matName ? `/mat/${d.eventSlug}/${encodeURIComponent(d.matName)}` : null), optional: true },
  { name: 'login', build: () => '/login' },
  { name: 'no-access', build: () => '/no-access' },
];

for (const locale of ['en', 'ka']) {
  for (const r of ROUTES) {
    test(`public [${locale}] ${r.name}`, async ({ page }) => {
      const d = data();
      const sub = r.build(d);
      if (sub === null) {
        if (r.optional) test.skip(true, `no id for ${r.name}`);
        else throw new Error(`required route ${r.name} has no id`);
        return;
      }
      const errors = collectErrors(page);
      const resp = await page.goto(`/${locale}${sub}`, { waitUntil: 'domcontentloaded' });
      expect(resp, 'navigation returned a response').toBeTruthy();
      expect(resp!.status(), `HTTP for /${locale}${sub}`).toBeLessThan(400);
      await page.waitForLoadState('load').catch(() => undefined);
      // rendered real content (not a blank shell)
      const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
      expect(bodyText.trim().length, `/${locale}${sub} rendered text`).toBeGreaterThan(0);
      expect(summarize(errors), `client errors on /${locale}${sub}`).toBe('');
    });
  }
}

test('sitemap.xml served', async ({ request }) => {
  const r = await request.get('/sitemap.xml');
  expect(r.status()).toBe(200);
  expect((await r.text()).slice(0, 200)).toContain('<urlset');
});

test('robots.txt served', async ({ request }) => {
  const r = await request.get('/robots.txt');
  expect(r.status()).toBe(200);
  expect((await r.text()).toLowerCase()).toContain('user-agent');
});
