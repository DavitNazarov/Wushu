import type { APIRequestContext } from '@playwright/test';

// Pulls real ids/slugs from the public API so tests aren't pinned to specific
// seed rows. Returns null fields when the dataset is empty.
export async function sampleData(request: APIRequestContext): Promise<{
  eventSlug: string | null;
  clubId: string | null;
  athleteId: string | null;
  newsSlug: string | null;
}> {
  const getJson = async (path: string): Promise<unknown[]> => {
    try {
      const res = await request.get(path);
      if (!res.ok()) return [];
      const data = (await res.json()) as unknown;
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };

  const [events, clubs, news] = await Promise.all([
    getJson('/api/public/events'),
    getJson('/api/public/clubs'),
    getJson('/api/public/news'),
  ]);

  // Prefer a stable seeded event; skip throwaway e2e-* events that mutating
  // specs create/tear down in parallel (their data-less detail pages would make
  // this probe flaky/slow).
  const eventList = events as { slug?: string }[];
  const eventSlug =
    eventList.find((e) => e.slug && !e.slug.startsWith('e2e-'))?.slug ??
    eventList[0]?.slug ??
    null;
  const clubId = (clubs[0] as { id?: string } | undefined)?.id ?? null;
  const newsSlug = (news[0] as { slug?: string } | undefined)?.slug ?? null;

  // Athlete id comes from a club's roster (public athletes have no list route).
  let athleteId: string | null = null;
  if (clubId) {
    try {
      const res = await request.get(`/api/public/clubs/${clubId}`);
      if (res.ok()) {
        const club = (await res.json()) as {
          athletes?: { id: string }[];
        };
        athleteId = club.athletes?.[0]?.id ?? null;
      }
    } catch {
      // leave null
    }
  }

  return { eventSlug, clubId, athleteId, newsSlug };
}
