/**
 * Tests for the scan result cache.
 *
 * The cache prevents re-scraping for the same query within a TTL window.
 * These tests verify TTL expiration, FIFO eviction, and cache isolation.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { getCached, setCached, clearCache } from "@/lib/orchestration/cache";
import type { ScanResponse } from "@/lib/types";

function makeResponse(query: string, total = 1): ScanResponse {
  return {
    query,
    total_jobs: total,
    jobs: [],
  };
}

describe("Cache — basic operations", () => {
  beforeEach(() => {
    clearCache();
  });

  it("should return undefined for uncached queries", () => {
    expect(getCached("nonexistent")).toBeUndefined();
  });

  it("should cache and retrieve a response", () => {
    const resp = makeResponse("test query");
    setCached("test query", resp);
    const cached = getCached("test query");
    expect(cached).toBeDefined();
    expect(cached?.query).toBe("test query");
  });

  it("should return different results for different queries", () => {
    setCached("query-a", makeResponse("query-a", 5));
    setCached("query-b", makeResponse("query-b", 10));
    expect(getCached("query-a")?.total_jobs).toBe(5);
    expect(getCached("query-b")?.total_jobs).toBe(10);
  });

  it("clearCache should remove all entries", () => {
    setCached("q1", makeResponse("q1"));
    setCached("q2", makeResponse("q2"));
    clearCache();
    expect(getCached("q1")).toBeUndefined();
    expect(getCached("q2")).toBeUndefined();
  });
});

describe("Cache — TTL expiration", () => {
  beforeEach(() => {
    clearCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return cached data within TTL (5 minutes)", () => {
    setCached("fresh", makeResponse("fresh"));
    vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
    expect(getCached("fresh")).toBeDefined();
  });

  it("should expire after TTL (5 minutes)", () => {
    setCached("stale", makeResponse("stale"));
    vi.advanceTimersByTime(5 * 60 * 1000 + 1); // 5 minutes + 1ms
    expect(getCached("stale")).toBeUndefined();
  });
});

describe("Cache — FIFO eviction", () => {
  beforeEach(() => {
    clearCache();
  });

  it("should evict oldest entry when max capacity (100) is reached", () => {
    // Fill cache to capacity
    for (let i = 0; i < 100; i++) {
      setCached(`query-${i}`, makeResponse(`query-${i}`));
    }
    // This should evict query-0
    setCached("overflow", makeResponse("overflow"));
    expect(getCached("query-0")).toBeUndefined();
    expect(getCached("overflow")).toBeDefined();
    // query-1 should still exist
    expect(getCached("query-1")).toBeDefined();
  });
});
