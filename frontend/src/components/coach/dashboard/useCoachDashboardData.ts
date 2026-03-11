'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { useQueries, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import type { AthleteRow, EventRow, RegistrationRow } from '@/types/api';
import { buildCoachDashboardModel } from './dashboard.utils';

export function useCoachDashboardData() {
  const locale = useLocale();
  const athletesQuery = useQuery({
    queryKey: ['athletes'],
    queryFn: () => apiGet<AthleteRow[]>('/api/athletes'),
  });

  const eventsQuery = useQuery({
    queryKey: ['public', 'events'],
    queryFn: () => apiGet<EventRow[]>('/api/public/events'),
  });

  const registrationQueries = useQueries({
    queries: (eventsQuery.data ?? []).map((event) => ({
      queryKey: ['registrations', event.id],
      queryFn: () => apiGet<RegistrationRow[]>(`/api/registrations?eventId=${event.id}`),
      enabled: Boolean(event.id),
      staleTime: 30_000,
    })),
  });

  const registrationsByEvent = useMemo(
    () =>
      Object.fromEntries(
        (eventsQuery.data ?? []).map((event, index) => [event.id, registrationQueries[index]?.data ?? []]),
      ),
    [eventsQuery.data, registrationQueries],
  );

  const registrationErrors = registrationQueries.filter((query) => query.error).length;
  const isRegistrationsLoading =
    Boolean(eventsQuery.data?.length) && registrationQueries.some((query) => query.isLoading);

  const model = useMemo(() => {
    if (!athletesQuery.data || !eventsQuery.data) return null;
    return buildCoachDashboardModel({
      athletes: athletesQuery.data,
      events: eventsQuery.data,
      registrationsByEvent,
      locale,
      now: new Date(),
    });
  }, [athletesQuery.data, eventsQuery.data, locale, registrationsByEvent]);

  return {
    athletesQuery,
    eventsQuery,
    registrationQueries,
    registrationErrors,
    isLoading: athletesQuery.isLoading || eventsQuery.isLoading || isRegistrationsLoading,
    isBaseLoading: athletesQuery.isLoading || eventsQuery.isLoading,
    model,
  };
}
