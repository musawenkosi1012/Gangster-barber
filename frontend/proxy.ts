/**
 * GANGSTER BARBER - Network Proxy Boundary
 * Next.js 16 uses proxy.ts instead of middleware.ts
 * Handles authentication gating and route protection via Clerk.
 */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/(.*)',
]);

const isAdminRoute = createRouteMatcher(['/admin(.*)']);
const isITRoute = createRouteMatcher(['/it(.*)']);
const isBookRoute = createRouteMatcher(['/book(.*)']);

export default clerkMiddleware(async (auth, request) => {
  const { sessionClaims, userId } = await auth();

  const role =
    (sessionClaims?.metadata as any)?.role ||
    (sessionClaims?.publicMetadata as any)?.role ||
    (sessionClaims?.public_metadata as any)?.role ||
    'customer';

  const path = request.nextUrl.pathname;

  // Staff redirect: if a staff member hits /book, send them to /admin
  if (isBookRoute(request) && userId) {
    if (['admin', 'barber', 'barber_admin', 'owner'].includes(role)) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    if (role === 'it_admin') {
      return NextResponse.redirect(new URL('/it', request.url));
    }
  }

  // Admin guard: only staff can access /admin
  if (isAdminRoute(request)) {
    if (!userId || !['admin', 'barber', 'barber_admin', 'owner'].includes(role)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // IT guard
  if (isITRoute(request)) {
    if (!userId || !['it_admin', 'owner'].includes(role)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Protect non-public routes — but /book is PUBLIC (customers can book without account)
  // Only protect /admin and /it (already handled above)
  // Do NOT call auth.protect() on /book — it causes redirect loops for unauthenticated users

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
