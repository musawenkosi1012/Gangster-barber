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

      // 🛡️ Log Sanitization: Hiding granular details in production-ready logs
      if (response.status >= 500) {
        console.error(`[Syndicate] Uplink logic collision (5xx)`);
        throw new Error(`Uplink Error`);
      }
      
      if (response.status === 401 || response.status === 403) {
        console.error(`[Syndicate] Identity validation failed (40x)`);
      }
      
      if (response.status >= 400 && response.status !== 408) {
        // Deterministic failure: No retry for non-timeout client errors
        return response;
      }

      // If it's a 408 (simulated by fetch timeout or actual status)
      throw new Error("RETRYABLE_TIMEOUT");

    } catch (err: any) {
      clearTimeout(id);
      lastError = err;

      // Deterministic Exit: Only retry on TIMEOUT_EXCEEDED (408 logic)
      const isRetryable = err.name === "AbortError" && (err.cause === "TIMEOUT_EXCEEDED" || (err as any).reason === "TIMEOUT_EXCEEDED");
      
      if (!isRetryable && err.message !== "RETRYABLE_TIMEOUT") {
        throw err;
      }

      console.warn(`[Syndicate] Latency spike on attempt ${i + 1}/${retries}. Retrying...`);

      // Exponential backoff
      const delay = Math.pow(2, i) * 1000;
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  throw lastError;
}
