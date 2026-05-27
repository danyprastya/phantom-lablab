"""
Phantom — Deterministic Signal Scoring

Pure Python scoring engine — NO LLM involvement.
Computes sub-scores from raw signals using fixed weights.
The LLM receives these pre-computed values and synthesises them,
but CANNOT override deterministic signal values.

Scoring Weight Table:
┌────────────────────┬─────────────────┬──────────────────────────┬────────┐
│ Signal             │ Source          │ Ghost Indicator          │ Weight │
├────────────────────┼─────────────────┼──────────────────────────┼────────┤
│ Posting age        │ Indeed Scraper  │ >60 days                 │ 30 pts │
│ Repost count       │ Indeed Scraper  │ Reposted 2+ times        │ 25 pts │
│ Headcount delta    │ LinkedIn        │ 0% change over 90 days   │ 20 pts │
│ Recent news        │ SERP + Unlocker │ No expansion/funding     │ 10 pts │
│ Glassdoor signals  │ Web Unlocker    │ Freeze/layoff mentions   │ 15 pts │
└────────────────────┴─────────────────┴──────────────────────────┴────────┘

Maximum raw ghost score: 100 points.
Final Hiring Reality Score = 100 - ghost_score.
"""

import logging
from typing import Optional

from models.schemas import (
    MergedJobSignals,
    Signal,
    SignalDirection,
    SignalWeight,
    Confidence,
    Verdict,
)

logger = logging.getLogger(__name__)

# ─── Weight Constants ────────────────────────────────────────────
# These are the deterministic weights. Changing them changes scoring
# for the entire application. Keep them centralised here.

POSTING_AGE_MAX_POINTS = 30
REPOST_COUNT_MAX_POINTS = 25
HEADCOUNT_DELTA_MAX_POINTS = 20
RECENT_NEWS_MAX_POINTS = 10
GLASSDOOR_MAX_POINTS = 15

# Thresholds
POSTING_AGE_GHOST_THRESHOLD_DAYS = 60  # >60 days = ghost indicator
POSTING_AGE_WARN_THRESHOLD_DAYS = 30   # 30-60 days = suspicious
REPOST_GHOST_THRESHOLD = 2             # 2+ reposts = ghost indicator
HEADCOUNT_STALE_THRESHOLD_PCT = 1.0    # <1% change = stale


def compute_deterministic_score(merged: MergedJobSignals) -> dict:
    """
    Compute the deterministic ghost score from merged job signals.

    This function produces the raw score that the LLM then synthesises.
    The LLM can adjust the final score by ±10 points max, but cannot
    override any value computed here.

    Args:
        merged: All signals for a single job, merged from 4 Bright Data sources

    Returns:
        dict with:
            - ghost_score: raw ghost score (0-100)
            - hiring_reality_score: 100 - ghost_score
            - signals: list of Signal objects with source tags
            - verdict: Real / Suspicious / Ghost
            - confidence: High / Medium / Low
            - sources_checked: number of sources that returned data
    """
    ghost_score = 0
    signals: list[Signal] = []

    # ─── Signal 1: Posting Age (30 pts max) ──────────────────────
    posting_age_points, posting_age_signal = _score_posting_age(merged)
    ghost_score += posting_age_points
    if posting_age_signal:
        signals.append(posting_age_signal)

    # ─── Signal 2: Repost Count (25 pts max) ─────────────────────
    repost_points, repost_signal = _score_repost_count(merged)
    ghost_score += repost_points
    if repost_signal:
        signals.append(repost_signal)

    # ─── Signal 3: Headcount Delta (20 pts max) ──────────────────
    headcount_points, headcount_signal = _score_headcount_delta(merged)
    ghost_score += headcount_points
    if headcount_signal:
        signals.append(headcount_signal)

    # ─── Signal 4: Recent News (10 pts max) ──────────────────────
    news_points, news_signal = _score_recent_news(merged)
    ghost_score += news_points
    if news_signal:
        signals.append(news_signal)

    # ─── Signal 5: Glassdoor Signals (15 pts max) ────────────────
    glassdoor_points, glassdoor_signal = _score_glassdoor(merged)
    ghost_score += glassdoor_points
    if glassdoor_signal:
        signals.append(glassdoor_signal)

    # ─── Compute final score and verdict ─────────────────────────
    # Cap ghost score at 100
    ghost_score = min(ghost_score, 100)
    hiring_reality_score = 100 - ghost_score

    # Determine verdict from score
    verdict = _determine_verdict(hiring_reality_score)

    # Determine confidence from data coverage
    sources_checked = merged.sources_with_data
    confidence = _determine_confidence(sources_checked)

    logger.info(
        f"Deterministic score for {merged.job_title} @ {merged.company}: "
        f"ghost={ghost_score}, reality={hiring_reality_score}, "
        f"verdict={verdict.value}, confidence={confidence.value}, "
        f"sources={sources_checked}/4"
    )

    return {
        "ghost_score": ghost_score,
        "hiring_reality_score": hiring_reality_score,
        "signals": signals,
        "verdict": verdict,
        "confidence": confidence,
        "sources_checked": sources_checked,
    }


# ─── Individual Signal Scoring Functions ─────────────────────────

def _score_posting_age(merged: MergedJobSignals) -> tuple[int, Optional[Signal]]:
    """
    Score posting age signal.
    >60 days = full 30 points (ghost).
    30-60 days = scaled 10-30 points (suspicious).
    <30 days = 0 points (real).
    """
    if not merged.indeed or merged.indeed.posting_age_days is None:
        return 0, None

    age = merged.indeed.posting_age_days

    if age > POSTING_AGE_GHOST_THRESHOLD_DAYS:
        points = POSTING_AGE_MAX_POINTS
        direction = SignalDirection.GHOST
    elif age > POSTING_AGE_WARN_THRESHOLD_DAYS:
        # Linear scaling between 30 and 60 days -> 10 to 30 points
        ratio = (age - POSTING_AGE_WARN_THRESHOLD_DAYS) / (
            POSTING_AGE_GHOST_THRESHOLD_DAYS - POSTING_AGE_WARN_THRESHOLD_DAYS
        )
        points = int(10 + ratio * 20)
        direction = SignalDirection.GHOST
    else:
        points = 0
        direction = SignalDirection.REAL

    signal = Signal(
        signal="Posting age",
        value=f"{age} days",
        source="Indeed Scraper",
        weight=SignalWeight.HIGH,
        direction=direction,
        points=points,
    )
    return points, signal


def _score_repost_count(merged: MergedJobSignals) -> tuple[int, Optional[Signal]]:
    """
    Score repost count signal.
    2+ reposts = full 25 points.
    1 repost = 10 points.
    0 reposts = 0 points.
    """
    if not merged.indeed or merged.indeed.repost_count is None:
        return 0, None

    reposts = merged.indeed.repost_count

    if reposts >= REPOST_GHOST_THRESHOLD:
        points = REPOST_COUNT_MAX_POINTS
        direction = SignalDirection.GHOST
    elif reposts == 1:
        points = 10
        direction = SignalDirection.GHOST
    else:
        points = 0
        direction = SignalDirection.REAL

    signal = Signal(
        signal="Repost count",
        value=f"{reposts} times",
        source="Indeed Scraper",
        weight=SignalWeight.HIGH,
        direction=direction,
        points=points,
    )
    return points, signal


def _score_headcount_delta(merged: MergedJobSignals) -> tuple[int, Optional[Signal]]:
    """
    Score headcount delta signal.
    0% change (or negative) over 90 days = 20 points.
    0-5% growth = 10 points (some growth but weak).
    >5% growth = 0 points (genuine expansion signal).
    """
    if not merged.linkedin or merged.linkedin.headcount_delta_pct is None:
        return 0, None

    delta = merged.linkedin.headcount_delta_pct

    if delta <= 0:
        points = HEADCOUNT_DELTA_MAX_POINTS
        direction = SignalDirection.GHOST
    elif delta < 5.0:
        # Some growth but below 5% — moderate ghost signal
        points = 10
        direction = SignalDirection.GHOST
    else:
        points = 0
        direction = SignalDirection.REAL

    signal = Signal(
        signal="Headcount delta",
        value=f"{delta:+.1f}% over 90 days",
        source="LinkedIn Scraper",
        weight=SignalWeight.MEDIUM,
        direction=direction,
        points=points,
    )
    return points, signal


def _score_recent_news(merged: MergedJobSignals) -> tuple[int, Optional[Signal]]:
    """
    Score recent news signal.
    No expansion or funding news = 10 points (low weight ghost signal).
    Has expansion/funding news = 0 points (positive signal).
    """
    if not merged.web_unlocker:
        return 0, None

    has_positive_news = (
        merged.web_unlocker.has_expansion_news or merged.web_unlocker.has_funding_news
    )

    if has_positive_news:
        points = 0
        direction = SignalDirection.REAL
        value = "Expansion/funding news found"
    else:
        points = RECENT_NEWS_MAX_POINTS
        direction = SignalDirection.GHOST
        value = "No expansion or funding news"

    signal = Signal(
        signal="Recent news",
        value=value,
        source="SERP API + Web Unlocker",
        weight=SignalWeight.LOW,
        direction=direction,
        points=points,
    )
    return points, signal


def _score_glassdoor(merged: MergedJobSignals) -> tuple[int, Optional[Signal]]:
    """
    Score Glassdoor review signals.
    Reviews mention freeze or layoffs = 15 points.
    Only freeze mentioned = 10 points.
    Only layoffs mentioned = 12 points.
    No negative signals = 0 points.
    """
    if not merged.web_unlocker:
        return 0, None

    mentions_freeze = merged.web_unlocker.glassdoor_mentions_freeze
    mentions_layoffs = merged.web_unlocker.glassdoor_mentions_layoffs

    if mentions_freeze and mentions_layoffs:
        points = GLASSDOOR_MAX_POINTS
        direction = SignalDirection.GHOST
        value = "Reviews mention hiring freeze and layoffs"
    elif mentions_freeze:
        points = 10
        direction = SignalDirection.GHOST
        value = "Reviews mention hiring freeze"
    elif mentions_layoffs:
        points = 12
        direction = SignalDirection.GHOST
        value = "Reviews mention layoffs"
    else:
        points = 0
        direction = SignalDirection.REAL
        value = "No freeze or layoff signals"

    signal = Signal(
        signal="Glassdoor signals",
        value=value,
        source="Web Unlocker",
        weight=SignalWeight.MEDIUM,
        direction=direction,
        points=points,
    )
    return points, signal


# ─── Verdict & Confidence ────────────────────────────────────────

def _determine_verdict(hiring_reality_score: int) -> Verdict:
    """
    Map Hiring Reality Score to a verdict label.
    >= 75: Real
    40-74: Suspicious
    < 40: Ghost
    """
    if hiring_reality_score >= 75:
        return Verdict.REAL
    elif hiring_reality_score >= 40:
        return Verdict.SUSPICIOUS
    else:
        return Verdict.GHOST


def _determine_confidence(sources_checked: int) -> Confidence:
    """
    Map number of data sources to confidence level.
    3-4 sources = High
    2 sources = Medium
    0-1 sources = Low

    Per the anti-hallucination architecture: if fewer than 3 of 4 scrapers
    return data, confidence is Low and the UI shows a data warning.
    """
    if sources_checked >= 3:
        return Confidence.HIGH
    elif sources_checked >= 2:
        return Confidence.MEDIUM
    else:
        return Confidence.LOW
