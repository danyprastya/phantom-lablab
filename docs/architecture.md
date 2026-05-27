# Phantom — Architecture Document

## System Overview

Phantom is a hiring intelligence agent built as a two-tier web application:

1. **Frontend** (Next.js 14, App Router) — search UI, results dashboard, API route proxy
2. **Backend** (Python FastAPI + LangChain) — agent orchestration, Bright Data integration, scoring engine

All communication between frontend and backend happens through the Next.js API route (`/api/scan`), which proxies to the Python backend. The backend URL is never exposed to the client.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER                                     │
│                   Types: "software engineer fintech remote"      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   NEXT.JS FRONTEND                               │
│                                                                  │
│  page.tsx (search) ──→ /api/scan/route.ts ──→ results/page.tsx  │
│                        (proxy to backend)     (SSE consumer)     │
└────────────────────────┬────────────────────────────────────────┘
                         │ POST /api/scan
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FASTAPI BACKEND                                │
│                                                                  │
│  main.py                                                        │
│    ├── Input validation & sanitisation                          │
│    ├── Rate limiting (5/min/IP)                                 │
│    └── StreamingResponse (SSE)                                  │
│                                                                  │
│  agent/orchestrator.py                                          │
│    ├── Check in-memory cache                                    │
│    ├── Phase 1: SERP Discovery (find job URLs)                  │
│    ├── Phase 2: Parallel enrichment per job                     │
│    │     ├── Indeed Scraper (posting age, reposts)               │
│    │     ├── LinkedIn Scraper (headcount, growth)                │
│    │     └── Web Unlocker (Glassdoor, news)                     │
│    ├── Phase 3: Merge signals per job                           │
│    ├── Phase 4: Deterministic scoring (Python)                  │
│    ├── Phase 5: LLM synthesis (GPT-4o, ±10 pts)                │
│    └── Phase 6: Sort by score, cache, stream results            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BRIGHT DATA TOOLS                              │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  SERP API    │  │  Web Scraper │  │ Web Unlocker │          │
│  │  (discovery) │  │  (Indeed,    │  │ (Glassdoor,  │          │
│  │              │  │   LinkedIn)  │  │  news sites) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Anti-Hallucination Architecture

The system enforces 4 techniques to ensure the LLM never generates facts from its own memory:

### 1. Closed-Context Prompting
The LLM system prompt explicitly states: "Use ONLY the data provided. If a data point is absent, output 'not found' — do not infer or estimate." This is enforced on every scoring call.

### 2. Structured Output with Source Tagging
Every signal in the output includes a `source` field identifying which Bright Data tool returned it. The Pydantic `Signal` model requires this field — signals without sources are structurally invalid and cannot be created.

### 3. Confidence Signalling
If fewer than 3 of 4 scrapers return data, confidence is set to "Low" and the UI shows a data warning. High-confidence scores are never presented on thin data.

### 4. Deterministic Signal Scoring
Posting age, headcount delta, and repost count are scored by Python functions — not by the LLM. The LLM receives pre-computed signal weights and synthesises them into a final score with explanation. The LLM can adjust by ±10 points maximum. It cannot override a deterministic signal value.

## Module Responsibilities

| Module | Responsibility |
|---|---|
| `agent/tools/serp.py` | Job discovery via Google search results |
| `agent/tools/indeed.py` | Posting age, repost count from Indeed |
| `agent/tools/linkedin.py` | Headcount, growth trajectory from LinkedIn |
| `agent/tools/unlocker.py` | Glassdoor reviews, company news |
| `agent/scoring/deterministic.py` | Fixed-weight signal scoring (no LLM) |
| `agent/scoring/llm_synthesis.py` | LLM synthesis with ±10 guardrail |
| `agent/orchestrator.py` | Coordinates all sub-agents, caching, streaming |
| `main.py` | FastAPI server, rate limiting, CORS, validation |
| `models/schemas.py` | All Pydantic data models |

## Security

- All API keys in environment variables (`.env`), never in code
- Rate limiting: 5 requests/IP/minute via `slowapi`
- CORS: only frontend domain allowed
- Input sanitisation: HTML/script tags stripped, special characters removed
- Backend URL hidden behind Next.js API proxy
- No persistent storage — stateless, results in browser session only

## Performance

- Target: under 15 seconds per search
- All 4 Bright Data sub-agents run in parallel via `asyncio.gather()`
- In-memory cache prevents re-scraping identical queries
- Results limited to 10 jobs per search
- Streaming SSE: frontend shows results progressively as each job is scored
