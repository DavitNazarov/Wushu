import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

/**
 * Routes that require a logged-in user.
 * Middleware only checks cookie *presence* — it does NOT call the backend or validate JWTs.
 * Heavy auth (token verification, role checks) is done in server components.
 */
const PROTECTED_PREFIXES = ['/admin', '/coach', '/athlete', '/dashboard'];

/**
 * Routes that should redirect logged-in users away to their dashboard.
 */
const LOGIN_PATHS = ['/login'];

function stripLocale(pathname: string): string {
  const m = pathname.match(/^\/(en|ka)(\/.*)?$/);
  return m ? (m[2] ?? '/') : pathname;
}

function isProtectedRoute(pathname: string): boolean {
  const path = stripLocale(pathname);
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

function isLoginRoute(pathname: string): boolean {
  const path = stripLocale(pathname);
  return LOGIN_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

const SENTRY_PATH_PREFIXES = ['/sentry-tunnel'];

function isSentryRoute(pathname: string): boolean {
  return SENTRY_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isSentryRoute(pathname)) {
    return NextResponse.next();
  }
  const locale = pathname.match(/^\/(en|ka)\b/)?.[1] ?? routing.defaultLocale;
  const forceLogin = request.nextUrl.searchParams.get('force') === '1';

  // Cookie presence check only — middleware must NEVER call /api/auth/refresh
  const hasAccessToken = Boolean(request.cookies.get('gw_auth')?.value);
  const hasRefreshToken = Boolean(request.cookies.get('gw_refresh')?.value);
  const hasAnyToken = hasAccessToken || hasRefreshToken;

  if (isProtectedRoute(pathname) && !hasAnyToken) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = `/${locale}/login`;
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginRoute(pathname) && hasAccessToken && !forceLogin) {
    // Only a live access token should block the login page.
    // A lone refresh cookie may be stale or the API may be unreachable, so
    // forcing a dashboard hop here can trap the user in a refresh loop.
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = `/${locale}/dashboard`;
    dashboardUrl.searchParams.delete('next');
    return NextResponse.redirect(dashboardUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|trpc|_next|_vercel|.*\\..*).*)'],
};
