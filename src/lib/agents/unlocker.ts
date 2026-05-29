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

export async function fetchUnlockerSignals(query: string, company?: string): Promise<WebUnlockerSignals | null> {
  const env = getEnv();
  const searchTarget = company || query;
  const apiKey = env.BRIGHT_DATA_API_KEY;
  const zone = env.BRIGHT_DATA_SERP_ZONE;

  const [glassdoorContent, newsContent] = await Promise.all([
    fetchGlassdoorViaGoogle(searchTarget, apiKey, zone),
    fetchNewsViaGoogle(searchTarget, apiKey, zone),
  ]);

  const signals = analyseSignals(glassdoorContent, newsContent);

  console.log(
    `Web Unlocker: freeze=${signals.glassdoor_mentions_freeze}, layoffs=${signals.glassdoor_mentions_layoffs}, ` +
    `expansion=${signals.has_expansion_news}, funding=${signals.has_funding_news} for: "${searchTarget}"`
  );

  return signals;
}

async function fetchGlassdoorViaGoogle(company: string, apiKey: string, zone: string): Promise<string | null> {
  const encodedQuery = encodeURIComponent(`${company} site:glassdoor.com reviews`);
  const searchUrl = `https://www.google.com/search?q=${encodedQuery}&hl=en`;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const payload = { zone, url: searchUrl, format: "json", brd_json: true };

  try {
    const response = await fetch(BRIGHT_DATA_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;
    const organic = (data.organic ?? []) as Array<Record<string, unknown>>;
    return organic.slice(0, 5).map((item) => (item.description ?? item.snippet ?? "") as string).join(" ");
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
  const searchUrl = `https://www.google.com/search?q=${encodedQuery}&tbm=nws&hl=en`;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const payload = { zone, url: searchUrl, format: "json", brd_json: true };

  try {
    const response = await fetch(BRIGHT_DATA_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;
    const organic = (data.organic ?? data.news ?? []) as Array<Record<string, unknown>>;
    return organic.slice(0, 5).map((item) => (item.description ?? item.snippet ?? "") as string).join(" ");
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
