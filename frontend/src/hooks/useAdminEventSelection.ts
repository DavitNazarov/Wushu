'use client';

import { useMemo, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import type { EventRow } from '@/types/api';

const EMPTY_EVENTS: EventRow[] = [];

export function useAdminEventSelection() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const eventsQuery = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<EventRow[]>('/api/events'),
  });

  const currentEventId = searchParams.get('eventId') ?? '';
  const events = eventsQuery.data ?? EMPTY_EVENTS;
  const selectedEvent = useMemo(
    () =>
      events.find((event) => event.id === currentEventId) ??
      (events.length > 0 ? events[0] : null),
    [currentEventId, events],
  );

  const setSelectedEventId = useCallback(
    (nextEventId: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (nextEventId) next.set('eventId', nextEventId);
      else next.delete('eventId');
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [pathname, router, searchParams],
  );

  return {
    currentEventId: selectedEvent?.id ?? '',
    events,
    eventsQuery,
    selectedEvent,
    setSelectedEventId,
  };
}
