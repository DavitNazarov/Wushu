'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchPublicEvents,
  fetchPublicEvent,
  fetchPublicNews,
  fetchPublicNewsPost,
  fetchPublicBrackets,
  fetchPublicResults,
  fetchPublicSchedule,
  fetchPublicMat,
  fetchPublicLive,
} from '@/lib/api/public';

export function usePublicEvents() {
  return useQuery({
    queryKey: ['public', 'events'],
    queryFn: fetchPublicEvents,
  });
}

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

export function usePublicBrackets(eventSlug: string | null) {
  return useQuery({
    queryKey: ['public', 'brackets', eventSlug],
    queryFn: () => fetchPublicBrackets(eventSlug!),
    enabled: !!eventSlug,
  });
}

export function usePublicSchedule(eventSlug: string | null) {
  return useQuery({
    queryKey: ['public', 'schedule', eventSlug],
    queryFn: () => fetchPublicSchedule(eventSlug!),
    enabled: !!eventSlug,
  });
}

export function usePublicMat(eventSlug: string | null, matName: string | null) {
  return useQuery({
    queryKey: ['public', 'mat', eventSlug, matName],
    queryFn: () => fetchPublicMat(eventSlug!, matName!),
    enabled: !!eventSlug && !!matName,
    refetchInterval: 5000,
  });
}

export function usePublicLive(eventSlug: string | null) {
  return useQuery({
    queryKey: ['public', 'live', eventSlug],
    queryFn: () => fetchPublicLive(eventSlug!),
    enabled: !!eventSlug,
    refetchInterval: 4000,
  });
}

export function usePublicResults(eventSlug: string | null) {
  return useQuery({
    queryKey: ['public', 'results', eventSlug],
    queryFn: () => fetchPublicResults(eventSlug!),
    enabled: !!eventSlug,
  });
}
