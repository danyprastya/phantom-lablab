/**
 * Demo Data — Preloaded fallback results for the curated demo query.
 *
 * Used when the demo mode is active or when live APIs are slow/down during
 * a live presentation. The demo query is "software engineer fintech remote"
 * and returns a mix of Real, Suspicious, and Ghost verdicts to showcase
 * the full scoring range.
 *
 * Per the system prompt: "Pick one specific search query. Test it 20+ times
 * before demo day. Know exactly what results it returns."
 *
 * @module data/demo
 */
import type { JobResult } from "@/lib/types";

/** The curated demo query — tested extensively before demo day */
export const DEMO_QUERY = "software engineer fintech remote";

/**
 * Checks whether the given query matches the demo query (case-insensitive,
 * trimmed). Used by the orchestrator to decide whether to serve demo data.
 */
export function isDemoQuery(query: string): boolean {
  return query.trim().toLowerCase() === DEMO_QUERY.toLowerCase();
}

/**
 * Preloaded demo results — a curated set of 5 job postings showing:
 * - 2 Real verdicts (scores 85, 78)
 * - 1 Suspicious verdict (score 55)
 * - 2 Ghost verdicts (scores 28, 15)
 *
 * Every signal has a source tag and realistic values.
 */
export const DEMO_RESULTS: JobResult[] = [
  {
    job_title: "Senior Software Engineer",
    company: "Stripe",
    location: "Remote",
    url: "https://stripe.com/jobs",
    score: 85,
    verdict: "Real",
    confidence: "High",
    signals: [
      { signal: "Posting age", value: "5 days", source: "Indeed Scraper", weight: "High", direction: "Real", points: 0 },
      { signal: "Repost count", value: "0 times", source: "Indeed Scraper", weight: "High", direction: "Real", points: 0 },
      { signal: "Headcount delta", value: "+8.0% over 90 days", source: "LinkedIn Scraper", weight: "Medium", direction: "Real", points: 0 },
      { signal: "Recent news", value: "Expansion/funding news found", source: "SERP API + Web Unlocker", weight: "Low", direction: "Real", points: 0 },
      { signal: "Glassdoor signals", value: "No freeze or layoff signals", source: "Web Unlocker", weight: "Medium", direction: "Real", points: 0 },
    ],
    summary: "This Senior Software Engineer position at Stripe received a Hiring Reality Score of 85/100, classified as \"Real\". The posting is only 5 days old with no reposts, and Stripe's headcount has grown 8% over the past 90 days. Recent news confirms ongoing expansion and funding activity. All 4 data sources returned data, giving high confidence in this assessment.",
    sources_checked: 4,
  },
  {
    job_title: "Backend Engineer — Payments Platform",
    company: "Plaid",
    location: "Remote (US)",
    url: "https://plaid.com/careers",
    score: 78,
    verdict: "Real",
    confidence: "High",
    signals: [
      { signal: "Posting age", value: "12 days", source: "Indeed Scraper", weight: "High", direction: "Real", points: 0 },
      { signal: "Repost count", value: "0 times", source: "Indeed Scraper", weight: "High", direction: "Real", points: 0 },
      { signal: "Headcount delta", value: "+5.2% over 90 days", source: "LinkedIn Scraper", weight: "Medium", direction: "Real", points: 0 },
      { signal: "Recent news", value: "Expansion/funding news found", source: "SERP API + Web Unlocker", weight: "Low", direction: "Real", points: 0 },
      { signal: "Glassdoor signals", value: "No freeze or layoff signals", source: "Web Unlocker", weight: "Medium", direction: "Real", points: 0 },
    ],
    summary: "This Backend Engineer role at Plaid scores 78/100 and is classified as \"Real\". The posting is recent (12 days), the company is actively growing with a 5.2% headcount increase, and there are no negative Glassdoor signals. Funding news further supports genuine hiring intent.",
    sources_checked: 4,
  },
  {
    job_title: "Full Stack Developer — Fintech",
    company: "Revolut",
    location: "Remote (EU/US)",
    url: "https://revolut.com/careers",
    score: 55,
    verdict: "Suspicious",
    confidence: "Medium",
    signals: [
      { signal: "Posting age", value: "38 days", source: "Indeed Scraper", weight: "High", direction: "Ghost", points: 14 },
      { signal: "Repost count", value: "1 times", source: "Indeed Scraper", weight: "High", direction: "Ghost", points: 10 },
      { signal: "Headcount delta", value: "+3.1% over 90 days", source: "LinkedIn Scraper", weight: "Medium", direction: "Ghost", points: 10 },
      { signal: "Recent news", value: "Expansion/funding news found", source: "SERP API + Web Unlocker", weight: "Low", direction: "Real", points: 0 },
      { signal: "Glassdoor signals", value: "Reviews mention restructuring", source: "Web Unlocker", weight: "Medium", direction: "Ghost", points: 12 },
    ],
    summary: "This Full Stack Developer position at Revolut received a score of 55/100, classified as \"Suspicious\". The posting has been up for 38 days and was reposted once, which are moderate warning signs. While there is positive funding news, Glassdoor reviews mention restructuring activity. Treat this listing with caution and verify directly with the company.",
    sources_checked: 3,
  },
  {
    job_title: "Software Engineer — Digital Banking",
    company: "Chime",
    location: "Remote",
    url: "https://chime.com/careers",
    score: 28,
    verdict: "Ghost",
    confidence: "High",
    signals: [
      { signal: "Posting age", value: "71 days", source: "Indeed Scraper", weight: "High", direction: "Ghost", points: 30 },
      { signal: "Repost count", value: "3 times", source: "Indeed Scraper", weight: "High", direction: "Ghost", points: 25 },
      { signal: "Headcount delta", value: "0.0% over 90 days", source: "LinkedIn Scraper", weight: "Medium", direction: "Ghost", points: 20 },
      { signal: "Recent news", value: "No expansion or funding news", source: "SERP API + Web Unlocker", weight: "Low", direction: "Ghost", points: 10 },
      { signal: "Glassdoor signals", value: "No freeze or layoff signals", source: "Web Unlocker", weight: "Medium", direction: "Real", points: 0 },
    ],
    summary: "This Software Engineer role at Chime scores 28/100, classified as \"Ghost\". Three independent signals align toward ghost status: the posting is 71 days old (well past the 60-day threshold), it has been reposted 3 times, and the company's headcount has shown zero growth in 90 days. No expansion news was found. This posting is very likely a ghost job.",
    sources_checked: 4,
  },
  {
    job_title: "Senior Platform Engineer",
    company: "Brex",
    location: "Remote (US)",
    url: "https://brex.com/careers",
    score: 15,
    verdict: "Ghost",
    confidence: "High",
    signals: [
      { signal: "Posting age", value: "90+ days", source: "Indeed Scraper", weight: "High", direction: "Ghost", points: 30 },
      { signal: "Repost count", value: "4 times", source: "Indeed Scraper", weight: "High", direction: "Ghost", points: 25 },
      { signal: "Headcount delta", value: "-5.0% over 90 days", source: "LinkedIn Scraper", weight: "Medium", direction: "Ghost", points: 20 },
      { signal: "Recent news", value: "No expansion or funding news", source: "SERP API + Web Unlocker", weight: "Low", direction: "Ghost", points: 10 },
      { signal: "Glassdoor signals", value: "Reviews mention hiring freeze and layoffs", source: "Web Unlocker", weight: "Medium", direction: "Ghost", points: 15 },
    ],
    summary: "This Senior Platform Engineer role at Brex scores just 15/100, classified as \"Ghost\" with high confidence. Every signal points to ghost status: the posting is over 90 days old and reposted 4 times, the company's headcount shrank by 5%, no positive news was found, and Glassdoor reviews mention both a hiring freeze and layoffs. This is almost certainly a ghost job — do not apply.",
    sources_checked: 4,
  },
];
