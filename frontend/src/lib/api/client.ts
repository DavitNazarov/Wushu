let refreshPromise: Promise<boolean> | null = null;
let loginRedirectDone = false;

const AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'];

function urlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

function isAuthEndpoint(input: RequestInfo | URL): boolean {
  const url = urlString(input);
  return AUTH_ENDPOINTS.some((e) => url.includes(e));
}

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    return res.ok;
  } catch {
    return false;
  }
}

function redirectToLogin(): void {
  if (loginRedirectDone || typeof window === 'undefined') return;
  loginRedirectDone = true;
  const locale = window.location.pathname.match(/^\/(en|ka)/)?.[1] ?? 'en';
  const next = encodeURIComponent(window.location.pathname);
  window.location.href = `/${locale}/login?next=${next}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    const text = await res.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }

  throw new ApiError(
    res.status,
    (body.code as string) ?? (body.error as string) ?? `HTTP_${res.status}`,
    (body.message as string) ?? `Request failed with status ${res.status}`,
    body.issues ?? body.details,
  );
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { signal?: AbortSignal },
): Promise<T> {
  const opts: RequestInit = { ...init, credentials: 'include' };
  let res = await fetch(path, opts);

  if (res.status === 401 && !isAuthEndpoint(path)) {
    if (!refreshPromise) {
      refreshPromise = doRefresh().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;
    if (!refreshed) {
      redirectToLogin();
      throw new ApiError(401, 'UNAUTHENTICATED', 'Session expired');
    }
    res = await fetch(path, opts);
  }

  if (res.status === 403) {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied');
  }

  return handleResponse<T>(res);
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return api<T>(path, { method: 'GET', signal });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T = void>(path: string): Promise<T> {
  return api<T>(path, { method: 'DELETE' });
}
