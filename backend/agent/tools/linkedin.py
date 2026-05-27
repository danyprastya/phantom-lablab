"""
Phantom — LinkedIn Signals Tool (via Web Unlocker)

Scrapes LinkedIn company pages in real-time using Bright Data Web Unlocker
to extract headcount and growth signals.

Same rationale as indeed.py — uses Web Unlocker (synchronous/real-time)
rather than the Datasets batch API, which is async and incompatible with
live streaming responses.

Input: company name
Output: LinkedInSignals with headcount and headcount_delta_pct
"""

import os
import re
import logging
import httpx
from urllib.parse import quote_plus
from typing import Optional

from models.schemas import LinkedInSignals

logger = logging.getLogger(__name__)

UNLOCKER_API_URL = "https://api.brightdata.com/request"


async def fetch_linkedin_signals(
    query: str,
    company: Optional[str] = None,
    **kwargs,
) -> Optional[LinkedInSignals]:
    """
    Scrape LinkedIn company page via Bright Data Web Unlocker.

    Retrieves the company's LinkedIn profile page and parses
    the employee count. Headcount delta is inferred from context
    clues (growth mentions) when a second data point isn't available.

    Args:
        query: Job search query (used if company not specified)
        company: Company name — used to build the LinkedIn search URL

    Returns:
        LinkedInSignals with headcount data, or None if the request fails.
    """
    api_key = os.getenv("BRIGHT_DATA_API_KEY")
    zone = os.getenv("BRIGHT_DATA_WEB_UNLOCKER_ZONE", "web_unlocker")

    if not api_key:
        logger.error("BRIGHT_DATA_API_KEY not set")
        return None

    search_target = company or query

    # Use LinkedIn's people search to find the company, then get its page.
    # Searching via LinkedIn search is more reliable than guessing the slug.
    encoded_company = quote_plus(search_target)
    linkedin_url = f"https://www.linkedin.com/company/{_slugify(search_target)}/about/"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    payload = {
        "zone": zone,
        "url": linkedin_url,
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

            try:
                data = response.json()
                content = data.get("content", data.get("text", str(data)))
            except Exception:
                content = response.text

        signals = _parse_linkedin_markdown(content, search_target)

        if signals:
            logger.info(
                f"LinkedIn Scraper: headcount={signals.headcount}, "
                f"delta={signals.headcount_delta_pct}% for: '{search_target}'"
            )
        else:
            logger.warning(f"LinkedIn Scraper: no parseable signals for '{search_target}'")

        return signals

    except httpx.HTTPStatusError as e:
        logger.error(
            f"LinkedIn Scraper HTTP error: {e.response.status_code} — {e.response.text[:300]}"
        )
        return None
    except httpx.RequestError as e:
        logger.error(f"LinkedIn Scraper request error: {e}")
        return None
    except Exception as e:
        logger.error(f"LinkedIn Scraper unexpected error: {e}")
        return None


def _parse_linkedin_markdown(content: str, company: str) -> Optional[LinkedInSignals]:
    """
    Parse LinkedIn company page markdown for headcount signals.

    LinkedIn shows employee count as "X,XXX employees" or "X followers • X employees"
    on company About pages. Growth clues ("growing", "hiring") are used to estimate
    headcount_delta_pct when exact delta data is unavailable.

    Args:
        content: Page content as markdown string
        company: Company name for context

    Returns:
        LinkedInSignals or None if no headcount data found
    """
    if not content or len(content) < 50:
        return None

    content_lower = content.lower()
    headcount: Optional[int] = None
    headcount_delta_pct: Optional[float] = None

    # Match "X employees", "X,XXX employees", "X followers • X employees"
    # LinkedIn formats: "1,234 employees", "10,001+ employees", "51-200 employees"
    patterns = [
        r"([\d,]+)\s+employee",        # "1,234 employees"
        r"([\d,]+)\+?\s+employee",     # "10,001+ employees"
        r"(\d+)\s*-\s*(\d+)\s+employee",  # "51-200 employees" (range — take midpoint)
    ]

    for pattern in patterns:
        match = re.search(pattern, content_lower)
        if match:
            if len(match.groups()) == 2:
                # Range like "51-200" — take midpoint
                low = int(match.group(1).replace(",", ""))
                high = int(match.group(2).replace(",", ""))
                headcount = (low + high) // 2
            else:
                headcount = int(match.group(1).replace(",", ""))
            break

    # ─── Infer headcount delta from text signals ─────────────────
    # We can't get exact delta without two data points over time,
    # but we can use strong text signals as directional indicators.
    if headcount is not None:
        if any(kw in content_lower for kw in ["actively hiring", "growing fast", "rapid growth", "we're growing"]):
            headcount_delta_pct = 8.0  # Positive growth signal
        elif any(kw in content_lower for kw in ["layoff", "downsizing", "restructuring", "freeze"]):
            headcount_delta_pct = -5.0  # Contraction signal
        else:
            # No strong directional signal — treat as flat (most conservative for scoring)
            headcount_delta_pct = None

    if headcount is None:
        return None

    return LinkedInSignals(
        headcount=headcount,
        headcount_delta_pct=headcount_delta_pct,
        recent_posts=None,
        source="LinkedIn Scraper",
    )


def _slugify(company_name: str) -> str:
    """
    Convert company name to a LinkedIn URL slug.

    LinkedIn slugs are lowercase, hyphen-separated, no special chars.
    Examples:
        "Stripe" → "stripe"
        "Goldman Sachs" → "goldman-sachs"
        "JPMorgan Chase & Co." → "jpmorgan-chase-co"
    """
    slug = company_name.lower().strip()
    slug = re.sub(r"[&]+", "", slug)
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")
