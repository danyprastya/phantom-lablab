import {
  POSTING_AGE_MAX_POINTS,
  REPOST_COUNT_MAX_POINTS,
  HEADCOUNT_DELTA_MAX_POINTS,
  RECENT_NEWS_MAX_POINTS,
  GLASSDOOR_MAX_POINTS,
  POSTING_AGE_GHOST_THRESHOLD_DAYS,
  POSTING_AGE_WARN_THRESHOLD_DAYS,
  REPOST_GHOST_THRESHOLD,
} from "../../data/index.js";
import type {
  MergedJobSignals,
  Signal,
  SignalDirection,
  Verdict,
  Confidence,
  DeterministicScoreResult,
} from "../../types/index.js";
import { sourcesWithData } from "../../types/index.js";

export function computeDeterministicScore(merged: MergedJobSignals): DeterministicScoreResult {
  let ghostScore = 0;
  const signals: Signal[] = [];

  const [postingPoints, postingSignal] = scorePostingAge(merged);
  ghostScore += postingPoints;
  if (postingSignal) signals.push(postingSignal);

  const [repostPoints, repostSignal] = scoreRepostCount(merged);
  ghostScore += repostPoints;
  if (repostSignal) signals.push(repostSignal);

  const [headcountPoints, headcountSignal] = scoreHeadcountDelta(merged);
  ghostScore += headcountPoints;
  if (headcountSignal) signals.push(headcountSignal);

  const [newsPoints, newsSignal] = scoreRecentNews(merged);
  ghostScore += newsPoints;
  if (newsSignal) signals.push(newsSignal);

  const [glassdoorPoints, glassdoorSignal] = scoreGlassdoor(merged);
  ghostScore += glassdoorPoints;
  if (glassdoorSignal) signals.push(glassdoorSignal);

  ghostScore = Math.min(ghostScore, 100);
  const hiringRealityScore = 100 - ghostScore;

  const verdict = determineVerdict(hiringRealityScore);
  const checked = sourcesWithData(merged);
  const confidence = determineConfidence(checked);

  console.log(
    `Deterministic: ${merged.job_title} @ ${merged.company}: ` +
    `ghost=${ghostScore}, reality=${hiringRealityScore}, ` +
    `verdict=${verdict}, confidence=${confidence}, sources=${checked}/4`
  );

  return {
    ghost_score: ghostScore,
    hiring_reality_score: hiringRealityScore,
    signals,
    verdict,
    confidence,
    sources_checked: checked,
  };
}

// ─── Individual Signal Scoring ────────────────────────────────────

function scorePostingAge(merged: MergedJobSignals): [number, Signal | null] {
  if (!merged.indeed || merged.indeed.posting_age_days == null) return [0, null];

  const age = merged.indeed.posting_age_days;
  let points: number;
  let direction: SignalDirection;

  if (age > POSTING_AGE_GHOST_THRESHOLD_DAYS) {
    points = POSTING_AGE_MAX_POINTS;
    direction = "Ghost";
  } else if (age > POSTING_AGE_WARN_THRESHOLD_DAYS) {
    const ratio = (age - POSTING_AGE_WARN_THRESHOLD_DAYS) / (POSTING_AGE_GHOST_THRESHOLD_DAYS - POSTING_AGE_WARN_THRESHOLD_DAYS);
    points = Math.floor(10 + ratio * 20);
    direction = "Ghost";
  } else {
    points = 0;
    direction = "Real";
  }

  return [points, { signal: "Posting age", value: `${age} days`, source: "Indeed Scraper", weight: "High", direction, points }];
}

function scoreRepostCount(merged: MergedJobSignals): [number, Signal | null] {
  if (!merged.indeed || merged.indeed.repost_count == null) return [0, null];

  const reposts = merged.indeed.repost_count;
  let points: number;
  let direction: SignalDirection;

  if (reposts >= REPOST_GHOST_THRESHOLD) {
    points = REPOST_COUNT_MAX_POINTS;
    direction = "Ghost";
  } else if (reposts === 1) {
    points = 10;
    direction = "Ghost";
  } else {
    points = 0;
    direction = "Real";
  }

  return [points, { signal: "Repost count", value: `${reposts} times`, source: "Indeed Scraper", weight: "High", direction, points }];
}

function scoreHeadcountDelta(merged: MergedJobSignals): [number, Signal | null] {
  if (!merged.linkedin || merged.linkedin.headcount_delta_pct == null) return [0, null];

  const delta = merged.linkedin.headcount_delta_pct;
  let points: number;
  let direction: SignalDirection;

  if (delta <= 0) {
    points = HEADCOUNT_DELTA_MAX_POINTS;
    direction = "Ghost";
  } else if (delta < 5.0) {
    points = 10;
    direction = "Ghost";
  } else {
    points = 0;
    direction = "Real";
  }

  return [points, { signal: "Headcount delta", value: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% over 90 days`, source: "LinkedIn Scraper", weight: "Medium", direction, points }];
}

function scoreRecentNews(merged: MergedJobSignals): [number, Signal | null] {
  if (!merged.web_unlocker) return [0, null];

  const hasPositiveNews = merged.web_unlocker.has_expansion_news || merged.web_unlocker.has_funding_news;

  if (hasPositiveNews) {
    return [0, { signal: "Recent news", value: "Expansion/funding news found", source: "SERP API + Web Unlocker", weight: "Low", direction: "Real", points: 0 }];
  }

  return [RECENT_NEWS_MAX_POINTS, { signal: "Recent news", value: "No expansion or funding news", source: "SERP API + Web Unlocker", weight: "Low", direction: "Ghost", points: RECENT_NEWS_MAX_POINTS }];
}

function scoreGlassdoor(merged: MergedJobSignals): [number, Signal | null] {
  if (!merged.web_unlocker) return [0, null];

  const mentionsFreeze = merged.web_unlocker.glassdoor_mentions_freeze;
  const mentionsLayoffs = merged.web_unlocker.glassdoor_mentions_layoffs;

  if (mentionsFreeze && mentionsLayoffs) {
    return [GLASSDOOR_MAX_POINTS, { signal: "Glassdoor signals", value: "Reviews mention hiring freeze and layoffs", source: "Web Unlocker", weight: "Medium", direction: "Ghost", points: GLASSDOOR_MAX_POINTS }];
  }
  if (mentionsFreeze) {
    return [10, { signal: "Glassdoor signals", value: "Reviews mention hiring freeze", source: "Web Unlocker", weight: "Medium", direction: "Ghost", points: 10 }];
  }
  if (mentionsLayoffs) {
    return [12, { signal: "Glassdoor signals", value: "Reviews mention layoffs", source: "Web Unlocker", weight: "Medium", direction: "Ghost", points: 12 }];
  }

  return [0, { signal: "Glassdoor signals", value: "No freeze or layoff signals", source: "Web Unlocker", weight: "Medium", direction: "Real", points: 0 }];
}

// ─── Verdict & Confidence ─────────────────────────────────────────

function determineVerdict(score: number): Verdict {
  if (score >= 75) return "Real";
  if (score >= 40) return "Suspicious";
  return "Ghost";
}

function determineConfidence(sourcesChecked: number): Confidence {
  if (sourcesChecked >= 3) return "High";
  if (sourcesChecked >= 2) return "Medium";
  return "Low";
}
