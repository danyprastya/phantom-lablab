# Phantom — Architecture Document

## System Overview

Phantom is a hiring intelligence agent built as a **Next.js monolith** using the App Router:

1. **Frontend** — React UI with search input, SSE-powered results dashboard, and agent activity panel
2. **API Layer** — Next.js API routes (`/api/scan`, `/api/health`) that proxy all Bright Data calls server-side
3. **Agent Pipeline** — TypeScript modules that call 4 Bright Data tools in parallel, score signals deterministically, and synthesise results with Groq (llama-3.3-70b-versatile)

The architecture is a single deployable unit on Vercel. The Python/FastAPI backend described in early planning was consolidated into TypeScript to reduce deployment complexity for the hackathon. All Bright Data API calls happen server-side — the client never sees API keys or raw scraper responses.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER                                     │
│                   Types: "software engineer fintech remote"      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   NEXT.JS APP                                    │
│                                                                  │
│  page.tsx (search) ──→ /api/scan/route.ts ──→ results/page.tsx  │
│                        (rate limit, sanitise, orchestrate)       │
│                        (SSE streaming response)                  │
└────────────────────────┬────────────────────────────────────────┘
                         │ Phase 1: SERP Discovery
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              BRIGHT DATA — SERP API                              │
│        Discover job postings from Google search                  │
└────────────────────────┬────────────────────────────────────────┘
                         │ Phase 2: Parallel Enrichment (per job)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BRIGHT DATA TOOLS (parallel)                   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Web Unlocker │  │  Web Unlocker │  │  SERP API    │          │
│  │  (Indeed:     │  │  (LinkedIn:   │  │  + Unlocker   │          │
│  │   age, repost)│  │   headcount)  │  │  (Glassdoor,  │          │
│  │              │  │              │  │   news)       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────┬────────────────────────────────────────┘
                         │ Phase 3–5: Score & Synthesise
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              SCORING ENGINE                                      │
│                                                                  │
│  deterministic.ts → Fixed-weight signal scoring (Python-style)  │
│  synthesis.ts     → Groq synthesis (±10 pts max)       │
└────────────────────────┬────────────────────────────────────────┘
                         │ Phase 6: Stream results via SSE
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              RESULTS DASHBOARD                                   │
│  Job cards ranked by Hiring Reality Score (0–100)               │
│  Signal breakdown, verdict badges, confidence indicators        │
└─────────────────────────────────────────────────────────────────┘
```

## Anti-Hallucination Architecture

The system enforces 4 techniques to ensure the LLM never generates facts from its own memory:

### 1. Closed-Context Prompting
The LLM system prompt explicitly states: "Use ONLY the data provided. If a data point is absent, output 'not found' — do not infer or estimate." This is enforced on every scoring call.

### 2. Structured Output with Source Tagging
Every signal in the output includes a `source` field identifying which Bright Data tool returned it. The Zod `Signal` schema requires this field — signals without sources are structurally invalid and cannot be created.

### 3. Confidence Signalling
If fewer than 3 of 4 scrapers return data, confidence is set to "Low" and the UI shows a data warning. High-confidence scores are never presented on thin data.

### 4. Deterministic Signal Scoring
Posting age, headcount delta, and repost count are scored by TypeScript functions — not by the LLM. The LLM receives pre-computed signal weights and synthesises them into a final score with explanation. The LLM can adjust by ±10 points maximum. It cannot override a deterministic signal value.

## Module Responsibilities

| Module | Path | Responsibility |
|---|---|---|
| SERP Agent | `lib/agents/serp.ts` | Job discovery via Bright Data SERP API (Google search) |
| Indeed Agent | `lib/agents/indeed.ts` | Posting age, repost count via Bright Data Web Unlocker |
| LinkedIn Agent | `lib/agents/linkedin.ts` | Headcount, growth trajectory via Bright Data Web Unlocker |
| Web Unlocker Agent | `lib/agents/unlocker.ts` | Glassdoor reviews, company news via Bright Data SERP + Web Unlocker |
| Deterministic Scoring | `lib/scoring/deterministic.ts` | Fixed-weight signal scoring (no LLM involved) |
| LLM Synthesis | `lib/scoring/synthesis.ts` | Groq synthesis with ±10 guardrail |
| Orchestrator | `lib/orchestration/orchestrator.ts` | Coordinates all sub-agents, caching, SSE streaming |
| Cache | `lib/orchestration/cache.ts` | In-memory TTL cache to prevent re-scraping |
| Rate Limiter | `lib/middleware/rate-limiter.ts` | IP-based sliding window (5 req/min/IP) |
| Type Schemas | `lib/types/index.ts` | All Zod schemas and TypeScript types |
| Constants | `lib/data/index.ts` | Scoring weights, keyword lists, LLM prompts |
| Env Config | `lib/config/env.ts` | Centralised environment variable loader |
| Scan API Route | `app/api/scan/route.ts` | SSE endpoint — validates, rate-limits, streams results |
| Health API Route | `app/api/health/route.ts` | Simple health check |

## Security

- All API keys in environment variables (`.env`), never in code
- Rate limiting: 5 requests/IP/minute via custom sliding-window implementation
- Input sanitisation: HTML/script tags stripped, special characters removed, max 200 chars
- All Bright Data calls happen server-side — API keys never reach the client
- No persistent storage — stateless, results in browser session only
- Security headers: X-Frame-Options DENY, X-Content-Type-Options nosniff, strict Referrer-Policy

## Performance

- Target: under 15 seconds per search
- SERP discovery runs first, then 3 enrichment agents run in parallel via `Promise.all()`
- In-memory cache (5 min TTL, 100 entries max) prevents re-scraping identical queries
- Results limited to 10 jobs per search
- SSE streaming: frontend shows results progressively as each job is scored
- 60-second hard timeout prevents hung requests

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16 (App Router) | UI, routing, API routes |
| Styling | Tailwind CSS v4 | Utility-first styling |
| Type Validation | Zod | Runtime schema validation |
| LLM | Groq (llama-3.3-70b-versatile) | Signal synthesis and score adjustment |
| Job Discovery | Bright Data SERP API | Live Google search results |
| Job Signals | Bright Data Web Unlocker (Indeed) | Posting age, repost history |
| Company Signals | Bright Data Web Unlocker (LinkedIn) | Headcount, growth trajectory |
| Site Content | Bright Data SERP API + Web Unlocker | Glassdoor reviews, company news |
| Deployment | Vercel | Next.js hosting (single deployment) |
