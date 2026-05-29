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
import { parseGoogleSerpHtml } from "@/lib/parsers/serp-html";
import type { SERPResult } from "@/lib/types";

export async function fetchSerpResults(query: string, maxResults = 10): Promise<SERPResult[]> {
  const env = getEnv();
  const searchQuery = `${query} jobs hiring now`;
  const encodedQuery = encodeURIComponent(searchQuery);
  const searchUrl = `https://www.google.com/search?q=${encodedQuery}&num=${maxResults}&hl=en`;

  const payload = {
    zone: env.BRIGHT_DATA_SERP_ZONE,
    url: searchUrl,
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

    const html = await response.text();
    const parsed = parseGoogleSerpHtml(html, maxResults);

    const results: SERPResult[] = parsed.map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.snippet,
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
}[]> {
  return results.map((result) => {
    const parsed = parseJobTitle(result.title, result.url);
    return {
      job_title: parsed.job_title,
      company: parsed.company,
      location: parsed.location,
      url: result.url,
      snippet: result.snippet,
    };
  });
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
