'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet } from '@/lib/api/client';
import type { EventRow } from '@/types/api';
import {
  appendQueryString,
  type AdminEventRoutePage,
  getAdminEventPath,
} from '../lib/adminEventRoutes';

const EMPTY_EVENTS: EventRow[] = [];

type Options = {
  eventId: string;
  page: AdminEventRoutePage;
  preserveSearchKeys?: string[];
};

export function useAdminEventRoute({
  eventId,
  page,
  preserveSearchKeys = [],
}: Options) {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const eventsQuery = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<EventRow[]>('/api/events'),
  });

  const events = eventsQuery.data ?? EMPTY_EVENTS;
  const selectedEvent = events.find((event) => event.id === eventId) ?? null;

  const setSelectedEventId = useCallback(
    (nextEventId: string) => {
      if (!nextEventId) return;

      const nextSearchParams = new URLSearchParams();
      preserveSearchKeys.forEach((key) => {
        const value = searchParams.get(key);
        if (value) nextSearchParams.set(key, value);
      });

      router.replace(
        appendQueryString(
          getAdminEventPath(locale, nextEventId, page),
          nextSearchParams,
        ),
      );
    },
    [locale, page, preserveSearchKeys, router, searchParams],
  );

  return {
    currentEventId: eventId,
    events,
    eventsQuery,
    selectedEvent,
    setSelectedEventId,
  };
}
