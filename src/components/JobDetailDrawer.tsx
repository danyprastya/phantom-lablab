"use client";

import { useState, useEffect } from "react";
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
 * JobDetailDrawer — Slides in from the right when clicking a JobCard.
 *
 * Fully custom and animated using CSS transitions. Matches design exactly.
 */
export default function JobDetailDrawer({
  isOpen,
  onClose,
  job,
}: JobDetailDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [signalsExpanded, setSignalsExpanded] = useState(true);

  // Synchronize dynamic mount and animation cycles for transitions
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 250); // Exits in 250ms
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
            {/* Tag Badge */}
            <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-slate-500">
              Job Detailed
            </span>

            {/* X Close Icon */}
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
              {/* Inline горизонтальные детали компании */}
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

            {/* View Job Post Green Button */}
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
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
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

          {/* AI Insight section */}
          {job.summary && (
            <div className="bg-[#F0FDF4] border border-[#d1fae5] rounded-xl p-4.5 text-left">
              <div className="flex items-center gap-1.5 text-[#009966] font-bold text-sm mb-2.5">
                {/* Sparkle Icon */}
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
              {/* Section Header with Chevron Toggle */}
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
                  signalsExpanded ? "max-h-[500px]" : "max-h-0"
                }`}
              >
                <div className="divide-y divide-slate-100">
                  {job.signals.map((signal, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between px-4 py-3 text-xs ${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                      }`}
                    >
                      {/* Left: Direction + Name */}
                      <div className="flex items-center gap-2 w-1/3 min-w-0">
                        <span className="shrink-0">{directionIcon(signal.direction)}</span>
                        <span className="font-semibold text-slate-800 truncate">
                          {signal.signal}
                        </span>
                      </div>

                      {/* Center: Value */}
                      <span className="text-slate-600 font-medium w-1/4 text-center">
                        {signal.value}
                      </span>

                      {/* Right-aligned Source */}
                      <span className="text-slate-400 font-medium text-right w-1/4 truncate">
                        {signal.source}
                      </span>

                      {/* Far right Badge */}
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
          )}
        </div>
      </div>
    </div>
  );
}
