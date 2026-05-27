"""
Phantom — Web Unlocker Tool (Glassdoor & News Signals)

Uses Bright Data Web Unlocker to access Glassdoor and Google News
for company-level sentiment signals.

Glassdoor approach: Search Google for the company's Glassdoor page
rather than trying to construct a direct Glassdoor URL (which requires
knowing the company's internal numeric ID). This is more reliable.

News approach: Google News search for company expansion/funding keywords.

Input: company name
Output: WebUnlockerSignals with glassdoor and news boolean flags + snippets
"""

import os
import re
import logging
import httpx
from urllib.parse import quote_plus
from typing import Optional
import asyncio

from models.schemas import WebUnlockerSignals

logger = logging.getLogger(__name__)

UNLOCKER_API_URL = "https://api.brightdata.com/request"

# Keywords indicating hiring freeze in Glassdoor reviews
FREEZE_KEYWORDS = [
    "hiring freeze", "freeze", "not hiring", "no new hires",
    "headcount freeze", "budget freeze", "paused hiring", "no headcount",
]
# Keywords indicating layoffs
LAYOFF_KEYWORDS = [
    "layoff", "laid off", "layoffs", "rif", "restructuring",
    "downsizing", "reduction in force", "let go", "workforce reduction",
    "job cuts", "mass layoff",
]
# Keywords indicating genuine expansion
EXPANSION_KEYWORDS = [
    "expansion", "expanding", "new office", "growing team",
    "scaling", "new market", "launch", "opened", "new location",
]
# Keywords indicating funding/investment
FUNDING_KEYWORDS = [
    "funding", "raised", "series a", "series b", "series c",
    "seed round", "investment", "ipo", "valuation", "venture",
    "capital raise", "million", "billion",
]


async def fetch_unlocker_signals(
    query: str,
    company: Optional[str] = None,
    **kwargs,
) -> Optional[WebUnlockerSignals]:
    """
    Fetch company sentiment signals from Glassdoor (via Google) and news.

    Makes two parallel requests:
    1. Google search for the company's Glassdoor reviews — checks freeze/layoff keywords
    2. Google News for the company — checks expansion/funding keywords

    Why Google search for Glassdoor instead of direct Glassdoor URL:
    - Glassdoor direct URLs require the company's internal numeric ID (e.g. E675258)
    - There is no reliable way to derive that ID from a company name
    - Googling "company site:glassdoor.com reviews" returns the correct page
      in the snippets, which is sufficient for keyword analysis

    Args:
        query: Search query context (used if company not specified)
        company: Company name to research

    Returns:
        WebUnlockerSignals with boolean flags and relevant snippets
    """
    api_key = os.getenv("BRIGHT_DATA_API_KEY")
    zone = os.getenv("BRIGHT_DATA_SERP_ZONE", "serp")  # Use SERP for Google search

    if not api_key:
        logger.error("BRIGHT_DATA_API_KEY not set")
        return None

    search_target = company or query

    # Run Glassdoor and news fetches in parallel
    glassdoor_content, news_content = await asyncio.gather(
        _fetch_glassdoor_via_google(search_target, api_key, zone),
        _fetch_news_via_google(search_target, api_key, zone),
    )

    signals = _analyse_signals(glassdoor_content, news_content)

    logger.info(
        f"Web Unlocker: freeze={signals.glassdoor_mentions_freeze}, "
        f"layoffs={signals.glassdoor_mentions_layoffs}, "
        f"expansion={signals.has_expansion_news}, "
        f"funding={signals.has_funding_news} "
        f"for: '{search_target}'"
    )

    return signals


async def _fetch_glassdoor_via_google(
    company: str,
    api_key: str,
    zone: str,
) -> Optional[str]:
    """
    Search Google for the company's Glassdoor reviews via SERP API.

    Returns Google search results page as markdown. The snippets shown
    by Google for Glassdoor results often contain review excerpts including
    phrases like "hiring freeze", "layoffs", "great company" etc.
    """
    encoded_query = quote_plus(f"{company} site:glassdoor.com reviews")
    search_url = f"https://www.google.com/search?q={encoded_query}&hl=en"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    payload = {
        "zone": zone,
        "url": search_url,
        "format": "json",
        "brd_json": True,
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(UNLOCKER_API_URL, json=payload, headers=headers)
            response.raise_for_status()
            try:
                data = response.json()
                # Extract snippets from organic results
                organic = data.get("organic", [])
                if isinstance(organic, list):
                    snippets = " ".join(
                        item.get("description", item.get("snippet", ""))
                        for item in organic[:5]
                    )
                    return snippets
                return str(data)
            except Exception:
                return response.text
    except Exception as e:
        logger.warning(f"Glassdoor Google search failed for '{company}': {e}")
        return None


async def _fetch_news_via_google(
    company: str,
    api_key: str,
    zone: str,
) -> Optional[str]:
    """
    Search Google News for recent company expansion or funding news via SERP API.
    """
    encoded_query = quote_plus(f"{company} hiring expansion funding 2024 2025")
    search_url = f"https://www.google.com/search?q={encoded_query}&tbm=nws&hl=en"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    payload = {
        "zone": zone,
        "url": search_url,
        "format": "json",
        "brd_json": True,
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(UNLOCKER_API_URL, json=payload, headers=headers)
            response.raise_for_status()
            try:
                data = response.json()
                organic = data.get("organic", data.get("news", []))
                if isinstance(organic, list):
                    snippets = " ".join(
                        item.get("description", item.get("snippet", ""))
                        for item in organic[:5]
                    )
                    return snippets
                return str(data)
            except Exception:
                return response.text
    except Exception as e:
        logger.warning(f"News Google search failed for '{company}': {e}")
        return None


def _analyse_signals(
    glassdoor_content: Optional[str],
    news_content: Optional[str],
) -> WebUnlockerSignals:
    """
    Keyword-scan the fetched content for ghost job indicators.

    Args:
        glassdoor_content: Text from Glassdoor Google search snippets
        news_content: Text from Google News search snippets

    Returns:
        WebUnlockerSignals with boolean flags and relevant snippets
    """
    mentions_freeze = False
    mentions_layoffs = False
    review_snippets: list[str] = []
    has_expansion_news = False
    has_funding_news = False
    news_snippets: list[str] = []

    if glassdoor_content:
        content_lower = glassdoor_content.lower()
        for kw in FREEZE_KEYWORDS:
            if kw in content_lower:
                mentions_freeze = True
                idx = content_lower.index(kw)
                snippet = glassdoor_content[max(0, idx - 80): idx + 100].strip()
                review_snippets.append(snippet)
                break
        for kw in LAYOFF_KEYWORDS:
            if kw in content_lower:
                mentions_layoffs = True
                idx = content_lower.index(kw)
                snippet = glassdoor_content[max(0, idx - 80): idx + 100].strip()
                review_snippets.append(snippet)
                break

    if news_content:
        content_lower = news_content.lower()
        for kw in EXPANSION_KEYWORDS:
            if kw in content_lower:
                has_expansion_news = True
                idx = content_lower.index(kw)
                snippet = news_content[max(0, idx - 80): idx + 100].strip()
                news_snippets.append(snippet)
                break
        for kw in FUNDING_KEYWORDS:
            if kw in content_lower:
                has_funding_news = True
                idx = content_lower.index(kw)
                snippet = news_content[max(0, idx - 80): idx + 100].strip()
                news_snippets.append(snippet)
                break

    return WebUnlockerSignals(
        glassdoor_mentions_freeze=mentions_freeze,
        glassdoor_mentions_layoffs=mentions_layoffs,
        glassdoor_review_snippets=review_snippets if review_snippets else None,
        recent_news=news_snippets if news_snippets else None,
        has_expansion_news=has_expansion_news,
        has_funding_news=has_funding_news,
        source="Web Unlocker",
    )
