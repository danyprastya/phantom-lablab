/**
 * Tests for the TF-IDF relevance scorer.
 *
 * The relevance scorer ensures that when multiple SERP queries return
 * overlapping results, we deduplicate them and rank by how well they
 * match the user's original intent — not just the expanded variation.
 */
import { describe, it, expect } from "vitest";
import {
  tokenize,
  computeIDF,
  computeRelevanceScore,
  rankByRelevance,
} from "@/lib/scoring/relevance";

// ─── Tokenizer ────────────────────────────────────────────────────────────
describe("tokenize", () => {
  it("should lowercase and split on whitespace", () => {
    const tokens = tokenize("Software Engineer");
    expect(tokens).toContain("software");
    expect(tokens).toContain("engineer");
  });

  it("should remove stopwords", () => {
    const tokens = tokenize("the best job in the world");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("in");
    expect(tokens).toContain("best");
    expect(tokens).toContain("world");
  });

  it("should remove job-search noise words", () => {
    const tokens = tokenize("software engineer jobs hiring now");
    expect(tokens).not.toContain("jobs");
    expect(tokens).not.toContain("hiring");
    expect(tokens).not.toContain("now");
    expect(tokens).toContain("software");
  });

  it("should filter out single-character tokens", () => {
    const tokens = tokenize("a b c developer");
    expect(tokens).toEqual(["developer"]);
  });

  it("should handle empty input", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("should handle punctuation", () => {
    const tokens = tokenize("full-stack, developer.");
    expect(tokens).toContain("full-stack");
    expect(tokens).toContain("developer");
  });
});

// ─── IDF Computation ──────────────────────────────────────────────────────
describe("computeIDF", () => {
  it("should give higher IDF to rare terms", () => {
    const docs = [
      ["software", "engineer", "remote"],
      ["software", "developer", "python"],
      ["data", "analyst", "sql"],
    ];
    const idf = computeIDF(docs);
    // "software" appears in 2/3 docs, "data" in 1/3
    // "data" should have higher IDF
    expect(idf.get("data")!).toBeGreaterThan(idf.get("software")!);
  });

  it("should handle single-document corpus", () => {
    const idf = computeIDF([["software", "engineer"]]);
    expect(idf.get("software")).toBeDefined();
    expect(idf.get("software")!).toBeGreaterThan(0);
  });

  it("should handle empty corpus", () => {
    const idf = computeIDF([]);
    expect(idf.size).toBe(0);
  });
});

// ─── Relevance Scoring ───────────────────────────────────────────────────
describe("computeRelevanceScore", () => {
  it("should score higher for documents containing query terms", () => {
    const idf = computeIDF([
      ["software", "engineer", "remote"],
      ["plumber", "local"],
    ]);
    const scoreMatch = computeRelevanceScore(
      ["software", "engineer"],
      ["software", "engineer", "remote"],
      idf
    );
    const scoreNoMatch = computeRelevanceScore(
      ["software", "engineer"],
      ["plumber", "local"],
      idf
    );
    expect(scoreMatch).toBeGreaterThan(scoreNoMatch);
  });

  it("should return 0 for empty inputs", () => {
    const idf = new Map<string, number>();
    expect(computeRelevanceScore([], ["test"], idf)).toBe(0);
    expect(computeRelevanceScore(["test"], [], idf)).toBe(0);
  });

  it("should score between 0 and 1", () => {
    const idf = computeIDF([["software", "engineer"]]);
    const score = computeRelevanceScore(
      ["software", "engineer"],
      ["software", "engineer"],
      idf
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ─── rankByRelevance (full pipeline) ──────────────────────────────────────
describe("rankByRelevance", () => {
  const results = [
    { title: "Senior Software Engineer at Stripe", url: "https://stripe.com/jobs/1", snippet: "Build payments infrastructure with modern tech stack", source: "SERP API" },
    { title: "Plumber needed urgently", url: "https://plumbing.com/1", snippet: "We need a plumber for residential work in downtown", source: "SERP API" },
    { title: "Software Developer - Remote", url: "https://company.com/jobs/2", snippet: "Software developer role working with distributed systems", source: "SERP API" },
  ];

  it("should rank matching results higher", () => {
    const ranked = rankByRelevance("software engineer remote", results);
    // Software-related jobs should rank above plumber
    expect(ranked.length).toBeGreaterThanOrEqual(1);
    expect(ranked[0].title).toContain("Software");
  });

  it("should deduplicate by URL", () => {
    const duped = [
      ...results,
      { title: "Senior Software Engineer at Stripe", url: "https://stripe.com/jobs/1", snippet: "Duplicate", source: "SERP API" },
    ];
    const ranked = rankByRelevance("software engineer", duped);
    const stripeCount = ranked.filter((r) => r.url === "https://stripe.com/jobs/1").length;
    expect(stripeCount).toBe(1);
  });

  it("should deduplicate URLs case-insensitively", () => {
    const duped = [
      { title: "Job A", url: "https://Example.com/Job/1", snippet: "software engineer role", source: "SERP API" },
      { title: "Job B", url: "https://example.com/job/1", snippet: "software developer role", source: "SERP API" },
    ];
    const ranked = rankByRelevance("software engineer", duped);
    expect(ranked.length).toBe(1);
  });

  it("should handle empty results", () => {
    const ranked = rankByRelevance("software engineer", []);
    expect(ranked).toEqual([]);
  });

  it("should return results sorted by relevance (descending)", () => {
    const ranked = rankByRelevance("software engineer remote", results);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].relevanceScore).toBeGreaterThanOrEqual(ranked[i].relevanceScore);
    }
  });

  it("should filter out irrelevant results below threshold", () => {
    const ranked = rankByRelevance("software engineer remote", results, 0.3);
    // With a high threshold, irrelevant results (plumber) should be filtered
    const hasPlumber = ranked.some((r) => r.title.includes("Plumber"));
    expect(hasPlumber).toBe(false);
  });
});
