'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiPatch, apiPost } from '@/lib/api/client';
import type { UserDetailRow } from '@/types/api';

type CreateUserInput = {
  email: string;
  password: string;
  displayName: string;
  role: 'admin' | 'coach';
  clubId: string | null;
  nationality?: string | null;
};

type UpdateUserInput = {
  userId: string;
  email?: string;
  displayName?: string;
  role?: 'admin' | 'coach';
  clubId?: string | null;
  nationality?: string | null;
  isActive?: boolean;
};

type SuspendUserInput = {
  userId: string;
  reason: string;
  startAt: string;
  endAt: string;
  note?: string | null;
};

export function useCreateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateUserInput) =>
      apiPost<{ id: string }>('/api/admin/users', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, ...payload }: UpdateUserInput) =>
      apiPatch<UserDetailRow>(`/api/admin/users/${userId}`, payload),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.setQueryData(['admin-user', user.id], user);
    },
  });
}

export function useSuspendAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, ...payload }: SuspendUserInput) =>
      apiPost<UserDetailRow>(`/api/admin/users/${userId}/dq`, payload),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.setQueryData(['admin-user', user.id], user);
    },
  });
}

export function useRemoveAdminUserSuspension() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      apiPost<UserDetailRow>(`/api/admin/users/${userId}/remove-dq`),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.setQueryData(['admin-user', user.id], user);
    },
  });
}

export function useArchiveAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      apiDelete<UserDetailRow>(`/api/admin/users/${userId}`),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.setQueryData(['admin-user', user.id], user);
    },
  });
}
