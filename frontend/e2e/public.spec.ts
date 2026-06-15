import { test, expect } from '@playwright/test';
import { collectErrors, summarize } from './helpers/console';
import { sampleData } from './helpers/data';

// Static public routes that must render for anonymous visitors.
const STATIC_ROUTES = [
  '/en',
  '/en/events',
  '/en/news',
  '/en/clubs',
  '/en/countries',
  '/en/about',
  '/en/rules',
  '/en/contact',
  '/ka', // Georgian home — locale switch must work
];

test.describe('public — anonymous access', () => {
  for (const route of STATIC_ROUTES) {
    test(`renders ${route} without errors`, async ({ page }) => {
      const errors = collectErrors(page);
      const resp = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(resp, `no response for ${route}`).toBeTruthy();
      expect(resp!.status(), `bad status for ${route}`).toBeLessThan(400);
      // Body has real content (not a blank/crashed shell).
      await expect(page.locator('body')).not.toBeEmpty();
      await page.waitForLoadState('networkidle').catch(() => undefined);
      expect(
        errors.pageErrors.length === 0 && errors.badResponses.length === 0,
        `client errors on ${route}:\n${summarize(errors)}`,
      ).toBeTruthy();
    });
  }

  test('renders dynamic detail pages (event, club, athlete, news)', async ({
    page,
    request,
  }) => {
    const { eventSlug, clubId, athleteId, newsSlug } = await sampleData(request);
    expect(eventSlug, 'seed has at least one public event').toBeTruthy();

    const dynamicRoutes = [
      `/en/events/${eventSlug}`,
      `/en/events/${eventSlug}/brackets`,
      `/en/events/${eventSlug}/schedule`,
      `/en/events/${eventSlug}/live`,
      `/en/events/${eventSlug}/results`,
      ...(clubId ? [`/en/clubs/${clubId}`] : []),
      ...(athleteId ? [`/en/athletes/${athleteId}`] : []),
      ...(newsSlug ? [`/en/news/${newsSlug}`] : []),
    ];

    for (const route of dynamicRoutes) {
      const errors = collectErrors(page);
      const resp = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(resp!.status(), `bad status for ${route}`).toBeLessThan(400);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      expect(
        errors.pageErrors.length === 0 && errors.badResponses.length === 0,
        `client errors on ${route}:\n${summarize(errors)}`,
      ).toBeTruthy();
    }
  });

  test('event detail exposes SEO + OpenGraph + JSON-LD', async ({
    page,
    request,
  }) => {
    const { eventSlug } = await sampleData(request);
    test.skip(!eventSlug, 'no event to check');
    await page.goto(`/en/events/${eventSlug}`, { waitUntil: 'domcontentloaded' });

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', new RegExp(`/en/events/${eventSlug}$`));

    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', /.+/);

    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute('content', /opengraph-image/);

    // hreflang alternates for both locales.
    await expect(page.locator('link[rel="alternate"][hreflang="ka"]')).toHaveCount(1);

    // SportsEvent structured data present in initial HTML.
    const html = await page.content();
    expect(html).toContain('"@type":"SportsEvent"');
  });

  test('OpenGraph images render as PNG', async ({ request }) => {
    const { eventSlug } = await sampleData(request);
    const res = await request.get(`/en/events/${eventSlug}/opengraph-image`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  });

  test('sitemap.xml and robots.txt are served', async ({ request }) => {
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect(xml).toContain('<urlset');
    expect(xml).toContain('/en/events');

    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    const txt = await robots.text();
    expect(txt).toContain('Sitemap:');
    expect(txt).toMatch(/Disallow:\s*\/api\//);
  });

  test('anonymous live page makes no socket.io handshake (C1/H2 fix)', async ({
    page,
    request,
  }) => {
    const { eventSlug } = await sampleData(request);
    test.skip(!eventSlug, 'no event to check');

    const socketRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/socket.io')) socketRequests.push(req.url());
    });

    await page.goto(`/en/events/${eventSlug}/results`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(3000);
    expect(
      socketRequests,
      `anonymous viewer attempted sockets:\n${socketRequests.join('\n')}`,
    ).toHaveLength(0);
  });
});
