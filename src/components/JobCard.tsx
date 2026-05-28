"use client";

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
  /** 'history' = compact preview (default). 'result' = detailed with summary + hover tint. */
  variant?: "history" | "result";
}

/**
 * JobCard — Displays a single scored job posting.
 *
 * Updated for the Verity light-theme design system.
 */
export default function JobCard(
  props: JobCardProps & { salary?: string; onClick?: () => void }
) {
  const {
    job_title,
    company,
    location,
    score,
    verdict,
    confidence,
    sources_checked,
    index,
    salary,
    onClick,
    variant = "history",
  } = props;

  const isResult = variant === "result";

  const verdictClass =
    verdict === "Real"
      ? "bg-[#e6f7f0] text-[#009966]"
      : verdict === "Suspicious"
        ? "bg-[#fef3c7] text-[#d97706]"
        : "bg-[#fee2e2] text-[#dc2626]";

  return (
    <div
      id={`job-card-${index}`}
      onClick={onClick}
      className={`bg-white border border-[#e6f4f0] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] transition-all duration-150 animate-fade-in-up flex flex-col justify-between
        ${isResult ? "p-6 hover:bg-[#f0fdf4] hover:border-emerald-100 hover:shadow-[0_8px_30px_rgba(0,153,102,0.06)]" : "p-5 hover:shadow-[0_8px_30px_rgba(0,153,102,0.03)] hover:border-emerald-100"}
        ${onClick ? "cursor-pointer" : ""}
      `}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div>
        {/* Verdict Badge */}
        <div className="flex justify-between items-start mb-3">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${verdictClass}`}
          >
            {verdict}
          </span>
        </div>

        {/* ScoreRing and stats info */}
        <div className="flex items-center gap-3.5 mb-3">
          <ScoreRing score={score} size={36} strokeWidth={4} showText={false} />
          
          <div className="flex gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-medium leading-none mb-1">
                Confidence
              </span>
              <span
                className={`text-xs font-bold leading-none ${
                  confidence === "High"
                    ? "text-[#009966]"
                    : confidence === "Medium"
                      ? "text-[#d97706]"
                      : "text-[#dc2626]"
                }`}
              >
                {confidence}
              </span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-medium leading-none mb-1">
                Source
              </span>
              <span className="text-xs font-bold text-[#161513] leading-none">
                {sources_checked}/4
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-[#e6f4f0] my-3 w-full" />

        {/* Job Details */}
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-[#161513] mb-1.5 leading-snug truncate">
            {job_title}
          </h3>
          
          <p className="text-xs text-slate-500 font-medium mb-1.5 truncate">
            {company} · {location}
          </p>

          {salary && (
            <p className="text-xs text-slate-400 font-medium mb-2.5">
              {salary}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
