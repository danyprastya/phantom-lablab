/**
 * Tests for SERP title parsing and URL company extraction.
 *
 * These parsers handle the first step in the pipeline — converting raw Google
 * search results into structured job data. If parsing fails, the entire
 * downstream pipeline receives garbage.
 */
import { describe, it, expect } from "vitest";
import { parseJobTitle, extractCompanyFromUrl } from "@/lib/agents/serp";

// ─── Indeed-style titles ("Title - Company - Location") ───────────────────
describe("parseJobTitle — Indeed format (dash-separated)", () => {
  it("should parse 'Title - Company - Location'", () => {
    const result = parseJobTitle(
      "Software Engineer - Google - Mountain View, CA",
      "https://indeed.com/viewjob?jk=abc"
    );
    expect(result.job_title).toBe("Software Engineer");
    expect(result.company).toBe("Google");
    expect(result.location).toBe("Mountain View, CA");
  });

  it("should handle 'Title - Company' (no location)", () => {
    const result = parseJobTitle(
      "Data Analyst - Spotify",
      "https://indeed.com/viewjob?jk=xyz"
    );
    expect(result.job_title).toBe("Data Analyst");
    expect(result.company).toBe("Spotify");
    expect(result.location).toBe("Not specified");
  });

  it("should filter out 'Indeed' from parts", () => {
    const result = parseJobTitle(
      "Backend Developer - Stripe - Indeed",
      "https://indeed.com/viewjob"
    );
    expect(result.company).toBe("Stripe");
    expect(result.job_title).toBe("Backend Developer");
  });
});

// ─── LinkedIn-style titles ("Title | Company | Location") ─────────────────
describe("parseJobTitle — LinkedIn format (pipe-separated)", () => {
  it("should parse 'Title | Company | Location'", () => {
    const result = parseJobTitle(
      "Product Manager | Meta | Menlo Park, CA",
      "https://linkedin.com/jobs/view/123"
    );
    expect(result.job_title).toBe("Product Manager");
    expect(result.company).toBe("Meta");
    expect(result.location).toBe("Menlo Park, CA");
  });

  it("should filter out 'LinkedIn' from parts", () => {
    const result = parseJobTitle(
      "DevOps Engineer | Netflix | LinkedIn",
      "https://linkedin.com/jobs/view/456"
    );
    expect(result.job_title).toBe("DevOps Engineer");
    expect(result.company).toBe("Netflix");
  });

  it("should handle 'Title | Company | Location | Glassdoor'", () => {
    const result = parseJobTitle(
      "Senior SWE | Apple | Cupertino | Glassdoor",
      "https://glassdoor.com/job/123"
    );
    expect(result.job_title).toBe("Senior SWE");
    expect(result.company).toBe("Apple");
    expect(result.location).toBe("Cupertino");
  });
});

// ─── "at/@ Company" format ────────────────────────────────────────────────
describe("parseJobTitle — 'at' format", () => {
  it("should parse 'Title at Company'", () => {
    const result = parseJobTitle(
      "Software Engineer at Stripe",
      "https://stripe.com/jobs"
    );
    expect(result.job_title).toBe("Software Engineer");
    expect(result.company).toBe("Stripe");
  });

  it("should parse 'Title at Company - Location'", () => {
    const result = parseJobTitle(
      "Frontend Developer at Vercel - Remote",
      "https://vercel.com/careers"
    );
    expect(result.job_title).toBe("Frontend Developer");
    expect(result.company).toBe("Vercel");
    expect(result.location).toBe("Remote");
  });

  it("should parse 'Title @ Company'", () => {
    const result = parseJobTitle(
      "ML Engineer @ OpenAI",
      "https://openai.com/careers"
    );
    expect(result.job_title).toBe("ML Engineer");
    expect(result.company).toBe("OpenAI");
  });
});

// ─── Fallback to URL extraction ───────────────────────────────────────────
describe("parseJobTitle — fallback", () => {
  it("should extract company from company website URL", () => {
    const result = parseJobTitle(
      "Join our team!",
      "https://www.stripe.com/jobs/123"
    );
    expect(result.job_title).toBe("Join our team!");
    expect(result.company).toBe("Stripe");
  });

  it("should return 'Unknown' for job board URLs", () => {
    const result = parseJobTitle(
      "Apply now",
      "https://www.indeed.com/viewjob?jk=abc"
    );
    expect(result.company).toBe("Unknown");
  });
});

// ─── extractCompanyFromUrl ────────────────────────────────────────────────
describe("extractCompanyFromUrl", () => {
  it("should capitalize domain name from company site", () => {
    expect(extractCompanyFromUrl("https://stripe.com/jobs")).toBe("Stripe");
    expect(extractCompanyFromUrl("https://www.plaid.com/careers")).toBe("Plaid");
  });

  it("should return 'Unknown' for job board domains", () => {
    expect(extractCompanyFromUrl("https://indeed.com/viewjob?jk=abc")).toBe("Unknown");
    expect(extractCompanyFromUrl("https://www.linkedin.com/jobs/view/123")).toBe("Unknown");
    expect(extractCompanyFromUrl("https://glassdoor.com/job/abc")).toBe("Unknown");
    expect(extractCompanyFromUrl("https://lever.co/company/job")).toBe("Unknown");
    expect(extractCompanyFromUrl("https://greenhouse.io/job/123")).toBe("Unknown");
  });

  it("should return 'Unknown' for invalid URLs", () => {
    expect(extractCompanyFromUrl("not-a-url")).toBe("Unknown");
    expect(extractCompanyFromUrl("")).toBe("Unknown");
  });
});
