/**
 * Scan Orchestrator — Coordinates the full 6-phase pipeline for job scanning.
 *
 * Phase 1: SERP discovery (find job URLs from Google)
 * Phase 2: Parallel enrichment (Indeed, LinkedIn, Web Unlocker — simultaneously)
 * Phase 3: Merge signals per job
 * Phase 4: Deterministic scoring (TypeScript, no LLM)
 * Phase 5: LLM synthesis (Groq, ±10 pts max)
 * Phase 6: Sort, cache, and stream results via SSE
 *
 * Uses an async generator to yield StreamEvents progressively so the frontend
 * can render results as they arrive rather than waiting for the full pipeline.
 *
 * @module orchestration/orchestrator
 */
import { fetchMultiSerpResults, extractJobInfoFromSerp } from "@/lib/agents/serp";
import { fetchIndeedSignals } from "@/lib/agents/indeed";
import { fetchLinkedInSignals } from "@/lib/agents/linkedin";
import { fetchUnlockerSignals } from "@/lib/agents/unlocker";
import { expandQuery } from "@/lib/agents/query-expander";
import { computeDeterministicScore } from "@/lib/scoring/deterministic";
import { synthesiseScore } from "@/lib/scoring/synthesis";
import { rankByRelevance } from "@/lib/scoring/relevance";
import { getCached, setCached } from "@/lib/orchestration/cache";
import { MAX_JOBS_PER_SEARCH, SCAN_TIMEOUT_MS } from "@/lib/data";
import { isDemoQuery, DEMO_RESULTS } from "@/lib/data/demo";
import type { ScanRequest, StreamEvent, JobResult, MergedJobSignals } from "@/lib/types";

const NULL_EVENT = { agent_name: null, status: null, data: null } as const;

type AgentResult<T> = { data: T | null; error?: string };

async function safeFetch<T>(fn: () => Promise<AgentResult<T>>, name: string): Promise<AgentResult<T>> {
  try {
    return await fn();
  } catch (err) {
    const errMsg = `${name}: ${String(err).slice(0, 100)}`;
    console.error(errMsg);
    return { data: null, error: errMsg };
  }
}

async function enrichAndScore(
  query: string,
  jobInfo: { company: string; job_title: string; location: string; url: string; snippet: string; salary: string | null }
): Promise<{ result: JobResult | null; errors: string[] }> {
  const company = jobInfo.company;
  const jobTitle = jobInfo.job_title;
  const location = jobInfo.location ?? "Not specified";
  const url = jobInfo.url ?? "";
  const snippet = jobInfo.snippet ?? "";
  const serpSalary = jobInfo.salary;

  const errors: string[] = [];

  try {
    const [indeedRes, linkedinRes, unlockerRes] = await Promise.all([
      safeFetch(() => fetchIndeedSignals(query, company), "Indeed"),
      safeFetch(() => fetchLinkedInSignals(query, company), "LinkedIn"),
      safeFetch(() => fetchUnlockerSignals(query, company), "Unlocker"),
    ]);

    // Extract data and errors from wrapped results
    const indeedResult = indeedRes.data;
    const linkedinResult = linkedinRes.data;
    const unlockerResult = unlockerRes.data;

    if (indeedRes.error) errors.push(indeedRes.error);
    if (linkedinRes.error) errors.push(linkedinRes.error);
    if (unlockerRes.error) errors.push(unlockerRes.error);

    const merged: MergedJobSignals = {
      job_title: jobTitle,
      company,
      location,
      url,
      serp: { title: jobTitle, url, snippet, source: "SERP API" },
      indeed: indeedResult,
      linkedin: linkedinResult,
      web_unlocker: unlockerResult,
    };

    const det = computeDeterministicScore(merged);
    const result = await synthesiseScore(merged, det);

    // Attach salary — prefer Indeed's salary (more accurate), fall back to SERP snippet
    if (result) {
      result.salary = indeedResult?.salary ?? serpSalary ?? undefined;
    }

    return { result, errors };
  } catch (err) {
    console.error(`Error processing job "${jobTitle}" at "${company}": ${err}`);
    return { result: null, errors };
  }
}

export async function* runScan(request: ScanRequest): AsyncGenerator<StreamEvent> {
  const query = request.query.trim();

  const cached = getCached(query);
  if (cached) {
    console.log(`Cache hit for: "${query}"`);
    yield {
      ...NULL_EVENT,
      event_type: "scan_complete",
      message: `Returning cached results for "${query}"`,
      data: { query: cached.query, total_jobs: cached.total_jobs, jobs: cached.jobs as unknown[] },
    };
    return;
  }

  const startTime = Date.now();

  // Demo mode: if the demo query is used, attempt live first but fall back
  // to preloaded results if live APIs return nothing. This is stored as a
  // flag and checked at the end of the pipeline.
  const demoMode = isDemoQuery(query);

  yield {
    ...NULL_EVENT,
    event_type: "agent_status", agent_name: "serp", status: "querying",
    message: "Searching for job postings across the web...",
    data: null,
  };

  // Step 1: Fire the raw query search and query expansion in parallel.
  // The raw query hits Google immediately while the LLM expands in the background,
  // saving 0.5-2s of blocked time.
  const [rawSerpPromise, expanded] = await Promise.all([
    fetchSerpResults(query, MAX_JOBS_PER_SEARCH),
    expandQuery(query),
  ]);

  // Step 2: Run additional expanded variations through SERP (exclude raw query
  // which we already searched). Cap at 2 extra so total SERP calls ≤3 but with
  // overlap on the first one.
  const extraQueries = expanded.variations
    .filter((v) => v.toLowerCase() !== query.toLowerCase())
    .slice(0, 2);

  let rawSerpResults = rawSerpPromise;
  if (extraQueries.length > 0) {
    const extraResults = await fetchMultiSerpResults(extraQueries, MAX_JOBS_PER_SEARCH);
    rawSerpResults = [...rawSerpResults, ...extraResults];
  }

  console.log(`Query expansion: "${query}" → [${expanded.variations.join(" | ")}] (${extraQueries.length} extra variations)`);

  // Step 3: Deduplicate and rank by TF-IDF relevance to original query
  const rankedResults = rankByRelevance(query, rawSerpResults);
  console.log(`Relevance ranking: ${rawSerpResults.length} raw → ${rankedResults.length} after dedup+filter`);

  // Step 4: Extract structured job info from top results
  const jobsInfo = (await extractJobInfoFromSerp(rankedResults)).slice(0, MAX_JOBS_PER_SEARCH);

  if (jobsInfo.length === 0) {
    // Demo fallback: if live SERP returned nothing for the demo query,
    // serve preloaded curated results so the demo never shows a blank screen.
    if (demoMode) {
      console.log("Demo mode fallback: serving preloaded results");
      yield {
        ...NULL_EVENT,
        event_type: "agent_status", agent_name: "serp", status: "complete",
        message: "Demo mode — serving curated results...",
        data: null,
      };

      for (const job of DEMO_RESULTS) {
        // Small delay between results for a natural streaming feel
        await new Promise((r) => setTimeout(r, 400));
        yield {
          ...NULL_EVENT,
          event_type: "job_result",
          message: `Scored: ${job.job_title} — ${job.score}/100 (${job.verdict})`,
          data: job as unknown as Record<string, unknown>,
        };
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      yield {
        ...NULL_EVENT,
        event_type: "scan_complete",
        message: `Demo scan complete — ${DEMO_RESULTS.length} jobs in ${elapsed}s`,
        data: { query, total_jobs: DEMO_RESULTS.length, jobs: DEMO_RESULTS as unknown[] },
      };
      return;
    }

    yield {
      ...NULL_EVENT,
      event_type: "agent_status", agent_name: "serp", status: "failed",
      message: "No job postings discovered. Try a different query.",
      data: null,
    };
    yield {
      ...NULL_EVENT,
      event_type: "scan_complete",
      message: "Scan complete — no results found.",
      data: { query, total_jobs: 0, jobs: [] },
    };
    return;
  }

  yield {
    ...NULL_EVENT,
    event_type: "agent_status", agent_name: "serp", status: "complete",
    message: `Discovered ${jobsInfo.length} job postings — starting enrichment...`,
    data: null,
  };
  yield {
    ...NULL_EVENT,
    event_type: "agent_status", agent_name: "indeed", status: "querying",
    message: `Checking Indeed signals for ${jobsInfo.length} jobs...`,
    data: null,
  };
  yield {
    ...NULL_EVENT,
    event_type: "agent_status", agent_name: "linkedin", status: "querying",
    message: "Analysing company headcounts on LinkedIn...",
    data: null,
  };
  yield {
    ...NULL_EVENT,
    event_type: "agent_status", agent_name: "unlocker", status: "querying",
    message: `Scanning Glassdoor & news for ${jobsInfo.length} companies...`,
    data: null,
  };

  const wrapped = jobsInfo.map((job) => enrichAndScore(query, job));

  const scoredJobs: JobResult[] = [];
  const agentErrors: string[] = [];
  const deadline = Date.now() + SCAN_TIMEOUT_MS;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("scan_timeout")), SCAN_TIMEOUT_MS)
  );

  const pending = new Set(wrapped);
  while (pending.size > 0 && Date.now() < deadline) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const wrappedRemaining = [...pending].map(async (p) => {
      const value = await p;
      return { value, promise: p };
    });

    try {
      const winner = await Promise.race([...wrappedRemaining, timeoutPromise]);
      pending.delete(winner.promise);
      if (winner.value.result) {
        scoredJobs.push(winner.value.result);
        yield {
          ...NULL_EVENT,
          event_type: "job_result",
          message: `Scored: ${winner.value.result.job_title} — ${winner.value.result.score}/100 (${winner.value.result.verdict})`,
          data: winner.value.result as unknown as Record<string, unknown>,
        };
      }
      // Collect per-job agent errors for consolidated reporting
      if (winner.value.errors && winner.value.errors.length > 0) {
        for (const err of winner.value.errors) {
          if (!agentErrors.includes(err)) agentErrors.push(err);
        }
      }
    } catch {
      break;
    }
  }

  const indeedFailed = agentErrors.some((e) => e.startsWith("Indeed:"));
  const linkedinFailed = agentErrors.some((e) => e.startsWith("LinkedIn:"));
  const unlockerFailed = agentErrors.some((e) => e.startsWith("Unlocker:"));

  yield {
    ...NULL_EVENT,
    event_type: "agent_status", agent_name: "indeed", status: indeedFailed ? "failed" : "complete",
    message: indeedFailed
      ? `Indeed signals failed — ${agentErrors.find((e) => e.startsWith("Indeed:"))}`
      : "Indeed signals collected",
    data: null,
  };
  yield {
    ...NULL_EVENT,
    event_type: "agent_status", agent_name: "linkedin", status: linkedinFailed ? "failed" : "complete",
    message: linkedinFailed
      ? `LinkedIn signals failed — ${agentErrors.find((e) => e.startsWith("LinkedIn:"))}`
      : "LinkedIn signals collected",
    data: null,
  };
  yield {
    ...NULL_EVENT,
    event_type: "agent_status", agent_name: "unlocker", status: unlockerFailed ? "failed" : "complete",
    message: unlockerFailed
      ? `Glassdoor & news signals failed — ${agentErrors.find((e) => e.startsWith("Unlocker:"))}`
      : "Glassdoor & news signals collected",
    data: null,
  };

  scoredJobs.sort((a, b) => b.score - a.score);

  const response = { query, total_jobs: scoredJobs.length, jobs: scoredJobs };
  setCached(query, response);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Scan complete: ${scoredJobs.length} jobs in ${elapsed}s`);

  yield {
    ...NULL_EVENT,
    event_type: "scan_complete",
    message: `Scan complete — ${scoredJobs.length} jobs analysed in ${elapsed}s`,
    data: { query, total_jobs: scoredJobs.length, jobs: scoredJobs as unknown[] },
  };
}
