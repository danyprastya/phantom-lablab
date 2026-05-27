const bucket = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS = 5;
const WINDOW_MS = 60_000;

function getClientKey(ip: string): string {
  return ip || "unknown";
}

export function checkRateLimit(ip: string): { allowed: boolean; message?: string } {
  const key = getClientKey(ip);
  const now = Date.now();
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
