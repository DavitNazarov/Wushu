'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { apiPost, apiDelete } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import { useToast } from '@/components/ui/Toast';

type ScheduleKeys = {
  scheduleQK: readonly unknown[];
  sessionsQK: readonly unknown[];
};

type Diagnostics = {
  sessionCount: number;
  fightCount: number;
  diagnostics: { fullySatisfied: boolean; conflictCount: number };
};

export function useScheduleMutations(
  eventId: string,
  keys: ScheduleKeys,
  callbacks: {
    onSessionSaved: () => void;
    onSessionDeleted: () => void;
    onGenerated: () => void;
  },
  generateForm: { avgBoutSeconds: number; bufferSeconds: number },
) {
  const t = useTranslations('schedule');
  const qc = useQueryClient();
  const { toast } = useToast();

  const upsertSession = useMutation({
    mutationFn: (data: { id?: string; name: string; nameKa: string | null; startTime: string; endTime: string; order: number }) =>
      apiPost('/api/schedule-sessions', { eventId, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.sessionsQK });
      toast(t('sessionSaved'));
      callbacks.onSessionSaved();
    },
    onError: (e) => toast(getCompactErrorMessage(e, t('errorGeneric')), 'error'),
  });

  const deleteSession = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/schedule-sessions/${id}?eventId=${eventId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.sessionsQK });
      qc.invalidateQueries({ queryKey: keys.scheduleQK });
      toast(t('sessionDeleted'));
      callbacks.onSessionDeleted();
    },
    onError: (e) => toast(getCompactErrorMessage(e, t('errorGeneric')), 'error'),
  });

  const generate = useMutation({
    mutationFn: () =>
      apiPost<Diagnostics>('/api/schedule/generate', { eventId, ...generateForm }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: keys.scheduleQK });
      qc.invalidateQueries({ queryKey: keys.sessionsQK });
      toast(
        result.diagnostics.fullySatisfied
          ? t('generated')
          : t('generatedWithConflicts', { count: result.diagnostics.conflictCount }),
        result.diagnostics.fullySatisfied ? 'success' : 'error',
      );
      callbacks.onGenerated();
    },
    onError: (e) => toast(getCompactErrorMessage(e, t('errorGeneric')), 'error'),
  });

  const moveFight = useMutation({
    mutationFn: (data: { fightId: string; toSessionId: string | null; insertAfterOrder: number }) =>
      apiPost<{ ok: boolean; gapViolations: string[] }>('/api/schedule/move-session-fight', data),
    // Schedule issues are recomputed inline from the refetched schedule
    // (see computeScheduleIssues), so no move-time banner is needed here.
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.scheduleQK }),
    onError: (e) => toast(getCompactErrorMessage(e, t('errorGeneric')), 'error'),
  });

  const reorderSessions = useMutation({
    mutationFn: (sessionIds: string[]) =>
      apiPost('/api/schedule/reorder-sessions', { eventId, sessionIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sessionsQK }),
    onError: (e) => toast(getCompactErrorMessage(e, t('errorGeneric')), 'error'),
  });

  return { upsertSession, deleteSession, generate, moveFight, reorderSessions };
}
