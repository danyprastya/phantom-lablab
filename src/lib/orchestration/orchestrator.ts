import { fetchSerpResults, extractJobInfoFromSerp } from "@/lib/agents/serp";
import { fetchIndeedSignals } from "@/lib/agents/indeed";
import { fetchLinkedInSignals } from "@/lib/agents/linkedin";
import { fetchUnlockerSignals } from "@/lib/agents/unlocker";
import { computeDeterministicScore } from "@/lib/scoring/deterministic";
import { synthesiseScore } from "@/lib/scoring/synthesis";
import { getCached, setCached } from "@/lib/orchestration/cache";
import { MAX_JOBS_PER_SEARCH, SCAN_TIMEOUT_MS } from "@/lib/data";
import type { ScanRequest, StreamEvent, JobResult, MergedJobSignals } from "@/lib/types";

const NULL_EVENT = { agent_name: null, status: null, data: null } as const;

async function safeFetch<T>(fn: () => Promise<T | null>, name: string): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`Error in ${name}: ${err}`);
    return null;
  }
}

async function enrichAndScore(
  query: string,
  jobInfo: { company: string; job_title: string; location: string; url: string; snippet: string }
): Promise<JobResult | null> {
  const company = jobInfo.company;
  const jobTitle = jobInfo.job_title;
  const location = jobInfo.location ?? "Not specified";
  const url = jobInfo.url ?? "";
  const snippet = jobInfo.snippet ?? "";

  try {
    const [indeedResult, linkedinResult, unlockerResult] = await Promise.all([
      safeFetch(() => fetchIndeedSignals(query, company), "indeed"),
      safeFetch(() => fetchLinkedInSignals(query, company), "linkedin"),
      safeFetch(() => fetchUnlockerSignals(query, company), "unlocker"),
    ]);

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
    return await synthesiseScore(merged, det);
  } catch (err) {
    console.error(`Error processing job "${jobTitle}" at "${company}": ${err}`);
    return null;
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

  yield {
    ...NULL_EVENT,
    event_type: "agent_status", agent_name: "serp", status: "querying",
    message: "Searching for job postings across the web...",
    data: null,
  };

  const serpResults = await fetchSerpResults(query, MAX_JOBS_PER_SEARCH);
  const jobsInfo = (await extractJobInfoFromSerp(serpResults)).slice(0, MAX_JOBS_PER_SEARCH);

  if (jobsInfo.length === 0) {
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

  const wrapped = jobsInfo.map((job) =>
    enrichAndScore(query, job).then((result) => ({ result, promiseId: Symbol() }))
  );

  const scoredJobs: JobResult[] = [];
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
    } catch {
      break;
    }
  }

  yield {
    ...NULL_EVENT,
    event_type: "agent_status", agent_name: "indeed", status: "complete",
    message: "Indeed signals collected",
    data: null,
  };
  yield {
    ...NULL_EVENT,
    event_type: "agent_status", agent_name: "linkedin", status: "complete",
    message: "LinkedIn signals collected",
    data: null,
  };
  yield {
    ...NULL_EVENT,
    event_type: "agent_status", agent_name: "unlocker", status: "complete",
    message: "Glassdoor & news signals collected",
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
