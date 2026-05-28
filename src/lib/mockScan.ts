/**
 * mockScan.ts — Mock data for UI testing without a running backend.
 *
 * Exports:
 *   MOCK_AGENT_EVENTS  — SSE-style log events in exact order
 *   MOCK_JOB_RESULTS   — 5 varied job results matching JobResult type
 *   runMockScan        — async generator that yields events with realistic delays
 */

import type { JobResult, Signal } from "@/lib/types";

// ── Types mirroring the page's AgentStep interface ────────────────
export interface MockAgentEvent {
  event_type: "agent_status";
  agent_name: string;
  status: "querying" | "processing" | "complete" | "failed";
  message: string;
}

// ── Mock SSE log sequence ─────────────────────────────────────────
export const MOCK_AGENT_EVENTS: MockAgentEvent[] = [
  {
    event_type: "agent_status",
    agent_name: "serp",
    status: "querying",
    message: "Searching for job postings across the web...",
  },
  {
    event_type: "agent_status",
    agent_name: "serp",
    status: "complete",
    message: "Searching for job posting across the web completed",
  },
  {
    event_type: "agent_status",
    agent_name: "indeed",
    status: "querying",
    message: "Discovered 5 job postings — starting enrichment...",
  },
  {
    event_type: "agent_status",
    agent_name: "indeed",
    status: "querying",
    message: "Checking Indeed signals for 5 jobs...",
  },
  {
    event_type: "agent_status",
    agent_name: "linkedin",
    status: "querying",
    message: "Analysing company headcounts on LinkedIn...",
  },
  {
    event_type: "agent_status",
    agent_name: "unlocker",
    status: "querying",
    message: "Checking Glassdoor reviews and news signals...",
  },
  {
    event_type: "agent_status",
    agent_name: "linkedin",
    status: "complete",
    message: "LinkedIn analysis complete",
  },
  {
    event_type: "agent_status",
    agent_name: "unlocker",
    status: "complete",
    message: "Glassdoor analysis complete",
  },
  {
    event_type: "agent_status",
    agent_name: "indeed",
    status: "complete",
    message: "Indeed signals complete",
  },
];

// ── Helper ────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

// ── Mock Job Results ──────────────────────────────────────────────
export const MOCK_JOB_RESULTS: JobResult[] = [
  {
    job_title: "Senior Frontend Engineer",
    company: "GoTo Group",
    location: "Jakarta, Indonesia",
    url: "https://www.gotogroup.com/careers",
    score: 18,
    verdict: "Ghost",
    confidence: "High",
    sources_checked: 4,
    summary:
      "GoTo Group's listing for Senior Frontend Engineer shows significant ghost posting indicators. The position has been reposted 4 times in 60 days with no LinkedIn headcount growth. Glassdoor reviews mention a hiring freeze effective Q3, and the Indeed posting age is 85 days — far beyond typical active recruitment windows.",
    signals: [
      {
        signal: "Posting Age",
        value: "85 days",
        source: "Indeed Scraper",
        weight: "High",
        direction: "Ghost",
        points: 0,
      } satisfies Signal,
      {
        signal: "Repost Count",
        value: "4 times",
        source: "Indeed Scraper",
        weight: "High",
        direction: "Ghost",
        points: 0,
      } satisfies Signal,
      {
        signal: "Headcount Delta",
        value: "-3.2% over 90 days",
        source: "LinkedIn Scraper",
        weight: "High",
        direction: "Ghost",
        points: 0,
      } satisfies Signal,
      {
        signal: "Glassdoor Hiring Freeze",
        value: "Mentioned",
        source: "Web Unlocker",
        weight: "High",
        direction: "Ghost",
        points: 0,
      } satisfies Signal,
    ],
  },
  {
    job_title: "Data Scientist",
    company: "Shopee",
    location: "Singapore",
    url: "https://careers.shopee.com",
    score: 31,
    verdict: "Ghost",
    confidence: "High",
    sources_checked: 4,
    summary:
      "Shopee's Data Scientist role shows multiple ghost posting signals. The listing first appeared 72 days ago and has been reposted twice. Company headcount on LinkedIn declined by 5.1% — consistent with the recent round of layoffs reported in regional tech news. No expansion or funding signals were found.",
    signals: [
      {
        signal: "Posting Age",
        value: "72 days",
        source: "Indeed Scraper",
        weight: "High",
        direction: "Ghost",
        points: 0,
      } satisfies Signal,
      {
        signal: "Repost Count",
        value: "2 times",
        source: "Indeed Scraper",
        weight: "Medium",
        direction: "Ghost",
        points: 5,
      } satisfies Signal,
      {
        signal: "Headcount Delta",
        value: "-5.1% over 90 days",
        source: "LinkedIn Scraper",
        weight: "High",
        direction: "Ghost",
        points: 0,
      } satisfies Signal,
      {
        signal: "Layoff News",
        value: "Detected",
        source: "Web Unlocker",
        weight: "High",
        direction: "Ghost",
        points: 0,
      } satisfies Signal,
    ],
  },
  {
    job_title: "Product Manager",
    company: "Xendit",
    location: "Jakarta, Indonesia",
    url: "https://xendit.co/careers",
    score: 54,
    verdict: "Suspicious",
    confidence: "Medium",
    sources_checked: 3,
    summary:
      "Xendit's Product Manager posting shows mixed signals. The role is 28 days old with no reposts, and LinkedIn headcount is stable. However, no funding or expansion news was found and Glassdoor data was unavailable for this cycle. The posting shows moderate legitimacy but lacks the positive momentum typical of active hiring.",
    signals: [
      {
        signal: "Posting Age",
        value: "28 days",
        source: "Indeed Scraper",
        weight: "Medium",
        direction: "Neutral",
        points: 10,
      } satisfies Signal,
      {
        signal: "Repost Count",
        value: "0 times",
        source: "Indeed Scraper",
        weight: "Medium",
        direction: "Real",
        points: 15,
      } satisfies Signal,
      {
        signal: "Headcount Delta",
        value: "+0.4% over 90 days",
        source: "LinkedIn Scraper",
        weight: "Low",
        direction: "Neutral",
        points: 10,
      } satisfies Signal,
    ],
  },
  {
    job_title: "Backend Engineer",
    company: "Kopi Kenangan",
    location: "Jakarta, Indonesia",
    url: "https://kopikekangan.com/careers",
    score: 82,
    verdict: "Real",
    confidence: "High",
    sources_checked: 4,
    summary:
      "Kopi Kenangan's Backend Engineer listing demonstrates strong positive signals. The posting is 12 days old with no reposts, and LinkedIn headcount grew +8.4% in the last 90 days. Glassdoor reviews are predominantly positive and recent news confirms a Series C expansion into three new cities. This is a highly credible active opening.",
    signals: [
      {
        signal: "Posting Age",
        value: "12 days",
        source: "Indeed Scraper",
        weight: "Medium",
        direction: "Real",
        points: 18,
      } satisfies Signal,
      {
        signal: "Repost Count",
        value: "0 times",
        source: "Indeed Scraper",
        weight: "Medium",
        direction: "Real",
        points: 15,
      } satisfies Signal,
      {
        signal: "Headcount Delta",
        value: "+8.4% over 90 days",
        source: "LinkedIn Scraper",
        weight: "High",
        direction: "Real",
        points: 25,
      } satisfies Signal,
      {
        signal: "Expansion News",
        value: "Series C confirmed",
        source: "Web Unlocker",
        weight: "High",
        direction: "Real",
        points: 25,
      } satisfies Signal,
    ],
  },
  {
    job_title: "UX Designer",
    company: "Traveloka",
    location: "Jakarta, Indonesia",
    url: "https://careers.traveloka.com",
    score: 91,
    verdict: "Real",
    confidence: "High",
    sources_checked: 4,
    summary:
      "Traveloka's UX Designer role is one of the strongest signals of an active, genuine opening in this scan. The listing is only 5 days old, never reposted. LinkedIn headcount grew +6.2% over the last 90 days. Recent news confirms a Series B funding announcement. Glassdoor reviews highlight healthy culture and recent intern conversions — all pointing to a real, active hiring need.",
    signals: [
      {
        signal: "Posting Age",
        value: "5 days",
        source: "Indeed Scraper",
        weight: "Medium",
        direction: "Real",
        points: 20,
      } satisfies Signal,
      {
        signal: "Repost Count",
        value: "0 times",
        source: "Indeed Scraper",
        weight: "Medium",
        direction: "Real",
        points: 15,
      } satisfies Signal,
      {
        signal: "Headcount Delta",
        value: "+6.2% over 90 days",
        source: "LinkedIn Scraper",
        weight: "High",
        direction: "Real",
        points: 25,
      } satisfies Signal,
      {
        signal: "Funding News",
        value: "Series B announced",
        source: "Web Unlocker",
        weight: "High",
        direction: "Real",
        points: 30,
      } satisfies Signal,
    ],
  },
];

// ── Mock scan runner ──────────────────────────────────────────────
/**
 * Simulates the SSE scan flow with realistic timing.
 * Calls onEvent for each agent log line, then onComplete with all jobs.
 *
 * Timing:
 *   800ms between each log event appearing
 *   500ms extra pause before results are revealed
 */
export async function runMockScan(
  onEvent: (event: MockAgentEvent) => void,
  onComplete: (jobs: JobResult[]) => void
): Promise<void> {
  for (const event of MOCK_AGENT_EVENTS) {
    await delay(800);
    onEvent(event);
  }

  await delay(500);
  onComplete(MOCK_JOB_RESULTS);
}
