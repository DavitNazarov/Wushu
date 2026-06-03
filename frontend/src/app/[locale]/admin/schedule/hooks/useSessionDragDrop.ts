'use client';

import { useState } from 'react';
import type { ScheduleSessionRow } from '@/types/api';

type ReorderFn = (sessionIds: string[]) => void;

export function useSessionDragDrop(sortedSessions: ScheduleSessionRow[], reorder: ReorderFn) {
  const [dragSessionId, setDragSessionId] = useState<string | null>(null);
  const [dropSessionTarget, setDropSessionTarget] = useState<string | null>(null);

  function onSessionDragStart(sessionId: string) {
    setDragSessionId(sessionId);
  }

  function onSessionDragOver(sessionId: string) {
    if (dragSessionId) setDropSessionTarget(sessionId);
  }

  function onSessionDragEnd() {
    if (dragSessionId && dropSessionTarget && dragSessionId !== dropSessionTarget) {
      const ids = sortedSessions.map((s) => s.id);
      const fromIdx = ids.indexOf(dragSessionId);
      const toIdx = ids.indexOf(dropSessionTarget);
      if (fromIdx !== -1 && toIdx !== -1) {
        ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, dragSessionId);
        reorder(ids);
      }
    }
    setDragSessionId(null);
    setDropSessionTarget(null);
  }

  return {
    dragSessionId,
    dropSessionTarget,
    onSessionDragStart,
    onSessionDragOver,
    onSessionDragEnd,
  };
}
