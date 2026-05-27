import type { ScanResponse } from "@/lib/types";

const cache = new Map<string, ScanResponse>();

export function getCached(query: string): ScanResponse | undefined {
  return cache.get(query);
}

export function setCached(query: string, response: ScanResponse): void {
  cache.set(query, response);
}

export function clearCache(): void {
  cache.clear();
  console.log("Cache cleared");
}
