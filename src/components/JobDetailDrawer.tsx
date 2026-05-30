"use client";

import { useState, useEffect, useMemo } from "react";
import ScoreRing from "./ScoreRing";

interface Signal {
  signal: string;
  value: string;
  source: string;
  weight: string;
  direction: string;
  points: number;
}

interface JobResult {
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
}

interface JobDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobResult | null;
}

/**
 * Extracts company profile info from the signals array.
 * Each signal carries direction, value, and source — we group them
 * into headcount, glassdoor, and news categories for the profile panel.
 */
function extractCompanyProfile(signals: Signal[]) {
  const headcountSig = signals.find((s) => s.signal.toLowerCase().includes("headcount"));
  const glassdoorSig = signals.find((s) => s.signal.toLowerCase().includes("glassdoor"));
  const newsSig = signals.find((s) => s.signal.toLowerCase().includes("news"));
  const postingAgeSig = signals.find((s) => s.signal.toLowerCase().includes("posting age"));

  const growthDirection = headcountSig?.direction ?? "Neutral";
  const glassdoorSentiment = glassdoorSig?.direction ?? "Neutral";
  const newsPositive = newsSig?.direction === "Real";
  const postingFresh = postingAgeSig?.direction === "Real";

  const overallHealth =
    glassdoorSentiment === "Ghost" && growthDirection === "Ghost" ? "declining"
    : growthDirection === "Ghost" ? "stagnant"
    : growthDirection === "Real" && newsPositive ? "growing"
    : "mixed";

  return {
    headcountValue: headcountSig?.value ?? "No data",
    headcountDirection: growthDirection,
    glassdoorValue: glassdoorSig?.value ?? "No data",
    glassdoorDirection: glassdoorSentiment,
    newsValue: newsSig?.value ?? "No data",
    newsPositive,
    postingAgeValue: postingAgeSig?.value ?? "No data",
    postingFresh,
    overallHealth,
  };
}

/**
 * JobDetailDrawer — Slides in from the right when clicking a JobCard.
 *
 * Sections:
 *   1. Header (job title, company, location, View Job Post button)
 *   2. Score details (ring + confidence + sources)
 *   3. Company mini-profile (headcount, news, Glassdoor, posting freshness)
 *   4. AI Insight (LLM-generated summary)
 *   5. Signal Breakdown (collapsible list with per-signal bar chart)
 */
export default function JobDetailDrawer({
  isOpen,
  onClose,
  job,
}: JobDetailDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [signalsExpanded, setSignalsExpanded] = useState(true);

  const companyProfile = useMemo(() => {
    if (!job || !job.signals || job.signals.length === 0) return null;
    return extractCompanyProfile(job.signals);
  }, [job]);

  // Bar chart: compute max points across all signals for relative bar widths
  const maxPoints = useMemo(() => {
    if (!job || !job.signals || job.signals.length === 0) return 0;
    return Math.max(...job.signals.map((s) => s.points), 1);
  }, [job]);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!mounted || !job) return null;

  const directionIcon = (direction: string) => {
    if (direction === "Ghost") {
      return (
        <svg
          className="text-red-500 w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      );
    }
    if (direction === "Real") {
      return (
        <svg
          className="text-emerald-500 w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      );
    }
    return <span className="text-slate-400 font-bold">•</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
      {/* Background Overlay Dimmer */}
      <div
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] transition-opacity ease-out duration-300 ${
          visible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer Body Panel */}
      <div
        className={`relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 transition-transform ease-out duration-300 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header container */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex flex-col gap-4 shrink-0">
          <div className="flex items-center justify-between">
            <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-slate-500">
              Job Detailed
            </span>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              aria-label="Close drawer"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Job title row */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-[20px] font-extrabold text-slate-900 leading-snug">
                {job.job_title}
              </h2>
              <div className="flex items-center gap-4 text-xs text-slate-500 font-medium mt-2">
                <span className="flex items-center gap-1">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                  {job.company}
                </span>
                <span className="flex items-center gap-1">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {job.location}
                </span>
              </div>
            </div>

            {job.url && /^https?:\/\//i.test(job.url) && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 bg-[#009966] hover:bg-[#008055] text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <span>View Job Post</span>
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* Scrollable details */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Score details block */}
          <div className="flex items-center gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <ScoreRing score={job.score} size={42} strokeWidth={4.5} showText={false} />
            <div className="flex gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                  Confidence
                </span>
                <span
                  className={`text-sm font-extrabold ${
                    job.confidence === "High"
                      ? "text-[#009966]"
                      : job.confidence === "Medium"
                        ? "text-[#d97706]"
                        : "text-[#dc2626]"
                  }`}
                >
                  {job.confidence}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                  Source
                </span>
                <span className="text-sm font-extrabold text-slate-800">
                  {job.sources_checked}/4
                </span>
              </div>
            </div>
          </div>

          {/* Company Mini-Profile */}
          {companyProfile && (
            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Company Profile
                  </span>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      companyProfile.overallHealth === "growing"
                        ? "bg-[#e6f7f0] text-[#009966]"
                        : companyProfile.overallHealth === "stagnant"
                          ? "bg-[#fef3c7] text-[#d97706]"
                          : companyProfile.overallHealth === "declining"
                            ? "bg-[#fee2e2] text-[#dc2626]"
                            : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {companyProfile.overallHealth}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {/* Headcount row */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#009966" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-700 block">Headcount Trend</span>
                      <span className="text-[10px] text-slate-400">LinkedIn Scraper</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${
                      companyProfile.headcountDirection === "Real" ? "text-[#009966]"
                      : companyProfile.headcountDirection === "Ghost" ? "text-[#dc2626]"
                      : "text-slate-500"
                    }`}>
                      {companyProfile.headcountValue}
                    </span>
                    {directionIcon(companyProfile.headcountDirection)}
                  </div>
                </div>

                {/* Glassdoor row */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#009966" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-700 block">Employee Sentiment</span>
                      <span className="text-[10px] text-slate-400">Glassdoor via Web Unlocker</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${
                      companyProfile.glassdoorDirection === "Real" ? "text-[#009966]"
                      : companyProfile.glassdoorDirection === "Ghost" ? "text-[#dc2626]"
                      : "text-slate-500"
                    }`}>
                      {companyProfile.glassdoorValue}
                    </span>
                    {directionIcon(companyProfile.glassdoorDirection)}
                  </div>
                </div>

                {/* News row */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#009966" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-700 block">Recent News</span>
                      <span className="text-[10px] text-slate-400">SERP API + Web Unlocker</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${
                      companyProfile.newsPositive ? "text-[#009966]" : "text-[#dc2626]"
                    }`}>
                      {companyProfile.newsValue}
                    </span>
                    {directionIcon(companyProfile.newsPositive ? "Real" : "Ghost")}
                  </div>
                </div>

                {/* Posting age row */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#009966" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-700 block">Posting Freshness</span>
                      <span className="text-[10px] text-slate-400">Indeed Scraper</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${
                      companyProfile.postingFresh ? "text-[#009966]" : "text-[#dc2626]"
                    }`}>
                      {companyProfile.postingAgeValue}
                    </span>
                    {directionIcon(companyProfile.postingFresh ? "Real" : "Ghost")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Insight section */}
          {job.summary && (
            <div className="bg-[#F0FDF4] border border-[#d1fae5] rounded-xl p-4.5 text-left">
              <div className="flex items-center gap-1.5 text-[#009966] font-bold text-sm mb-2.5">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="shrink-0"
                >
                  <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />
                </svg>
                <span>AI Insight</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                {job.summary}
              </p>
            </div>
          )}

          {/* Signal Breakdown Section */}
          {job.signals && job.signals.length > 0 && (
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setSignalsExpanded(!signalsExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100 hover:bg-slate-100/50 transition-colors"
              >
                <span className="text-xs font-bold text-slate-800">
                  Signal Breakdown
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className={`text-slate-500 transition-transform duration-200 ${
                    signalsExpanded ? "" : "rotate-180"
                  }`}
                >
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>

              {/* Collapsible List container */}
              <div
                className={`transition-all duration-300 overflow-hidden ${
                  signalsExpanded ? "max-h-[700px]" : "max-h-0"
                }`}
              >
                <div className="p-4 space-y-3">
                  {/* Score Bar Chart */}
                  <div className="space-y-2">
                    {job.signals.map((signal, idx) => {
                      const barWidth = maxPoints > 0 ? (signal.points / maxPoints) * 100 : 0;
                      const barColor =
                        signal.direction === "Ghost" ? "#dc2626"
                        : signal.direction === "Real" ? "#009966"
                        : "#94a3b8";
                      const barBg =
                        signal.direction === "Ghost" ? "#fee2e2"
                        : signal.direction === "Real" ? "#e6f7f0"
                        : "#f1f5f9";

                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="w-24 text-[11px] font-semibold text-slate-700 shrink-0 leading-tight">
                            {signal.signal}
                          </span>
                          <div className="flex-1 flex items-center gap-2">
                            <div className="flex-1 h-5 rounded-full relative overflow-hidden" style={{ backgroundColor: barBg }}>
                              <div
                                className="h-full rounded-full transition-all duration-500 ease-out"
                                style={{
                                  width: `${barWidth}%`,
                                  backgroundColor: barColor,
                                  minWidth: signal.points > 0 ? "4px" : "0px",
                                }}
                              />
                            </div>
                            <span
                              className="text-[10px] font-bold w-10 text-right shrink-0"
                              style={{ color: signal.points > 0 ? barColor : "#94a3b8" }}
                            >
                              {signal.points > 0 ? `+${signal.points}` : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Divider before detail rows */}
                  <div className="h-px bg-slate-100" />

                  {/* Detailed signal rows */}
                  <div className="divide-y divide-slate-100">
                    {job.signals.map((signal, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between py-2.5 text-xs ${
                          idx % 2 === 0 ? "" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2 w-1/3 min-w-0">
                          <span className="shrink-0">{directionIcon(signal.direction)}</span>
                          <span className="font-semibold text-slate-800 truncate">
                            {signal.signal}
                          </span>
                        </div>
                        <span className="text-slate-600 font-medium w-1/4 text-center">
                          {signal.value}
                        </span>
                        <span className="text-slate-400 font-medium text-right w-1/4 truncate">
                          {signal.source}
                        </span>
                        <div className="w-1/6 flex justify-end">
                          <span className="bg-[#e6f7f0] text-[#009966] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                            {signal.points > 0 ? `+${signal.points}` : "Opts"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
