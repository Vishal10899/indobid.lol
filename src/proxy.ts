import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * INDOBID — NEXT.JS SERVER-SIDE PROXY (ROUTE PROTECTION)
 * Enforces mandatory authentication across all protected pages and APIs.
 * Unauthenticated users are strictly blocked and redirected to the public landing page.
 */

// Public paths that unauthenticated visitors/bots are permitted to access
const PUBLIC_API_PREFIXES = [
  '/api/health',
  '/api/ready',
  '/api/auth/',
  '/api/webhooks/',
  '/api/categories',
];

// Protected page prefixes that require an authenticated user session
const PROTECTED_PAGE_PREFIXES = [
  '/explore',
  '/trending',
  '/activity',
  '/notifications',
  '/messages',
  '/profile',
  '/debate',
  '/saved',
  '/admin',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip static assets, Next internals, and public root files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.svg' ||
    pathname === '/icon.svg' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // 2. Read session cookies
  const sessionCookie = request.cookies.get('indobid_session')?.value;
  const adminCookie = request.cookies.get('indobid_admin_session')?.value;
  const hasSession = Boolean(sessionCookie && sessionCookie.includes('.'));
  const hasAdminSession = Boolean(adminCookie);

  // 3. Server-side API Authorization Guard
  if (pathname.startsWith('/api/')) {
    const isPublicApi = PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    if (!isPublicApi) {
      // Require session token or admin session for protected APIs
      if (!hasSession && !hasAdminSession) {
        return NextResponse.json(
          {
            error: 'Authentication required to access IndoBid API',
            authenticated: false,
          },
          { status: 401 }
        );
      }
    }
    return NextResponse.next();
  }

  // 4. Server-side Protected Page Guard
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtectedPage && !hasSession && !hasAdminSession) {
    // Redirect unauthenticated visitor to public landing page with redirect target
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    loginUrl.searchParams.set('auth', 'login');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
