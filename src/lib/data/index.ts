/**
 * Data Constants — Scoring weights, thresholds, keyword lists, and LLM prompts.
 *
 * All deterministic scoring parameters are defined here so they can be tuned
 * in one place without touching the scoring logic. The LLM synthesis prompt
 * is also centralised here to keep prompt engineering separate from code.
 *
 * @module data/index
 */
export const POSTING_AGE_MAX_POINTS = 30;
export const REPOST_COUNT_MAX_POINTS = 25;
export const HEADCOUNT_DELTA_MAX_POINTS = 20;
export const RECENT_NEWS_MAX_POINTS = 10;
export const GLASSDOOR_MAX_POINTS = 15;

export const POSTING_AGE_GHOST_THRESHOLD_DAYS = 60;
export const POSTING_AGE_WARN_THRESHOLD_DAYS = 30;
export const REPOST_GHOST_THRESHOLD = 2;

export const MAX_JOBS_PER_SEARCH = 6;
export const SCAN_TIMEOUT_MS = 45_000;

export const BRIGHT_DATA_API_URL = "https://api.brightdata.com/request";

export const FREEZE_KEYWORDS = [
  "hiring freeze", "freeze", "not hiring", "no new hires",
  "headcount freeze", "budget freeze", "paused hiring", "no headcount",
];

export const LAYOFF_KEYWORDS = [
  "layoff", "laid off", "layoffs", "rif", "restructuring",
  "downsizing", "reduction in force", "let go", "workforce reduction",
  "job cuts", "mass layoff",
];

export const EXPANSION_KEYWORDS = [
  "expansion", "expanding", "new office", "growing team",
  "scaling", "new market", "launch", "opened", "new location",
];

export const FUNDING_KEYWORDS = [
  "funding", "raised", "series a", "series b", "series c",
  "seed round", "investment", "ipo", "valuation", "venture",
  "capital raise", "million", "billion",
];

export const SYNTHESIS_SYSTEM_PROMPT = `You are a hiring intelligence analyst for Phantom. Your job is to synthesise job posting signals into a final assessment.

CRITICAL RULES:
1. Use ONLY the data provided below. Do not use your own knowledge about companies.
2. If a data point is absent, state "not found" — do not infer, estimate, or guess.
3. The deterministic Hiring Reality Score is provided. You may adjust it by a MAXIMUM of ±10 points based on holistic signal coherence. Explain any adjustment.
4. Every claim you make must reference one of the provided signals and its source.
5. Write a clear, concise summary paragraph (3-5 sentences) explaining why this job posting received its score.
6. The summary should be understandable by a non-technical job seeker.

VERDICT DEFINITIONS:
- "Real" (score >= 75): This job posting shows strong indicators of genuine, active hiring intent.
- "Suspicious" (score 40-74): This job posting shows mixed signals — some indicators of genuine hiring, some red flags.
- "Ghost" (score < 40): This job posting shows strong indicators of being a ghost job — posted without genuine intent to hire.`;

export function buildSynthesisPrompt(params: {
  job_title: string;
  company: string;
  location: string;
  deterministic_score: number;
  verdict: string;
  confidence: string;
  sources_checked: number;
  signals_formatted: string;
}): string {
  return `Analyse this job posting based on the following signals. All signals come from live Bright Data scraping — they are factual, not estimated.

JOB: ${params.job_title} at ${params.company} (${params.location})

DETERMINISTIC SCORE: ${params.deterministic_score}/100 (Hiring Reality Score)
CURRENT VERDICT: ${params.verdict}
CONFIDENCE: ${params.confidence} (${params.sources_checked}/4 data sources returned data)

SIGNALS:
${params.signals_formatted}

Based on these signals:
1. Should the score be adjusted? (max ±10 points). If all signals align in the same direction, you may increase confidence slightly. Explain your reasoning.
2. Write a plain-English summary paragraph (3-5 sentences) explaining the score to a job seeker.

Respond in this exact JSON format:
{
  "adjusted_score": <int 0-100>,
  "adjustment_reason": "<why you adjusted or kept the score>",
  "summary": "<plain English explanation for job seekers>"
}`;
}
