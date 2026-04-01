'use client';

export const SOCKET_IO_PATH = '/api/socket.io';

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function getSocketServerUrl(): string | undefined {
  const configuredUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();

  if (configuredUrl) {
    if (configuredUrl === '/' && typeof window !== 'undefined') {
      return window.location.origin;
    }
    return normalizeOrigin(configuredUrl);
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return undefined;
}
