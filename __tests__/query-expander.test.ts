/**
 * Tests for the NLP query expander.
 *
 * The query expander is the front door of the search pipeline — it transforms
 * natural language into multiple optimised search queries. The deterministic
 * fallback (synonym expansion) is fully testable without LLM access.
 */
import { describe, it, expect } from "vitest";
import { deterministicExpand } from "@/lib/agents/query-expander";

describe("deterministicExpand", () => {
  it("should always return at least 2 variations", () => {
    const result = deterministicExpand("random search query");
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("should return at most 3 variations", () => {
    const result = deterministicExpand("software engineer remote");
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("should include the original query with 'jobs hiring now' when no job keyword present", () => {
    const result = deterministicExpand("data scientist machine learning");
    expect(result[0]).toBe("data scientist machine learning jobs hiring now");
  });

  it("should NOT append job suffix when query already contains 'jobs'", () => {
    const result = deterministicExpand("software engineer jobs fintech");
    // No variation should contain double "jobs" or redundant suffix
    const doubleSuffix = result.some((v) => v.includes("jobs jobs") || v.includes("jobs hiring now"));
    expect(doubleSuffix).toBe(false);
    // At least one variation should contain the original phrasing
    const hasOriginal = result.some((v) => v.includes("software engineer jobs fintech"));
    expect(hasOriginal).toBe(true);
  });

  it("should NOT append job suffix when query already contains 'hiring'", () => {
    const result = deterministicExpand("hiring software engineer remote");
    // No variation should contain "hiring ... hiring" or "hiring ... jobs hiring now"
    const doubleSuffix = result.some(
      (v) => {
        const lower = v.toLowerCase();
        const hiringCount = lower.split("hiring").length - 1;
        return hiringCount > 1;
      }
    );
    expect(doubleSuffix).toBe(false);
  });

  it("should still append job keywords for queries without them", () => {
    const result = deterministicExpand("frontend developer react");
    // At least one variation should contain "jobs", "hiring", or "careers"
    const hasJobKeyword = result.some((v) =>
      /jobs|hiring|careers/.test(v.toLowerCase())
    );
    expect(hasJobKeyword).toBe(true);
  });

  it("should expand 'software engineer' synonym", () => {
    const result = deterministicExpand("software engineer remote");
    const hasExpansion = result.some(
      (v) => v.includes("software developer") || v.includes("SWE") || v.includes("programmer")
    );
    expect(hasExpansion).toBe(true);
  });

  it("should expand 'frontend' synonym", () => {
    const result = deterministicExpand("frontend developer react");
    const hasExpansion = result.some(
      (v) => v.includes("front-end") || v.includes("front end") || v.includes("UI developer")
    );
    expect(hasExpansion).toBe(true);
  });

  it("should expand 'remote' synonym", () => {
    const result = deterministicExpand("developer remote");
    const hasExpansion = result.some(
      (v) => v.includes("work from home") || v.includes("distributed") || v.includes("WFH")
    );
    expect(hasExpansion).toBe(true);
  });

  it("should expand industry terms like 'fintech'", () => {
    const result = deterministicExpand("engineer fintech");
    const hasExpansion = result.some(
      (v) => v.includes("financial technology") || v.includes("payments") || v.includes("banking tech")
    );
    expect(hasExpansion).toBe(true);
  });

  it("should expand 'devops' synonym", () => {
    const result = deterministicExpand("devops engineer cloud");
    const hasExpansion = result.some(
      (v) => v.includes("DevOps") || v.includes("site reliability") || v.includes("SRE") || v.includes("platform engineer")
    );
    expect(hasExpansion).toBe(true);
  });

  it("should handle queries with no known synonyms", () => {
    const result = deterministicExpand("obscure niche job title xyz");
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toContain("obscure niche job title xyz");
  });

  it("should handle single-word queries", () => {
    const result = deterministicExpand("designer");
    expect(result.length).toBeGreaterThanOrEqual(2);
    const hasExpansion = result.some(
      (v) => v.includes("UX designer") || v.includes("UI designer") || v.includes("product designer")
    );
    expect(hasExpansion).toBe(true);
  });
});
