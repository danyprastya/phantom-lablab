import { getEnv } from "@/lib/config/env";
import { BRIGHT_DATA_API_URL } from "@/lib/data";
import type { IndeedSignals } from "@/lib/types";

export async function fetchIndeedSignals(query: string, company?: string): Promise<IndeedSignals | null> {
  const env = getEnv();
  const searchTerms = company ? `${query} ${company}` : query;
  const encodedTerms = encodeURIComponent(searchTerms);
  const indeedUrl = `https://www.indeed.com/jobs?q=${encodedTerms}&sort=date&limit=10`;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.BRIGHT_DATA_API_KEY}`,
  };

  const payload = {
    zone: env.BRIGHT_DATA_WEB_UNLOCKER_ZONE,
    url: indeedUrl,
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
      console.error(`Indeed HTTP ${response.status}`);
      return null;
    }

    let content: string;
    try {
      const data = (await response.json()) as Record<string, unknown>;
      content = (data.content ?? data.text ?? JSON.stringify(data)) as string;
    } catch {
      content = await response.text();
    }

    const signals = parseIndeedMarkdown(content, company);

    if (signals) {
      console.log(`Indeed: posting_age=${signals.posting_age_days}d, reposts=${signals.repost_count} for: "${searchTerms}"`);
    } else {
      console.warn(`Indeed: no parseable signals for "${searchTerms}"`);
    }

    return signals;
  } catch (err) {
    console.error(`Indeed error: ${err}`);
    return null;
  }
}

function parseIndeedMarkdown(content: string, company?: string): IndeedSignals | null {
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

  return {
    posting_age_days: postingAgeDays,
    repost_count: repostCount,
    date_posted: null,
    company_name: company ?? null,
    source: "Indeed Scraper",
  };
}
