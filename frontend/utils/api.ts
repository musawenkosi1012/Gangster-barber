/**
 * Elite 'Syndicate' API Utility
 * Provides robust fetches with retry logic and environment-aware routing
 */

export async function syndicateFetch(endpoint: string, options: RequestInit = {}, retries = 3): Promise<Response> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const url = endpoint.startsWith("http") ? endpoint : `${apiUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  let lastError: any;

  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(id);

      if (!response.ok && response.status >= 500) {
        throw new Error(`Syndicate Server Error: ${response.status}`);
      }

      return response;
    } catch (err: any) {
      lastError = err;
      if (err.name === 'AbortError') {
        console.warn(`Syndicate Connection Timeout: Retrying ${i + 1}/${retries}`);
      } else {
        console.warn(`Syndicate Fetch Failed: Retrying ${i + 1}/${retries}`);
      }
      
      // Exponential backoff
      await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
    }
  }

  throw lastError;
}
