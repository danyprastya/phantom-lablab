/**
 * SERP Agent — Discovers job postings via Bright Data SERP API (Google search).
 *
 * This is Phase 1 of the pipeline: it takes a plain English query, searches
 * Google for job postings, and returns structured results with titles, URLs,
 * and snippets. The results are then enriched by the other 3 agents.
 *
 * @module agents/serp
 */
import { getEnv } from "@/lib/config/env";
import { BRIGHT_DATA_API_URL } from "@/lib/data";
import type { SERPResult } from "@/lib/types";

export async function fetchSerpResults(query: string, maxResults = 10): Promise<SERPResult[]> {
  const env = getEnv();
  // Query is already expanded by the query-expander, don't add extra suffixes
  const encodedQuery = encodeURIComponent(query);
  // brd_json=1 tells Bright Data to return parsed JSON instead of raw HTML
  // gl=us targets US job market, hl=en for English results
  const searchUrl = `https://www.google.com/search?q=${encodedQuery}&brd_json=1&num=${maxResults}&hl=en&gl=us`;

  const payload = {
    zone: env.BRIGHT_DATA_SERP_ZONE,
    url: searchUrl,
    format: "raw",  // Required by Bright Data docs — "raw" returns the target's response
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.BRIGHT_DATA_API_KEY}`,
  };

  try {
    const response = await fetch(BRIGHT_DATA_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      console.error(`SERP API HTTP ${response.status}: ${await response.text().catch(() => "")}`);
      return [];
    }

    const data = (await response.json()) as Record<string, unknown>;

    // Bright Data returns parsed SERP in multiple possible structures:
    // 1. brd_json=1: { results: [{ type: "organic", title, url, description }] }
    // 2. parsed_light: { organic: [{ link, title, description, global_rank }] }
    // 3. full parsed:   { general, input, navigation: [{ title, link, description }] }
    let items: Array<Record<string, unknown>> = [];

    if (Array.isArray(data.organic)) {
      // parsed_light format
      items = data.organic as Array<Record<string, unknown>>;
    } else if (Array.isArray(data.results)) {
      // brd_json=1 format — filter to organic results only
      items = (data.results as Array<Record<string, unknown>>).filter(
        (r) => (r.type as string) === "organic"
      );
    } else if (Array.isArray(data.navigation)) {
      // full parsed format
      items = data.navigation as Array<Record<string, unknown>>;
    }

    if (items.length === 0) {
      console.warn(`SERP API: parsed response has no organic results. Keys: [${Object.keys(data).join(", ")}]`);
      console.warn(`SERP API: first 200 chars of raw response: ${JSON.stringify(data).slice(0, 200)}`);
    }

    const results: SERPResult[] = items.slice(0, maxResults).map((item) => ({
      title: (item.title ?? "") as string,
      url: (item.link ?? item.url ?? "") as string,
      snippet: (item.description ?? item.snippet ?? "") as string,
      source: "SERP API",
    }));

    console.log(`SERP API returned ${results.length} results for: ${query}`);
    return results;
  } catch (err) {
    console.error(`SERP API error: ${err}`);
    return [];
  }
}

/**
 * Runs multiple query variations through SERP in parallel.
 * Returns the combined (non-deduplicated) results from all variations.
 * Deduplication happens in the relevance scorer.
 */
export async function fetchMultiSerpResults(
  queryVariations: string[],
  maxResultsPerQuery = 10
): Promise<SERPResult[]> {
  const results = await Promise.all(
    queryVariations.map((q) => fetchSerpResults(q, maxResultsPerQuery))
  );
  const combined = results.flat();
  console.log(
    `Multi-SERP: ${queryVariations.length} variations → ${combined.length} total results ` +
    `(before dedup)`
  );
  return combined;
}

export async function extractJobInfoFromSerp(results: SERPResult[]): Promise<{
  job_title: string;
  company: string;
  location: string;
  url: string;
  snippet: string;
  salary: string | null;
}[]> {
  return results
    .map((result) => {
      const parsed = parseJobTitle(result.title, result.url);
      const salary = extractSalary(result.snippet + " " + result.title);
      return {
        job_title: parsed.job_title,
        company: parsed.company,
        location: parsed.location,
        url: result.url,
        snippet: result.snippet,
        salary,
      };
    })
    .filter((job) => job.company !== "Unknown");
}

/**
 * Extracts salary information from SERP snippets.
 * Matches patterns like:
 * - $120,000 - $150,000
 * - $80K - $120K
 * - $45/hr - $65/hr
 * - $120,000 a year
 * - £50,000 - £70,000
 */
export function extractSalary(text: string): string | null {
  if (!text) return null;

  const patterns = [
    // Range: $120,000 - $150,000 or $120K-$150K
    /[\$£€]\s?[\d,]+\.?\d*\s?[kK]?\s*[-–—to]+\s*[\$£€]?\s?[\d,]+\.?\d*\s?[kK]?\s*(?:per\s+(?:year|annum|month|hour|hr)|a\s+(?:year|month)|\/?\s?(?:yr|year|mo|month|hr|hour))?/gi,
    // Single: $120,000 a year or $120K/yr
    /[\$£€]\s?[\d,]+\.?\d*\s?[kK]?\s*(?:per\s+(?:year|annum|month|hour|hr)|a\s+(?:year|month)|\/?\s?(?:yr|year|mo|month|hr|hour))/gi,
    // Single number with currency: $120,000 or $120K
    /[\$£€]\s?\d{2,3},?\d{3}(?:\.\d{2})?/g,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }

  return null;
}

/**
 * Parses job title strings from various job board formats:
 * - Indeed:    "Software Engineer - Google - Mountain View, CA"
 * - LinkedIn:  "Software Engineer | Google | Mountain View, CA"
 * - Glassdoor: "Software Engineer Jobs at Google | Glassdoor"
 * - Generic:   "Software Engineer at Google (Remote)"
 *
 * Falls back to extracting company from URL domain if all patterns fail.
 */
/** @internal Exported for testing */
export function parseJobTitle(title: string, url: string): {
  job_title: string;
  company: string;
  location: string;
} {
  // Pattern 1: "Title | Company | Location" (LinkedIn style)
  if (title.includes(" | ")) {
    const parts = title.split(" | ").map((s) => s.trim());
    // Filter out site names like "LinkedIn", "Glassdoor", "Indeed"
    const filtered = parts.filter(
      (p) => !/(linkedin|glassdoor|indeed|ziprecruiter|monster|dice)\b/i.test(p)
    );
    if (filtered.length >= 2) {
      return {
        job_title: filtered[0],
        company: filtered[1],
        location: filtered[2] || "Not specified",
      };
    }
  }

  // Pattern 2: "Title at Company" or "Title @ Company"
  const atMatch = title.match(/^(.+?)\s+(?:at|@)\s+(.+?)(?:\s*[-–|]\s*(.+))?$/i);
  if (atMatch) {
    return {
      job_title: atMatch[1].trim(),
      company: atMatch[2].trim(),
      location: atMatch[3]?.trim() || "Not specified",
    };
  }

  // Pattern 3: "Title - Company - Location" (Indeed style, most common)
  const dashParts = title.split(/\s*[-–—]\s*/);
  if (dashParts.length >= 2) {
    // Filter out site names from the parts
    const filtered = dashParts.filter(
      (p) => !/(linkedin|glassdoor|indeed|ziprecruiter|monster|dice|jobs?$)\b/i.test(p.trim())
    );
    if (filtered.length >= 2) {
      return {
        job_title: filtered[0].trim(),
        company: filtered[1].trim(),
        location: filtered[2]?.trim() || "Not specified",
      };
    }
  }

  // Fallback: try to extract company from URL domain
  const company = extractCompanyFromUrl(url);
  return {
    job_title: title.trim(),
    company,
    location: "Not specified",
  };
}

/** Extracts a company name guess from the URL domain (e.g., "stripe.com" → "Stripe") */
/** @internal Exported for testing */
export function extractCompanyFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Skip job board domains — they're not the company
    const jobBoards = ["indeed.com", "linkedin.com", "glassdoor.com", "ziprecruiter.com", "monster.com", "dice.com", "lever.co", "greenhouse.io", "workday.com"];
    if (jobBoards.some((jb) => hostname.includes(jb))) return "Unknown";
    // Take the main domain part and capitalize it
    const domain = hostname.replace(/^www\./, "").split(".")[0];
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    return "Unknown";
  }
}
