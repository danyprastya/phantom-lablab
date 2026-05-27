"""
Phantom Backend — Pydantic Models & Schemas

Defines all data models used across the backend for request/response handling,
signal processing, and streaming events. These models enforce structured output
with source tagging to prevent hallucination.
"""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class Verdict(str, Enum):
    """Job posting verdict based on Hiring Reality Score."""
    REAL = "Real"           # Score >= 75
    SUSPICIOUS = "Suspicious"  # Score 40-74
    GHOST = "Ghost"         # Score < 40


class Confidence(str, Enum):
    """Confidence level based on data source coverage."""
    HIGH = "High"     # 3-4 scrapers returned data
    MEDIUM = "Medium" # 2 scrapers returned data
    LOW = "Low"       # 0-1 scrapers returned data


class SignalDirection(str, Enum):
    """Whether a signal points toward real hiring or ghost posting."""
    REAL = "Real"
    GHOST = "Ghost"
    NEUTRAL = "Neutral"


class SignalWeight(str, Enum):
    """Weight category for scoring signals."""
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


# ─── Request Models ─────────────────────────────────────────────

class ScanRequest(BaseModel):
    """
    User search input. A single plain-English query containing
    role and location information.

    Example: "software engineer fintech remote"
    """
    query: str = Field(
        ...,
        min_length=3,
        max_length=200,
        description="Plain English job search query (role + location)",
        examples=["software engineer fintech remote", "data scientist new york"]
    )


# ─── Signal & Scoring Models ────────────────────────────────────

class Signal(BaseModel):
    """
    A single data signal extracted from a Bright Data source.
    Every signal MUST have a source field — no source = not included.
    This is a core anti-hallucination constraint.
    """
    signal: str = Field(..., description="Name of the signal (e.g., 'Posting age')")
    value: str = Field(..., description="Observed value (e.g., '71 days')")
    source: str = Field(..., description="Bright Data tool that returned this signal")
    weight: SignalWeight = Field(..., description="Scoring weight category")
    direction: SignalDirection = Field(..., description="Whether this signal indicates Real or Ghost")
    points: int = Field(0, description="Deterministic score points assigned", ge=0, le=30)


class JobResult(BaseModel):
    """
    A single job posting with its Hiring Reality Score and full signal breakdown.
    Every fact in this result must originate from a Bright Data scraping call.
    """
    job_title: str = Field(..., description="Job title from the posting")
    company: str = Field(..., description="Company name")
    location: str = Field(default="Not specified", description="Job location")
    url: str = Field(default="", description="URL to the original job posting")
    score: int = Field(..., ge=0, le=100, description="Hiring Reality Score (0-100)")
    verdict: Verdict = Field(..., description="Real / Suspicious / Ghost")
    confidence: Confidence = Field(..., description="Data coverage confidence level")
    signals: list[Signal] = Field(default_factory=list, description="All signals with sources")
    summary: str = Field(default="", description="Plain-English reasoning for the score")
    sources_checked: int = Field(
        default=0,
        ge=0,
        le=4,
        description="Number of Bright Data sources that returned data (out of 4)"
    )


class ScanResponse(BaseModel):
    """
    Complete scan results. Jobs are sorted by Hiring Reality Score (highest first).
    Limited to 10 jobs maximum per search.
    """
    query: str = Field(..., description="Original search query")
    total_jobs: int = Field(0, description="Number of jobs analysed")
    jobs: list[JobResult] = Field(default_factory=list, description="Scored job results")


# ─── Streaming Event Models ─────────────────────────────────────

class AgentStatus(str, Enum):
    """Status of an individual sub-agent during the scanning pipeline."""
    QUERYING = "querying"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class StreamEvent(BaseModel):
    """
    Server-Sent Event payload for real-time progress updates.
    The frontend renders these as live agent activity indicators.
    """
    event_type: str = Field(
        ...,
        description="Event type: 'agent_status', 'job_result', 'scan_complete', 'error'"
    )
    agent_name: Optional[str] = Field(
        None,
        description="Which sub-agent this event is about (serp, indeed, linkedin, unlocker)"
    )
    status: Optional[AgentStatus] = Field(None, description="Current agent status")
    message: Optional[str] = Field(None, description="Human-readable status message")
    data: Optional[dict] = None  # Flexible payload for job results or errors


# ─── Raw Data Models (internal, from Bright Data) ───────────────

class SERPResult(BaseModel):
    """Raw search result from Bright Data SERP API."""
    title: str = ""
    url: str = ""
    snippet: str = ""
    source: str = "SERP API"


class IndeedSignals(BaseModel):
    """Signals extracted from Indeed via Bright Data Web Scraper."""
    posting_age_days: Optional[int] = None
    repost_count: Optional[int] = None
    date_posted: Optional[str] = None
    company_name: Optional[str] = None
    source: str = "Indeed Scraper"


class LinkedInSignals(BaseModel):
    """Signals extracted from LinkedIn via Bright Data Web Scraper."""
    headcount: Optional[int] = None
    headcount_delta_pct: Optional[float] = None  # % change over 90 days
    recent_posts: Optional[list[str]] = None
    source: str = "LinkedIn Scraper"


class WebUnlockerSignals(BaseModel):
    """Signals from Glassdoor/news via Bright Data Web Unlocker."""
    glassdoor_mentions_freeze: bool = False
    glassdoor_mentions_layoffs: bool = False
    glassdoor_review_snippets: Optional[list[str]] = None
    recent_news: Optional[list[str]] = None
    has_expansion_news: bool = False
    has_funding_news: bool = False
    source: str = "Web Unlocker"


class MergedJobSignals(BaseModel):
    """
    All signals for a single job, merged from all 4 Bright Data sources.
    This is the input to the scoring engine.
    """
    job_title: str
    company: str
    location: str = "Not specified"
    url: str = ""
    serp: Optional[SERPResult] = None
    indeed: Optional[IndeedSignals] = None
    linkedin: Optional[LinkedInSignals] = None
    web_unlocker: Optional[WebUnlockerSignals] = None

    @property
    def sources_with_data(self) -> int:
        """Count how many Bright Data sources returned usable data."""
        count = 0
        if self.serp:
            count += 1
        if self.indeed and (self.indeed.posting_age_days is not None or self.indeed.repost_count is not None):
            count += 1
        if self.linkedin and self.linkedin.headcount_delta_pct is not None:
            count += 1
        if self.web_unlocker and (self.web_unlocker.recent_news or self.web_unlocker.glassdoor_review_snippets):
            count += 1
        return count
