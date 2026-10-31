import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isTokenValid, getSafeRedirectUrl } from '@/shared/utils/auth-token.util';

const PROTECTED_PREFIXES = [
  '/home',
  '/projects',
  '/library',
  '/storage',
  '/experiments',
  '/settings',
  '/drafts',
  '/ai',
  '/editor',
  '/your-work',
  '/stickies',
  '/pages',
  '/chat',
  '/inbox',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const rawToken = request.cookies.get('accessToken')?.value;
  const hasRefreshToken = Boolean(request.cookies.get('refresh_token')?.value);

  const hasRawToken = Boolean(rawToken && rawToken.trim());
  const isAuthenticated = isTokenValid(rawToken);

  // 1. Marketing root page:
  // Root page (landing page) is accessible to everyone (both authenticated and unauthenticated).
  if (pathname === '/') {
    if (hasRawToken && !isAuthenticated && !hasRefreshToken) {
      const response = NextResponse.next();
      response.cookies.delete('accessToken');
      return response;
    }
    return NextResponse.next();
  }

  // 2. Auth entry pages:
  // If already authenticated and not forcing relogin, redirect to /home or redirect param.
  if (pathname === '/login' || pathname === '/register') {
    const isForce = request.nextUrl.searchParams.get('force') === 'true';
    if (isAuthenticated && !isForce) {
      const redirectParam = request.nextUrl.searchParams.get('redirect');
      const targetUrl = getSafeRedirectUrl(redirectParam, '/home');
      return NextResponse.redirect(new URL(targetUrl, request.url));
    }

    const response = NextResponse.next();
    if (hasRawToken && !isAuthenticated && !hasRefreshToken) {
      response.cookies.delete('accessToken');
    }
    return response;
  }

  // 3. Protected internal application routes:
  // If user is not authenticated:
  // - If they have a valid refresh_token cookie, allow request to render App Shell so client can silentRefresh.
  // - Otherwise, redirect to login page preserving the target URL.
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !isAuthenticated) {
    if (hasRefreshToken) {
      // User session is still active via HttpOnly refresh_token cookie.
      // Allow request to proceed to client app, where api.ts will execute silentRefresh.
      return NextResponse.next();
    }

    const loginUrl = new URL('/login', request.url);
    const fullOriginalUrl = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set('redirect', fullOriginalUrl);
    const response = NextResponse.redirect(loginUrl);
    if (hasRawToken) {
      response.cookies.delete('accessToken');
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and assets:
     * - _next/static, _next/image
     * - favicon.ico, images, files with extensions
     * - api routes & backend auth endpoints
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs|pdf)$).*)',
  ],
};

