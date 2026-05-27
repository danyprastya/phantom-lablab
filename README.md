# Phantom — Hiring Intelligence Agent

Phantom is a hiring market intelligence agent that discovers job postings from plain English queries, cross-references them across 4 live data sources simultaneously, and returns scored, cited intelligence via a Hiring Reality Score (0–100) so you can tell real jobs from ghost postings without ever touching a job board.

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- Bright Data account with SERP API, Web Scraper, and Web Unlocker zones
- OpenAI API key (for GPT-4o scoring synthesis)

### Setup

```bash
# 1. Clone and set up environment variables
cp .env.example .env
# Fill in your API keys in .env

# 2. Frontend setup
cd frontend
npm install
npm run dev
# Frontend runs at http://localhost:3000

# 3. Backend setup (in a separate terminal)
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
python main.py
# Backend runs at http://localhost:8000
```

### Demo Query

```
software engineer fintech remote
```

## How the Scoring Works

Every job posting receives a **Hiring Reality Score** (0–100) computed from 5 deterministic signals gathered across 4 Bright Data sources:

| Signal | Source | Ghost Indicator | Weight |
|---|---|---|---|
| Posting age | Indeed Scraper | >60 days | 30 pts |
| Repost count | Indeed Scraper | Reposted 2+ times | 25 pts |
| Headcount delta | LinkedIn Scraper | 0% change over 90 days | 20 pts |
| Recent news | SERP API + Web Unlocker | No expansion/funding news | 10 pts |
| Glassdoor signals | Web Unlocker | Reviews mention freeze/layoffs | 15 pts |

**Raw ghost score** = sum of triggered signal weights (max 100).
**Hiring Reality Score** = 100 − ghost score.

The LLM (GPT-4o) adjusts the final score by ±10 points max based on signal coherence and generates a plain-English explanation. The LLM never generates facts — it only synthesises signals sourced from Bright Data.

### Verdicts

- **Real** (score ≥ 75): Strong indicators of genuine, active hiring.
- **Suspicious** (score 40–74): Mixed signals — some red flags.
- **Ghost** (score < 40): Strong indicators of a ghost job.

### Confidence Levels

- **High**: 3–4 out of 4 data sources returned data.
- **Medium**: 2 out of 4 sources returned data.
- **Low**: 0–1 sources returned data. Treat the score with caution.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full architecture document.

```
User input → Next.js → FastAPI → 4 Bright Data sub-agents (parallel)
           → Merge signals → Deterministic scoring → LLM synthesis
           → Streaming SSE → Job cards ranked by score
```

## Known Limitations

- **Data availability**: Bright Data scraper responses depend on site structure. Some companies may not have Indeed listings or LinkedIn profiles.
- **Credit usage**: Each scan makes multiple Bright Data API calls. Use the in-memory cache (same query within a session skips re-scraping) to conserve credits.
- **Confidence caveats**: Scores with "Low" confidence (fewer than 3 sources returned data) should be treated as preliminary estimates.
- **Rate limiting**: The API is limited to 5 requests per IP per minute to prevent credit abuse.
- **No persistence**: Results live only in the browser session. Refreshing the results page will re-trigger the scan.

## Project Structure

```
phantom/
├── frontend/                  # Next.js 14 (App Router)
│   ├── app/
│   │   ├── page.tsx           # Search input page
│   │   ├── results/page.tsx   # Results dashboard
│   │   └── api/scan/route.ts  # Proxy to Python backend
│   └── components/
│       ├── SearchBar.tsx
│       ├── JobCard.tsx
│       ├── ScoreRing.tsx
│       └── LoadingAgent.tsx
├── backend/                   # Python FastAPI + LangChain
│   ├── main.py                # FastAPI entry point
│   ├── agent/
│   │   ├── orchestrator.py    # Dispatches sub-agents
│   │   ├── tools/
│   │   │   ├── serp.py        # Bright Data SERP API
│   │   │   ├── indeed.py      # Bright Data Indeed Scraper
│   │   │   ├── linkedin.py    # Bright Data LinkedIn Scraper
│   │   │   └── unlocker.py    # Bright Data Web Unlocker
│   │   └── scoring/
│   │       ├── deterministic.py   # Rule-based signal scoring
│   │       └── llm_synthesis.py   # LLM scoring + explanation
│   └── models/
│       └── schemas.py         # Pydantic models
└── docs/
    └── architecture.md
```

## License

Built for the Bright Data AI Agents Web Data Hackathon on lablab.ai (May 2026).
