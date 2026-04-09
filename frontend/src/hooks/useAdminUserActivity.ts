'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import type { UserActivityEntry, UserCapabilityRow } from '@/types/api';

export function useAdminUserActivity(userId: string | null) {
  return useQuery({
    queryKey: ['admin-user-activity', userId],
    queryFn: () =>
      apiGet<UserActivityEntry[]>(`/api/admin/users/${userId}/activity`),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
}

export function useAdminUserCapabilities(userId: string | null) {
  return useQuery({
    queryKey: ['admin-user-capabilities', userId],
    queryFn: () =>
      apiGet<UserCapabilityRow[]>(`/api/admin/users/${userId}/capabilities`),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}
