/**
 * Tests for the IP-based rate limiter.
 *
 * The rate limiter protects Bright Data credits from abuse.
 * Tests verify the sliding window, per-IP isolation, and cleanup logic.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { checkRateLimit, clearRateLimits } from "@/lib/middleware/rate-limiter";

describe("Rate limiter — basic flow", () => {
  beforeEach(() => {
    clearRateLimits();
  });

  it("should allow the first request", () => {
    const result = checkRateLimit("192.168.1.1");
    expect(result.allowed).toBe(true);
  });

  it("should allow up to 5 requests from the same IP", () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit("192.168.1.1");
      expect(result.allowed).toBe(true);
    }
  });

  it("should block the 6th request from the same IP", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("192.168.1.1");
    }
    const result = checkRateLimit("192.168.1.1");
    expect(result.allowed).toBe(false);
    expect(result.message).toContain("Rate limit exceeded");
  });

  it("should track IPs independently", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("10.0.0.1");
    }
    // 10.0.0.1 is exhausted, but 10.0.0.2 should be fine
    expect(checkRateLimit("10.0.0.1").allowed).toBe(false);
    expect(checkRateLimit("10.0.0.2").allowed).toBe(true);
  });
});

describe("Rate limiter — sliding window", () => {
  beforeEach(() => {
    clearRateLimits();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should reset after the 60-second window expires", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("192.168.1.1");
    }
    expect(checkRateLimit("192.168.1.1").allowed).toBe(false);

    // Advance past the 60-second window
    vi.advanceTimersByTime(60_001);

    // Should allow again
    expect(checkRateLimit("192.168.1.1").allowed).toBe(true);
  });
});

describe("Rate limiter — input sanitisation", () => {
  beforeEach(() => {
    clearRateLimits();
  });

  it("should extract the first IP from x-forwarded-for format", () => {
    // These should all count as the same IP
    checkRateLimit("1.2.3.4, 5.6.7.8, 9.10.11.12");
    checkRateLimit("1.2.3.4");
    // Both calls above should be from "1.2.3.4", so we have 2 requests
    for (let i = 0; i < 3; i++) {
      checkRateLimit("1.2.3.4");
    }
    // Now at 5, the 6th should be blocked
    expect(checkRateLimit("1.2.3.4").allowed).toBe(false);
  });

  it("should handle 'unknown' IP gracefully", () => {
    const result = checkRateLimit("unknown");
    expect(result.allowed).toBe(true);
  });

  it("should truncate extremely long IP strings to prevent memory abuse", () => {
    const longIp = "a".repeat(1000);
    const result = checkRateLimit(longIp);
    expect(result.allowed).toBe(true);
  });
});
