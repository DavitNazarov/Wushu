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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = pathname.match(/^\/(en|ka)\b/)?.[1] ?? routing.defaultLocale;
  const forceLogin = request.nextUrl.searchParams.get('force') === '1';

  // Cookie presence check only — middleware must NEVER call /api/auth/refresh
  const hasAccessToken = Boolean(request.cookies.get('gw_auth')?.value);
  const hasRefreshToken = Boolean(request.cookies.get('gw_refresh')?.value);
  const hasAnyToken = hasAccessToken || hasRefreshToken;

  if (isProtectedRoute(pathname) && !hasAnyToken) {
    // [LOG] temporary observability
    console.debug(
      `[middleware] REDIRECT to login | path=${pathname} | access=${hasAccessToken} | refresh=${hasRefreshToken}`,
    );
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = `/${locale}/login`;
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginRoute(pathname) && hasAnyToken && !forceLogin) {
    // Logged-in user on login page: send them to dashboard.
    // Dashboard will call getAuthContext(), and if the access token is gone it will
    // redirect to /auth/refresh — one clean hop, no loop.
    console.debug(`[middleware] REDIRECT logged-in user away from login | path=${pathname}`);
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
