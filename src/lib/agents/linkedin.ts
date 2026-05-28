import { getEnv } from "@/lib/config/env";
import { BRIGHT_DATA_API_URL } from "@/lib/data";
import type { LinkedInSignals } from "@/lib/types";

export async function fetchLinkedInSignals(query: string, company?: string): Promise<LinkedInSignals> {
  const env = getEnv();
  const searchTarget = company || query;
  const linkedinUrl = `https://www.linkedin.com/company/${slugify(searchTarget)}/about/`;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.BRIGHT_DATA_API_KEY}`,
  };

  const payload = {
    zone: env.BRIGHT_DATA_WEB_UNLOCKER_ZONE,
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

    return signals;
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
