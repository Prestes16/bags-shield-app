// Middleware: early return for static assets to prevent 404/500 in dev
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Early return for Next.js internal assets and static files
  // This prevents middleware from intercepting _next/static, favicon, etc.
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap.xml') ||
    pathname.startsWith('/manifest.webmanifest') ||
    pathname.startsWith('/_next/image') ||
    pathname.startsWith('/_next/static')
  ) {
    return NextResponse.next();
  }

  // Continue with normal middleware logic (if any in the future)
  return NextResponse.next();
}

export const config = {
  // Exclude Next.js internal paths and static assets from middleware
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt, sitemap.xml, manifest.webmanifest (SEO files)
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest).*)',
  ],
};
