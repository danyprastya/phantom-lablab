"""
Phantom — FastAPI Backend Entry Point

Exposes the Phantom agent pipeline as an HTTP API with:
- POST /api/scan — Main endpoint, returns Server-Sent Events (SSE)
- Rate limiting: 5 requests per IP per minute
- CORS configured for frontend domain only
- Input validation and sanitisation

The backend is designed to be independently deployable (Railway)
and proxied through the Next.js API route so the backend URL
is never exposed to the client.
"""

import os
import re
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

from models.schemas import ScanRequest, StreamEvent
from agent.orchestrator import run_scan, clear_cache

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ─── Rate Limiting ───────────────────────────────────────────────
# Maximum 5 requests per IP per minute to prevent abuse of
# Bright Data credits during demo.
limiter = Limiter(key_func=get_remote_address)


# ─── App Lifecycle ───────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info("Phantom backend starting up")
    yield
    logger.info("Phantom backend shutting down")
    clear_cache()


# ─── FastAPI App ─────────────────────────────────────────────────
app = FastAPI(
    title="Phantom API",
    description="Hiring intelligence agent — discovers and scores job postings",
    version="1.0.0",
    lifespan=lifespan,
)

# Attach rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── CORS Configuration ─────────────────────────────────────────
# Only allow requests from the frontend domain.
# This prevents external sites from calling the API and burning credits.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


# ─── Input Sanitisation ─────────────────────────────────────────
def sanitise_query(query: str) -> str:
    """
    Sanitise user input before passing to any Bright Data tool.

    Removes potentially dangerous characters while preserving
    legitimate job search queries like "software engineer fintech remote".
    """
    # Remove any HTML/script tags
    query = re.sub(r"<[^>]+>", "", query)
    # Remove special characters that could be injection vectors
    # Keep letters, numbers, spaces, hyphens, and common punctuation
    query = re.sub(r"[^\w\s\-.,/()&+]", "", query)
    # Collapse multiple spaces
    query = re.sub(r"\s+", " ", query).strip()
    return query


# ─── Endpoints ───────────────────────────────────────────────────

@app.post("/api/scan")
@limiter.limit("5/minute")
async def scan_jobs(request: Request, scan_request: ScanRequest):
    """
    Main endpoint — scans for jobs and returns a streaming response.

    The response is a Server-Sent Events (SSE) stream that sends:
    1. Agent status updates (which sub-agents are running)
    2. Individual job results as they're scored
    3. A final scan_complete event with the full sorted results

    This streaming approach makes the 15-second pipeline feel
    active and intentional rather than frozen.
    """
    # Sanitise the query
    clean_query = sanitise_query(scan_request.query)
    if len(clean_query) < 3:
        return JSONResponse(
            status_code=400,
            content={"error": "Query too short. Please enter a job role and location."},
        )

    scan_request.query = clean_query
    logger.info(f"Scan request received: '{clean_query}'")

    async def event_generator():
        """Generate SSE events from the scan pipeline."""
        try:
            async for event in run_scan(scan_request):
                yield {
                    "event": event.event_type,
                    "data": json.dumps(event.model_dump(), default=str),
                }
        except Exception as e:
            logger.error(f"Scan pipeline error: {e}")
            error_event = StreamEvent(
                event_type="error",
                message=f"An error occurred during the scan: {str(e)}",
            )
            yield {
                "event": "error",
                "data": json.dumps(error_event.model_dump(), default=str),
            }

    return EventSourceResponse(event_generator())


@app.get("/health")
async def health_check():
    """Health check endpoint for deployment monitoring."""
    return {"status": "healthy", "service": "phantom-backend"}


@app.get("/")
async def root():
    """Root endpoint — basic API info."""
    return {
        "name": "Phantom API",
        "version": "1.0.0",
        "description": "Hiring intelligence agent",
        "docs": "/docs",
    }


# ─── Main ────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,  # Hot reload during development
        log_level="info",
    )
