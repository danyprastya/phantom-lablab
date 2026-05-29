/**
 * Relevance Scorer — TF-IDF-based scoring to rank job results by how well
 * they match the user's original search query.
 *
 * When we expand a query into multiple search variations and run them through
 * Google, we get results of varying relevance. This module scores each result
 * to filter out noise and rank the most relevant jobs first.
 *
 * Uses simplified TF-IDF:
 * - TF (Term Frequency) = how often query terms appear in the result text
 * - IDF (Inverse Document Frequency) = rarer terms in the corpus get more weight
 * - Final score = sum of (TF × IDF) for each query term
 *
 * @module scoring/relevance
 */

/** Stopwords to exclude from TF-IDF computation */
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "i", "me", "my", "we", "our", "you", "your", "he", "she", "it",
  "they", "them", "their", "this", "that", "these", "those", "what",
  "which", "who", "whom", "how", "when", "where", "why",
  "and", "but", "or", "nor", "not", "so", "yet", "both", "either",
  "neither", "each", "every", "all", "any", "few", "more", "most",
  "in", "on", "at", "to", "for", "of", "with", "by", "from", "as",
  "into", "through", "during", "before", "after", "above", "below",
  "up", "down", "out", "off", "over", "under", "again", "further",
  "then", "once", "here", "there", "very", "just", "also", "now",
  "jobs", "job", "hiring", "careers", "apply", "openings", "position",
  "positions", "opportunity", "opportunities", "now", "new",
]);

/**
 * Tokenizes and normalizes text: lowercases, removes punctuation,
 * splits on whitespace, and filters out stopwords.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

/**
 * Computes IDF (Inverse Document Frequency) for each unique term
 * across a set of documents.
 *
 * IDF(term) = log(totalDocs / docsContainingTerm)
 * Rarer terms get higher IDF values.
 */
export function computeIDF(documents: string[][]): Map<string, number> {
  const totalDocs = documents.length;
  const docFreq = new Map<string, number>();

  for (const doc of documents) {
    const uniqueTerms = new Set(doc);
    for (const term of uniqueTerms) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, freq] of docFreq) {
    // +1 smoothing to avoid division by zero
    idf.set(term, Math.log((totalDocs + 1) / (freq + 1)) + 1);
  }

  return idf;
}

/**
 * Computes a TF-IDF relevance score for a single document against query terms.
 *
 * @param queryTerms - Tokenized query terms
 * @param docTerms - Tokenized document terms (title + snippet)
 * @param idf - Precomputed IDF values
 * @returns Normalized relevance score between 0 and 1
 */
export function computeRelevanceScore(
  queryTerms: string[],
  docTerms: string[],
  idf: Map<string, number>
): number {
  if (queryTerms.length === 0 || docTerms.length === 0) return 0;

  const docLength = docTerms.length;
  let score = 0;
  let maxPossibleScore = 0;

  for (const qTerm of queryTerms) {
    const termIDF = idf.get(qTerm) ?? 1;
    maxPossibleScore += termIDF;

    // Count occurrences of this query term in the document
    const tf = docTerms.filter((t) => t === qTerm || t.includes(qTerm) || qTerm.includes(t)).length;

    if (tf > 0) {
      // Normalized TF: prevent long documents from dominating
      const normalizedTF = tf / docLength;
      score += normalizedTF * termIDF;
    }
  }

  // Normalize to 0-1 range
  return maxPossibleScore > 0 ? Math.min(score / (maxPossibleScore * 0.1), 1) : 0;
}

export interface ScoredResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  relevanceScore: number;
}

/**
 * Ranks and filters SERP results by relevance to the original query.
 *
 * @param query - The original user query
 * @param results - Raw SERP results (may contain duplicates)
 * @param minRelevance - Minimum relevance threshold (0-1). Default 0.05.
 * @returns Deduplicated, scored, and sorted results
 */
export function rankByRelevance(
  query: string,
  results: { title: string; url: string; snippet: string; source: string }[],
  minRelevance = 0.05
): ScoredResult[] {
  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    const normalized = r.url.replace(/\/$/, "").toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  if (unique.length === 0) return [];

  // Tokenize query and all documents
  const queryTerms = tokenize(query);
  const docTokens = unique.map((r) => tokenize(`${r.title} ${r.snippet}`));

  // Compute IDF across all documents
  const idf = computeIDF(docTokens);

  // Score each result
  const scored: ScoredResult[] = unique.map((r, i) => ({
    ...r,
    relevanceScore: computeRelevanceScore(queryTerms, docTokens[i], idf),
  }));

  // Filter by minimum relevance and sort descending
  return scored
    .filter((r) => r.relevanceScore >= minRelevance)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
