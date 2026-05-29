/**
 * Indeed Agent — Fetches job posting signals from Indeed via Bright Data Web Unlocker.
 *
 * Uses the Web Unlocker API (NOT Browser API) to fetch Indeed pages as raw HTML,
 * then parses posting age, repost count, and salary from the content.
 *
 * These are high-weight signals in the ghost job scoring system.
 *
 * @module agents/indeed
 */
import { getEnv } from "@/lib/config/env";
import { BRIGHT_DATA_API_URL } from "@/lib/data";
import type { IndeedSignals } from "@/lib/types";

export async function fetchIndeedSignals(query: string, company?: string): Promise<{ data: IndeedSignals | null; error?: string }> {
  const env = getEnv();
  const searchTerms = company ? `${query} ${company}` : query;
  const encodedTerms = encodeURIComponent(searchTerms);
  const indeedUrl = `https://www.indeed.com/jobs?q=${encodedTerms}&sort=date&limit=10`;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.BRIGHT_DATA_API_KEY}`,
  };

  // Use Web Unlocker zone (REST API) — NOT Browser API zone (Puppeteer only)
  const payload = {
    zone: env.BRIGHT_DATA_WEB_UNLOCKER_ZONE,
    url: indeedUrl,
    format: "raw",  // Required by Bright Data docs — returns raw HTML
  };

  try {
    const response = await fetch(BRIGHT_DATA_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      const errMsg = `Indeed: HTTP ${response.status}`;
      console.error(`${errMsg}: ${errorText}`);
      return { data: null, error: errMsg };
    }

    // Web Unlocker returns raw HTML
    const content = await response.text();

    const signals = parseIndeedHtml(content, company);

    if (signals) {
      console.log(`Indeed: posting_age=${signals.posting_age_days}d, reposts=${signals.repost_count}, salary=${signals.salary ?? "N/A"} for: "${searchTerms}"`);
      return { data: signals };
    } else {
      console.warn(`Indeed: no parseable signals for "${searchTerms}"`);
      return { data: null, error: `Indeed: no parseable data for ${searchTerms}` };
    }
  } catch (err) {
    const errMsg = `Indeed: network error: ${String(err).slice(0, 100)}`;
    console.error(errMsg);
    return { data: null, error: errMsg };
  }
}

function parseIndeedHtml(content: string, company?: string): IndeedSignals | null {
  if (!content || content.length < 50) return null;

  const lower = content.toLowerCase();

  let postingAgeDays: number | null = null;

  if (lower.includes("30+ days ago") || lower.includes("30+ days")) {
    postingAgeDays = 31;
  }

  if (postingAgeDays === null) {
    const daysMatch = lower.match(/(\d+)\s+day[s]?\s+ago/);
    if (daysMatch) postingAgeDays = parseInt(daysMatch[1], 10);
  }

  if (postingAgeDays === null) {
    if (lower.includes("today") || lower.includes("just posted") || lower.includes("hours ago")) {
      postingAgeDays = 0;
    }
  }

  let repostCount = 0;
  if (lower.includes("reposted")) {
    repostCount = (lower.match(/reposted/g) || []).length;
  }

  // Extract salary from Indeed HTML
  let salary: string | null = null;
  const salaryPatterns = [
    // Indeed-specific salary selectors often have text like "$80,000 - $120,000 a year"
    /\$[\d,]+(?:\.\d{2})?\s*[-–—to]+\s*\$?[\d,]+(?:\.\d{2})?\s*(?:a\s+(?:year|month)|per\s+(?:year|hour|annum)|\/?(?:yr|year|hr|hour|mo))?/gi,
    /\$[\d,]+(?:\.\d{2})?\s*(?:a\s+(?:year|month)|per\s+(?:year|hour|annum)|\/?(?:yr|year|hr|hour))/gi,
    /\$\d{2,3},?\d{3}/g,
  ];
  for (const pattern of salaryPatterns) {
    const match = content.match(pattern);
    if (match) {
      salary = match[0].trim();
      break;
    }
  }

  return {
    posting_age_days: postingAgeDays,
    repost_count: repostCount,
    date_posted: null,
    company_name: company ?? null,
    salary,
    source: "Indeed Scraper",
  };
}
