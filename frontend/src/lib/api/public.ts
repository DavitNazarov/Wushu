/**
 * Public API endpoints (no auth required).
 * Use relative URLs so Next.js rewrites proxy to backend.
 */

export type PublicEvent = {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  lifecycle: string;
  published: boolean;
  competitionStartDate: string;
  competitionEndDate: string;
  registrationStartDate?: string;
  registrationEndDate?: string;
  dates?: { range?: { startDate: string; endDate: string } } | null;
};

export type PublicNewsItem = {
  id: string;
  title: string;
  slug: string;
  publishedAt: string | null;
  createdAt: string;
  eventId?: string | null;
  event?: { id: string; name: string; slug: string; location: string | null } | null;
};

export type PublicNewsPost = {
  id: string;
  title: string;
  slug: string;
  body: string;
  publishedAt: string | null;
  createdAt: string;
  eventId?: string | null;
  event?: { id: string; name: string; slug: string; location: string | null } | null;
};

export type BracketFight = {
  id: string;
  round: number;
  boutNo: number;
  redAthlete?: { id: string; firstName: string; lastName: string } | null;
  blueAthlete?: { id: string; firstName: string; lastName: string } | null;
  winnerAthlete?: { id: string; firstName: string; lastName: string } | null;
};

export type PublicBracket = {
  id: string;
  categoryCode: string;
  fights?: BracketFight[];
};

export type ScheduleFight = {
  id: string;
  categoryCode: string;
  orderInMat: number | null;
  scheduledStartTime: string | null;
  mat?: { id: string; name: string } | null;
  redAthlete?: { id: string; firstName: string; lastName: string } | null;
  blueAthlete?: { id: string; firstName: string; lastName: string } | null;
};

export type MatFight = {
  id: string;
  categoryCode: string;
  boutNo: number;
  round: number;
  status: string;
  redAthlete?: { id: string; firstName: string; lastName: string } | null;
  blueAthlete?: { id: string; firstName: string; lastName: string } | null;
  winnerAthlete?: { id: string; firstName: string; lastName: string } | null;
  timerState?: { state: string; startedAt: string | null; pausedMs: number } | null;
};

export type MatFeed = {
  mat: { id: string; name: string };
  now: MatFight | null;
  onDeck: MatFight | null;
  next: MatFight[];
  fights: MatFight[];
};

async function publicFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchPublicEvents(): Promise<PublicEvent[]> {
  return publicFetch<PublicEvent[]>('/api/public/events');
}

export async function fetchPublicEvent(slug: string): Promise<PublicEvent | null> {
  const res = await fetch(`/api/public/events/${encodeURIComponent(slug)}`, {
    credentials: 'include',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export async function fetchPublicNews(): Promise<PublicNewsItem[]> {
  return publicFetch<PublicNewsItem[]>('/api/public/news');
}

export async function fetchPublicNewsPost(slug: string): Promise<PublicNewsPost | null> {
  const res = await fetch(`/api/public/news/${encodeURIComponent(slug)}`, {
    credentials: 'include',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export async function fetchPublicBrackets(eventSlug: string): Promise<PublicBracket[]> {
  return publicFetch<PublicBracket[]>(
    `/api/public/brackets?eventSlug=${encodeURIComponent(eventSlug)}`,
  );
}

export async function fetchPublicSchedule(eventSlug: string): Promise<ScheduleFight[]> {
  return publicFetch<ScheduleFight[]>(
    `/api/public/schedule?eventSlug=${encodeURIComponent(eventSlug)}`,
  );
}

export async function fetchPublicMat(
  eventSlug: string,
  matName: string,
): Promise<MatFeed | null> {
  const res = await fetch(
    `/api/public/mat?eventSlug=${encodeURIComponent(eventSlug)}&mat=${encodeURIComponent(matName)}`,
    { credentials: 'include' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}
