import { getEnv } from "@/lib/config/env";
import { BRIGHT_DATA_API_URL } from "@/lib/data";
import type { SERPResult } from "@/lib/types";

export async function fetchSerpResults(query: string, maxResults = 10): Promise<SERPResult[]> {
  const env = getEnv();
  const searchQuery = `${query} jobs hiring now`;
  const encodedQuery = encodeURIComponent(searchQuery);
  const searchUrl = `https://www.google.com/search?q=${encodedQuery}&num=${maxResults}&hl=en`;

  const payload = {
    zone: env.BRIGHT_DATA_SERP_ZONE,
    url: searchUrl,
    format: "json",
    brd_json: true,
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
    const results: SERPResult[] = [];
    const organic = (data.organic ?? data.results ?? []) as Array<Record<string, unknown>>;

    for (const item of organic.slice(0, maxResults)) {
      const url = (item.link ?? item.url ?? "") as string;
      if (!url) continue;
      results.push({
        title: (item.title ?? "") as string,
        url,
        snippet: (item.description ?? item.snippet ?? "") as string,
        source: "SERP API",
      });
    }

    console.log(`SERP API returned ${results.length} results for: ${query}`);
    return results;
  } catch (err) {
    console.error(`SERP API error: ${err}`);
    return [];
  }
}

export async function extractJobInfoFromSerp(results: SERPResult[]): Promise<{
  job_title: string;
  company: string;
  location: string;
  url: string;
  snippet: string;
}[]> {
  return results.map((result) => {
    const titleParts = result.title.split(" - ");
    return {
      job_title: titleParts[0]?.trim() || result.title,
      company: titleParts[1]?.trim() || "Unknown",
      location: titleParts[2]?.trim() || "Not specified",
      url: result.url,
      snippet: result.snippet,
    };
  });
}
