import { EventEmitter } from "node:events";
import { fetchSerpResults, extractJobInfoFromSerp } from "@/lib/agents/serp";
import { fetchIndeedSignals } from "@/lib/agents/indeed";
import { fetchLinkedInSignals } from "@/lib/agents/linkedin";
import { fetchUnlockerSignals } from "@/lib/agents/unlocker";
import { computeDeterministicScore } from "@/lib/scoring/deterministic";
import { synthesiseScore } from "@/lib/scoring/synthesis";
import { getCached, setCached } from "@/lib/orchestration/cache";
import { MAX_JOBS_PER_SEARCH, SCAN_TIMEOUT_MS } from "@/lib/data";
import type { ScanRequest, StreamEvent, JobResult, MergedJobSignals } from "@/lib/types";

async function safeFetch<T>(fn: () => Promise<T | null>, name: string): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`Error in ${name}: ${err}`);
    return null;
  }
}

export async function* runScan(request: ScanRequest): AsyncGenerator<StreamEvent> {
  const query = request.query.trim();

  const cached = getCached(query);
  if (cached) {
    console.log(`Cache hit for: "${query}"`);
    yield {
      event_type: "scan_complete",
      agent_name: null,
      status: null,
      message: `Returning cached results for "${query}"`,
      data: { query: cached.query, total_jobs: cached.total_jobs, jobs: cached.jobs as unknown[] },
    };
    return;
  }

  const startTime = Date.now();

  yield {
    event_type: "agent_status",
    agent_name: "serp",
    status: "querying",
    message: "Searching for job postings across the web...",
    data: null,
  };

  const serpResults = await fetchSerpResults(query, MAX_JOBS_PER_SEARCH);
  const jobsInfo = (await extractJobInfoFromSerp(serpResults)).slice(0, MAX_JOBS_PER_SEARCH);

  if (jobsInfo.length === 0) {
    yield {
      event_type: "agent_status",
      agent_name: "serp",
      status: "failed",
      message: "No job postings discovered. Try a different query.",
      data: null,
    };
    yield {
      event_type: "scan_complete",
      agent_name: null,
      status: null,
      message: "Scan complete — no results found.",
      data: { query, total_jobs: 0, jobs: [] },
    };
    return;
  }

  yield {
    event_type: "agent_status",
    agent_name: "serp",
    status: "complete",
    message: `Discovered ${jobsInfo.length} job postings — starting enrichment...`,
    data: null,
  };

  yield {
    event_type: "agent_status",
    agent_name: "indeed",
    status: "querying",
    message: `Checking Indeed signals for ${jobsInfo.length} jobs...`,
    data: null,
  };
  yield {
    event_type: "agent_status",
    agent_name: "linkedin",
    status: "querying",
    message: "Analysing company headcounts on LinkedIn...",
    data: null,
  };
  yield {
    event_type: "agent_status",
    agent_name: "unlocker",
    status: "querying",
    message: `Scanning Glassdoor & news for ${jobsInfo.length} companies...`,
    data: null,
  };

  const ee = new EventEmitter();
  const scoredJobs: JobResult[] = [];
  let pending = jobsInfo.length;

  for (const jobInfo of jobsInfo) {
    const company = jobInfo.company;
    const jobTitle = jobInfo.job_title;

    (async () => {
      try {
        const [indeedResult, linkedinResult, unlockerResult] = await Promise.all([
          safeFetch(() => fetchIndeedSignals(query, company), "indeed"),
          safeFetch(() => fetchLinkedInSignals(query, company), "linkedin"),
          safeFetch(() => fetchUnlockerSignals(query, company), "unlocker"),
        ]);

        const merged: MergedJobSignals = {
          job_title: jobTitle,
          company,
          location: jobInfo.location ?? "Not specified",
          url: jobInfo.url ?? "",
          serp: { title: jobTitle, url: jobInfo.url ?? "", snippet: jobInfo.snippet ?? "", source: "SERP API" },
          indeed: indeedResult,
          linkedin: linkedinResult,
          web_unlocker: unlockerResult,
        };

        const det = computeDeterministicScore(merged);
        const result = await synthesiseScore(merged, det);

        scoredJobs.push(result);
        ee.emit("result", result);
      } catch (err) {
        console.error(`Error processing job "${jobTitle}" at "${company}": ${err}`);
      } finally {
        pending--;
        if (pending === 0) ee.emit("allDone");
      }
    })();
  }

  const deadline = Date.now() + SCAN_TIMEOUT_MS;

  while (pending > 0 && Date.now() < deadline) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    try {
      const result = await new Promise<JobResult>((resolve, reject) => {
        const onResult = (r: JobResult) => {
          ee.off("result", onResult);
          resolve(r);
        };
        ee.on("result", onResult);
        setTimeout(() => reject(new Error("timeout")), remaining);
      });

      yield {
        event_type: "job_result",
        agent_name: null,
        status: null,
        message: `Scored: ${result.job_title} — ${result.score}/100 (${result.verdict})`,
        data: result as unknown as Record<string, unknown>,
      };
    } catch {
      break;
    }
  }

  yield {
    event_type: "agent_status",
    agent_name: "indeed",
    status: "complete",
    message: "Indeed signals collected",
    data: null,
  };
  yield {
    event_type: "agent_status",
    agent_name: "linkedin",
    status: "complete",
    message: "LinkedIn signals collected",
    data: null,
  };
  yield {
    event_type: "agent_status",
    agent_name: "unlocker",
    status: "complete",
    message: "Glassdoor & news signals collected",
    data: null,
  };

  scoredJobs.sort((a, b) => b.score - a.score);

  const response = {
    query,
    total_jobs: scoredJobs.length,
    jobs: scoredJobs,
  };

  setCached(query, response);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Scan complete: ${scoredJobs.length} jobs in ${elapsed}s`);

  yield {
    event_type: "scan_complete",
    agent_name: null,
    status: null,
    message: `Scan complete — ${scoredJobs.length} jobs analysed in ${elapsed}s`,
    data: { query, total_jobs: scoredJobs.length, jobs: scoredJobs as unknown[] },
  };
}
