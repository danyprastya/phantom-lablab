# Phantom (Verity) — Complete Codebase Context

> For another AI to understand this app and make an implementation plan.

---

## 1. WHAT THIS APP IS

**Verity** (codename Phantom) is a "Hiring Intelligence Agent" — a Next.js 16 App Router monolith that detects **ghost job postings** (fake/listings posted without intent to hire).

User types a natural language query (e.g., "software engineer fintech remote") → The app searches Google via Bright Data SERP API, finds job postings, cross-references each job across 4 data sources in parallel, computes a **Hiring Reality Score (0-100)**, and streams results in real-time via SSE.

| Score Range | Verdict |
|-------------|---------|
| 75-100 | **Real** — genuine hiring intent |
| 40-74 | **Suspicious** — mixed signals |
| 0-39 | **Ghost** — likely fake posting |

Built for Bright Data AI Agents Web Data Hackathon (May 2026, lablab.ai).

---

## 2. TECH STACK

| Layer | Tech | Notes |
|-------|------|-------|
| Framework | Next.js 16.2.6 | App Router, server-side API routes |
| UI | React 19.2.4 + Tailwind CSS v4 | Custom design system (green accent #009966) |
| LLM | **Groq SDK** (llama-3.3-70b-versatile) | Despite comments saying "Gemini", actual code uses Groq. `@google/generative-ai` is in package.json but NOT used in any agent code |
| Validation | Zod v3 | Runtime schema validation for all data structures |
| Testing | Vitest v4 | 10 test files in `__tests__/` |
| Web Data | Bright Data | 3 zones: SERP API, Web Scraper, Web Unlocker |
| Deployment | Vercel | Single deployment unit |

---

## 3. DIRECTORY STRUCTURE

```
src/
├── app/
│   ├── layout.tsx                    # Root layout, fonts, metadata
│   ├── page.tsx                      # Landing page (search + results + history)
│   ├── globals.css                   # Design system tokens, animations
│   ├── about/page.tsx                # Static about page
│   ├── how-it-works/page.tsx         # Pipeline explanation page
│   ├── results/page.tsx              # Dynamic results page (SSE consumer)
│   └── api/
│       ├── scan/route.ts             # POST /api/scan — SSE streaming endpoint
│       └── health/route.ts           # GET /api/health
├── components/
│   ├── SearchBar.tsx                 # Animated search input
│   ├── JobCard.tsx                   # Scored job result card
│   ├── JobDetailDrawer.tsx           # Slide-in detail panel
│   ├── ScoreRing.tsx                 # Animated SVG radial score ring
│   └── LoadingAgent.tsx              # Real-time agent activity log
├── lib/
│   ├── agents/
│   │   ├── serp.ts                   # SERP Agent: Google job search via Bright Data SERP API
│   │   ├── indeed.ts                 # Indeed Agent: posting age, repost count via Web Unlocker
│   │   ├── linkedin.ts               # LinkedIn Agent: headcount, growth via SERP+Unlocker
│   │   ├── unlocker.ts               # Unlocker Agent: Glassdoor reviews + company news
│   │   └── query-expander.ts         # LLM query expansion (Groq) + deterministic fallback
│   ├── scoring/
│   │   ├── deterministic.ts          # Fixed-weight TypeScript scoring (5 signals, no LLM)
│   │   ├── synthesis.ts              # LLM synthesis (±10 pts max adjustment)
│   │   └── relevance.ts             # TF-IDF dedup and ranking
│   ├── orchestration/
│   │   ├── orchestrator.ts           # 6-phase pipeline coordinator (async generator)
│   │   └── cache.ts                  # In-memory TTL cache (5 min, 100 entries)
│   ├── parsers/
│   │   └── serp-html.ts             # Regex-based Google SERP HTML parser
│   ├── config/
│   │   └── env.ts                    # Centralized env var loader
│   ├── data/
│   │   ├── index.ts                  # Scoring weights, keywords, LLM prompts
│   │   └── demo.ts                   # Preloaded demo results for curated query fallback
│   ├── middleware/
│   │   └── rate-limiter.ts           # IP-based sliding window (5 req/min)
│   ├── services/
│   │   └── scan.ts                   # Client-side SSE stream handler
│   ├── types/
│   │   └── index.ts                  # Zod schemas + TypeScript types
│   └── mockScan.ts                   # Mock data for UI testing
__tests__/                             # 10 Vitest test files
```

---

## 4. PIPELINE FLOW (6 Phases)

```
User Query
    ↓
[Phase 1] Query Expansion (query-expander.ts)
    Groq LLM generates 3 search variations with synonyms
    Fallback: deterministic synonym dictionary
    ↓
[Phase 2] SERP Discovery (serp.ts)
    Runs all 3 query variations through Google via Bright Data SERP API in parallel
    URL: https://api.brightdata.com/request
    zone: BRIGHT_DATA_SERP_ZONE
    format: "raw" + brd_json=1 in search URL
    ↓
[Phase 3] TF-IDF Dedup & Ranking (relevance.ts)
    Removes duplicate URLs, scores relevance to original query
    Filters low-relevance results (min threshold 0.05)
    ↓
[Phase 4] Parallel Enrichment — per job (indeed.ts + linkedin.ts + unlocker.ts)
    Indeed Agent:      Fetches Indeed search page via Web Unlocker → parses posting age, repost count, salary
    LinkedIn Agent:    Step 1: SERP API to find company URL. Step 2: Web Unlocker to fetch page → parses headcount, growth
    Unlocker Agent:    SERP API searches for Glassdoor reviews + Google News → keyword matching
    ↓
[Phase 5] Deterministic Scoring (deterministic.ts) + LLM Synthesis (synthesis.ts)
    5 signals scored by TypeScript (no LLM):
      1. Posting age    (30 pts max) — Indeed Scraper
      2. Repost count   (25 pts max) — Indeed Scraper
      3. Headcount delta (20 pts max) — LinkedIn Scraper
      4. Recent news     (10 pts max) — SERP+Unlocker
      5. Glassdoor       (15 pts max) — Web Unlocker
    Ghost Score = sum of triggered signal weights (max 100)
    Hiring Reality Score = 100 - Ghost Score
    Then Groq LLM adjusts by ±10 pts max and generates plain-English summary
    ↓
[Phase 6] Cache + SSE Stream
    In-memory cache (5 min TTL), results streamed progressively to frontend
```

---

## 5. BRIGHT DATA ZONES USED

| Zone Env Var | Default | Used By | Purpose |
|-------------|---------|---------|---------|
| `BRIGHT_DATA_SERP_ZONE` | `phantom_serp_api` | serp.ts, unlocker.ts, linkedin.ts (URL resolver) | Google search (SERP API) |
| `BRIGHT_DATA_WEB_UNLOCKER_ZONE` | `phantom_web_unlocker` | indeed.ts, linkedin.ts (page fetch) | Raw HTML fetch with anti-bot |
| `BRIGHT_DATA_WEB_SCRAPER_ZONE` | `phantom_web_scraper` | **NOT USED** anywhere | Defined but never referenced |

The architecture docs mention "Web Scraper" for Indeed and LinkedIn, but the actual code uses **Web Unlocker** for both. This is a discrepancy.

---

## 6. KEY DATA STRUCTURES (from types/index.ts)

```typescript
// Core types (all validated with Zod)

SERPResult {
  title: string, url: string, snippet: string, source: "SERP API"
}

IndeedSignals {
  posting_age_days: number | null,   // null = not found
  repost_count: number | null,
  date_posted: string | null,
  company_name: string | null,
  salary: string | null,
  source: "Indeed Scraper"
}

LinkedInSignals {
  headcount: number | null,
  headcount_delta_pct: number | null,  // positive=growth, negative=shrinking
  recent_posts: string[] | null,
  source: "LinkedIn Scraper"
}

WebUnlockerSignals {
  glassdoor_mentions_freeze: boolean,
  glassdoor_mentions_layoffs: boolean,
  glassdoor_review_snippets: string[] | null,
  recent_news: string[] | null,
  has_expansion_news: boolean,
  has_funding_news: boolean,
  source: "Web Unlocker"
}

MergedJobSignals {
  job_title, company, location, url,
  serp: SERPResult | null,
  indeed: IndeedSignals | null,
  linkedin: LinkedInSignals | null,
  web_unlocker: WebUnlockerSignals | null
}

JobResult {
  job_title, company, location, url,
  score: 0-100,          // Final Hiring Reality Score
  verdict: "Real" | "Suspicious" | "Ghost",
  confidence: "High" | "Medium" | "Low",  // based on sources_checked
  signals: Signal[],      // Detailed breakdown
  summary: string,        // LLM-generated plain-English explanation
  sources_checked: 0-4,   // How many of 4 sources returned data
  salary?: string         // From Indeed (preferred) or SERP snippet
}

Signal {
  signal: string,         // e.g. "Posting age"
  value: string,          // e.g. "30 days"
  source: string,         // e.g. "Indeed Scraper"
  weight: "High" | "Medium" | "Low",
  direction: "Real" | "Ghost" | "Neutral",
  points: 0-30            // Points added to ghost score
}

StreamEvent {
  event_type: string,     // "agent_status" | "job_result" | "scan_complete" | "error"
  agent_name: string | null,
  status: string | null,  // "querying" | "processing" | "complete" | "failed" | "idle"
  message: string | null,
  data: Record | null     // JobResult payload for job_result events
}
```

---

## 7. ENVIRONMENT VARIABLES

```
# Required
BRIGHT_DATA_API_KEY=              # Bright Data API key

# Optional (defaults shown)
BRIGHT_DATA_SERP_ZONE=phantom_serp_api
BRIGHT_DATA_WEB_SCRAPER_ZONE=phantom_web_scraper
BRIGHT_DATA_WEB_UNLOCKER_ZONE=phantom_web_unlocker
GROQ_API_KEY=                    # If missing, LLM features fall back gracefully
LLM_MODEL=llama-3.3-70b-versatile
FRONTEND_URL=http://localhost:3000
```

---

## 8. SCORING CONSTANTS (from lib/data/index.ts)

| Constant | Value | Description |
|----------|-------|-------------|
| POSTING_AGE_MAX_POINTS | 30 | Max ghost points from old postings |
| REPOST_COUNT_MAX_POINTS | 25 | Max ghost points from reposts |
| HEADCOUNT_DELTA_MAX_POINTS | 20 | Max ghost points from stagnant headcount |
| RECENT_NEWS_MAX_POINTS | 10 | Max ghost points from no expansion news |
| GLASSDOOR_MAX_POINTS | 15 | Max ghost points from freeze/layoff mentions |
| POSTING_AGE_GHOST_THRESHOLD_DAYS | 60 | >60 days = full ghost points |
| POSTING_AGE_WARN_THRESHOLD_DAYS | 30 | 30-60 days = proportional points |
| REPOST_GHOST_THRESHOLD | 2 | 2+ reposts = full ghost points |
| MAX_JOBS_PER_SEARCH | 10 | Results limit |
| SCAN_TIMEOUT_MS | 60000 | 60-second pipeline timeout |

---

## 9. QUERY EXPANDER DETAILS

### LLM path (Groq)
- Prompt instructs: "Always include 'jobs' or 'hiring' or 'careers' in each variation"
- Returns exactly 3 variations as JSON array
- Temperature: 0.7, max_tokens: 200

### Deterministic fallback (synonym dictionary)
- Variation 1: `${query} jobs hiring now`
- Variation 2: Replace first synonym match + " jobs"
- Variation 3: Bigram/single-word synonym replacement + " careers"
- Synonym map covers: roles (frontend, backend, devops, data scientist, etc.), seniority (senior, junior, lead, intern), industries (fintech, healthtech, AI, crypto, SaaS, ecommerce), work styles (remote, hybrid, onsite)

---

## 10. BRIGHT DATA API CALL PATTERNS

### SERP API calls (serp.ts, unlocker.ts, linkedin.ts)
```json
{
  "zone": "phantom_serp_api",
  "url": "https://www.google.com/search?q=...&brd_json=1&num=10&hl=en&gl=us",
  "format": "raw"
}
```
- Response parsed handles two formats:
  1. `data.organic[]` (parsed_light)
  2. `data.results[]` filtered by `type === "organic"` (brd_json=1)

### Web Unlocker calls (indeed.ts, linkedin.ts page fetch)
```json
{
  "zone": "phantom_web_unlocker",
  "url": "https://www.indeed.com/jobs?q=...&sort=date&limit=10",
  "format": "raw"
}
```
- Response is raw HTML, parsed with regex

---

## 11. FEEDBACK FROM AI AGENT — 5 Issues & Verification

Below is the feedback from another AI agent that reviewed this codebase. Each issue is listed with whether it still exists or was already fixed.

### 🔴 Issue #1: serp.ts format bug → **ALREADY FIXED**
**Reported**: "serp.ts uses `format: "json"` but docs require `format: "raw"`. Also missing `brd_json=1` in search URL."
**Status**: ✅ FIXED. serp.ts already uses `format: "raw"` (line 25) and `brd_json=1` (line 20).

### 🔴 Issue #2: indeed.ts/linkedin.ts use wrong zone → **NEEDS REVIEW**
**Reported**: "indeed.ts and linkedin.ts send REST API calls to phantom_web_scraper — but that's a Browser API zone."
**Status**: 🟡 CODE USES CORRECT ZONE but `BRIGHT_DATA_WEB_SCRAPER_ZONE` is never used. Both indeed.ts (line 28) and linkedin.ts (line 33) use `BRIGHT_DATA_WEB_UNLOCKER_ZONE`. However, `BRIGHT_DATA_WEB_SCRAPER_ZONE` is defined in env.ts (line 24) but never referenced anywhere in code. The architecture docs say "Web Scraper" for Indeed/LinkedIn but code uses "Web Unlocker" — docs are stale. Could be removed for cleanliness.

### 🟡 Issue #3: unlocker.ts has format bug → **ALREADY FIXED**
**Reported**: "unlocker.ts has the same `format: "json"` bug."
**Status**: ✅ FIXED. unlocker.ts already uses `format: "raw"` (lines 53, 95) and `brd_json=1` (lines 46, 88).

### 🟡 Issue #4: LinkedIn URL resolver has format bug → **ALREADY FIXED**
**Reported**: "LinkedIn's URL resolver also has the format bug."
**Status**: ✅ FIXED. linkedin.ts `resolveLinkedInUrl` already uses `format: "raw"` (line 100) and `brd_json=1` (line 91).

### 🟡 Issue #5: Double-suffixed search queries → **STILL EXISTS**
**Reported**: "fetchSerpResults adds 'jobs hiring now' to queries that the query expander already expanded with 'jobs'/'hiring'/'careers' — resulting in diluted double-suffixed searches."
**Status**: 🟡 STILL EXISTS in deterministic fallback. In `query-expander.ts`, `deterministicExpand()` (line 128) adds `"jobs hiring now"` to the raw query. The LLM expansion prompt (line 29) also says "Always include 'jobs' or 'hiring' or 'careers' in each variation." If the user's query already contains these words (e.g., "hiring software engineer"), the LLM may produce: "hiring software engineer jobs" — double-suffixed. The `fetchSerpResults` function itself (serp.ts line 17 comment) correctly notes "don't add extra suffixes" — but the expander still does.

---

## 12. KNOWN ISSUES SUMMARY (PRIORITIZED)

### Priority: After reviewing the feedback

| # | Issue | Status | Action |
|---|-------|--------|--------|
| 1 | serp.ts format bug | ✅ Already fixed | No action needed |
| 2 | indeed/linkedin wrong zone | 🟡 Zone correct, docs stale | Update docs OR remove unused Web Scraper zone config |
| 3 | unlocker.ts format bug | ✅ Already fixed | No action needed |
| 4 | LinkedIn resolver format bug | ✅ Already fixed | No action needed |
| 5 | Double-suffixed queries | 🟡 Still exists | Fix `deterministicExpand()` and/or LLM prompt to avoid suffixing when query already contains jobs/hiring/careers |
| 6 | Stale architecture docs | 🟡 Docs say Web Scraper for Indeed/LinkedIn, code uses Web Unlocker | Update architecture.md and README |
| 7 | Unused BRIGHT_DATA_WEB_SCRAPER_ZONE | 🟡 Defined but never used | Remove or repurpose |
| 8 | Code comments say "Gemini" but code uses Groq | 🟡 Misleading docs | Update comments and README to say Groq |

### Suggested Fix Priority:
1. **Fix Issue #5** (double-suffixed queries) — actual bug affecting search quality
2. **Remove/repurpose unused Web Scraper zone** (Issue #7)
3. **Update stale docs** (Issues #6, #8) — README and architecture.md still reference Gemini
```

---

## 13. SUGGESTED IMPLEMENTATION PLAN

Based on the analysis, here are the tasks for the next AI to plan:

1. **[HIGH] Fix Issue #5**: Refactor `deterministicExpand()` and the LLM expansion prompt to detect and avoid double-suffixing when the user's original query already contains "jobs", "hiring", or "careers".

2. **[LOW] Clean up zone config**: Either remove `BRIGHT_DATA_WEB_SCRAPER_ZONE` from env.ts if unused, or document why it's kept.

3. **[LOW] Update docs**: Fix all references to "Gemini" → "Groq" in README, architecture.md, code comments. Fix references to "Web Scraper" → "Web Unlocker" for Indeed/LinkedIn agents.

4. **[VERIFICATION] Check Bright Data integration**: Verify that `format: "raw"` + `brd_json=1` is actually returning correct data from Bright Data SERP API in production. If it returns empty, the response parsing logic (handling both `data.organic` and `data.results`) might need adjustment.

5. **[ENHANCEMENT] Add better error surfacing**: When `indeed.ts` or `linkedin.ts` return null, the pipeline silently degrades to fewer sources checked. Could surface WHY (e.g., anti-bot blocks, HTML parsing failures) via the SSE stream.

6. **[POTENTIAL] Add response parsing for brd_json=1**: The response parsing in serp.ts (and similar functions in unlocker.ts, linkedin.ts) tries both `data.organic` and `data.results` formats. Confirm whether Bright Data actually returns these keys when `brd_json=1` is used with `format: "raw"`.
