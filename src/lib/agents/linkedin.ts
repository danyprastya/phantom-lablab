/**
 * LinkedIn Agent — Fetches company headcount and growth signals via Bright Data Web Scraper.
 *
 * Extracts:
 * - headcount: Current employee count
 * - headcount_delta_pct: Growth trajectory (positive = growing, negative = shrinking)
 *
 * Uses keyword heuristics to estimate growth direction from LinkedIn company page content.
 *
 * @module agents/linkedin
 */
import { getEnv } from "@/lib/config/env";
import { BRIGHT_DATA_API_URL } from "@/lib/data";
import { parseGoogleSerpHtml } from "@/lib/parsers/serp-html";
import type { LinkedInSignals } from "@/lib/types";

export async function fetchLinkedInSignals(query: string, company?: string): Promise<LinkedInSignals> {
  const env = getEnv();
  const searchTarget = company || query;

  // Step 1: Try to find the actual LinkedIn company URL via Google search.
  // This is far more reliable than guessing the slug from the company name.
  const linkedinUrl = await resolveLinkedInUrl(searchTarget, env.BRIGHT_DATA_API_KEY, env.BRIGHT_DATA_SERP_ZONE)
    ?? `https://www.linkedin.com/company/${slugify(searchTarget)}/about/`;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.BRIGHT_DATA_API_KEY}`,
  };

  const payload = {
    zone: env.BRIGHT_DATA_WEB_SCRAPER_ZONE,
    url: linkedinUrl,
    format: "json",
    data_format: "markdown",
  };

  try {
    const response = await fetch(BRIGHT_DATA_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      console.error(`LinkedIn HTTP ${response.status}`);
      return {
        headcount: null,
        headcount_delta_pct: null,
        recent_posts: null,
        source: "LinkedIn Scraper",
      };
    }

    let content: string;
    try {
      const data = (await response.json()) as Record<string, unknown>;
      content = (data.content ?? data.text ?? JSON.stringify(data)) as string;
    } catch {
      content = await response.text();
    }

    const signals = parseLinkedInMarkdown(content, searchTarget);

    if (signals) {
      console.log(`LinkedIn: headcount=${signals.headcount}, delta=${signals.headcount_delta_pct}% for: "${searchTarget}"`);
    } else {
      console.warn(`LinkedIn: no parseable signals for "${searchTarget}"`);
    }

    return signals ?? {
      headcount: null,
      headcount_delta_pct: null,
      recent_posts: null,
      source: "LinkedIn Scraper",
    };
  } catch (err) {
    console.error(`LinkedIn error: ${err}`);
    return {
      headcount: null,
      headcount_delta_pct: null,
      recent_posts: null,
      source: "LinkedIn Scraper",
    };
  }
}

/**
 * Resolves the actual LinkedIn company URL by searching Google.
 * Returns the first linkedin.com/company/ URL found, or null.
 */
async function resolveLinkedInUrl(company: string, apiKey: string, zone: string): Promise<string | null> {
  const encodedQuery = encodeURIComponent(`${company} site:linkedin.com/company`);
  const searchUrl = `https://www.google.com/search?q=${encodedQuery}&hl=en&num=3`;

  try {
    const response = await fetch(BRIGHT_DATA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ zone, url: searchUrl }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    const parsed = parseGoogleSerpHtml(html, 5);

    for (const item of parsed) {
      const url = item.url;
      if (/linkedin\.com\/company\/[a-z0-9-]+/i.test(url)) {
        const match = url.match(/(https?:\/\/[^/]*linkedin\.com\/company\/[a-z0-9-]+)/i);
        if (match) {
          const resolved = `${match[1]}/about/`;
          console.log(`LinkedIn: resolved "${company}" → ${resolved}`);
          return resolved;
        }
      }
    }
  } catch (err) {
    console.warn(`LinkedIn URL resolution failed for "${company}": ${err}`);
  }

  return null;
}

function parseLinkedInMarkdown(content: string, company: string): LinkedInSignals | null {
  if (!content || content.length < 50) return null;

  const lower = content.toLowerCase();
  let headcount: number | null = null;

  const patterns = [
    /([\d,]+)\s+employee/,
    /([\d,]+)\+?\s+employee/,
    /(\d+)\s*-\s*(\d+)\s+employee/,
  ];

  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) {
      if (match[2] !== undefined) {
        const low = parseInt(match[1].replace(/,/g, ""), 10);
        const high = parseInt(match[2].replace(/,/g, ""), 10);
        headcount = Math.floor((low + high) / 2);
      } else {
        headcount = parseInt(match[1].replace(/,/g, ""), 10);
      }
      break;
    }
  }

  let headcountDeltaPct: number | null = null;

  if (headcount != null) {
    if (["actively hiring", "growing fast", "rapid growth", "we're growing"].some((kw) => lower.includes(kw))) {
      headcountDeltaPct = 8.0;
    } else if (["layoff", "downsizing", "restructuring", "freeze"].some((kw) => lower.includes(kw))) {
      headcountDeltaPct = -5.0;
    } else {
      headcountDeltaPct = null;
    }
  }

  if (headcount === null) return null;

  return {
    headcount,
    headcount_delta_pct: headcountDeltaPct,
    recent_posts: null,
    source: "LinkedIn Scraper",
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/&+/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
