'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import type { UserDetailRow } from '@/types/api';

export function useAdminUser(userId: string | null) {
  return useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => apiGet<UserDetailRow>(`/api/admin/users/${userId}`),
    enabled: Boolean(userId),
  });
}
