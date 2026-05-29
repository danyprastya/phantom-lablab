/**
 * Google SERP HTML Parser — Extracts organic search results from raw Google HTML.
 *
 * When BrightData web scraper zones return raw HTML (no structured JSON mode),
 * this parser extracts URLs, titles, and snippets from the response body.
 *
 * @module parsers/serp-html
 */

export interface ParsedSerpResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Parses raw Google search HTML into structured results.
 * Uses regex-based extraction that handles both modern and legacy Google result formats.
 */
export function parseGoogleSerpHtml(html: string, maxResults = 10): ParsedSerpResult[] {
  const results: ParsedSerpResult[] = [];
  const seen = new Set<string>();

  // Strategy 1: Extract Google redirect URLs (/url?q=REAL_URL)
  // These appear in href attributes of search result links
  const redirectRegex = /\/url\?[^"]*q=(https?:\/\/[^"&]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = redirectRegex.exec(html)) !== null) {
    const raw = match[1];
    try {
      const url = decodeURIComponent(raw);
      // Skip Google's own domains and tracking URLs
      if (
        url.includes("google.com") ||
        url.includes("googleadservices") ||
        url.includes("youtube.com") ||
        seen.has(url)
      ) {
        continue;
      }
      seen.add(url);
    } catch {
      continue;
    }
  }

  // Strategy 2: Extract h3 titles + their associated snippet text
  const resultBlockRegex = /<h3[^>]*>(.*?)<\/h3>/gi;
  const titles = extractMatches(html, resultBlockRegex, 1)
    .map((t) => stripHtml(t))
    .filter((t) => t.length > 3 && !t.includes("People also ask") && !t.includes("Images"));

  // Strategy 3: Extract snippet text
  const snippetRegexes = [
    /<span[^>]*class="[^"]*st[^"]*"[^>]*>(.*?)<\/span>/gi,
    /<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>(.*?)<\/div>/gi,
    /<div[^>]*data-sncf="[^"]*"[^>]*>(.*?)<\/div>/gi,
  ];

  let snippets: string[] = [];
  for (const regex of snippetRegexes) {
    snippets = extractMatches(html, regex, 1)
      .map((s) => stripHtml(s))
      .filter((s) => s.length > 10);
    if (snippets.length > 0) break;
  }

  // Fallback: extract all direct http/https links not from Google
  const directRegex = /href="(https?:\/\/(?!google\.com|googleadservices|youtube\.com|accounts\.google)[^"]+)"/gi;
  const directUrls: string[] = [];
  while ((match = directRegex.exec(html)) !== null) {
    const url = match[1].replace(/&amp;/g, "&");
    if (!seen.has(url) && !url.endsWith(".css") && !url.endsWith(".js")) {
      seen.add(url);
      directUrls.push(url);
    }
  }

  // Assemble results: pair titles with URLs where possible
  const urls = Array.from(seen).filter(
    (u) =>
      u.startsWith("http") &&
      !u.includes("google.com") &&
      !u.includes("googleadservices") &&
      !u.includes("youtube.com") &&
      !u.includes("w3.org") &&
      !u.includes("schema.org")
  );

  const count = Math.min(maxResults, Math.max(titles.length, urls.length, snippets.length));

  for (let i = 0; i < count; i++) {
    results.push({
      title: titles[i] || `Result ${i + 1}`,
      url: urls[i] || directUrls[i] || "",
      snippet: snippets[i] || "",
    });
  }

  // If we got URLs but no titles, use URL-based fallback titles
  if (results.length === 0 && urls.length > 0) {
    for (const url of urls.slice(0, maxResults)) {
      results.push({
        title: extractDomainTitle(url),
        url,
        snippet: "",
      });
    }
  }

  return results;
}

/** Extracts text content from HTML, stripping all tags. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extracts all text content from HTML for keyword analysis. */
export function extractTextContent(html: string): string {
  return stripHtml(html).toLowerCase();
}

function extractMatches(html: string, regex: RegExp, group: number): string[] {
  const results: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(regex.source, regex.flags);
  while ((match = re.exec(html)) !== null) {
    const value = match[group];
    if (value) results.push(value);
    if (results.length >= 30) break;
  }
  return results;
}

function extractDomainTitle(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const domain = hostname.replace(/^www\./, "").split(".")[0];
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    return url;
  }
}
