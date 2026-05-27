"""
Phantom — Sub-Agent Tool Registry

Central registry for all Bright Data sub-agent tools.
Adding a new data source requires adding one entry here and
creating the corresponding tool module.

Each tool module exposes an async function with the signature:
    async def fetch(query: str, **kwargs) -> SomeSignalModel
"""

from agent.tools.serp import fetch_serp_results
from agent.tools.indeed import fetch_indeed_signals
from agent.tools.linkedin import fetch_linkedin_signals
from agent.tools.unlocker import fetch_unlocker_signals

# Registry: maps agent names to their fetch functions.
# Used by the orchestrator to dispatch all sub-agents in parallel.
TOOL_REGISTRY = {
    "serp": {
        "name": "SERP API",
        "description": "Discovers job postings via Google search results",
        "fetch": fetch_serp_results,
    },
    "indeed": {
        "name": "Indeed Scraper",
        "description": "Extracts posting age, repost history, and dates from Indeed",
        "fetch": fetch_indeed_signals,
    },
    "linkedin": {
        "name": "LinkedIn Scraper",
        "description": "Extracts headcount, growth trajectory from LinkedIn company pages",
        "fetch": fetch_linkedin_signals,
    },
    "unlocker": {
        "name": "Web Unlocker",
        "description": "Accesses Glassdoor reviews and company news articles",
        "fetch": fetch_unlocker_signals,
    },
}


def get_all_tools() -> dict:
    """Return the full tool registry."""
    return TOOL_REGISTRY


def get_tool(name: str) -> dict:
    """Get a specific tool by name. Raises KeyError if not found."""
    return TOOL_REGISTRY[name]
