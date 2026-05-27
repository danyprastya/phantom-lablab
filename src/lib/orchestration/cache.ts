import type { ScanResponse } from "@/lib/types";

interface CacheEntry {
  response: ScanResponse;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 100;

export function getCached(query: string): ScanResponse | undefined {
  const entry = cache.get(query);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(query);
    return undefined;
  }
  return entry.response;
}

export function setCached(query: string, response: ScanResponse): void {
  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(query, { response, expiresAt: Date.now() + TTL_MS });
}

export function clearCache(): void {
  cache.clear();
  console.log("Cache cleared");
}
