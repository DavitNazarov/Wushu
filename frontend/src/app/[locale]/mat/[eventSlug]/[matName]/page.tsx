'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { use } from 'react';
import { io, type Socket } from 'socket.io-client';

type Athlete = { id: string; firstName: string; lastName: string } | null;
type TimerState = {
  state: 'IDLE' | 'RUNNING' | 'PAUSED' | 'FINISHED';
  startedAt: string | null;
  pausedMs: number;
};
type Fight = {
  id: string;
  categoryCode: string;
  boutNo: number;
  round: number;
  status: string;
  redAthlete: Athlete;
  blueAthlete: Athlete;
  winnerAthlete: Athlete;
  timerState: TimerState | null;
};

type MatFeed = {
  mat: { id: string; name: string };
  now: Fight | null;
  onDeck: Fight | null;
  next: Fight[];
};

function athleteName(a: Athlete) {
  if (!a) return 'BYE';
  return `${a.firstName} ${a.lastName}`;
}

function useTimer(timerState: TimerState | null) {
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    function tick() {
      if (!timerState) { setElapsed(0); return; }
      if (timerState.state === 'RUNNING' && timerState.startedAt) {
        setElapsed(Date.now() - new Date(timerState.startedAt).getTime() + timerState.pausedMs);
      } else if (timerState.state === 'PAUSED') {
        setElapsed(timerState.pausedMs);
      } else {
        setElapsed(0);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [timerState]);

  const seconds = Math.floor(elapsed / 1000);
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function MatScreenPage({
  params,
}: {
  params: Promise<{ eventSlug: string; matName: string }>;
}) {
  const { eventSlug, matName } = use(params);
  const [feed, setFeed] = useState<MatFeed | null>(null);
  const [connected, setConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const matIdRef = useRef<string | null>(null);
  const timerDisplay = useTimer(feed?.now?.timerState ?? null);

  const loadFeed = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/public/mat?eventSlug=${encodeURIComponent(eventSlug)}&mat=${encodeURIComponent(matName)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as MatFeed;
        setFeed(data);
        matIdRef.current = data.mat.id;
        setConnected(true);
        setLastUpdated(new Date());
        if (socketRef.current?.connected) {
          socketRef.current.emit('join-mat', { matId: data.mat.id });
        }
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    }
  }, [eventSlug, matName]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadFeed();
    });
    const socketBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? window.location.origin;
    const socket = io(socketBaseUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      if (matIdRef.current) {
        socket.emit('join-mat', { matId: matIdRef.current });
      }
    };
    const onDisconnect = () => {
      setConnected(false);
    };
    const onUpdate = () => {
      void loadFeed();
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('fight:update', onUpdate);
    socket.on('timer:update', onUpdate);
    socket.on('schedule:update', onUpdate);

    const fallbackInterval = setInterval(() => {
      void loadFeed();
    }, 30000);

    return () => {
      clearInterval(fallbackInterval);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('fight:update', onUpdate);
      socket.off('timer:update', onUpdate);
      socket.off('schedule:update', onUpdate);
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [eventSlug, matName, loadFeed]);

  const decodedMatName = decodeURIComponent(matName);

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center"
      style={{ backgroundColor: '#0B1220', color: '#E5E7EB' }}
    >
      <div className="absolute left-0 top-0 flex w-full items-center justify-between px-8 pt-6">
        <div className="text-sm font-semibold uppercase tracking-widest opacity-60">
          {decodedMatName}
        </div>
        {lastUpdated && (
          <div className="text-xs opacity-40">
            Updated {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {!connected && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
        >
          <div className="text-3xl font-bold">Reconnecting…</div>
          {lastUpdated && (
            <div className="mt-2 text-sm opacity-60">
              Last update: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
      )}

      {!feed?.now ? (
        <div className="text-center">
          <div className="mb-4 text-2xl opacity-40">No active fight</div>
          {feed?.onDeck && (
            <div className="mt-6">
              <div className="mb-2 text-sm font-semibold uppercase tracking-widest opacity-60">
                On Deck
              </div>
              <div className="text-3xl font-bold">
                {athleteName(feed.onDeck.redAthlete)}
              </div>
              <div className="my-3 text-xl opacity-50">vs</div>
              <div className="text-3xl font-bold">
                {athleteName(feed.onDeck.blueAthlete)}
              </div>
              <div className="mt-2 text-base opacity-60">{feed.onDeck.categoryCode}</div>
            </div>
          )}
          {feed?.next && feed.next.length > 0 && (
            <div className="mt-8">
              <div className="mb-3 text-sm font-semibold uppercase tracking-widest opacity-60">
                Next
              </div>
              {feed.next.map((f) => (
                <div key={f.id} className="mb-2 text-lg opacity-70">
                  {athleteName(f.redAthlete)} vs {athleteName(f.blueAthlete)}
                  <span className="ml-3 text-sm opacity-50">{f.categoryCode}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full max-w-4xl px-8 text-center">
          <div className="mb-2 text-lg font-semibold uppercase tracking-widest" style={{ color: '#C81D25' }}>
            NOW
          </div>
          <div className="mb-1 text-base opacity-60">
            {feed.now.categoryCode} — Bout #{feed.now.boutNo}
          </div>

          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex-1">
              <div
                className="text-4xl font-bold leading-tight"
                style={{ color: '#ef4444' }}
              >
                {athleteName(feed.now.redAthlete)}
              </div>
            </div>

            <div
              className="shrink-0 font-mono text-7xl font-bold"
              style={{ color: '#E5E7EB' }}
            >
              {timerDisplay}
            </div>

            <div className="flex-1">
              <div
                className="text-4xl font-bold leading-tight"
                style={{ color: '#60a5fa' }}
              >
                {athleteName(feed.now.blueAthlete)}
              </div>
            </div>
          </div>

          {feed.onDeck && (
            <div className="mt-8 border-t border-white/10 pt-6">
              <div className="mb-2 text-sm font-semibold uppercase tracking-widest opacity-60">
                On Deck
              </div>
              <div className="text-2xl opacity-80">
                {athleteName(feed.onDeck.redAthlete)} vs {athleteName(feed.onDeck.blueAthlete)}
              </div>
              <div className="mt-1 text-sm opacity-50">{feed.onDeck.categoryCode}</div>
            </div>
          )}

          {feed.next.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-sm font-semibold uppercase tracking-widest opacity-60">
                Next
              </div>
              {feed.next.map((f) => (
                <div key={f.id} className="mb-1 text-lg opacity-60">
                  {athleteName(f.redAthlete)} vs {athleteName(f.blueAthlete)}
                  <span className="ml-2 text-sm opacity-50">{f.categoryCode}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
