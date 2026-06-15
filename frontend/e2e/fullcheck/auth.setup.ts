import { test as setup, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

// Establishes auth via the API (robust — no dependence on cold-compile redirect
// timing) and saves storageState for the role projects. The real login *form* is
// exercised as a UI test in interactions.spec.ts. Also discovers the dynamic ids
// the crawl specs need → e2e/.auth/fc-data.json.
const ADMIN = { email: 'admin@geowushu.ge', password: 'Password123!' };
const COACH = { email: 'coach1@geowushu.ge', password: 'Password123!' };

setup('admin auth (API) → storageState', async ({ request, baseURL }) => {
  const r = await request.post('/api/auth/login', { data: ADMIN, headers: { origin: baseURL! } });
  expect(r.ok(), await r.text()).toBeTruthy();
  await request.storageState({ path: 'e2e/.auth/fc-admin.json' });
});

setup('coach auth (API) → storageState', async ({ request, baseURL }) => {
  const r = await request.post('/api/auth/login', { data: COACH, headers: { origin: baseURL! } });
  expect(r.ok(), await r.text()).toBeTruthy();
  await request.storageState({ path: 'e2e/.auth/fc-coach.json' });
});

setup('discover dynamic ids', async ({ request, baseURL }) => {
  const li = await request.post('/api/auth/login', { data: ADMIN, headers: { origin: baseURL! } });
  expect(li.ok(), await li.text()).toBeTruthy();

  const json = async (p: string) => {
    const r = await request.get(p);
    if (!r.ok()) return null;
    return r.json().catch(() => null);
  };

  const adminEvents = (await json('/api/events')) as any[] | null;
  const pubEvents = (await json('/api/public/events')) as any[] | null;
  const clubs = (await json('/api/public/clubs')) as any[] | null;
  const countries = (await json('/api/public/countries')) as any[] | null;
  const news = (await json('/api/public/news')) as any[] | null;

  const pubEvent = (pubEvents || []).find((e) => /full|fullrun/i.test(e.slug || e.name)) ?? (pubEvents || [])[0] ?? null;
  const adminEvent = (adminEvents || []).find((e) => e.id === pubEvent?.id) ?? (adminEvents || [])[0] ?? null;
  const eventId = adminEvent?.id ?? null;

  let matName: string | null = null;
  if (eventId) {
    const mats = (await json(`/api/mats?eventId=${eventId}`)) as any[] | null;
    matName = (mats || [])[0]?.name ?? null;
  }
  const clubId = (clubs || [])[0]?.id ?? null;
  let athleteId: string | null = null;
  if (clubId) {
    const club = (await json(`/api/public/clubs/${clubId}`)) as any;
    athleteId = club?.athletes?.[0]?.id ?? null;
  }

  const data = {
    eventSlug: pubEvent?.slug ?? null,
    eventId,
    coachEventSlug: pubEvent?.slug ?? null,
    clubId,
    countryId: (countries || [])[0]?.id ?? null,
    athleteId,
    matName,
    newsSlug: (news || [])[0]?.slug ?? null,
  };
  writeFileSync('e2e/.auth/fc-data.json', JSON.stringify(data, null, 2));
  console.log('fc-data discovered:', JSON.stringify(data));
  expect(data.eventSlug, 'a published event must exist for public crawl').toBeTruthy();
});
