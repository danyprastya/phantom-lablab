/**
 * LinkedIn Agent — Fetches company headcount and growth signals via Bright Data.
 *
 * Step 1: Uses SERP API to find the LinkedIn company page URL (Google search)
 * Step 2: Uses Web Unlocker API to fetch the LinkedIn page as raw HTML
 *
 * Extracts:
 * - headcount: Current employee count
 * - headcount_delta_pct: Growth trajectory (positive = growing, negative = shrinking)
 *
 * @module agents/linkedin
 */
import { getEnv } from "@/lib/config/env";
import { BRIGHT_DATA_API_URL } from "@/lib/data";
import type { LinkedInSignals } from "@/lib/types";

export async function fetchLinkedInSignals(query: string, company?: string): Promise<{ data: LinkedInSignals; error?: string }> {
  const env = getEnv();
  const searchTarget = company || query;

  // Step 1: Find LinkedIn company URL via Google SERP API
  const linkedinUrl = await resolveLinkedInUrl(searchTarget, env.BRIGHT_DATA_API_KEY, env.BRIGHT_DATA_SERP_ZONE)
    ?? `https://www.linkedin.com/company/${slugify(searchTarget)}/about/`;

  // Step 2: Fetch the actual LinkedIn page via Web Unlocker (handles anti-bot)
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.BRIGHT_DATA_API_KEY}`,
  };

  // Use Web Unlocker zone (REST API) — NOT Browser API zone
  const payload = {
    zone: env.BRIGHT_DATA_WEB_UNLOCKER_ZONE,
    url: linkedinUrl,
    format: "raw",  // Required by Bright Data docs — returns raw HTML
  };

  try {
    const response = await fetch(BRIGHT_DATA_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errMsg = `LinkedIn: HTTP ${response.status}`;
      console.error(errMsg);
      return {
        data: {
          headcount: null,
          headcount_delta_pct: null,
          recent_posts: null,
          source: "LinkedIn Scraper",
        },
        error: errMsg,
      };
    }

    // Web Unlocker returns raw HTML
    const content = await response.text();

    const signals = parseLinkedInHtml(content, searchTarget);

    if (signals) {
      console.log(`LinkedIn: headcount=${signals.headcount}, delta=${signals.headcount_delta_pct}% for: "${searchTarget}"`);
      return { data: signals };
    } else {
      console.warn(`LinkedIn: no parseable signals for "${searchTarget}"`);
      return {
        data: {
          headcount: null,
          headcount_delta_pct: null,
          recent_posts: null,
          source: "LinkedIn Scraper",
        },
        error: `LinkedIn: no parseable data for ${searchTarget}`,
      };
    }
  } catch (err) {
    const errMsg = `LinkedIn: network error: ${String(err).slice(0, 100)}`;
    console.error(errMsg);
    return {
      data: {
        headcount: null,
        headcount_delta_pct: null,
        recent_posts: null,
        source: "LinkedIn Scraper",
      },
      error: errMsg,
    };
  }
}

/**
 * Resolves the actual LinkedIn company URL by searching Google via SERP API.
 * Returns the first linkedin.com/company/ URL found, or null.
 */
async function resolveLinkedInUrl(company: string, apiKey: string, zone: string): Promise<string | null> {
  const encodedQuery = encodeURIComponent(`${company} site:linkedin.com/company`);
  // brd_json=1 required for parsed JSON output from SERP API
  const searchUrl = `https://www.google.com/search?q=${encodedQuery}&brd_json=1&hl=en&num=3`;

  try {
    const response = await fetch(BRIGHT_DATA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ zone, url: searchUrl, format: "raw" }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;

    // Handle brd_json=1 (results[]), parsed_light (organic[]), and full parsed (navigation[])
    let organic: Array<Record<string, unknown>> = [];
    if (Array.isArray(data.organic)) {
      organic = data.organic as Array<Record<string, unknown>>;
    } else if (Array.isArray(data.results)) {
      organic = (data.results as Array<Record<string, unknown>>).filter(
        (r) => (r.type as string) === "organic"
      );
    } else if (Array.isArray(data.navigation)) {
      organic = data.navigation as Array<Record<string, unknown>>;
    } else {
      console.warn(`[linkedin.ts] SERP (resolveLinkedInUrl): unexpected response shape. Keys: [${Object.keys(data).join(", ")}]`);
      console.warn(`[linkedin.ts] SERP (resolveLinkedInUrl): first 200 chars: ${JSON.stringify(data).slice(0, 200)}`);
    }

    for (const item of organic) {
      const url = (item.link ?? item.url ?? "") as string;
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

function parseLinkedInHtml(content: string, company: string): LinkedInSignals | null {
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
