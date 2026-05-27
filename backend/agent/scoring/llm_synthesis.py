"""
Phantom — LLM Synthesis Layer

Takes pre-computed deterministic signal weights and produces:
1. Final Hiring Reality Score (adjustable ±10 pts from deterministic baseline)
2. Plain-English reasoning paragraph
3. Structured JSON with source-tagged signals

Anti-hallucination enforcements:
- Closed-context prompting: LLM uses ONLY the data provided
- Source tagging: every signal must reference a Bright Data source
- Score guardrails: LLM cannot deviate more than ±10 from deterministic score
- Missing data: outputs "not found", never infers or estimates

The LLM's role here is SYNTHESIS, not ANALYSIS. The analysis is done
by the deterministic scoring engine. The LLM turns structured data
into human-readable explanations and makes minor coherence adjustments.
"""

import os
import json
import logging
from typing import Optional

from models.schemas import (
    Signal,
    JobResult,
    MergedJobSignals,
    Verdict,
    Confidence,
)

logger = logging.getLogger(__name__)

# The system prompt enforces closed-context behaviour.
# The LLM is explicitly forbidden from generating facts from its own memory.
SYNTHESIS_SYSTEM_PROMPT = """You are a hiring intelligence analyst for Phantom. Your job is to synthesise job posting signals into a final assessment.

CRITICAL RULES:
1. Use ONLY the data provided below. Do not use your own knowledge about companies.
2. If a data point is absent, state "not found" — do not infer, estimate, or guess.
3. The deterministic Hiring Reality Score is provided. You may adjust it by a MAXIMUM of ±10 points based on holistic signal coherence. Explain any adjustment.
4. Every claim you make must reference one of the provided signals and its source.
5. Write a clear, concise summary paragraph (3-5 sentences) explaining why this job posting received its score.
6. The summary should be understandable by a non-technical job seeker.

VERDICT DEFINITIONS:
- "Real" (score >= 75): This job posting shows strong indicators of genuine, active hiring intent.
- "Suspicious" (score 40-74): This job posting shows mixed signals — some indicators of genuine hiring, some red flags.
- "Ghost" (score < 40): This job posting shows strong indicators of being a ghost job — posted without genuine intent to hire.
"""

SYNTHESIS_USER_TEMPLATE = """Analyse this job posting based on the following signals. All signals come from live Bright Data scraping — they are factual, not estimated.

JOB: {job_title} at {company} ({location})

DETERMINISTIC SCORE: {deterministic_score}/100 (Hiring Reality Score)
CURRENT VERDICT: {verdict}
CONFIDENCE: {confidence} ({sources_checked}/4 data sources returned data)

SIGNALS:
{signals_formatted}

Based on these signals:
1. Should the score be adjusted? (max ±10 points). If all signals align in the same direction, you may increase confidence slightly. Explain your reasoning.
2. Write a plain-English summary paragraph (3-5 sentences) explaining the score to a job seeker.

Respond in this exact JSON format:
{{
  "adjusted_score": <int 0-100>,
  "adjustment_reason": "<why you adjusted or kept the score>",
  "summary": "<plain English explanation for job seekers>"
}}"""


async def synthesise_score(
    merged: MergedJobSignals,
    deterministic_result: dict,
) -> JobResult:
    """
    Use LLM to synthesise deterministic signals into a final scored result.

    The LLM receives pre-computed signal weights and produces:
    - Final adjusted score (±10 from deterministic baseline)
    - Plain-English summary paragraph
    - Verdict confirmation or adjustment

    Args:
        merged: All merged signals from the 4 Bright Data sources
        deterministic_result: Output from deterministic.compute_deterministic_score()

    Returns:
        JobResult with final score, verdict, signals, and summary
    """
    det_score = deterministic_result["hiring_reality_score"]
    signals = deterministic_result["signals"]
    verdict = deterministic_result["verdict"]
    confidence = deterministic_result["confidence"]
    sources_checked = deterministic_result["sources_checked"]

    # Format signals for the LLM prompt
    signals_formatted = _format_signals_for_prompt(signals)

    # Build the prompt
    user_prompt = SYNTHESIS_USER_TEMPLATE.format(
        job_title=merged.job_title,
        company=merged.company,
        location=merged.location,
        deterministic_score=det_score,
        verdict=verdict.value,
        confidence=confidence.value,
        sources_checked=sources_checked,
        signals_formatted=signals_formatted,
    )

    # Call the LLM
    llm_response = await _call_llm(user_prompt)

    if llm_response:
        # Parse LLM response and enforce guardrails
        adjusted_score = llm_response.get("adjusted_score", det_score)
        summary = llm_response.get("summary", "")

        # Enforce ±10 guardrail — LLM cannot override deterministic scoring
        if abs(adjusted_score - det_score) > 10:
            logger.warning(
                f"LLM tried to adjust score by {adjusted_score - det_score} pts "
                f"(max ±10). Clamping."
            )
            adjusted_score = max(
                det_score - 10,
                min(det_score + 10, adjusted_score)
            )

        # Clamp to valid range
        adjusted_score = max(0, min(100, adjusted_score))

        # Re-determine verdict based on adjusted score
        if adjusted_score >= 75:
            final_verdict = Verdict.REAL
        elif adjusted_score >= 40:
            final_verdict = Verdict.SUSPICIOUS
        else:
            final_verdict = Verdict.GHOST
    else:
        # LLM call failed — use deterministic results as-is
        adjusted_score = det_score
        final_verdict = verdict
        summary = _generate_fallback_summary(merged, det_score, verdict, signals)

    return JobResult(
        job_title=merged.job_title,
        company=merged.company,
        location=merged.location,
        url=merged.url,
        score=adjusted_score,
        verdict=final_verdict,
        confidence=confidence,
        signals=signals,
        summary=summary,
        sources_checked=sources_checked,
    )


async def _call_llm(user_prompt: str) -> Optional[dict]:
    """
    Call the LLM API (Google Gemini) with the synthesis prompt.

    Uses closed-context system prompt to prevent hallucination.
    Reads GOOGLE_API_KEY from environment.

    Returns:
        Parsed JSON dict from LLM response, or None if call fails.
    """
    api_key = os.getenv("GOOGLE_API_KEY")

    if not api_key:
        logger.warning("GOOGLE_API_KEY not set — using fallback scoring")
        return None

    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import SystemMessage, HumanMessage

        llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",  # Fast, free-tier compatible
            temperature=0.1,           # Low temperature for consistent scoring
            google_api_key=api_key,
            max_output_tokens=500,
        )

        messages = [
            SystemMessage(content=SYNTHESIS_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ]

        response = await llm.ainvoke(messages)
        content = response.content

        # Parse JSON from LLM response
        # Handle cases where LLM wraps JSON in markdown code blocks
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        return json.loads(content.strip())

    except json.JSONDecodeError as e:
        logger.error(f"LLM returned invalid JSON: {e}")
        return None
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        return None


def _format_signals_for_prompt(signals: list[Signal]) -> str:
    """
    Format signal objects into a readable string for the LLM prompt.
    Each signal includes its source for traceability.
    """
    if not signals:
        return "No signals available."

    lines = []
    for s in signals:
        lines.append(
            f"- {s.signal}: {s.value} "
            f"[Source: {s.source}] "
            f"[Weight: {s.weight.value}] "
            f"[Direction: {s.direction.value}] "
            f"[Points: {s.points}]"
        )
    return "\n".join(lines)


def _generate_fallback_summary(
    merged: MergedJobSignals,
    score: int,
    verdict: Verdict,
    signals: list[Signal],
) -> str:
    """
    Generate a plain-English summary without LLM (fallback).
    Used when the LLM API is unavailable or returns an error.
    """
    ghost_signals = [s for s in signals if s.direction.value == "Ghost"]
    real_signals = [s for s in signals if s.direction.value == "Real"]

    parts = [
        f"This {merged.job_title} position at {merged.company} received a "
        f"Hiring Reality Score of {score}/100, classified as \"{verdict.value}\"."
    ]

    if ghost_signals:
        ghost_descriptions = [f"{s.signal} ({s.value})" for s in ghost_signals]
        parts.append(
            f"Warning signals include: {', '.join(ghost_descriptions)}."
        )

    if real_signals:
        real_descriptions = [f"{s.signal} ({s.value})" for s in real_signals]
        parts.append(
            f"Positive indicators include: {', '.join(real_descriptions)}."
        )

    sources_count = merged.sources_with_data
    if sources_count < 3:
        parts.append(
            f"Note: Only {sources_count} of 4 data sources returned data, "
            f"so confidence in this assessment is limited."
        )

    return " ".join(parts)
