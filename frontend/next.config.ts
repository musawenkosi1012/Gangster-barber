import type { NextConfig } from "next";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://gangster-barber-backend.vercel.app";

const PAYNOW_URL =
  process.env.NEXT_PUBLIC_PAYNOW_URL ||
  "https://gangster-barber-paynow.vercel.app";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
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
      // PayNow microservice — must come BEFORE the general backend rule
      {
        source: "/api/payments/:path*",
        destination: `${PAYNOW_URL}/api/payments/:path*`,
      },
      // FastAPI backend — everything else under /api
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
