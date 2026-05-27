"use client";

import { useState } from "react";
import ScoreRing from "./ScoreRing";

interface Signal {
  signal: string;
  value: string;
  source: string;
  weight: string;
  direction: string;
  points: number;
}

interface JobCardProps {
  job_title: string;
  company: string;
  location: string;
  url: string;
  score: number;
  verdict: "Real" | "Suspicious" | "Ghost";
  confidence: "High" | "Medium" | "Low";
  signals: Signal[];
  summary: string;
  sources_checked: number;
  index: number;
}

/**
 * JobCard — Displays a single scored job posting.
 *
 * Features:
 * - Score ring with colour-coded verdict
 * - Verdict badge (Real/Suspicious/Ghost)
 * - Expandable signal breakdown with source tags
 * - Plain-English reasoning paragraph
 * - Confidence indicator
 * - Staggered entrance animation
 */
export default function JobCard({
  job_title,
  company,
  location,
  url,
  score,
  verdict,
  confidence,
  signals,
  summary,
  sources_checked,
  index,
}: JobCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const verdictClass =
    verdict === "Real"
      ? "verdict-real"
      : verdict === "Suspicious"
        ? "verdict-suspicious"
        : "verdict-ghost";

  const directionIcon = (direction: string) => {
    if (direction === "Ghost")
      return <span className="text-[var(--color-ghost)]">▼</span>;
    if (direction === "Real")
      return <span className="text-[var(--color-real)]">▲</span>;
    return <span className="text-[var(--text-muted)]">●</span>;
  };

  return (
    <div
      id={`job-card-${index}`}
      className="glass-card p-5 animate-fade-in-up"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className="flex items-start gap-4">
        {/* Score Ring */}
        <div className="flex-shrink-0">
          <ScoreRing score={score} size={72} />
        </div>

        {/* Job Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-base font-semibold text-[var(--text-primary)] truncate">
              {job_title}
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${verdictClass}`}
            >
              {verdict}
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] mb-2">
            <span className="flex items-center gap-1">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              {company}
            </span>
            <span className="flex items-center gap-1">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {location}
            </span>
          </div>

          {/* Summary */}
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-3">
            {summary}
          </p>

          {/* Confidence & Sources */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-[var(--text-muted)]">
              Confidence:{" "}
              <span
                className={`font-medium ${
                  confidence === "High"
                    ? "text-[var(--color-real)]"
                    : confidence === "Medium"
                      ? "text-[var(--color-suspicious)]"
                      : "text-[var(--color-ghost)]"
                }`}
              >
                {confidence}
              </span>
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {sources_checked}/4 sources
            </span>
            {confidence === "Low" && (
              <span className="text-xs text-[var(--color-ghost)] flex items-center gap-1">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z" />
                </svg>
                Limited data
              </span>
            )}
          </div>

          {/* Expand/Collapse Signals */}
          <button
            id={`toggle-signals-${index}`}
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-xs text-[var(--accent-secondary)] hover:text-[var(--accent-primary)] transition-colors duration-200"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {isExpanded ? "Hide" : "Show"} signal breakdown ({signals.length}{" "}
            signals)
          </button>

          {/* Signal Breakdown (expandable) */}
          {isExpanded && (
            <div className="mt-3 space-y-2 animate-fade-in">
              {signals.map((signal, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 px-3 bg-[var(--bg-secondary)] rounded-lg text-xs"
                >
                  <div className="flex items-center gap-2">
                    {directionIcon(signal.direction)}
                    <span className="font-medium text-[var(--text-primary)]">
                      {signal.signal}
                    </span>
                    <span className="text-[var(--text-secondary)]">
                      {signal.value}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-[var(--bg-elevated)] rounded text-[var(--text-muted)] font-mono text-[10px]">
                      {signal.source}
                    </span>
                    <span
                      className={`font-semibold ${
                        signal.direction === "Ghost"
                          ? "text-[var(--color-ghost)]"
                          : "text-[var(--color-real)]"
                      }`}
                    >
                      {signal.points > 0 ? `+${signal.points}pts` : "0pts"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* View Original Link */}
      {url && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--accent-secondary)] hover:text-[var(--accent-primary)] transition-colors duration-200 flex items-center gap-1"
          >
            View original posting
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}
