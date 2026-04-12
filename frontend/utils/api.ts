/**
 * Syndicate API Utility v3.0
 * - Timeout reduced from 45s to 12s (dashboard never blocks for minutes)
 * - Retries reduced from 3 to 2 (max wait: 12s + 2s backoff + 12s = 26s worst case)
 * - Cold-start detection still works via isWarm flag
 * - Explicit AbortController per request
 */

let isWarm = false;

export async function syndicateFetch(
  endpoint: string,
  options: RequestInit = {},
  retries = 2
): Promise<Response> {
  // Always use relative paths — Next.js rewrites in next.config.ts proxy
  // /api/* → FastAPI backend and /api/payments/* → PayNow microservice.
  // Absolute http/https URLs are passed through as-is (e.g. Paynow poll_url checks).
  const pathSeparator = endpoint.startsWith("/") ? "" : "/";
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${pathSeparator}${endpoint}`;

  let lastError: any;

  // 12s standard, 20s cold-start first attempt
  const timeoutMs = isWarm ? 12000 : 20000;

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();

    const id = setTimeout(() => {
      try {
        controller.abort("TIMEOUT_EXCEEDED");
      } catch {
        controller.abort();
      }
    }, timeoutMs);

    // 🛡️ Security Sanity: Prevent malformed auth headers from leaking to the backend
    if (options.headers) {
      const headers = options.headers as Record<string, string>;
      if (headers['Authorization'] === 'Bearer null' || headers['Authorization'] === 'Bearer undefined') {
        console.warn("[Syndicate] Blocked unauthenticated trial: Token missing on mount.");
        delete headers['Authorization'];
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options.headers,
          "X-Syndicate-Platform": "GB-Term-2026",
        }
      });

      clearTimeout(id);

      if (response.ok) {
        isWarm = true;
        return response;
      }

      if (response.status >= 500) {
        console.error(`[Syndicate] Server Error ${response.status} on ${url}`);
        throw new Error(`Server Error: ${response.status}`);
      }
      
      if (response.status === 401 || response.status === 403) {
        const detail = await response.clone().json().catch(() => ({}));
        console.error(`[Syndicate] Identity Failure ${response.status}:`, detail.detail || "Authentication required");
      }
      
      if (response.status >= 400) {
        console.error(`[Syndicate] Client Error ${response.status} on ${url}`);
      }

      if (response.status === 429) {
        throw new Error("Rate Limit Exceeded");
      }

      // 4xx — return as-is, caller handles
      return response;
    } catch (err: any) {
      clearTimeout(id);
      lastError = err;

      if (err.name === "AbortError") {
        const reason = err.cause || (err as any).reason;

        // Component unmounted / manual abort — exit immediately, don't retry
        if (!reason || reason !== "TIMEOUT_EXCEEDED") {
          throw err;
        }

        console.warn(
          `[Syndicate] Timeout (${timeoutMs}ms) on attempt ${i + 1}/${retries}: ${url}`
        );

        if (i === retries - 1) {
          throw new Error("TIMEOUT_EXCEEDED");
        }
      }

      // Exponential backoff between retries (1s, 2s)
      const delay = Math.pow(2, i) * 1000;
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  throw lastError;
}
