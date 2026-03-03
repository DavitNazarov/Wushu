import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const PROTECTED_PREFIXES = ['/admin', '/coach', '/athlete', '/dashboard'];

function isProtectedRoute(pathname: string): boolean {
  const localePath = pathname.match(/^\/(en|ka)(\/.*)?$/);
  if (!localePath) return false;
  const pathAfterLocale = localePath[2] ?? '/';
  return PROTECTED_PREFIXES.some((p) => pathAfterLocale === p || pathAfterLocale.startsWith(`${p}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const response = intlMiddleware(request);

  const isProtected = isProtectedRoute(pathname);
  const isLoginRoute = /^\/(en|ka)\/login(\/|$)/.test(pathname);

  const token = request.cookies.get('gw_auth')?.value;

  const localeMatch = pathname.match(/^\/(en|ka)\b/);
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;

  if (isProtected && !token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = `/${locale}/login`;
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginRoute && token) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = `/${locale}/dashboard`;
    dashboardUrl.searchParams.delete('next');
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|trpc|_next|_vercel|.*\\..*).*)'],
};
