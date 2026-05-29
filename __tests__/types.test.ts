/**
 * Tests for Zod schemas, type validators, and the sourcesWithData function.
 *
 * Since types are the foundation of the entire pipeline, validating them
 * ensures no invalid data can sneak through and cause silent scoring errors.
 */
import { describe, it, expect } from "vitest";
import {
  ScanRequest,
  Signal,
  Verdict,
  Confidence,
  JobResult,
  ScanResponse,
  sourcesWithData,
} from "@/lib/types";
import type { MergedJobSignals } from "@/lib/types";

// ─── Zod Schema Validation ───────────────────────────────────────────────
describe("ScanRequest schema", () => {
  it("should accept a valid query", () => {
    const result = ScanRequest.safeParse({ query: "software engineer remote" });
    expect(result.success).toBe(true);
  });

  it("should reject a query shorter than 3 characters", () => {
    const result = ScanRequest.safeParse({ query: "ab" });
    expect(result.success).toBe(false);
  });

  it("should reject a query longer than 200 characters", () => {
    const result = ScanRequest.safeParse({ query: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("should reject missing query", () => {
    const result = ScanRequest.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("Verdict enum", () => {
  it("should accept valid verdicts", () => {
    expect(Verdict.safeParse("Real").success).toBe(true);
    expect(Verdict.safeParse("Suspicious").success).toBe(true);
    expect(Verdict.safeParse("Ghost").success).toBe(true);
  });

  it("should reject invalid verdicts", () => {
    expect(Verdict.safeParse("fake").success).toBe(false);
    expect(Verdict.safeParse("").success).toBe(false);
  });
});

describe("Confidence enum", () => {
  it("should accept valid confidence levels", () => {
    expect(Confidence.safeParse("High").success).toBe(true);
    expect(Confidence.safeParse("Medium").success).toBe(true);
    expect(Confidence.safeParse("Low").success).toBe(true);
  });

  it("should reject invalid values", () => {
    expect(Confidence.safeParse("VeryHigh").success).toBe(false);
  });
});

describe("Signal schema", () => {
  it("should accept a valid signal", () => {
    const result = Signal.safeParse({
      signal: "Posting age",
      value: "5 days",
      source: "Indeed Scraper",
      weight: "High",
      direction: "Real",
      points: 0,
    });
    expect(result.success).toBe(true);
  });

  it("should reject points > 30", () => {
    const result = Signal.safeParse({
      signal: "Test",
      value: "Test",
      source: "Test",
      weight: "Low",
      direction: "Ghost",
      points: 31,
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative points", () => {
    const result = Signal.safeParse({
      signal: "Test",
      value: "Test",
      source: "Test",
      weight: "Low",
      direction: "Ghost",
      points: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("JobResult schema", () => {
  it("should accept a valid job result", () => {
    const result = JobResult.safeParse({
      job_title: "Engineer",
      company: "TestCo",
      score: 85,
      verdict: "Real",
      confidence: "High",
    });
    expect(result.success).toBe(true);
  });

  it("should reject score > 100", () => {
    const result = JobResult.safeParse({
      job_title: "Engineer",
      company: "TestCo",
      score: 101,
      verdict: "Real",
      confidence: "High",
    });
    expect(result.success).toBe(false);
  });

  it("should reject score < 0", () => {
    const result = JobResult.safeParse({
      job_title: "Engineer",
      company: "TestCo",
      score: -1,
      verdict: "Real",
      confidence: "High",
    });
    expect(result.success).toBe(false);
  });
});

describe("ScanResponse schema", () => {
  it("should accept a valid response with jobs", () => {
    const result = ScanResponse.safeParse({
      query: "test",
      total_jobs: 1,
      jobs: [
        {
          job_title: "Engineer",
          company: "Co",
          score: 50,
          verdict: "Suspicious",
          confidence: "Medium",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should default to empty jobs array", () => {
    const result = ScanResponse.safeParse({ query: "test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jobs).toEqual([]);
      expect(result.data.total_jobs).toBe(0);
    }
  });
});

// ─── sourcesWithData ──────────────────────────────────────────────────────
describe("sourcesWithData", () => {
  function makeMerged(overrides: Partial<MergedJobSignals> = {}): MergedJobSignals {
    return {
      job_title: "Test", company: "Co", location: "Remote", url: "",
      serp: null, indeed: null, linkedin: null, web_unlocker: null,
      ...overrides,
    };
  }

  it("should return 0 when no sources have data", () => {
    expect(sourcesWithData(makeMerged())).toBe(0);
  });

  it("should count SERP as a source", () => {
    expect(
      sourcesWithData(makeMerged({
        serp: { title: "x", url: "x", snippet: "x", source: "SERP API" },
      }))
    ).toBe(1);
  });

  it("should count Indeed when posting_age_days is present", () => {
    expect(
      sourcesWithData(makeMerged({
        indeed: { posting_age_days: 5, repost_count: null, date_posted: null, company_name: null, source: "Indeed Scraper" },
      }))
    ).toBe(1);
  });

  it("should NOT count Indeed when both fields are null", () => {
    expect(
      sourcesWithData(makeMerged({
        indeed: { posting_age_days: null, repost_count: null, date_posted: null, company_name: null, source: "Indeed Scraper" },
      }))
    ).toBe(0);
  });

  it("should count LinkedIn when headcount_delta_pct is present", () => {
    expect(
      sourcesWithData(makeMerged({
        linkedin: { headcount: 100, headcount_delta_pct: 5.0, recent_posts: null, source: "LinkedIn Scraper" },
      }))
    ).toBe(1);
  });

  it("should count Web Unlocker when boolean signals are true", () => {
    expect(
      sourcesWithData(makeMerged({
        web_unlocker: {
          glassdoor_mentions_freeze: true, glassdoor_mentions_layoffs: false,
          glassdoor_review_snippets: null, recent_news: null,
          has_expansion_news: false, has_funding_news: false, source: "Web Unlocker",
        },
      }))
    ).toBe(1);
  });

  it("should count Web Unlocker when news snippets are present", () => {
    expect(
      sourcesWithData(makeMerged({
        web_unlocker: {
          glassdoor_mentions_freeze: false, glassdoor_mentions_layoffs: false,
          glassdoor_review_snippets: null, recent_news: ["expansion news"],
          has_expansion_news: false, has_funding_news: false, source: "Web Unlocker",
        },
      }))
    ).toBe(1);
  });

  it("should NOT count Web Unlocker when all signals are false/empty", () => {
    expect(
      sourcesWithData(makeMerged({
        web_unlocker: {
          glassdoor_mentions_freeze: false, glassdoor_mentions_layoffs: false,
          glassdoor_review_snippets: null, recent_news: null,
          has_expansion_news: false, has_funding_news: false, source: "Web Unlocker",
        },
      }))
    ).toBe(0);
  });

  it("should return 4 when all sources have data", () => {
    expect(
      sourcesWithData(makeMerged({
        serp: { title: "x", url: "x", snippet: "x", source: "SERP API" },
        indeed: { posting_age_days: 5, repost_count: 0, date_posted: null, company_name: null, source: "Indeed Scraper" },
        linkedin: { headcount: 100, headcount_delta_pct: 5.0, recent_posts: null, source: "LinkedIn Scraper" },
        web_unlocker: {
          glassdoor_mentions_freeze: false, glassdoor_mentions_layoffs: false,
          glassdoor_review_snippets: null, recent_news: null,
          has_expansion_news: true, has_funding_news: false, source: "Web Unlocker",
        },
      }))
    ).toBe(4);
  });
});
