import { z } from "zod";

export const Verdict = z.enum(["Real", "Suspicious", "Ghost"]);
export type Verdict = z.infer<typeof Verdict>;

export const Confidence = z.enum(["High", "Medium", "Low"]);
export type Confidence = z.infer<typeof Confidence>;

export const SignalDirection = z.enum(["Real", "Ghost", "Neutral"]);
export type SignalDirection = z.infer<typeof SignalDirection>;

export const SignalWeight = z.enum(["High", "Medium", "Low"]);
export type SignalWeight = z.infer<typeof SignalWeight>;

export const AgentStatus = z.enum(["querying", "processing", "complete", "failed", "idle"]);
export type AgentStatus = z.infer<typeof AgentStatus>;

export const ScanRequest = z.object({
  query: z.string().min(3).max(200),
});
export type ScanRequest = z.infer<typeof ScanRequest>;

export const Signal = z.object({
  signal: z.string(),
  value: z.string(),
  source: z.string(),
  weight: SignalWeight,
  direction: SignalDirection,
  points: z.number().int().min(0).max(30),
});
export type Signal = z.infer<typeof Signal>;

export const SERPResult = z.object({
  title: z.string().default(""),
  url: z.string().default(""),
  snippet: z.string().default(""),
  source: z.string().default("SERP API"),
});
export type SERPResult = z.infer<typeof SERPResult>;

export const IndeedSignals = z.object({
  posting_age_days: z.number().int().nullable().default(null),
  repost_count: z.number().int().nullable().default(null),
  date_posted: z.string().nullable().default(null),
  company_name: z.string().nullable().default(null),
  source: z.string().default("Indeed Scraper"),
});
export type IndeedSignals = z.infer<typeof IndeedSignals>;

export const LinkedInSignals = z.object({
  headcount: z.number().int().nullable().default(null),
  headcount_delta_pct: z.number().nullable().default(null),
  recent_posts: z.array(z.string()).nullable().default(null),
  source: z.string().default("LinkedIn Scraper"),
});
export type LinkedInSignals = z.infer<typeof LinkedInSignals>;

export const WebUnlockerSignals = z.object({
  glassdoor_mentions_freeze: z.boolean().default(false),
  glassdoor_mentions_layoffs: z.boolean().default(false),
  glassdoor_review_snippets: z.array(z.string()).nullable().default(null),
  recent_news: z.array(z.string()).nullable().default(null),
  has_expansion_news: z.boolean().default(false),
  has_funding_news: z.boolean().default(false),
  source: z.string().default("Web Unlocker"),
});
export type WebUnlockerSignals = z.infer<typeof WebUnlockerSignals>;

export const MergedJobSignals = z.object({
  job_title: z.string(),
  company: z.string(),
  location: z.string().default("Not specified"),
  url: z.string().default(""),
  serp: SERPResult.nullable().default(null),
  indeed: IndeedSignals.nullable().default(null),
  linkedin: LinkedInSignals.nullable().default(null),
  web_unlocker: WebUnlockerSignals.nullable().default(null),
});
export type MergedJobSignals = z.infer<typeof MergedJobSignals>;

export function sourcesWithData(merged: MergedJobSignals): number {
  let count = 0;
  if (merged.serp) count++;
  if (merged.indeed && (merged.indeed.posting_age_days != null || merged.indeed.repost_count != null)) count++;
  if (merged.linkedin && merged.linkedin.headcount_delta_pct != null) count++;
  if (merged.web_unlocker && ((merged.web_unlocker.recent_news && merged.web_unlocker.recent_news.length > 0) || (merged.web_unlocker.glassdoor_review_snippets && merged.web_unlocker.glassdoor_review_snippets.length > 0))) count++;
  return count;
}

export const JobResult = z.object({
  job_title: z.string(),
  company: z.string(),
  location: z.string().default("Not specified"),
  url: z.string().default(""),
  score: z.number().int().min(0).max(100),
  verdict: Verdict,
  confidence: Confidence,
  signals: z.array(Signal).default([]),
  summary: z.string().default(""),
  sources_checked: z.number().int().min(0).max(4).default(0),
  salary: z.string().optional(),
});
export type JobResult = z.infer<typeof JobResult>;

export const ScanResponse = z.object({
  query: z.string(),
  total_jobs: z.number().int().default(0),
  jobs: z.array(JobResult).default([]),
});
export type ScanResponse = z.infer<typeof ScanResponse>;

export const StreamEvent = z.object({
  event_type: z.string(),
  agent_name: z.string().nullable().default(null),
  status: AgentStatus.nullable().default(null),
  message: z.string().nullable().default(null),
  data: z.record(z.unknown()).nullable().default(null),
});
export type StreamEvent = z.infer<typeof StreamEvent>;

export interface DeterministicScoreResult {
  ghost_score: number;
  hiring_reality_score: number;
  signals: Signal[];
  verdict: Verdict;
  confidence: Confidence;
  sources_checked: number;
}
