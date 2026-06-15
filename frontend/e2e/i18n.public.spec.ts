import { test, expect, type APIRequestContext } from '@playwright/test';

// Bilingual (EN/KA) rendering on the public surface. The app must show Georgian
// names on /ka and English on /en for any entity that carries a non-null KA
// field. Strings are derived from the API so the test isn't pinned to specific
// seed rows.

async function aGeClub(request: APIRequestContext) {
  const clubs = (await (await request.get('/api/public/clubs')).json()) as {
    name: string;
    nameKa: string | null;
  }[];
  return clubs.find((c) => c.nameKa && c.nameKa !== c.name) ?? null;
}

async function aKaEvent(request: APIRequestContext) {
  const events = (await (await request.get('/api/public/events')).json()) as {
    slug: string;
    name: string;
    nameKa: string | null;
  }[];
  // Skip throwaway E2E events; prefer a real seeded one with a distinct KA name.
  return (
    events.find(
      (e) => e.nameKa && e.nameKa !== e.name && !e.slug.startsWith('e2e-'),
    ) ?? null
  );
}

test.describe('i18n — public rendering', () => {
  test('clubs list shows Georgian names on /ka, English on /en', async ({
    page,
    request,
  }) => {
    const club = await aGeClub(request);
    test.skip(!club, 'no GE club with a distinct KA name in the seed');

    await page.goto('/ka/clubs', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(club!.nameKa!);
    // The English name must NOT leak onto the Georgian page for this club.
    await expect(page.locator('body')).not.toContainText(club!.name);

    await page.goto('/en/clubs', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(club!.name);
  });

  test('events list shows the Georgian event name on /ka', async ({
    page,
    request,
  }) => {
    const ev = await aKaEvent(request);
    test.skip(!ev, 'no seeded event with a distinct KA name');

    await page.goto('/ka/events', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(ev!.nameKa!);
  });

  test('html lang attribute matches the locale', async ({ page }) => {
    await page.goto('/ka', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', /ka/);
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', /en/);
  });
});

test.describe('i18n — display-name KA contract', () => {
  test('live feed exposes redDisplayNameKa / blueDisplayNameKa', async ({
    request,
  }) => {
    const live = await request.get(
      '/api/public/live?eventSlug=ge-national-spring-2026',
    );
    expect(live.status()).toBe(200);
    const raw = await live.text();
    // The schedule/live endpoints must carry the KA display-name fields so the
    // /ka boards can localize "Winner of X" / TBD placeholders (per CLAUDE.md).
    expect(raw).toContain('redDisplayNameKa');
    expect(raw).toContain('blueDisplayNameKa');
  });
});
