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

// First-time draw, run from the Brackets page (no override — the lifecycle /
// readiness rules must pass). Regeneration keeps using override + reason above.
export function useGenerateBrackets() {
  return useMutation({
    mutationFn: (input: { eventId: string; sameClubSeparation: boolean }) =>
      apiPost('/api/draw', {
        eventId: input.eventId,
        sameClubSeparation: input.sameClubSeparation,
      }),
  });
}
