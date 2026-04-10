/**
 * Elite 'Syndicate' API Utility v2.0
 * Enhanced with 'Cold Start' resilience and explicit abort signals.
 */

let isWarm = false;

export async function syndicateFetch(endpoint: string, options: RequestInit = {}, retries = 3): Promise<Response> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const pathSeparator = endpoint.startsWith("/") ? "" : "/";
  const url = endpoint.startsWith("http") ? endpoint : `${apiUrl}${pathSeparator}${endpoint}`;

  let lastError: any;

  // Layer 2: Zim-Resilience Buffer (Dynamic Timeout)
  // Standard: 30s | Warmup/Cold Start: 45s 
  const timeoutMs = isWarm ? 30000 : 45000;

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    
    // Layer 1: Explicit Abort Signals
    const id = setTimeout(() => {
      // Modern browsers/Node support reasons in abort()
      try {
        controller.abort("TIMEOUT_EXCEEDED");
      } catch (e) {
        // Fallback for older environments
        controller.abort();
      }
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(id);

      // Status Check: Cluster Success
      if (response.ok) {
        isWarm = true; // System is now confirmed active
        return response;
      }

      // Layer 3: Error Interception
      if (response.status >= 500) {
        throw new Error(`Syndicate Cluster Error: ${response.status}`);
      }

      // If it's a client error (4xx) or a successful but non-ok response, 
      // we don't necessarily retry unless it's a 429
      if (response.status === 429) {
        throw new Error("Rate Limit Exceeded");
      }

      return response;
    } catch (err: any) {
      clearTimeout(id);
      lastError = err;

      // Handle Abort Signals
      if (err.name === 'AbortError') {
        const reason = err.cause || (err as any).reason; // Fetch implementations differ on where 'reason' is stored

        // If the developer save/unmount killed the request, we exit silently
        if (!reason || reason !== "TIMEOUT_EXCEEDED") {
          throw err;
        }

        // Tactical Timeout Handling
        console.warn(`[Syndicate] Tactical Timeout (${timeoutMs}ms) exceeded. ${isWarm ? 'Retry' : 'Warmup'} ${i + 1}/${retries}`);
        
        if (i === retries - 1) {
          throw new Error("Security Cluster is waking up. Connection delayed. Please refresh in a moment.");
        }
      }

      // Exponential backoff between retries
      const delay = Math.pow(2, i) * 1000;
      await new Promise(res => setTimeout(res, delay));
    }
  }

  throw lastError;
}
