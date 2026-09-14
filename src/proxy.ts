import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = [
  '/home',
  '/projects',
  '/dashboard',
  '/library',
  '/storage',
  '/settings',
  '/drafts',
  '/ai',
  '/editor',
  '/your-work',
  '/stickies',
  '/archives',
  '/analytics',
  '/pages',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token =
    request.cookies.get('accessToken')?.value ||
    request.cookies.get('token')?.value;

  const isAuthenticated = Boolean(token);

  // 1. Marketing root page:
  // Root page (landing page) is accessible to everyone (both authenticated and unauthenticated).
  if (pathname === '/') {
    return NextResponse.next();
  }

  // 2. Auth entry pages:
  // If already authenticated and not forcing relogin, redirect to /home or redirect param.
  if (pathname === '/login' || pathname === '/register') {
    const isForce = request.nextUrl.searchParams.get('force') === 'true';
    if (isAuthenticated && !isForce) {
      const redirectParam = request.nextUrl.searchParams.get('redirect');
      if (redirectParam && redirectParam.startsWith('/')) {
        return NextResponse.redirect(new URL(redirectParam, request.url));
      }
      return NextResponse.redirect(new URL('/home', request.url));
    }
    return NextResponse.next();
  }

  // 3. Protected internal application routes:
  // If user is not authenticated, redirect to login page preserving the target URL.
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
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

