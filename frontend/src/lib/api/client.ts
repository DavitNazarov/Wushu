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
  window.location.href = `/${locale}/login?force=1&next=${next}`;
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

  const rawBody = await res.text();
  let body: Record<string, unknown> = {};
  if (rawBody) {
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      body = { message: rawBody };
    }
  }

  throw new ApiError(
    res.status,
    (body.code as string) ?? (body.error as string) ?? `HTTP_${res.status}`,
    (body.message as string) ?? rawBody ?? `Request failed with status ${res.status}`,
    // Only carry STRUCTURED validation issues here. Never fall back to the raw
    // response body — otherwise error UIs print the whole JSON payload as a
    // bogus "issue" line.
    body.issues ?? body.details ?? undefined,
  );
}

// Fetch with cookie auth; on a 401 from a non-auth endpoint, refresh the session
// once (de-duped across concurrent callers) and retry the same request. Throws
// ApiError + redirects to login when the refresh itself fails.
async function fetchWithRefresh(
  path: string,
  opts: RequestInit,
): Promise<Response> {
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

  return res;
}

async function api<T = unknown>(
  path: string,
  init?: RequestInit & { signal?: AbortSignal },
): Promise<T> {
  const res = await fetchWithRefresh(path, { ...init, credentials: 'include' });

  if (res.status === 403) {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied');
  }

  return handleResponse<T>(res);
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return api<T>(path, { method: 'GET', signal });
}

// GET that also surfaces the `X-Total-Count` response header alongside the
// parsed body — used for server-side pagination, where the body is one page of
// rows and the header is the full filtered count. Falls back to the body length
// when the header is absent (so non-paginated endpoints still behave sanely).
export async function apiGetWithTotal<T>(
  path: string,
  signal?: AbortSignal,
): Promise<{ rows: T; total: number }> {
  const res = await fetchWithRefresh(path, {
    method: 'GET',
    credentials: 'include',
    signal,
  });

  if (res.status === 403) {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied');
  }

  const rows = await handleResponse<T>(res);
  const header = res.headers.get('X-Total-Count');
  const parsed = header ? Number.parseInt(header, 10) : Number.NaN;
  const total = Number.isFinite(parsed)
    ? parsed
    : Array.isArray(rows)
      ? (rows as unknown[]).length
      : 0;

  return { rows, total };
}

// Fetch a binary response (e.g. a generated PDF) as a Blob, with the same
// cookie auth + 401-refresh behaviour as api(). Throws ApiError on failure.
export async function apiBlob(path: string): Promise<Blob> {
  const res = await fetchWithRefresh(path, {
    method: 'GET',
    credentials: 'include',
  });

  // handleResponse throws a parsed ApiError for any non-ok status.
  if (!res.ok) return handleResponse<Blob>(res);
  return res.blob();
}

// Save a Blob to the user's machine via a transient object URL.
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
