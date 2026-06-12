'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchPublicEvent,
  fetchPublicNews,
  fetchPublicNewsPost,
  fetchPublicResults,
  fetchPublicSchedule,
  fetchPublicScheduleSessions,
  fetchPublicLive,
  fetchPublicWeighInResults,
} from '@/lib/api/public';

// Poll cadence for the during-event public feeds (live, schedule). Spectators
// have no socket (the gateway requires LIVE_RUN), so this interval IS the
// public liveness mechanism. The responses are edge-cached ~15s server-side
// (CACHE_SHORT), so origin cost stays bounded regardless of viewer count.
// React Query pauses interval refetches while the tab is unfocused by default.
const PUBLIC_EVENT_FEED_POLL_MS = 20_000;

export function usePublicEvent(slug: string | null) {
  return useQuery({
    queryKey: ['public', 'event', slug],
    queryFn: () => fetchPublicEvent(slug!),
    enabled: !!slug,
  });
}

export function usePublicNews() {
  return useQuery({
    queryKey: ['public', 'news'],
    queryFn: fetchPublicNews,
  });
}

export function usePublicNewsPost(slug: string | null) {
  return useQuery({
    queryKey: ['public', 'news', slug],
    queryFn: () => fetchPublicNewsPost(slug!),
    enabled: !!slug,
  });
}

export function usePublicWeighInResults(eventSlug: string | null) {
  return useQuery({
    queryKey: ['public', 'weighin-results', eventSlug],
    queryFn: () => fetchPublicWeighInResults(eventSlug!),
    enabled: !!eventSlug,
  });
}

export function usePublicSchedule(eventSlug: string | null) {
  return useQuery({
    queryKey: ['public', 'schedule', eventSlug],
    queryFn: () => fetchPublicSchedule(eventSlug!),
    enabled: !!eventSlug,
    refetchInterval: PUBLIC_EVENT_FEED_POLL_MS,
  });
}

export function usePublicScheduleSessions(eventSlug: string | null) {
  return useQuery({
    queryKey: ['public', 'schedule-sessions', eventSlug],
    queryFn: () => fetchPublicScheduleSessions(eventSlug!),
    enabled: !!eventSlug,
    refetchInterval: PUBLIC_EVENT_FEED_POLL_MS,
  });
}

export function usePublicLive(eventSlug: string | null) {
  return useQuery({
    queryKey: ['public', 'live', eventSlug],
    queryFn: () => fetchPublicLive(eventSlug!),
    enabled: !!eventSlug,
    // Spectator "live" page: poll while visible (see PUBLIC_EVENT_FEED_POLL_MS)
    // — previously this only refreshed on mount/refocus, so the page was
    // effectively frozen for anyone watching it.
    refetchInterval: PUBLIC_EVENT_FEED_POLL_MS,
  });
}

export function usePublicResults(eventSlug: string | null) {
  return useQuery({
    queryKey: ['public', 'results', eventSlug],
    queryFn: () => fetchPublicResults(eventSlug!),
    enabled: !!eventSlug,
  });
}
