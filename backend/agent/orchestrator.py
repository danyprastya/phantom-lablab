"""
Phantom — Agent Orchestrator

Core orchestration engine that coordinates all Bright Data sub-agents,
merges their signals, runs deterministic scoring, and calls LLM synthesis.

Architecture:
    User query → SERP discovery → ALL jobs enriched in PARALLEL
               → Merge signals → Deterministic scoring → LLM synthesis
               → Sorted, scored results (streamed as they complete)

Key design decisions:
- SERP runs first to discover all job URLs (sequential — needed before enrichment)
- All N job enrichments run SIMULTANEOUSLY via asyncio.create_task()
  This is the critical path for the 15-second performance target.
- asyncio.Queue bridges the parallel tasks → streaming generator
  (Python generators can't yield from inside task callbacks — the queue solves this)
- In-memory cache keyed by query prevents re-scraping within a session
- Results capped at 10 jobs to stay within demo time budget
"""

import asyncio
import logging
import time
from typing import AsyncGenerator, Callable, Optional

from models.schemas import (
    ScanRequest,
    ScanResponse,
    JobResult,
    MergedJobSignals,
    SERPResult,
    IndeedSignals,
    LinkedInSignals,
    WebUnlockerSignals,
    StreamEvent,
    AgentStatus,
)
from agent.tools.serp import fetch_serp_results, extract_job_info_from_serp
from agent.tools.indeed import fetch_indeed_signals
from agent.tools.linkedin import fetch_linkedin_signals
from agent.tools.unlocker import fetch_unlocker_signals
from agent.scoring.deterministic import compute_deterministic_score
from agent.scoring.llm_synthesis import synthesise_score

logger = logging.getLogger(__name__)

# ─── In-Memory Cache ────────────────────────────────────────────────────────
# Simple dict keyed by query string. Prevents hitting Bright Data twice
# for identical queries within the same server session.
_results_cache: dict[str, ScanResponse] = {}

# Maximum jobs to enrich per search
MAX_JOBS_PER_SEARCH = 10


async def run_scan(
    request: ScanRequest,
    on_event: Optional[Callable] = None,
) -> AsyncGenerator[StreamEvent, None]:
    """
    Execute the full Phantom pipeline as a streaming async generator.

    Yields StreamEvent objects. The FastAPI server sends each event to
    the browser as a Server-Sent Event (SSE) line.

    Pipeline:
    1. Check cache → return immediately if hit
    2. SERP discovery → find up to 10 job URLs
    3. Launch ALL job enrichments simultaneously (parallel)
    4. As each job finishes scoring, yield it immediately (streaming)
    5. Final sorted result set cached and yielded as scan_complete

    Args:
        request: ScanRequest containing the user's plain English query
        on_event: Optional callback used in tests

    Yields:
        StreamEvent (agent_status, job_result, scan_complete, error)
    """
    query = request.query.strip()

    # ─── Cache check ───────────────────────────────────────────────────
    if query in _results_cache:
        logger.info(f"Cache hit for query: '{query}'")
        cached = _results_cache[query]
        yield StreamEvent(
            event_type="scan_complete",
            message=f"Returning cached results for '{query}'",
            data=cached.model_dump(),
        )
        return

    start_time = time.time()

    # ─── Phase 1: SERP Discovery ───────────────────────────────────────
    yield StreamEvent(
        event_type="agent_status",
        agent_name="serp",
        status=AgentStatus.QUERYING,
        message="Searching for job postings across the web...",
    )

    serp_results = await fetch_serp_results(query, max_results=MAX_JOBS_PER_SEARCH)

    if not serp_results:
        yield StreamEvent(
            event_type="agent_status",
            agent_name="serp",
            status=AgentStatus.FAILED,
            message="No job postings discovered. Try a different query.",
        )
        yield StreamEvent(
            event_type="scan_complete",
            message="Scan complete — no results found.",
            data=ScanResponse(query=query, total_jobs=0, jobs=[]).model_dump(),
        )
        return

    yield StreamEvent(
        event_type="agent_status",
        agent_name="serp",
        status=AgentStatus.COMPLETE,
        message=f"Discovered {len(serp_results)} job postings — starting enrichment...",
    )

    jobs_info = await extract_job_info_from_serp(serp_results)
    jobs_info = jobs_info[:MAX_JOBS_PER_SEARCH]

    # ─── Phase 2: Parallel Enrichment ─────────────────────────────────
    # Signal that all 3 enrichment agents are now active simultaneously.
    # We yield these BEFORE launching tasks so the UI shows activity right away.
    yield StreamEvent(
        event_type="agent_status",
        agent_name="indeed",
        status=AgentStatus.QUERYING,
        message=f"Checking Indeed signals for {len(jobs_info)} jobs...",
    )
    yield StreamEvent(
        event_type="agent_status",
        agent_name="linkedin",
        status=AgentStatus.QUERYING,
        message=f"Analysing company headcounts on LinkedIn...",
    )
    yield StreamEvent(
        event_type="agent_status",
        agent_name="unlocker",
        status=AgentStatus.QUERYING,
        message=f"Scanning Glassdoor & news for {len(jobs_info)} companies...",
    )

    # Use a queue to collect results from parallel tasks.
    # asyncio generators cannot yield from inside task callbacks, so tasks
    # push results onto a queue that the generator reads from here.
    result_queue: asyncio.Queue[JobResult | Exception] = asyncio.Queue()

    async def enrich_and_score(job_info: dict) -> None:
        """
        Enrich one job with all 3 data sources in parallel, then score it.
        Pushes the result onto result_queue when done.
        """
        company = job_info.get("company", "Unknown")
        job_title = job_info.get("job_title", "Unknown")

        try:
            # All 3 enrichment agents run simultaneously for this job
            indeed_result, linkedin_result, unlocker_result = await asyncio.gather(
                _safe_fetch(fetch_indeed_signals, query=query, company=company),
                _safe_fetch(fetch_linkedin_signals, query=query, company=company),
                _safe_fetch(fetch_unlocker_signals, query=query, company=company),
            )

            merged = MergedJobSignals(
                job_title=job_title,
                company=company,
                location=job_info.get("location", "Not specified"),
                url=job_info.get("url", ""),
                serp=SERPResult(
                    title=job_title,
                    url=job_info.get("url", ""),
                    snippet=job_info.get("snippet", ""),
                ),
                indeed=indeed_result,
                linkedin=linkedin_result,
                web_unlocker=unlocker_result,
            )

            deterministic_result = compute_deterministic_score(merged)
            job_result = await synthesise_score(merged, deterministic_result)

            await result_queue.put(job_result)

        except Exception as e:
            logger.error(f"Error processing job '{job_title}' at '{company}': {e}")
            await result_queue.put(e)

    # Launch ALL jobs simultaneously
    tasks = [
        asyncio.create_task(enrich_and_score(job_info))
        for job_info in jobs_info
    ]

    # ─── Phase 3: Stream results as they complete ─────────────────────
    scored_jobs: list[JobResult] = []
    expected_count = len(tasks)

    # Give tasks up to 60 seconds total; yield each result as it arrives
    deadline = time.time() + 60.0

    for _ in range(expected_count):
        remaining = deadline - time.time()
        if remaining <= 0:
            logger.warning("Scan timeout — some jobs may not be scored")
            break

        try:
            item = await asyncio.wait_for(result_queue.get(), timeout=remaining)
        except asyncio.TimeoutError:
            logger.warning("Timed out waiting for job result")
            break

        if isinstance(item, Exception):
            # A job failed — skip it, don't crash the whole scan
            continue

        scored_jobs.append(item)

        yield StreamEvent(
            event_type="job_result",
            message=f"Scored: {item.job_title} — {item.score}/100 ({item.verdict.value})",
            data=item.model_dump(),
        )

    # Update enrichment agent statuses now that all parallel work is done
    yield StreamEvent(
        event_type="agent_status",
        agent_name="indeed",
        status=AgentStatus.COMPLETE,
        message="Indeed signals collected",
    )
    yield StreamEvent(
        event_type="agent_status",
        agent_name="linkedin",
        status=AgentStatus.COMPLETE,
        message="LinkedIn signals collected",
    )
    yield StreamEvent(
        event_type="agent_status",
        agent_name="unlocker",
        status=AgentStatus.COMPLETE,
        message="Glassdoor & news signals collected",
    )

    # Cancel any tasks that are still running (timeout case)
    for task in tasks:
        if not task.done():
            task.cancel()

    # ─── Phase 4: Sort, cache, and finalise ───────────────────────────
    scored_jobs.sort(key=lambda j: j.score, reverse=True)

    response = ScanResponse(
        query=query,
        total_jobs=len(scored_jobs),
        jobs=scored_jobs,
    )

    _results_cache[query] = response

    elapsed = time.time() - start_time
    logger.info(f"Scan complete: {len(scored_jobs)} jobs in {elapsed:.1f}s")

    yield StreamEvent(
        event_type="scan_complete",
        message=f"Scan complete — {len(scored_jobs)} jobs analysed in {elapsed:.1f}s",
        data=response.model_dump(),
    )


async def _safe_fetch(fetch_fn: Callable, **kwargs):
    """
    Safely call a fetch function, catching all exceptions.

    Returns None if the fetch fails for any reason. This ensures a single
    data source failure does not abort the entire job enrichment.
    """
    try:
        return await fetch_fn(**kwargs)
    except Exception as e:
        logger.error(f"Error in {fetch_fn.__name__}: {e}")
        return None


def clear_cache() -> None:
    """Clear the in-memory results cache (e.g. for testing)."""
    _results_cache.clear()
    logger.info("Results cache cleared")
