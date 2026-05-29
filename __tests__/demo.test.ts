/**
 * Tests for the demo data module.
 *
 * Demo mode is the safety net for the hackathon demo — if live APIs fail,
 * these preloaded results are shown. Tests ensure the demo data is valid
 * and the query matcher works correctly.
 */
import { describe, it, expect } from "vitest";
import { isDemoQuery, DEMO_QUERY, DEMO_RESULTS } from "@/lib/data/demo";
import { JobResult } from "@/lib/types";

// ─── isDemoQuery ─────────────────────────────────────────────────────────
describe("isDemoQuery", () => {
  it("should match the exact demo query", () => {
    expect(isDemoQuery("software engineer fintech remote")).toBe(true);
  });

  it("should be case-insensitive", () => {
    expect(isDemoQuery("Software Engineer Fintech Remote")).toBe(true);
    expect(isDemoQuery("SOFTWARE ENGINEER FINTECH REMOTE")).toBe(true);
  });

  it("should trim whitespace", () => {
    expect(isDemoQuery("  software engineer fintech remote  ")).toBe(true);
  });

  it("should reject different queries", () => {
    expect(isDemoQuery("data scientist machine learning")).toBe(false);
    expect(isDemoQuery("software engineer")).toBe(false);
    expect(isDemoQuery("")).toBe(false);
  });

  it("should reject partial matches", () => {
    expect(isDemoQuery("software engineer fintech")).toBe(false);
    expect(isDemoQuery("software engineer fintech remote extra")).toBe(false);
  });
});

// ─── DEMO_RESULTS data integrity ─────────────────────────────────────────
describe("DEMO_RESULTS", () => {
  it("should contain exactly 5 results", () => {
    expect(DEMO_RESULTS).toHaveLength(5);
  });

  it("should contain 2 Real, 1 Suspicious, 2 Ghost verdicts", () => {
    const verdicts = DEMO_RESULTS.map((r) => r.verdict);
    expect(verdicts.filter((v) => v === "Real")).toHaveLength(2);
    expect(verdicts.filter((v) => v === "Suspicious")).toHaveLength(1);
    expect(verdicts.filter((v) => v === "Ghost")).toHaveLength(2);
  });

  it("should have scores in valid range (0-100)", () => {
    for (const result of DEMO_RESULTS) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it("should have scores matching their verdicts", () => {
    for (const result of DEMO_RESULTS) {
      if (result.verdict === "Real") expect(result.score).toBeGreaterThanOrEqual(75);
      if (result.verdict === "Suspicious") {
        expect(result.score).toBeGreaterThanOrEqual(40);
        expect(result.score).toBeLessThan(75);
      }
      if (result.verdict === "Ghost") expect(result.score).toBeLessThan(40);
    }
  });

  it("every result should pass Zod validation", () => {
    for (const result of DEMO_RESULTS) {
      const parsed = JobResult.safeParse(result);
      expect(parsed.success).toBe(true);
    }
  });

  it("every result should have a non-empty summary", () => {
    for (const result of DEMO_RESULTS) {
      expect(result.summary.length).toBeGreaterThan(50);
    }
  });

  it("every result should have 5 signals", () => {
    for (const result of DEMO_RESULTS) {
      expect(result.signals).toHaveLength(5);
    }
  });

  it("DEMO_QUERY should be the correct demo string", () => {
    expect(DEMO_QUERY).toBe("software engineer fintech remote");
  });
});
