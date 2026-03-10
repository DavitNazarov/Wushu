import { useMutation } from '@tanstack/react-query';
import { apiPost } from '@/lib/api/client';

type ExportType = 'registrations' | 'brackets' | 'schedule' | 'results';

export function useSetEventPublishState() {
  return useMutation({
    mutationFn: (input: { eventId: string; published: boolean }) =>
      apiPost(`/api/events/${input.eventId}/publish`, {
        published: input.published,
      }),
  });
}

export function useGenerateBracketExport() {
  return useMutation({
    mutationFn: (input: { eventId: string }) =>
      apiPost<{ links: Array<{ type: ExportType; url: string; id: string }> }>(
        '/api/exports',
        {
          eventId: input.eventId,
          types: ['brackets'],
        },
      ),
  });
}

export function useRegenerateBrackets() {
  return useMutation({
    mutationFn: (input: { eventId: string; reason: string }) =>
      apiPost('/api/draw', {
        eventId: input.eventId,
        override: true,
        reason: input.reason,
      }),
  });
}
