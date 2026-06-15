import { getServerApiUrl } from '@/lib/api';

// Server-side fetch of a public entity for generateMetadata / OG image routes.
// Returns null on any failure (404, network, parse) so metadata generation
// degrades gracefully to the page/site defaults instead of throwing — a missing
// OG card must never break the page render.
export async function fetchPublicJson<T>(apiPath: string): Promise<T | null> {
  try {
    const url = await getServerApiUrl(apiPath);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
