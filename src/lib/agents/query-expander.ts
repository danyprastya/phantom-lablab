/**
 * Query Expander — Uses Groq LLM to expand natural language queries into
 * multiple optimised search variations.
 *
 * Instead of sending the user's exact words to Google, we:
 * 1. Ask Groq to extract intent (role, seniority, industry, location)
 * 2. Generate 3 diverse search query variations with synonyms
 * 3. Run all variations through SERP in parallel
 * 4. Deduplicate results by URL
 *
 * Fallback: if Groq is unavailable, uses a deterministic synonym expansion.
 *
 * @module agents/query-expander
 */
import Groq from "groq-sdk";
import { getEnv } from "@/lib/config/env";

export interface ExpandedQueries {
  /** The original user query */
  original: string;
  /** 2-3 search query variations optimised for Google job search */
  variations: string[];
}

const EXPANSION_PROMPT = `You are a job search query optimizer. Given a natural language job search query, generate 2 diverse Google search variations that will find relevant job postings.

RULES:
1. Each variation should use different synonyms and phrasings
2. If the user's query does NOT already contain a job-related word (jobs, hiring, careers, positions, openings), add one. If it already contains such a word, do NOT add it again.
3. Expand abbreviations (e.g., "SWE" → "Software Engineer", "ML" → "Machine Learning")
4. If the query mentions a location, keep it. If not, don't add one.
5. If the query mentions an industry/domain, include related terms
6. Keep each variation under 10 words

Respond ONLY with a JSON array of 2 strings. No markdown, no explanation.

Example input: "frontend dev react startup"
Example output: ["frontend developer react startup jobs", "react engineer hiring startup"]`;

/**
 * Expands a user query into multiple search variations using Groq.
 * Falls back to deterministic expansion if LLM is unavailable.
 */
export async function expandQuery(query: string): Promise<ExpandedQueries> {
  const trimmed = query.trim();

  try {
    const env = getEnv();
    if (!env.GROQ_API_KEY) {
      console.log("Query expander: no GROQ_API_KEY, using deterministic fallback");
      return { original: trimmed, variations: deterministicExpand(trimmed) };
    }

    const groq = new Groq({ apiKey: env.GROQ_API_KEY });
    const result = await groq.chat.completions.create({
      model: env.LLM_MODEL || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: EXPANSION_PROMPT },
        { role: "user", content: `Input: "${trimmed}"` },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const text = result.choices[0]?.message?.content?.trim() || "";

    // Parse JSON array from response (strip markdown fencing if present)
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as string[];

    if (Array.isArray(parsed) && parsed.length >= 1 && parsed.every((s) => typeof s === "string")) {
      const cleaned = stripRedundantJobSuffixes(trimmed, parsed.slice(0, 2));
      console.log(`Query expander: "${trimmed}" → ${cleaned.length} variations`);
      return { original: trimmed, variations: cleaned };
    }

    throw new Error("Invalid LLM response format");
  } catch (err) {
    console.warn(`Query expander LLM failed, using fallback: ${err}`);
    try {
      const fallback = deterministicExpand(trimmed);
      return { original: trimmed, variations: stripRedundantJobSuffixes(trimmed, fallback) };
    } catch {
      // Last resort: return the original query with a simple suffix
      return { original: trimmed, variations: [`${trimmed} jobs`, `${trimmed} hiring`] };
    }
  }
}

// ─── Synonym Map ──────────────────────────────────────────────────────────
const SYNONYMS: Record<string, string[]> = {
  // Roles
  "software engineer": ["software developer", "SWE", "programmer"],
  "software developer": ["software engineer", "developer", "coder"],
  "frontend": ["front-end", "front end", "UI developer"],
  "backend": ["back-end", "back end", "server-side"],
  "fullstack": ["full-stack", "full stack"],
  "full-stack": ["fullstack", "full stack"],
  "devops": ["DevOps", "site reliability", "SRE", "platform engineer"],
  "data scientist": ["data science", "ML engineer", "machine learning"],
  "data engineer": ["data platform", "data infrastructure", "ETL engineer"],
  "product manager": ["PM", "product lead", "product owner"],
  "designer": ["UX designer", "UI designer", "product designer"],
  "qa": ["quality assurance", "test engineer", "SDET"],
  "mobile": ["iOS", "Android", "mobile developer"],
  // Seniority
  "senior": ["sr", "lead", "staff"],
  "junior": ["jr", "entry level", "associate"],
  "lead": ["principal", "staff", "senior"],
  "intern": ["internship", "co-op", "trainee"],
  // Industry
  "fintech": ["financial technology", "payments", "banking tech"],
  "healthtech": ["health tech", "healthcare technology", "medtech"],
  "edtech": ["education technology", "ed-tech", "learning platform"],
  "ai": ["artificial intelligence", "machine learning", "deep learning"],
  "crypto": ["blockchain", "web3", "cryptocurrency"],
  "saas": ["SaaS", "cloud software", "B2B software"],
  "ecommerce": ["e-commerce", "online retail", "marketplace"],
  // Work style
  "remote": ["work from home", "distributed", "WFH"],
  "hybrid": ["hybrid remote", "flexible location"],
  "onsite": ["on-site", "in-office", "in office"],
};

// ─── Job Keyword Detection ────────────────────────────────────────────────
const JOB_KEYWORDS = [
  "job", "jobs", "hiring", "careers", "career",
  "position", "positions", "opening", "openings",
  "vacancy", "vacancies",
];

/**
 * Detects whether a query string already contains job-related keywords.
 * Used to prevent double-suffixing when expanding queries.
 */
function queryContainsJobKeyword(query: string): boolean {
  const lower = query.toLowerCase();
  return JOB_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Strips redundant job keywords from expanded variations when the original
 * query already contains them. Prevents double-suffixed searches that dilute
 * Google search quality.
 *
 * Example: original="hiring software engineer", variation="hiring software engineer jobs"
 *          → cleaned="hiring software engineer"
 */
function stripRedundantJobSuffixes(original: string, variations: string[]): string[] {
  const originalHasJobKeyword = queryContainsJobKeyword(original);
  if (!originalHasJobKeyword) return variations;

  return variations.map((v) => {
    for (const kw of JOB_KEYWORDS) {
      // Only strip suffix-position keywords (at the end), not ones mid-query
      const suffixRegex = new RegExp(`\\s+${kw}\\s*$`, "i");
      const cleaned = v.replace(suffixRegex, "");
      if (cleaned !== v && cleaned.trim().length >= 3) return cleaned.trim();
    }
    return v;
  });
}

/**
 * Deterministic query expansion using a synonym dictionary.
 * Used as fallback when Groq is unavailable.
 */
export function deterministicExpand(query: string): string[] {
  const lower = query.toLowerCase();
  const words = lower.split(/\s+/);
  const variations: string[] = [];
  const hasJobKeyword = queryContainsJobKeyword(query);

  // Variation 1: Original query + job suffix (only if not already present)
  variations.push(hasJobKeyword ? query : `${query} jobs hiring now`);

  // Variation 2: Replace first matching synonym
  let expanded = lower;
  let expandedHasJobKeyword = hasJobKeyword;
  for (const [term, syns] of Object.entries(SYNONYMS)) {
    if (lower.includes(term)) {
      expanded = lower.replace(term, syns[0]);
      expandedHasJobKeyword = queryContainsJobKeyword(expanded);
      break;
    }
  }
  if (expanded !== lower) {
    variations.push(expandedHasJobKeyword ? expanded : `${expanded} jobs`);
  }

  // Variation 3: Try bigram synonym matches, otherwise use word-level expansion
  let secondExpansion = lower;
  let secondHasJobKeyword = hasJobKeyword;
  let found = false;
  // Try 2-word combos first
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (SYNONYMS[bigram]) {
      secondExpansion = lower.replace(bigram, SYNONYMS[bigram][1] || SYNONYMS[bigram][0]);
      secondHasJobKeyword = queryContainsJobKeyword(secondExpansion);
      found = true;
      break;
    }
  }
  // Then single words
  if (!found) {
    for (const word of words) {
      if (SYNONYMS[word] && lower.replace(word, SYNONYMS[word][0]) !== expanded) {
        secondExpansion = lower.replace(word, SYNONYMS[word][0]);
        secondHasJobKeyword = queryContainsJobKeyword(secondExpansion);
        found = true;
        break;
      }
    }
  }
  if (found) {
    variations.push(secondHasJobKeyword ? secondExpansion : `${secondExpansion} careers`);
  }

  // Always ensure at least 1 variation (raw query is already being searched separately)
  if (variations.length < 1) {
    variations.push(hasJobKeyword ? query : `${query} careers openings`);
  }

  return variations.slice(0, 2);
}
