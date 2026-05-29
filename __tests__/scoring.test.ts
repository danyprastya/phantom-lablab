/**
 * Tests for the deterministic scoring engine.
 *
 * This is the core scoring logic — it MUST be deterministic and reproducible.
 * Every scoring edge case is tested here because the LLM synthesis layer
 * relies on these scores being correct.
 */
import { describe, it, expect } from "vitest";
import { computeDeterministicScore } from "@/lib/scoring/deterministic";
import type { MergedJobSignals } from "@/lib/types";

// ─── Helper: builds a MergedJobSignals with optional overrides ────────────
function makeMerged(overrides: Partial<MergedJobSignals> = {}): MergedJobSignals {
  return {
    job_title: "Test Engineer",
    company: "TestCo",
    location: "Remote",
    url: "https://example.com",
    serp: null,
    indeed: null,
    linkedin: null,
    web_unlocker: null,
    ...overrides,
  };
}

// ─── Verdict Boundaries ───────────────────────────────────────────────────
describe("Verdict determination", () => {
  it("should return 'Real' when all signals are positive (score >= 75)", () => {
    const merged = makeMerged({
      serp: { title: "Test", url: "https://example.com", snippet: "...", source: "SERP API" },
      indeed: { posting_age_days: 5, repost_count: 0, date_posted: null, company_name: null, source: "Indeed Scraper" },
      linkedin: { headcount: 5000, headcount_delta_pct: 10.0, recent_posts: null, source: "LinkedIn Scraper" },
      web_unlocker: {
        glassdoor_mentions_freeze: false, glassdoor_mentions_layoffs: false,
        glassdoor_review_snippets: null, recent_news: null,
        has_expansion_news: true, has_funding_news: true, source: "Web Unlocker",
      },
    });
    const result = computeDeterministicScore(merged);
    expect(result.verdict).toBe("Real");
    expect(result.hiring_reality_score).toBeGreaterThanOrEqual(75);
  });

  it("should return 'Ghost' when all signals are negative (score < 40)", () => {
    const merged = makeMerged({
      indeed: { posting_age_days: 90, repost_count: 5, date_posted: null, company_name: null, source: "Indeed Scraper" },
      linkedin: { headcount: 100, headcount_delta_pct: -5.0, recent_posts: null, source: "LinkedIn Scraper" },
      web_unlocker: {
        glassdoor_mentions_freeze: true, glassdoor_mentions_layoffs: true,
        glassdoor_review_snippets: ["freeze"], recent_news: null,
        has_expansion_news: false, has_funding_news: false, source: "Web Unlocker",
      },
    });
    const result = computeDeterministicScore(merged);
    expect(result.verdict).toBe("Ghost");
    expect(result.hiring_reality_score).toBeLessThan(40);
  });

  it("should return 'Suspicious' for mixed signals (score 40-74)", () => {
    const merged = makeMerged({
      indeed: { posting_age_days: 45, repost_count: 1, date_posted: null, company_name: null, source: "Indeed Scraper" },
      linkedin: { headcount: 200, headcount_delta_pct: 3.0, recent_posts: null, source: "LinkedIn Scraper" },
      web_unlocker: {
        glassdoor_mentions_freeze: false, glassdoor_mentions_layoffs: false,
        glassdoor_review_snippets: null, recent_news: null,
        has_expansion_news: true, has_funding_news: false, source: "Web Unlocker",
      },
    });
    const result = computeDeterministicScore(merged);
    expect(result.verdict).toBe("Suspicious");
    expect(result.hiring_reality_score).toBeGreaterThanOrEqual(40);
    expect(result.hiring_reality_score).toBeLessThan(75);
  });
});

// ─── Posting Age Scoring ──────────────────────────────────────────────────
describe("Posting age scoring", () => {
  it("should score 0 points for fresh postings (< 30 days)", () => {
    const merged = makeMerged({
      indeed: { posting_age_days: 5, repost_count: 0, date_posted: null, company_name: null, source: "Indeed Scraper" },
    });
    const result = computeDeterministicScore(merged);
    const signal = result.signals.find((s) => s.signal === "Posting age");
    expect(signal?.points).toBe(0);
    expect(signal?.direction).toBe("Real");
  });

  it("should score 30 points for stale postings (> 60 days)", () => {
    const merged = makeMerged({
      indeed: { posting_age_days: 61, repost_count: 0, date_posted: null, company_name: null, source: "Indeed Scraper" },
    });
    const result = computeDeterministicScore(merged);
    const signal = result.signals.find((s) => s.signal === "Posting age");
    expect(signal?.points).toBe(30);
    expect(signal?.direction).toBe("Ghost");
  });

  it("should score proportionally for warning zone (30-60 days)", () => {
    const merged = makeMerged({
      indeed: { posting_age_days: 45, repost_count: 0, date_posted: null, company_name: null, source: "Indeed Scraper" },
    });
    const result = computeDeterministicScore(merged);
    const signal = result.signals.find((s) => s.signal === "Posting age");
    expect(signal?.points).toBeGreaterThan(0);
    expect(signal?.points).toBeLessThan(30);
    expect(signal?.direction).toBe("Ghost");
  });

  it("should skip signal when indeed data is missing", () => {
    const merged = makeMerged({ indeed: null });
    const result = computeDeterministicScore(merged);
    expect(result.signals.find((s) => s.signal === "Posting age")).toBeUndefined();
  });
});

// ─── Repost Count Scoring ─────────────────────────────────────────────────
describe("Repost count scoring", () => {
  it("should score 0 for 0 reposts", () => {
    const merged = makeMerged({
      indeed: { posting_age_days: 5, repost_count: 0, date_posted: null, company_name: null, source: "Indeed Scraper" },
    });
    const result = computeDeterministicScore(merged);
    const signal = result.signals.find((s) => s.signal === "Repost count");
    expect(signal?.points).toBe(0);
    expect(signal?.direction).toBe("Real");
  });

  it("should score 10 for 1 repost", () => {
    const merged = makeMerged({
      indeed: { posting_age_days: 5, repost_count: 1, date_posted: null, company_name: null, source: "Indeed Scraper" },
    });
    const result = computeDeterministicScore(merged);
    const signal = result.signals.find((s) => s.signal === "Repost count");
    expect(signal?.points).toBe(10);
  });

  it("should score 25 (max) for 2+ reposts", () => {
    const merged = makeMerged({
      indeed: { posting_age_days: 5, repost_count: 3, date_posted: null, company_name: null, source: "Indeed Scraper" },
    });
    const result = computeDeterministicScore(merged);
    const signal = result.signals.find((s) => s.signal === "Repost count");
    expect(signal?.points).toBe(25);
  });
});

// ─── Headcount Delta Scoring ──────────────────────────────────────────────
describe("Headcount delta scoring", () => {
  it("should score 0 for strong growth (>= 5%)", () => {
    const merged = makeMerged({
      linkedin: { headcount: 1000, headcount_delta_pct: 8.0, recent_posts: null, source: "LinkedIn Scraper" },
    });
    const result = computeDeterministicScore(merged);
    const signal = result.signals.find((s) => s.signal === "Headcount delta");
    expect(signal?.points).toBe(0);
    expect(signal?.direction).toBe("Real");
  });

  it("should score 10 for slow growth (0-5%)", () => {
    const merged = makeMerged({
      linkedin: { headcount: 1000, headcount_delta_pct: 3.0, recent_posts: null, source: "LinkedIn Scraper" },
    });
    const result = computeDeterministicScore(merged);
    const signal = result.signals.find((s) => s.signal === "Headcount delta");
    expect(signal?.points).toBe(10);
  });

  it("should score 20 (max) for zero or negative growth", () => {
    const merged = makeMerged({
      linkedin: { headcount: 1000, headcount_delta_pct: 0.0, recent_posts: null, source: "LinkedIn Scraper" },
    });
    const result = computeDeterministicScore(merged);
    const signal = result.signals.find((s) => s.signal === "Headcount delta");
    expect(signal?.points).toBe(20);
    expect(signal?.direction).toBe("Ghost");
  });

  it("should score 20 for negative growth", () => {
    const merged = makeMerged({
      linkedin: { headcount: 1000, headcount_delta_pct: -5.0, recent_posts: null, source: "LinkedIn Scraper" },
    });
    const result = computeDeterministicScore(merged);
    const signal = result.signals.find((s) => s.signal === "Headcount delta");
    expect(signal?.points).toBe(20);
  });
});

// ─── Recent News Scoring ──────────────────────────────────────────────────
describe("Recent news scoring", () => {
  it("should score 0 when expansion news found", () => {
    const merged = makeMerged({
      web_unlocker: {
        glassdoor_mentions_freeze: false, glassdoor_mentions_layoffs: false,
        glassdoor_review_snippets: null, recent_news: null,
        has_expansion_news: true, has_funding_news: false, source: "Web Unlocker",
      },
    });
    const result = computeDeterministicScore(merged);
    const signal = result.signals.find((s) => s.signal === "Recent news");
    expect(signal?.points).toBe(0);
    expect(signal?.direction).toBe("Real");
  });

  it("should score 10 when no positive news found", () => {
    const merged = makeMerged({
      web_unlocker: {
        glassdoor_mentions_freeze: false, glassdoor_mentions_layoffs: false,
        glassdoor_review_snippets: null, recent_news: null,
        has_expansion_news: false, has_funding_news: false, source: "Web Unlocker",
      },
    });
    const result = computeDeterministicScore(merged);
    const signal = result.signals.find((s) => s.signal === "Recent news");
    expect(signal?.points).toBe(10);
    expect(signal?.direction).toBe("Ghost");
  });
});

// ─── Glassdoor Scoring ────────────────────────────────────────────────────
describe("Glassdoor scoring", () => {
  it("should score 15 (max) when both freeze and layoffs mentioned", () => {
    const merged = makeMerged({
      web_unlocker: {
        glassdoor_mentions_freeze: true, glassdoor_mentions_layoffs: true,
        glassdoor_review_snippets: null, recent_news: null,
        has_expansion_news: false, has_funding_news: false, source: "Web Unlocker",
      },
    });
    const result = computeDeterministicScore(merged);
    const signal = result.signals.find((s) => s.signal === "Glassdoor signals");
    expect(signal?.points).toBe(15);
  });

  it("should score 10 for freeze only", () => {
    const merged = makeMerged({
      web_unlocker: {
        glassdoor_mentions_freeze: true, glassdoor_mentions_layoffs: false,
        glassdoor_review_snippets: null, recent_news: null,
        has_expansion_news: false, has_funding_news: false, source: "Web Unlocker",
      },
    });
    const result = computeDeterministicScore(merged);
    const signal = result.signals.find((s) => s.signal === "Glassdoor signals");
    expect(signal?.points).toBe(10);
  });

  it("should score 12 for layoffs only", () => {
    const merged = makeMerged({
      web_unlocker: {
        glassdoor_mentions_freeze: false, glassdoor_mentions_layoffs: true,
        glassdoor_review_snippets: null, recent_news: null,
        has_expansion_news: false, has_funding_news: false, source: "Web Unlocker",
      },
    });
    const result = computeDeterministicScore(merged);
    const signal = result.signals.find((s) => s.signal === "Glassdoor signals");
    expect(signal?.points).toBe(12);
  });

  it("should score 0 when no negative Glassdoor signals", () => {
    const merged = makeMerged({
      web_unlocker: {
        glassdoor_mentions_freeze: false, glassdoor_mentions_layoffs: false,
        glassdoor_review_snippets: null, recent_news: null,
        has_expansion_news: true, has_funding_news: false, source: "Web Unlocker",
      },
    });
    const result = computeDeterministicScore(merged);
    const signal = result.signals.find((s) => s.signal === "Glassdoor signals");
    expect(signal?.points).toBe(0);
    expect(signal?.direction).toBe("Real");
  });
});

// ─── Confidence Levels ────────────────────────────────────────────────────
describe("Confidence determination", () => {
  it("should be 'High' with 4 data sources", () => {
    const merged = makeMerged({
      serp: { title: "Test", url: "https://example.com", snippet: "...", source: "SERP API" },
      indeed: { posting_age_days: 5, repost_count: 0, date_posted: null, company_name: null, source: "Indeed Scraper" },
      linkedin: { headcount: 1000, headcount_delta_pct: 8.0, recent_posts: null, source: "LinkedIn Scraper" },
      web_unlocker: {
        glassdoor_mentions_freeze: false, glassdoor_mentions_layoffs: false,
        glassdoor_review_snippets: null, recent_news: null,
        has_expansion_news: true, has_funding_news: false, source: "Web Unlocker",
      },
    });
    const result = computeDeterministicScore(merged);
    expect(result.confidence).toBe("High");
    expect(result.sources_checked).toBe(4);
  });

  it("should be 'Low' with no data sources", () => {
    const merged = makeMerged();
    const result = computeDeterministicScore(merged);
    expect(result.confidence).toBe("Low");
    expect(result.sources_checked).toBe(0);
  });
});

// ─── Score Bounds ─────────────────────────────────────────────────────────
describe("Score bounds", () => {
  it("should never exceed 100", () => {
    const merged = makeMerged({
      indeed: { posting_age_days: 200, repost_count: 10, date_posted: null, company_name: null, source: "Indeed Scraper" },
      linkedin: { headcount: 100, headcount_delta_pct: -20.0, recent_posts: null, source: "LinkedIn Scraper" },
      web_unlocker: {
        glassdoor_mentions_freeze: true, glassdoor_mentions_layoffs: true,
        glassdoor_review_snippets: null, recent_news: null,
        has_expansion_news: false, has_funding_news: false, source: "Web Unlocker",
      },
    });
    const result = computeDeterministicScore(merged);
    expect(result.ghost_score).toBeLessThanOrEqual(100);
    expect(result.hiring_reality_score).toBeGreaterThanOrEqual(0);
  });

  it("hiring_reality_score should equal 100 - ghost_score", () => {
    const merged = makeMerged({
      indeed: { posting_age_days: 45, repost_count: 1, date_posted: null, company_name: null, source: "Indeed Scraper" },
    });
    const result = computeDeterministicScore(merged);
    expect(result.hiring_reality_score).toBe(100 - result.ghost_score);
  });
});
