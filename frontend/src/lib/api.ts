const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function getApiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * For server-side fetch: use same-origin URL so Next.js rewrite proxies to backend.
 * Avoids direct localhost:4000 calls that can fail (e.g. server not reachable).
 */
export async function getServerApiUrl(path: string): Promise<string> {
  const { headers } = await import('next/headers');
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const protocol = h.get('x-forwarded-proto') ?? 'http';
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${protocol}://${host}${p}`;
}
