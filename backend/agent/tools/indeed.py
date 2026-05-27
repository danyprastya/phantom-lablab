"""
Phantom — Indeed Signals Tool (via Web Unlocker)

Scrapes Indeed job search results in real-time using Bright Data Web Unlocker.
Parses posting age ("X days ago"), repost signals, and job metadata from
the page content returned as markdown.

Web Unlocker is used here instead of the Datasets API because:
- Datasets/v3/trigger is a BATCH async API — it queues jobs and you poll for results.
  That's incompatible with real-time streaming responses.
- Web Unlocker is SYNCHRONOUS — it returns the page content immediately.
  This is what we need for a live demo under 15 seconds.

Input: search query + optional company name
Output: IndeedSignals with posting_age_days, repost_count, date_posted
"""

import os
import re
import logging
import httpx
from urllib.parse import quote_plus
from typing import Optional

from models.schemas import IndeedSignals

logger = logging.getLogger(__name__)

UNLOCKER_API_URL = "https://api.brightdata.com/request"


async def fetch_indeed_signals(
    query: str,
    company: Optional[str] = None,
    **kwargs,
) -> Optional[IndeedSignals]:
    """
    Scrape Indeed job search results via Bright Data Web Unlocker.

    Searches Indeed for the query and parses the first matching result
    for posting age and repost signals. These are the two highest-weight
    signals in the deterministic scoring (30 + 25 = 55 pts).

    Args:
        query: Job search query (e.g., "software engineer fintech remote")
        company: Optional company name — used to build a narrower search

    Returns:
        IndeedSignals with parsed data, or None if the request fails.
    """
    api_key = os.getenv("BRIGHT_DATA_API_KEY")
    zone = os.getenv("BRIGHT_DATA_WEB_UNLOCKER_ZONE", "web_unlocker")

    if not api_key:
        logger.error("BRIGHT_DATA_API_KEY not set")
        return None

    # Build the Indeed search URL — URL-encode to avoid invalid URI errors
    search_terms = f"{query} {company}" if company else query
    encoded_terms = quote_plus(search_terms)
    # sort=date ensures freshest results appear first — important for age signals
    indeed_url = f"https://www.indeed.com/jobs?q={encoded_terms}&sort=date&limit=10"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    payload = {
        "zone": zone,
        "url": indeed_url,
        "format": "json",          # Required by Bright Data
        "data_format": "markdown", # Return page as markdown for parsing
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                UNLOCKER_API_URL,
                json=payload,
                headers=headers,
            )
            response.raise_for_status()

            # Response may be JSON wrapper or raw text
            try:
                data = response.json()
                content = data.get("content", data.get("text", str(data)))
            except Exception:
                content = response.text

        signals = _parse_indeed_markdown(content, company)

        if signals:
            logger.info(
                f"Indeed Scraper: posting_age={signals.posting_age_days}d, "
                f"reposts={signals.repost_count} for: '{search_terms}'"
            )
        else:
            logger.warning(f"Indeed Scraper: no parseable signals for '{search_terms}'")

        return signals

    except httpx.HTTPStatusError as e:
        logger.error(
            f"Indeed Scraper HTTP error: {e.response.status_code} — {e.response.text[:300]}"
        )
        return None
    except httpx.RequestError as e:
        logger.error(f"Indeed Scraper request error: {e}")
        return None
    except Exception as e:
        logger.error(f"Indeed Scraper unexpected error: {e}")
        return None


def _parse_indeed_markdown(content: str, company: Optional[str] = None) -> Optional[IndeedSignals]:
    """
    Parse Indeed search result page (markdown format) for ghost job signals.

    Extracts:
    - Posting age from "X days ago", "Today", "Just posted", "30+ days ago" text
    - Repost indicator from "Reposted" label
    - Company name from job listing context

    Args:
        content: Page content as markdown string
        company: Optional company name to help match relevant job listing

    Returns:
        IndeedSignals or None if no parseable data found
    """
    if not content or len(content) < 50:
        return None

    content_lower = content.lower()

    # ─── Posting Age ─────────────────────────────────────────────
    posting_age_days: Optional[int] = None

    # "30+ days ago" → treat as 31 days (ghost territory)
    if "30+ days ago" in content_lower or "30+ days" in content_lower:
        posting_age_days = 31

    # "X days ago" — match numbers 1-30
    if posting_age_days is None:
        days_match = re.search(r"(\d+)\s+day[s]?\s+ago", content_lower)
        if days_match:
            posting_age_days = int(days_match.group(1))

    # "Today" or "Just posted" → 0 days
    if posting_age_days is None:
        if "today" in content_lower or "just posted" in content_lower or "hours ago" in content_lower:
            posting_age_days = 0

    # ─── Repost Count ────────────────────────────────────────────
    repost_count = 0
    if "reposted" in content_lower:
        # Count how many times "reposted" appears as a label
        repost_count = content_lower.count("reposted")

    # ─── Company Name ────────────────────────────────────────────
    # Try to find the company name in context if provided
    found_company: Optional[str] = company

    return IndeedSignals(
        posting_age_days=posting_age_days,
        repost_count=repost_count,
        date_posted=None,  # Raw date not reliably parseable from markdown
        company_name=found_company,
        source="Indeed Scraper",
    )
