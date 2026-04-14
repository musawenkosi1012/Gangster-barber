import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Routes that never need auth
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/onboarding(.*)",
  "/api/(.*)",       // backend handles its own JWT auth
]);

// Admin zone — requires a non-customer role
const isAdminRoute = createRouteMatcher(["/admin(.*)", "/it(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();

  // Unauthenticated — block non-public routes
  if (!userId) {
    if (!isPublicRoute(req)) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
    return NextResponse.next();
  }

  // Block customers from admin/it dashboards (server-side guard)
  if (isAdminRoute(req)) {
    const role = (sessionClaims as any)?.metadata?.role || "customer";
    if (role === "customer") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
