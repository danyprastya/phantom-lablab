/**
 * LLM Synthesis — Groq-powered score synthesis and explanation generation.
 *
 * Takes the deterministic score and signal breakdown, sends them to Groq with
 * a closed-context prompt, and receives back an adjusted score (±10 max) and a
 * plain-English summary. Falls back to a template-based summary if the LLM call
 * fails or GROQ_API_KEY is not set.
 *
 * @module scoring/synthesis
 */
import Groq from "groq-sdk";
import { getEnv } from "@/lib/config/env";
import { SYNTHESIS_SYSTEM_PROMPT, buildSynthesisPrompt } from "@/lib/data";
import type { MergedJobSignals, JobResult, Signal, Verdict, Confidence, DeterministicScoreResult } from "@/lib/types";

let _llmClient: Groq | null = null;

function createLLMClient(): Groq | null {
  const env = getEnv();
  if (!env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: env.GROQ_API_KEY });
}

function getLLMClient() {
  if (!_llmClient) _llmClient = createLLMClient();
  return _llmClient;
}

export async function synthesiseScore(
  merged: MergedJobSignals,
  det: DeterministicScoreResult
): Promise<JobResult> {
  const detScore = det.hiring_reality_score;
  const signals = det.signals;
  const verdict = det.verdict;
  const confidence = det.confidence;
  const sourcesChecked = det.sources_checked;

  const signalsFormatted = formatSignalsForPrompt(signals);

  const userPrompt = buildSynthesisPrompt({
    job_title: merged.job_title,
    company: merged.company,
    location: merged.location,
    deterministic_score: detScore,
    verdict,
    confidence,
    sources_checked: sourcesChecked,
    signals_formatted: signalsFormatted,
  });

  const llmResponse = await callLLM(userPrompt);

  if (llmResponse) {
    let adjustedScore = llmResponse.adjusted_score ?? detScore;
    const summary = llmResponse.summary ?? "";

    if (Math.abs(adjustedScore - detScore) > 10) {
      console.warn(`LLM tried to adjust score by ${adjustedScore - detScore} pts (max ±10). Clamping.`);
      adjustedScore = Math.max(detScore - 10, Math.min(detScore + 10, adjustedScore));
    }

    adjustedScore = Math.max(0, Math.min(100, adjustedScore));

    let finalVerdict: Verdict;
    if (adjustedScore >= 75) finalVerdict = "Real";
    else if (adjustedScore >= 40) finalVerdict = "Suspicious";
    else finalVerdict = "Ghost";

    return {
      job_title: merged.job_title,
      company: merged.company,
      location: merged.location,
      url: merged.url,
      score: adjustedScore,
      verdict: finalVerdict,
      confidence,
      signals,
      summary,
      sources_checked: sourcesChecked,
    };
  }

  const fallbackSummary = generateFallbackSummary(merged, detScore, verdict, signals);
  return {
    job_title: merged.job_title,
    company: merged.company,
    location: merged.location,
    url: merged.url,
    score: detScore,
    verdict,
    confidence,
    signals,
    summary: fallbackSummary,
    sources_checked: sourcesChecked,
  };
}

async function callLLM(userPrompt: string): Promise<{
  adjusted_score?: number;
  adjustment_reason?: string;
  summary?: string;
} | null> {
  const groq = getLLMClient();
  if (!groq) {
    console.warn("GROQ_API_KEY not set — using fallback scoring");
    return null;
  }

  const env = getEnv();

  try {
    const result = await groq.chat.completions.create({
      model: env.LLM_MODEL || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const text = result.choices[0]?.message?.content || "";
    let jsonStr = text.trim();

    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.split("```json")[1].split("```")[0].trim();
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.split("```")[1].split("```")[0].trim();
    }

    return JSON.parse(jsonStr);
  } catch (err) {
    console.error(`LLM call failed: ${err}`);
    return null;
  }
}

function formatSignalsForPrompt(signals: Signal[]): string {
  if (signals.length === 0) return "No signals available.";

  return signals
    .map(
      (s) =>
        `- ${s.signal}: ${s.value} [Source: ${s.source}] [Weight: ${s.weight}] [Direction: ${s.direction}] [Points: ${s.points}]`
    )
    .join("\n");
}

function generateFallbackSummary(
  merged: MergedJobSignals,
  score: number,
  verdict: Verdict,
  signals: Signal[]
): string {
  const ghostSignals = signals.filter((s) => s.direction === "Ghost");
  const realSignals = signals.filter((s) => s.direction === "Real");

  const parts: string[] = [
    `This ${merged.job_title} position at ${merged.company} received a Hiring Reality Score of ${score}/100, classified as "${verdict}".`,
  ];

  if (ghostSignals.length > 0) {
    parts.push(`Warning signals include: ${ghostSignals.map((s) => `${s.signal} (${s.value})`).join(", ")}.`);
  }

  if (realSignals.length > 0) {
    parts.push(`Positive indicators include: ${realSignals.map((s) => `${s.signal} (${s.value})`).join(", ")}.`);
  }

  let sourcesCount = 0;
  if (merged.serp) sourcesCount++;
  if (merged.indeed && (merged.indeed.posting_age_days != null || merged.indeed.repost_count != null)) sourcesCount++;
  if (merged.linkedin && merged.linkedin.headcount_delta_pct != null) sourcesCount++;
  if (merged.web_unlocker && (
    merged.web_unlocker.glassdoor_mentions_freeze ||
    merged.web_unlocker.glassdoor_mentions_layoffs ||
    merged.web_unlocker.has_expansion_news ||
    merged.web_unlocker.has_funding_news ||
    (merged.web_unlocker.recent_news && merged.web_unlocker.recent_news.length > 0) ||
    (merged.web_unlocker.glassdoor_review_snippets && merged.web_unlocker.glassdoor_review_snippets.length > 0)
  )) sourcesCount++;

  if (sourcesCount < 3) {
    parts.push(`Note: Only ${sourcesCount} of 4 data sources returned data, so confidence in this assessment is limited.`);
  }

  return parts.join(" ");
}
