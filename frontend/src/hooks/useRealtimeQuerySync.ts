'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { logRealtime } from '@/lib/realtime/realtimeLogger';
import {
  getSocketServerUrl,
  SOCKET_IO_PATH,
} from '@/lib/realtime/socketUrl';

type QueryKey = readonly unknown[];

// Coalesce window for socket-driven refetches. A single operator action emits a
// burst of socket events (fight:update + schedule:update + timer:update, plus a
// pair for any auto-advanced fight) within a few ms. Without coalescing, each
// fired its own query refetch, and a busy live session blew past the API's
// per-IP throttle bucket → HTTP 429. Debouncing collapses one burst into one
// refetch; 250ms is imperceptible to operators but well above the fan-out.
const REALTIME_INVALIDATE_DEBOUNCE_MS = 250;

type UseRealtimeQuerySyncInput = {
  scope: string;
  eventId?: string | null;
  matId?: string | null;
  enabled?: boolean;
  queryKeys: QueryKey[];
};

export function useRealtimeQuerySync(input: UseRealtimeQuerySyncInput) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const serializedQueryKeys = JSON.stringify(input.queryKeys);

  useEffect(() => {
    if (!input.enabled || !input.eventId) return;

    const socketServerUrl = getSocketServerUrl();
    const socket = socketServerUrl
      ? io(socketServerUrl, {
          path: SOCKET_IO_PATH,
          transports: ['polling', 'websocket'],
          withCredentials: true,
          // C1: cap reconnection backoff. An anonymous public viewer has no
          // LIVE_RUN token, so the gateway rejects the handshake and socket.io
          // retries forever. Capping the delay to 30s (default 5s) means a
          // rejected client retries at most once per 30s, bounding handshake
          // load on the single-process gateway ~6x. Connected behaviour is
          // unchanged; authed operators still reconnect (just with a higher
          // backoff ceiling). Full fix = anonymous read-only namespace (see
          // docs/DEPLOYMENT.md "Known scaling limits").
          reconnectionDelayMax: 30_000,
        })
      : io({
          path: SOCKET_IO_PATH,
          transports: ['polling', 'websocket'],
          withCredentials: true,
          // C1: cap reconnection backoff. An anonymous public viewer has no
          // LIVE_RUN token, so the gateway rejects the handshake and socket.io
          // retries forever. Capping the delay to 30s (default 5s) means a
          // rejected client retries at most once per 30s, bounding handshake
          // load on the single-process gateway ~6x. Connected behaviour is
          // unchanged; authed operators still reconnect (just with a higher
          // backoff ceiling). Full fix = anonymous read-only namespace (see
          // docs/DEPLOYMENT.md "Known scaling limits").
          reconnectionDelayMax: 30_000,
        });
    const connectionTarget = socketServerUrl ?? 'same-origin';

    const onConnect = () => {
      setIsConnected(true);
      logRealtime(input.scope, 'connect', {
        eventId: input.eventId,
        matId: input.matId ?? null,
        baseUrl: connectionTarget,
        path: SOCKET_IO_PATH,
      });
      socket.emit('join-event', { eventId: input.eventId });
      logRealtime(input.scope, 'join-event', { eventId: input.eventId });

      if (input.matId) {
        socket.emit('join-mat', { matId: input.matId });
        logRealtime(input.scope, 'join-mat', { matId: input.matId });
      }
    };

    const onDisconnect = () => {
      setIsConnected(false);
      logRealtime(input.scope, 'disconnect', {
        eventId: input.eventId,
        matId: input.matId ?? null,
      });
    };

    const onConnectError = (error: Error) => {
      logRealtime(input.scope, 'connect-error', {
        eventId: input.eventId,
        matId: input.matId ?? null,
        baseUrl: connectionTarget,
        path: SOCKET_IO_PATH,
        message: error.message,
      });
    };

    // join-event/join-mat rejections arrive here as a WsException. Without this
    // listener a failed room join is silent — the socket looks "connected" but
    // never receives updates.
    const onException = (payload: unknown) => {
      logRealtime(input.scope, 'exception', {
        eventId: input.eventId,
        matId: input.matId ?? null,
        payload,
      });
    };

    // Trailing-debounce the refetch so a per-action burst of socket events
    // collapses into a single invalidation (see REALTIME_INVALIDATE_DEBOUNCE_MS).
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null;
    const flushInvalidate = () => {
      invalidateTimer = null;
      for (const queryKey of input.queryKeys) {
        void queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
    };

    const onUpdate = (eventName: string) => {
      setLastSyncAt(new Date().toISOString());
      logRealtime(input.scope, 'receive', {
        eventName,
        eventId: input.eventId,
        matId: input.matId ?? null,
      });

      if (invalidateTimer) clearTimeout(invalidateTimer);
      invalidateTimer = setTimeout(
        flushInvalidate,
        REALTIME_INVALIDATE_DEBOUNCE_MS,
      );
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('exception', onException);
    socket.on('fight:update', () => onUpdate('fight:update'));
    socket.on('schedule:update', () => onUpdate('schedule:update'));
    socket.on('timer:update', () => onUpdate('timer:update'));

    return () => {
      if (invalidateTimer) clearTimeout(invalidateTimer);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('exception', onException);
      socket.off('fight:update');
      socket.off('schedule:update');
      socket.off('timer:update');
      socket.close();
    };
  }, [
    input.enabled,
    input.eventId,
    input.matId,
    input.scope,
    queryClient,
    serializedQueryKeys,
  ]);

  return {
    isConnected,
    lastSyncAt,
  };
}
