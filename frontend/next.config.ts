import type { NextConfig } from "next";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://gangster-barber-backend.vercel.app";

const PAYNOW_URL =
  process.env.PAYNOW_URL ||
  process.env.NEXT_PUBLIC_PAYNOW_URL ||
  "https://gangster-barber-paynow.vercel.app";

const INDEXNOW_KEY = "1aab24b423a34a0597a5ecd41c9d12c0";

const IMMUTABLE_ASSETS = [
  "/logo.png",
  "/favicon.ico",
  "/favicon.png",
  "/apple-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/noise.svg",
];

const DAILY_CACHE_ASSETS = [
  "/site.webmanifest",
  `/${INDEXNOW_KEY}.txt`,
];

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const IMMUTABLE_HEADERS = [
  { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
];

const DAILY_HEADERS = [
  { key: "Cache-Control", value: "public, max-age=86400" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      // Cloudinary — service image uploads
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      // Supabase Storage — service image uploads
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      // Supabase custom domains
      {
        protocol: "https",
        hostname: "**.supabase.in",
      },
    ],
  },

  /**
   * Response headers
   *
   * - Baseline security headers on every route (nosniff, referrer-policy,
   *   permissions-policy). X-Frame-Options intentionally omitted because Clerk
   *   and PayNow flows require controlled iframe/redirect behaviour.
   * - Strict-Transport-Security intentionally omitted — Vercel sets HSTS at
   *   the edge for all apex/preview domains; duplicating it here is redundant.
   * - Long immutable cache on branded assets (favicons, logos, noise).
   * - Next.js already sets `immutable` on /_next/static/* by default; no need
   *   to duplicate.
   * - Daily cache on the manifest and the IndexNow key file (they change
   *   rarely but not never).
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      ...IMMUTABLE_ASSETS.map((source) => ({
        source,
        headers: IMMUTABLE_HEADERS,
      })),
      ...DAILY_CACHE_ASSETS.map((source) => ({
        source,
        headers: DAILY_HEADERS,
      })),
    ];
  },

  /**
   * API Proxy Rewrites
   *
   * All /api/payments/* calls are forwarded to the PayNow microservice.
   * All other /api/* calls are forwarded to the FastAPI backend.
   *
   * This means NEXT_PUBLIC_API_URL and NEXT_PUBLIC_PAYNOW_URL only need to be
   * set in server-side env vars (no NEXT_PUBLIC_ exposure needed in production).
   * The frontend always calls relative /api/* paths — no hardcoded URLs in client code.
   */
  async rewrites() {
    return [
      // /api/payments/* is handled by app/api/payments/[...path]/route.ts
      // which injects the INTERNAL_API_SECRET Bearer token server-side.
      // This rewrite is a fallback for deployments where the API route
      // is not yet registered (e.g. during PR preview builds).
      {
        source: "/api/payments/:path*",
        destination: `${PAYNOW_URL}/api/payments/:path*`,
      },
      // FastAPI backend — everything else under /api
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      // Static assets (uploads) from backend
      {
        source: "/static/:path*",
        destination: `${BACKEND_URL}/static/:path*`,
      },
    ];
  },
};

export default nextConfig;
