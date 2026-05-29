"use client";

import { useEffect, useState } from "react";
import type { AgentStep } from "@/lib/types";

interface LoadingAgentProps {
  events: AgentStep[];
}

const AGENT_META: Record<string, { icon: string; label: string; color: string }> = {
  serp: {
    icon: "🔍",
    label: "SERP Discovery",
    color: "var(--accent-primary)",
  },
  indeed: {
    icon: "📋",
    label: "Indeed Signals",
    color: "#818cf8",
  },
  linkedin: {
    icon: "💼",
    label: "LinkedIn Growth",
    color: "#60a5fa",
  },
  unlocker: {
    icon: "🔓",
    label: "Glassdoor & News",
    color: "#c084fc",
  },
  scoring: {
    icon: "⚡",
    label: "Score Engine",
    color: "var(--accent-secondary)",
  },
};

/**
 * LoadingAgent — Live agent activity log during scanning.
 *
 * This is NOT a spinner. It's a real-time display of which
 * data sources are being queried, processed, and completed.
 * This is a key UX moment for the demo — makes the pipeline
 * feel active and intentional.
 *
 * Features:
 * - 4 agent status indicators (SERP, Indeed, LinkedIn, Unlocker)
 * - Status transitions: Querying → Processing → Complete / Failed
 * - Live message log with timestamps
 * - Animated progress indicators per agent
 * - Scanning line animation across the panel
 */
export default function LoadingAgent({ events }: LoadingAgentProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer to show elapsed seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white border border-[#e6f4f0] rounded-xl px-5 py-4">
        {events.length === 0 ? (
          /* Initial state before first event arrives */
          <div className="flex items-center gap-3 py-0.5">
            {/* 8-spoke radial spinner */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              className="animate-spin shrink-0"
            >
              <g stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="4.22" y1="4.22" x2="7.05" y2="7.05" />
                <line x1="16.95" y1="16.95" x2="19.78" y2="19.78" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
                <line x1="4.22" y1="19.78" x2="7.05" y2="16.95" />
                <line x1="16.95" y1="7.05" x2="19.78" y2="4.22" />
              </g>
            </svg>
            <span className="text-sm text-slate-500">
              Initializing agent pipeline...
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event, i) => {
              const isComplete = event.status === "complete";
              const isFailed = event.status === "failed";

              return (
                <div
                  key={i}
                  className="flex items-center gap-3"
                >
                  {isComplete ? (
                    /* Solid green filled circle with white checkmark */
                    <div className="shrink-0 w-[18px] h-[18px] rounded-full bg-[#009966] flex items-center justify-center">
                      <svg
                        width="9"
                        height="9"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  ) : isFailed ? (
                    /* Red filled circle with white × for failures */
                    <div className="shrink-0 w-[18px] h-[18px] rounded-full bg-[#dc2626] flex items-center justify-center">
                      <svg
                        width="9"
                        height="9"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </div>
                  ) : (
                    /* 8-spoke radial spinner for active / querying / processing */
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      className="animate-spin shrink-0"
                    >
                      <g stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="12" y1="2" x2="12" y2="6" />
                        <line x1="12" y1="18" x2="12" y2="22" />
                        <line x1="4.22" y1="4.22" x2="7.05" y2="7.05" />
                        <line x1="16.95" y1="16.95" x2="19.78" y2="19.78" />
                        <line x1="2" y1="12" x2="6" y2="12" />
                        <line x1="18" y1="12" x2="22" y2="12" />
                        <line x1="4.22" y1="19.78" x2="7.05" y2="16.95" />
                        <line x1="16.95" y1="7.05" x2="19.78" y2="4.22" />
                      </g>
                    </svg>
                  )}

                  <span
                    className={`text-sm leading-snug ${
                      isComplete
                        ? "font-bold text-[#009966]"
                        : isFailed
                          ? "text-[#dc2626]"
                          : "text-slate-600 font-normal"
                    }`}
                  >
                    {event.message}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
