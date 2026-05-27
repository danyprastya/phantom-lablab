"""
Phantom — SERP API Tool (Job Discovery)

Uses Bright Data SERP API to discover job postings from a plain English query.
This is the DISCOVERY tool — it finds jobs the user never had to search for.

Input: search query string (e.g., "software engineer fintech remote")
Output: list of SERPResult objects with job URLs, titles, and snippets

Bright Data SERP API docs: https://docs.brightdata.com/scraping-automation/serp-api
"""

import os
import logging
import httpx
from urllib.parse import quote_plus
from typing import Optional

from models.schemas import SERPResult

logger = logging.getLogger(__name__)

# Bright Data SERP API endpoint
SERP_API_URL = "https://api.brightdata.com/request"


async def fetch_serp_results(
    query: str,
    max_results: int = 10,
    **kwargs,
) -> list[SERPResult]:
    """
    Discover job postings via Bright Data SERP API.

    Constructs a targeted Google search query to find job listings
    across major job boards, then returns structured results.

    Args:
        query: Plain English job search query (e.g., "software engineer fintech remote")
        max_results: Maximum number of results to return (default 10)

    Returns:
        List of SERPResult objects containing title, URL, and snippet for each job found.
        Returns empty list if the API call fails.
    """
    api_key = os.getenv("BRIGHT_DATA_API_KEY")
    zone = os.getenv("BRIGHT_DATA_SERP_ZONE", "serp")

    if not api_key:
        logger.error("BRIGHT_DATA_API_KEY not set")
        return []

    # Build a search query targeting job boards.
    # URL-encode with quote_plus so spaces → "+" and special chars are escaped.
    # Bright Data's API validates the URL and rejects raw spaces.
    search_query = f"{query} jobs hiring now"
    encoded_query = quote_plus(search_query)
    search_url = (
        f"https://www.google.com/search"
        f"?q={encoded_query}"
        f"&num={max_results}"
        f"&hl=en"
    )

    payload = {
        "zone": zone,
        "url": search_url,
        "format": "json",   # Required by Bright Data Web Access API
        "brd_json": True,   # Return parsed SERP JSON (Google organic results)
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                SERP_API_URL,
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        results = []
        # Parse organic search results from the SERP response
        organic = data.get("organic", data.get("results", []))
        if isinstance(organic, list):
            for item in organic[:max_results]:
                result = SERPResult(
                    title=item.get("title", ""),
                    url=item.get("link", item.get("url", "")),
                    snippet=item.get("description", item.get("snippet", "")),
                    source="SERP API",
                )
                if result.url:  # Only include results with valid URLs
                    results.append(result)

        logger.info(f"SERP API returned {len(results)} results for query: {query}")
        return results

    except httpx.HTTPStatusError as e:
        logger.error(f"SERP API HTTP error: {e.response.status_code} - {e.response.text}")
        return []
    except httpx.RequestError as e:
        logger.error(f"SERP API request error: {e}")
        return []
    except Exception as e:
        logger.error(f"SERP API unexpected error: {e}")
        return []


async def extract_job_info_from_serp(results: list[SERPResult]) -> list[dict]:
    """
    Extract structured job information from raw SERP results.

    Parses titles and snippets to identify company names, locations,
    and job titles from the search results.

    Args:
        results: List of raw SERPResult objects from fetch_serp_results

    Returns:
        List of dicts with keys: job_title, company, location, url
    """
    jobs = []
    for result in results:
        # Extract basic info — the title often contains "Job Title - Company - Location"
        title_parts = result.title.split(" - ")
        job_info = {
            "job_title": title_parts[0].strip() if title_parts else result.title,
            "company": title_parts[1].strip() if len(title_parts) > 1 else "Unknown",
            "location": title_parts[2].strip() if len(title_parts) > 2 else "Not specified",
            "url": result.url,
            "snippet": result.snippet,
        }
        jobs.append(job_info)

    return jobs
