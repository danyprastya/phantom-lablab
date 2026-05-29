/**
 * Tests for the Web Unlocker signal analyser.
 *
 * The analyseSignals function is the keyword matching engine that detects
 * hiring freeze, layoff, expansion, and funding signals from raw text.
 * This is a pure function with no network calls — fully testable.
 */
import { describe, it, expect } from "vitest";
import { analyseSignals } from "@/lib/agents/unlocker";

// ─── Glassdoor Freeze Detection ──────────────────────────────────────────
describe("analyseSignals — Glassdoor freeze detection", () => {
  it("should detect 'hiring freeze' keyword", () => {
    const result = analyseSignals(
      "The company announced a hiring freeze in Q4 last year",
      null
    );
    expect(result.glassdoor_mentions_freeze).toBe(true);
  });

  it("should detect 'paused hiring' keyword", () => {
    const result = analyseSignals("Management has paused hiring for all departments", null);
    expect(result.glassdoor_mentions_freeze).toBe(true);
  });

  it("should be case-insensitive", () => {
    const result = analyseSignals("HIRING FREEZE announced", null);
    expect(result.glassdoor_mentions_freeze).toBe(true);
  });

  it("should not flag freeze when no keywords present", () => {
    const result = analyseSignals("Great company, good benefits, flexible hours", null);
    expect(result.glassdoor_mentions_freeze).toBe(false);
  });
});

// ─── Glassdoor Layoff Detection ──────────────────────────────────────────
describe("analyseSignals — Glassdoor layoff detection", () => {
  it("should detect 'layoff' keyword", () => {
    const result = analyseSignals("Recent layoff affected 200 employees", null);
    expect(result.glassdoor_mentions_layoffs).toBe(true);
  });

  it("should detect 'restructuring' keyword", () => {
    const result = analyseSignals("Going through restructuring this quarter", null);
    expect(result.glassdoor_mentions_layoffs).toBe(true);
  });

  it("should detect 'reduction in force' keyword", () => {
    const result = analyseSignals("The reduction in force was unexpected", null);
    expect(result.glassdoor_mentions_layoffs).toBe(true);
  });

  it("should detect both freeze AND layoffs simultaneously", () => {
    const result = analyseSignals(
      "After the layoffs, management announced a hiring freeze",
      null
    );
    expect(result.glassdoor_mentions_freeze).toBe(true);
    expect(result.glassdoor_mentions_layoffs).toBe(true);
  });
});

// ─── News Expansion Detection ────────────────────────────────────────────
describe("analyseSignals — expansion news detection", () => {
  it("should detect 'expansion' keyword in news", () => {
    const result = analyseSignals(null, "Company announces expansion into new markets");
    expect(result.has_expansion_news).toBe(true);
  });

  it("should detect 'new office' keyword", () => {
    const result = analyseSignals(null, "Opening a new office in London next quarter");
    expect(result.has_expansion_news).toBe(true);
  });

  it("should not flag expansion when no keywords present", () => {
    const result = analyseSignals(null, "Company reports quarterly earnings unchanged");
    expect(result.has_expansion_news).toBe(false);
  });
});

// ─── News Funding Detection ─────────────────────────────────────────────
describe("analyseSignals — funding news detection", () => {
  it("should detect 'funding' keyword", () => {
    const result = analyseSignals(null, "Company closes new funding round");
    expect(result.has_funding_news).toBe(true);
  });

  it("should detect 'series b' keyword", () => {
    const result = analyseSignals(null, "Startup raises Series B at $200M valuation");
    expect(result.has_funding_news).toBe(true);
  });

  it("should detect 'raised' keyword", () => {
    const result = analyseSignals(null, "Company raised $50 million in latest round");
    expect(result.has_funding_news).toBe(true);
  });
});

// ─── Edge Cases ──────────────────────────────────────────────────────────
describe("analyseSignals — edge cases", () => {
  it("should handle null inputs gracefully", () => {
    const result = analyseSignals(null, null);
    expect(result.glassdoor_mentions_freeze).toBe(false);
    expect(result.glassdoor_mentions_layoffs).toBe(false);
    expect(result.has_expansion_news).toBe(false);
    expect(result.has_funding_news).toBe(false);
    expect(result.glassdoor_review_snippets).toBeNull();
    expect(result.recent_news).toBeNull();
  });

  it("should handle empty strings", () => {
    const result = analyseSignals("", "");
    expect(result.glassdoor_mentions_freeze).toBe(false);
    expect(result.has_expansion_news).toBe(false);
  });

  it("should extract snippets when keywords are found", () => {
    const result = analyseSignals(
      "This is some preamble text. The company announced a hiring freeze recently. More text follows.",
      null
    );
    expect(result.glassdoor_review_snippets).not.toBeNull();
    expect(result.glassdoor_review_snippets!.length).toBeGreaterThan(0);
    expect(result.glassdoor_review_snippets![0]).toContain("hiring freeze");
  });

  it("should set source to 'Web Unlocker'", () => {
    const result = analyseSignals(null, null);
    expect(result.source).toBe("Web Unlocker");
  });
});
