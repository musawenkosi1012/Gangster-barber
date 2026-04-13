import { NextRequest, NextResponse } from "next/server";

const PAYNOW_URL =
  process.env.PAYNOW_URL ||
  process.env.NEXT_PUBLIC_PAYNOW_URL ||
  "https://gangster-barber-paynow.vercel.app";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";

async function proxy(req: NextRequest, path: string[]) {
  const targetUrl = `${PAYNOW_URL}/api/payments/${path.join("/")}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (INTERNAL_SECRET) {
    headers["Authorization"] = `Bearer ${INTERNAL_SECRET}`;
  }

  const init: RequestInit = { method: req.method, headers };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const res = await fetch(targetUrl, init);
  const data = await res.text();

  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(req, path);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(req, path);
}
