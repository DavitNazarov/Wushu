'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { logRealtime } from '@/lib/realtime/realtimeLogger';
import { getSocketServerUrl } from '@/lib/realtime/socketUrl';

type QueryKey = readonly unknown[];

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

    const baseUrl = getSocketServerUrl();
    const socket = io(baseUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    const onConnect = () => {
      setIsConnected(true);
      logRealtime(input.scope, 'connect', {
        eventId: input.eventId,
        matId: input.matId ?? null,
        baseUrl,
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
        baseUrl,
        message: error.message,
      });
    };

    const onUpdate = (eventName: string) => {
      setLastSyncAt(new Date().toISOString());
      logRealtime(input.scope, 'receive', {
        eventName,
        eventId: input.eventId,
        matId: input.matId ?? null,
      });

      for (const queryKey of input.queryKeys) {
        void queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('fight:update', () => onUpdate('fight:update'));
    socket.on('schedule:update', () => onUpdate('schedule:update'));
    socket.on('timer:update', () => onUpdate('timer:update'));

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('fight:update');
      socket.off('schedule:update');
      socket.off('timer:update');
      socket.close();
    };
  }, [input.enabled, input.eventId, input.matId, input.scope, queryClient, serializedQueryKeys]);

  return {
    isConnected,
    lastSyncAt,
  };
}
