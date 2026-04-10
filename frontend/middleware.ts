/**
 * GANGSTER BARBER - Network Proxy Boundary
 * Renamed from middleware.ts as per Next.js v16 convention.
 * Handles authentication gating and route protection via Clerk.
 */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define precise operational zones
const isBarberZone = createRouteMatcher(['/admin(.*)']);
const isITZone = createRouteMatcher(['/it(.*)']);
const isBookingRoute = createRouteMatcher(['/book(.*)']);
const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)', '/api/(.*)']);

export default clerkMiddleware(async (auth, request) => {
  const { sessionClaims } = await auth();
  
  // Tactical Role Extraction: Searching all possible claim sectors
  const role = (sessionClaims?.metadata as any)?.role || 
               (sessionClaims?.publicMetadata as any)?.role || 
               (sessionClaims?.public_metadata as any)?.role ||
               "customer";
               
  const path = request.nextUrl.pathname;

  // 1. Admin-Blind Redirect: Pushing staff members to the Cockpit
  if (path.startsWith('/book')) {
    if (role === 'it_admin') {
      return NextResponse.redirect(new URL('/it', request.url));
    }
    // Any barber-level staff should NOT be in the customer booking flow
    if (['admin', 'barber', 'barber_admin', 'owner'].includes(role)) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // 2. Outbound Guard: Protecting the Barber Ops zone
  if (path.startsWith('/admin')) {
    if (!['admin', 'barber', 'barber_admin', 'owner'].includes(role)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // 3. IT Security Guard: Protecting the technical zone
  if (path.startsWith('/it')) {
    if (role !== 'it_admin' && role !== 'owner') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // 4. Force Auth for non-public sectors
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Layer 2: Explicitly exclude static assets to prevent header lamination errors
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
