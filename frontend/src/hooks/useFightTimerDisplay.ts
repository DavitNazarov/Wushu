'use client';

import { useEffect, useMemo, useState } from 'react';
import type { TimerState } from '@/types/api';
import {
  formatTimerMs,
  getTimerRemainingMs,
  isAwaitingRoundResult,
} from '@/lib/live/timer';

export function useFightTimerDisplay(timerState: TimerState | null) {
  const [nowMs, setNowMs] = useState(Date.now());
  const running = timerState?.state === 'RUNNING';

  useEffect(() => {
    if (!running) {
      setNowMs(Date.now());
      return;
    }

    let frame = requestAnimationFrame(function tick() {
      setNowMs(Date.now());
      frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  }, [running, timerState?.phaseStartedAt, timerState?.elapsed]);

  return useMemo(() => {
    const remainingMs = getTimerRemainingMs(timerState, nowMs);
    return {
      remainingMs,
      display: formatTimerMs(remainingMs),
      awaitingRoundResult: isAwaitingRoundResult(timerState),
    };
  }, [nowMs, timerState]);
}
