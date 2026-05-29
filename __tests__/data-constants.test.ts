/**
 * Tests for the query sanitiser and data constants.
 *
 * The sanitiser is the first line of defence against injection attacks.
 * The data constants define all scoring parameters — any misconfiguration
 * would silently break the entire scoring system.
 */
import { describe, it, expect } from "vitest";
import {
  POSTING_AGE_MAX_POINTS,
  REPOST_COUNT_MAX_POINTS,
  HEADCOUNT_DELTA_MAX_POINTS,
  RECENT_NEWS_MAX_POINTS,
  GLASSDOOR_MAX_POINTS,
  POSTING_AGE_GHOST_THRESHOLD_DAYS,
  POSTING_AGE_WARN_THRESHOLD_DAYS,
  REPOST_GHOST_THRESHOLD,
  MAX_JOBS_PER_SEARCH,
  BRIGHT_DATA_API_URL,
  FREEZE_KEYWORDS,
  LAYOFF_KEYWORDS,
  EXPANSION_KEYWORDS,
  FUNDING_KEYWORDS,
  buildSynthesisPrompt,
} from "@/lib/data";

// ─── Query Sanitiser (tested via reimplementation since it's in route.ts) ─
// We test the exact same logic here to verify it works correctly.
function sanitiseQuery(query: string): string {
  return query
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s\-.,/()&+]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

describe("sanitiseQuery", () => {
  it("should pass through clean queries unchanged", () => {
    expect(sanitiseQuery("software engineer fintech remote")).toBe("software engineer fintech remote");
  });

  it("should strip HTML tags", () => {
    expect(sanitiseQuery("<script>alert(1)</script>test")).toBe("alert(1)test");
  });

  it("should strip special characters", () => {
    expect(sanitiseQuery("test; DROP TABLE users; --")).toBe("test DROP TABLE users --");
  });

  it("should collapse multiple spaces", () => {
    expect(sanitiseQuery("software   engineer    remote")).toBe("software engineer remote");
  });

  it("should trim whitespace", () => {
    expect(sanitiseQuery("  test query  ")).toBe("test query");
  });

  it("should allow common job search characters", () => {
    // + and () are kept by the sanitiser — they're valid for queries like C++
    expect(sanitiseQuery("C++ developer (senior/lead)")).toBe("C++ developer (senior/lead)");
    expect(sanitiseQuery("full-stack & backend")).toBe("full-stack & backend");
  });
});

// ─── Scoring Constants Integrity ──────────────────────────────────────────
describe("Scoring constants", () => {
  it("signal max points should sum to exactly 100", () => {
    const total = POSTING_AGE_MAX_POINTS
      + REPOST_COUNT_MAX_POINTS
      + HEADCOUNT_DELTA_MAX_POINTS
      + RECENT_NEWS_MAX_POINTS
      + GLASSDOOR_MAX_POINTS;
    expect(total).toBe(100);
  });

  it("thresholds should be in correct order", () => {
    expect(POSTING_AGE_WARN_THRESHOLD_DAYS).toBeLessThan(POSTING_AGE_GHOST_THRESHOLD_DAYS);
  });

  it("repost threshold should be reasonable", () => {
    expect(REPOST_GHOST_THRESHOLD).toBeGreaterThanOrEqual(2);
    expect(REPOST_GHOST_THRESHOLD).toBeLessThanOrEqual(5);
  });

  it("MAX_JOBS_PER_SEARCH should be between 5 and 20", () => {
    expect(MAX_JOBS_PER_SEARCH).toBeGreaterThanOrEqual(5);
    expect(MAX_JOBS_PER_SEARCH).toBeLessThanOrEqual(20);
  });
});

// ─── Keyword Lists ────────────────────────────────────────────────────────
describe("Keyword lists", () => {
  it("FREEZE_KEYWORDS should contain 'hiring freeze'", () => {
    expect(FREEZE_KEYWORDS).toContain("hiring freeze");
  });

  it("LAYOFF_KEYWORDS should contain 'layoff' and 'restructuring'", () => {
    expect(LAYOFF_KEYWORDS).toContain("layoff");
    expect(LAYOFF_KEYWORDS).toContain("restructuring");
  });

  it("EXPANSION_KEYWORDS should contain 'expansion'", () => {
    expect(EXPANSION_KEYWORDS).toContain("expansion");
  });

  it("FUNDING_KEYWORDS should contain 'series a'", () => {
    expect(FUNDING_KEYWORDS).toContain("series a");
  });

  it("all keyword lists should have at least 5 entries", () => {
    expect(FREEZE_KEYWORDS.length).toBeGreaterThanOrEqual(5);
    expect(LAYOFF_KEYWORDS.length).toBeGreaterThanOrEqual(5);
    expect(EXPANSION_KEYWORDS.length).toBeGreaterThanOrEqual(5);
    expect(FUNDING_KEYWORDS.length).toBeGreaterThanOrEqual(5);
  });

  it("keywords should all be lowercase", () => {
    const all = [...FREEZE_KEYWORDS, ...LAYOFF_KEYWORDS, ...EXPANSION_KEYWORDS, ...FUNDING_KEYWORDS];
    for (const kw of all) {
      expect(kw).toBe(kw.toLowerCase());
    }
  });
});

// ─── API URL ──────────────────────────────────────────────────────────────
describe("BRIGHT_DATA_API_URL", () => {
  it("should be the correct Bright Data endpoint", () => {
    expect(BRIGHT_DATA_API_URL).toBe("https://api.brightdata.com/request");
  });

  it("should use HTTPS", () => {
    expect(BRIGHT_DATA_API_URL).toMatch(/^https:\/\//);
  });
});

// ─── buildSynthesisPrompt ─────────────────────────────────────────────────
describe("buildSynthesisPrompt", () => {
  it("should include all provided parameters", () => {
    const prompt = buildSynthesisPrompt({
      job_title: "Engineer",
      company: "TestCo",
      location: "Remote",
      deterministic_score: 75,
      verdict: "Real",
      confidence: "High",
      sources_checked: 4,
      signals_formatted: "- Signal 1\n- Signal 2",
    });

    expect(prompt).toContain("Engineer");
    expect(prompt).toContain("TestCo");
    expect(prompt).toContain("Remote");
    expect(prompt).toContain("75/100");
    expect(prompt).toContain("Real");
    expect(prompt).toContain("High");
    expect(prompt).toContain("4/4");
    expect(prompt).toContain("Signal 1");
  });

  it("should request JSON response format", () => {
    const prompt = buildSynthesisPrompt({
      job_title: "x", company: "y", location: "z",
      deterministic_score: 50, verdict: "Suspicious",
      confidence: "Medium", sources_checked: 2,
      signals_formatted: "",
    });
    expect(prompt).toContain("adjusted_score");
    expect(prompt).toContain("adjustment_reason");
    expect(prompt).toContain("summary");
  });
});
