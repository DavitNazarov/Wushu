/**
 * Public API endpoints (no auth required).
 * Use relative URLs so Next.js rewrites proxy to backend.
 */

import type { TimerState } from '@/types/api';
import type { PublicResultsFeed } from './public-results';

export type PublicEvent = {
  id: string;
  name: string;
  nameKa?: string | null;
  slug: string;
  location: string | null;
  entryFee?: number | null;
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

export type PublicScheduleSession = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  order: number;
};

export type ScheduleFight = {
  id: string;
  bracketRoundLabel: string;
  bracketFightNumber: number;
  scheduleOrder: number | null;
  redDisplayName: string;
  blueDisplayName: string;
  redDisplayNameKa?: string | null;
  blueDisplayNameKa?: string | null;
  redSourceScheduleOrder: number | null;
  blueSourceScheduleOrder: number | null;
  isPlayable: boolean;
  isScheduled: boolean;
  status: string;
  matId: string | null;
  matName: string | null;
  orderInMat: number | null;
  scheduledAt: string | null;
  sessionId: string | null;
  orderInSession: number | null;
  winnerCorner: 'RED' | 'BLUE' | null;
  liveStatus?: 'PENDING' | 'UPCOMING' | 'RUNNING' | 'FINISHED';
};

export type PublicLiveFeed = {
  eventId: string;
  current: PublicLiveFight | null;
  onDeck: PublicLiveFight | null;
  upNext: PublicLiveFight[];
  queuePreview: PublicLiveFight[];
  latestResult: PublicLiveFight | null;
};

type PublicLiveFight = {
  id: string;
  categoryCode: string;
  categoryName: string;
  boutNo: number;
  round: number;
  bracketRoundLabel: string;
  scheduleOrder: number | null;
  status: string;
  liveStatus?: 'PENDING' | 'UPCOMING' | 'RUNNING' | 'FINISHED';
  redAthleteId: string | null;
  blueAthleteId: string | null;
  winnerAthleteId: string | null;
  winMethod: 'POINTS' | 'KO' | 'DQ' | 'WO' | null;
  notes: string | null;
  redDisplayName: string;
  blueDisplayName: string;
  redDisplayNameKa?: string | null;
  blueDisplayNameKa?: string | null;
  timerState: TimerState | null;
};

type PublicWeighInAthlete = {
  athleteId: string;
  firstName: string;
  lastName: string;
  firstNameKa: string | null;
  lastNameKa: string | null;
  clubName: string | null;
  clubNameKa: string | null;
  weightKg: number | null;
};

type PublicWeighInCategory = {
  id: string;
  categoryName: string;
  ageGroupName: string;
  division: 'MALE' | 'FEMALE' | null;
  athletes: PublicWeighInAthlete[];
};

export type PublicWeighInResults = {
  event: { id: string; name: string; nameKa: string | null; slug: string };
  categories: PublicWeighInCategory[];
};

async function publicFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
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

export async function fetchPublicSchedule(eventSlug: string): Promise<ScheduleFight[]> {
  const res = await fetch(
    `/api/public/schedule?eventSlug=${encodeURIComponent(eventSlug)}`,
    {
      credentials: 'include',
    },
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export async function fetchPublicScheduleSessions(eventSlug: string): Promise<PublicScheduleSession[]> {
  const res = await fetch(
    `/api/public/schedule-sessions?eventSlug=${encodeURIComponent(eventSlug)}`,
    { credentials: 'include' },
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export async function fetchPublicLive(
  eventSlug: string,
): Promise<PublicLiveFeed | null> {
  const query = new URLSearchParams({ eventSlug });
  const res = await fetch(`/api/public/live?${query.toString()}`, {
    credentials: 'include',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export async function fetchPublicResults(
  eventSlug: string,
): Promise<PublicResultsFeed | null> {
  const query = new URLSearchParams({ eventSlug });
  const res = await fetch(`/api/public/results?${query.toString()}`, {
    credentials: 'include',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

// 404 when weigh-in weights aren't public for this event (toggle off) —
// callers treat null as "not available" and render the empty state.
export async function fetchPublicWeighInResults(
  eventSlug: string,
): Promise<PublicWeighInResults | null> {
  const res = await fetch(
    `/api/public/weighin-results?eventSlug=${encodeURIComponent(eventSlug)}`,
    { credentials: 'include' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}
