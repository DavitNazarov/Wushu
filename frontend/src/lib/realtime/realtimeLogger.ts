'use client';

export function logRealtime(scope: string, action: string, details?: Record<string, unknown>) {
  console.info('[realtime]', {
    scope,
    action,
    ...(details ?? {}),
  });
}
