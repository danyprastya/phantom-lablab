/**
 * Web Unlocker Agent — Fetches Glassdoor review signals and company news.
 *
 * Uses Bright Data SERP API to search Google for:
 * - Glassdoor reviews mentioning hiring freezes or layoffs
 * - Recent news about company expansion or funding
 *
 * These signals have Medium and Low weight in the ghost job scoring system.
 *
 * @module agents/unlocker
 */
import { getEnv } from "@/lib/config/env";
import {
  BRIGHT_DATA_API_URL,
  FREEZE_KEYWORDS,
  LAYOFF_KEYWORDS,
  EXPANSION_KEYWORDS,
  FUNDING_KEYWORDS,
} from "@/lib/data";
import type { WebUnlockerSignals } from "@/lib/types";

export async function fetchUnlockerSignals(query: string, company?: string): Promise<{ data: WebUnlockerSignals | null; error?: string }> {
  const env = getEnv();
  const searchTarget = company || query;
  const apiKey = env.BRIGHT_DATA_API_KEY;
  const zone = env.BRIGHT_DATA_SERP_ZONE;

  try {
    const [glassdoorContent, newsContent] = await Promise.all([
      fetchGlassdoorViaGoogle(searchTarget, apiKey, zone),
      fetchNewsViaGoogle(searchTarget, apiKey, zone),
    ]);

    const signals = analyseSignals(glassdoorContent, newsContent);

    console.log(
      `Web Unlocker: freeze=${signals.glassdoor_mentions_freeze}, layoffs=${signals.glassdoor_mentions_layoffs}, ` +
      `expansion=${signals.has_expansion_news}, funding=${signals.has_funding_news} for: "${searchTarget}"`
    );

    const error = glassdoorContent === null && newsContent === null
      ? "Unlocker: both Glassdoor and News searches returned no data"
      : undefined;

    return { data: signals, error };
  } catch (err) {
    const errMsg = `Unlocker: ${String(err).slice(0, 100)}`;
    console.error(errMsg);
    return {
      data: {
        glassdoor_mentions_freeze: false,
        glassdoor_mentions_layoffs: false,
        glassdoor_review_snippets: null,
        recent_news: null,
        has_expansion_news: false,
        has_funding_news: false,
        source: "Web Unlocker",
      },
      error: errMsg,
    };
  }
}

async function fetchGlassdoorViaGoogle(company: string, apiKey: string, zone: string): Promise<string | null> {
  const encodedQuery = encodeURIComponent(`${company} site:glassdoor.com reviews`);
  // brd_json=1 required for parsed JSON output from SERP API
  const searchUrl = `https://www.google.com/search?q=${encodedQuery}&brd_json=1&hl=en&gl=us`;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const payload = { zone, url: searchUrl, format: "raw" };

  try {
    const response = await fetch(BRIGHT_DATA_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      console.warn(`Glassdoor SERP HTTP ${response.status} for "${company}"`);
      return null;
    }

    const text = await response.text();
    let data: Record<string, unknown>;

    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Response may be raw HTML instead of JSON — use text directly for keyword analysis
      if (text && text.length > 50) {
        console.log(`Glassdoor SERP: got HTML (${text.length} chars) for "${company}", using as raw text`);
        return text;
      }
      console.warn(`Glassdoor SERP: empty/truncated response for "${company}" (${text.length} chars)`);
      return null;
    }

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
      console.warn(`[unlocker.ts] Glassdoor SERP: unexpected response shape. Keys: [${Object.keys(data).join(", ")}]`);
      console.warn(`[unlocker.ts] Glassdoor SERP: first 200 chars: ${JSON.stringify(data).slice(0, 200)}`);
    }
    return organic.slice(0, 5).map((item) => String(item.description ?? item.snippet ?? item.title ?? "")).join(" ");
  } catch (err) {
    console.warn(`Glassdoor Google search failed for "${company}": ${err}`);
    return null;
  }
}

async function fetchNewsViaGoogle(company: string, apiKey: string, zone: string): Promise<string | null> {
  // Dynamically compute year range so news results stay current
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const encodedQuery = encodeURIComponent(`${company} hiring expansion funding ${previousYear} ${currentYear}`);
  // brd_json=1 required for parsed JSON output; tbm=nws for Google News
  const searchUrl = `https://www.google.com/search?q=${encodedQuery}&brd_json=1&tbm=nws&hl=en&gl=us`;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const payload = { zone, url: searchUrl, format: "raw" };

  try {
    const response = await fetch(BRIGHT_DATA_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      console.warn(`News SERP HTTP ${response.status} for "${company}"`);
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;
    // Handle multiple Bright Data response shapes:
    // - parsed_light: { organic: [...] }
    // - brd_json=1:   { results: [...], general, input, navigation }
    // - tbm=nws full: { general, input, navigation: [...] }
    let items: Array<Record<string, unknown>> = [];
    if (Array.isArray(data.organic)) {
      items = data.organic as Array<Record<string, unknown>>;
    } else if (Array.isArray(data.news)) {
      items = data.news as Array<Record<string, unknown>>;
    } else if (Array.isArray(data.navigation)) {
      items = data.navigation as Array<Record<string, unknown>>;
    } else if (Array.isArray(data.results)) {
      // brd_json=1 format — filter to organic results only
      items = (data.results as Array<Record<string, unknown>>).filter(
        (r) => (r.type as string) === "organic"
      );
    } else {
      console.warn(`[unlocker.ts] News SERP: unexpected response shape. Keys: [${Object.keys(data).join(", ")}]`);
      console.warn(`[unlocker.ts] News SERP: first 200 chars: ${JSON.stringify(data).slice(0, 200)}`);
    }
    return items.slice(0, 5).map((item) => String(item.description ?? item.snippet ?? item.title ?? "")).join(" ");
  } catch (err) {
    console.warn(`News Google search failed for "${company}": ${err}`);
    return null;
  }
}

/** @internal Exported for testing */
export function analyseSignals(
  glassdoorContent: string | null,
  newsContent: string | null
): WebUnlockerSignals {
  let mentionsFreeze = false;
  let mentionsLayoffs = false;
  const reviewSnippets: string[] = [];
  let hasExpansionNews = false;
  let hasFundingNews = false;
  const newsSnippets: string[] = [];

  if (glassdoorContent) {
    const lower = glassdoorContent.toLowerCase();
    for (const kw of FREEZE_KEYWORDS) {
      if (lower.includes(kw)) {
        mentionsFreeze = true;
        const idx = lower.indexOf(kw);
        reviewSnippets.push(glassdoorContent.slice(Math.max(0, idx - 80), idx + 100).trim());
        break;
      }
    }
    for (const kw of LAYOFF_KEYWORDS) {
      if (lower.includes(kw)) {
        mentionsLayoffs = true;
        const idx = lower.indexOf(kw);
        reviewSnippets.push(glassdoorContent.slice(Math.max(0, idx - 80), idx + 100).trim());
        break;
      }
    }
  }

  if (newsContent) {
    const lower = newsContent.toLowerCase();
    for (const kw of EXPANSION_KEYWORDS) {
      if (lower.includes(kw)) {
        hasExpansionNews = true;
        const idx = lower.indexOf(kw);
        newsSnippets.push(newsContent.slice(Math.max(0, idx - 80), idx + 100).trim());
        break;
      }
    }
    for (const kw of FUNDING_KEYWORDS) {
      if (lower.includes(kw)) {
        hasFundingNews = true;
        const idx = lower.indexOf(kw);
        newsSnippets.push(newsContent.slice(Math.max(0, idx - 80), idx + 100).trim());
        break;
      }
    }
  }

  return {
    glassdoor_mentions_freeze: mentionsFreeze,
    glassdoor_mentions_layoffs: mentionsLayoffs,
    glassdoor_review_snippets: reviewSnippets.length > 0 ? reviewSnippets : null,
    recent_news: newsSnippets.length > 0 ? newsSnippets : null,
    has_expansion_news: hasExpansionNews,
    has_funding_news: hasFundingNews,
    source: "Web Unlocker",
  };
}
