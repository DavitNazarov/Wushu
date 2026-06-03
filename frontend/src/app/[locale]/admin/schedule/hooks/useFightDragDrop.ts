'use client';

import { useState } from 'react';
import type { DragFight, DropFightTarget } from '../schedule.types';

type MoveFn = (data: { fightId: string; toSessionId: string | null; insertAfterOrder: number }) => void;

export function useFightDragDrop(move: MoveFn) {
  const [dragFight, setDragFight] = useState<DragFight | null>(null);
  const [dropFightTarget, setDropFightTarget] = useState<DropFightTarget | null>(null);

  function onFightDragStart(fightId: string, fromSessionId: string) {
    setDragFight({ fightId, fromSessionId });
  }

  function onFightDragEnd() {
    setDragFight(null);
    setDropFightTarget(null);
  }

  function onFightDragOver(_e: React.DragEvent, sessionId: string, insertAfterOrder: number) {
    if (dragFight) setDropFightTarget({ sessionId, insertAfterOrder });
  }

  function onFightDrop(_e: React.DragEvent, sessionId: string, insertAfterOrder: number) {
    if (!dragFight) return;
    move({ fightId: dragFight.fightId, toSessionId: sessionId, insertAfterOrder });
    setDragFight(null);
    setDropFightTarget(null);
  }

  return {
    dragFight,
    dropFightTarget,
    onFightDragStart,
    onFightDragEnd,
    onFightDragOver,
    onFightDrop,
  };
}
