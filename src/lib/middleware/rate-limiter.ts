/**
 * Rate Limiter — IP-based sliding-window rate limiting for the /api/scan endpoint.
 *
 * Limits each IP to 5 requests per 60-second window to prevent abuse
 * of Bright Data API credits. Uses an in-memory Map with automatic
 * cleanup to prevent unbounded memory growth.
 *
 * Note: On serverless platforms (Vercel), each cold start gets a fresh Map.
 * Rate limiting is best-effort in that environment — effective for burst
 * protection but not for sustained abuse across different instances.
 *
 * @module middleware/rate-limiter
 */
const bucket = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS = 5;
const WINDOW_MS = 60_000;
const MAX_ENTRIES = 10_000;

function getClientKey(ip: string): string {
  // x-forwarded-for can be "client, proxy1, proxy2" — take only the first IP
  const firstIp = ip.split(",")[0]?.trim() || "unknown";
  return firstIp.substring(0, 45); // prevent memory exhaustion from long headers
}

export function checkRateLimit(ip: string): { allowed: boolean; message?: string } {
  const key = getClientKey(ip);
  const now = Date.now();

  // Prevent bucket from growing unbounded
  if (bucket.size >= MAX_ENTRIES) {
    const iter = bucket.keys();
    let cleaned = 0;
    for (const k of iter) {
      const entry = bucket.get(k);
      if (entry && now > entry.resetAt) {
        bucket.delete(k);
        cleaned++;
      }
      if (cleaned >= 100) break;
    }
  }

  const entry = bucket.get(key);

  if (!entry || now > entry.resetAt) {
    bucket.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      message: `Rate limit exceeded. Max ${MAX_REQUESTS} requests per minute.`,
    };
  }

  entry.count++;
  return { allowed: true };
}

export function clearRateLimits(): void {
  bucket.clear();
}
