/**
 * Authenticated fetch wrapper.
 *
 * Rules:
 * - Always sends cookies (credentials: "include").
 * - On 401: tries POST /api/auth/refresh ONCE (shared promise — prevents refresh storms).
 * - On successful refresh: retries original request once.
 * - On failed refresh: redirects to login ONCE (loginRedirectDone flag prevents loops).
 * - Never retries auth endpoints themselves.
 */

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
  console.debug('[fetchWithAuth] POSTing /api/auth/refresh');
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    console.debug('[fetchWithAuth] refresh result:', res.status);
    return res.ok;
  } catch (err) {
    console.error('[fetchWithAuth] refresh network error', err);
    return false;
  }
}

function redirectToLogin(): void {
  if (loginRedirectDone) return;
  loginRedirectDone = true;
  const locale = window.location.pathname.match(/^\/(en|ka)/)?.[1] ?? 'en';
  const next = encodeURIComponent(window.location.pathname);
  console.warn('[fetchWithAuth] refresh failed — redirecting to login');
  window.location.href = `/${locale}/login?force=1&next=${next}`;
}

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const opts: RequestInit = { ...init, credentials: 'include' };
  const res = await fetch(input, opts);

  if (res.status !== 401) return res;

  // Don't try to refresh if the failing request IS an auth endpoint
  if (isAuthEndpoint(input)) {
    console.debug('[fetchWithAuth] 401 on auth endpoint — not refreshing');
    return res;
  }

  console.debug('[fetchWithAuth] 401 on', urlString(input), '— attempting refresh');

  // Share one refresh call across concurrent 401s
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  const refreshed = await refreshPromise;

  if (!refreshed) {
    redirectToLogin();
    return res;
  }

  return fetch(input, opts);
}
