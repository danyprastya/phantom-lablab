"use client";

import { useEffect, useState } from "react";

interface AgentStep {
  agent_name: string;
  status: "querying" | "processing" | "complete" | "failed";
  message: string;
  timestamp: Date;
}

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

  // Derive current status per agent from events
  const agentStatuses = Object.keys(AGENT_META).reduce(
    (acc, key) => {
      const latestEvent = [...events]
        .reverse()
        .find((e) => e.agent_name === key);
      acc[key] = latestEvent?.status || "idle";
      return acc;
    },
    {} as Record<string, string>
  );

  const statusIcon = (status: string) => {
    switch (status) {
      case "querying":
        return (
          <div className="flex gap-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] loading-dot" />
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] loading-dot" />
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] loading-dot" />
          </div>
        );
      case "processing":
        return (
          <svg className="animate-spin h-4 w-4 text-[var(--accent-secondary)]" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
          </svg>
        );
      case "complete":
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-real)" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case "failed":
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-ghost)" strokeWidth="3">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        );
      default:
        return (
          <div className="w-4 h-4 rounded-full border-2 border-[var(--border-medium)]" />
        );
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in-up">
      <div className="glass-card p-6 relative overflow-hidden">
        {/* Scanning line effect */}
        <div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent opacity-40"
          style={{
            animation: "scan-line 2s ease-in-out infinite",
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)] tracking-wide uppercase">
              Agent Pipeline Active
            </h3>
          </div>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            {elapsedTime}s elapsed
          </span>
        </div>

        {/* Agent Status Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {Object.entries(AGENT_META)
            .filter(([key]) => key !== "scoring")
            .map(([key, meta]) => (
              <div
                key={key}
                className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all duration-300 ${
                  agentStatuses[key] === "querying" || agentStatuses[key] === "processing"
                    ? "bg-[var(--accent-glow)] border border-[var(--border-accent)]"
                    : agentStatuses[key] === "complete"
                      ? "bg-[var(--color-real-bg)] border border-transparent"
                      : agentStatuses[key] === "failed"
                        ? "bg-[var(--color-ghost-bg)] border border-transparent"
                        : "bg-[var(--bg-secondary)] border border-transparent"
                }`}
              >
                <span className="text-lg">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                    {meta.label}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] capitalize">
                    {agentStatuses[key] || "Waiting"}
                  </p>
                </div>
                {statusIcon(agentStatuses[key])}
              </div>
            ))}
        </div>

        {/* Live Log */}
        <div className="bg-[var(--bg-secondary)] rounded-xl p-3 max-h-48 overflow-y-auto">
          <div className="space-y-1.5">
            {events.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] italic">
                Initializing agent pipeline...
              </p>
            )}
            {events.slice(-8).map((event, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs animate-slide-in-right"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <span className="text-[var(--text-muted)] font-mono shrink-0 mt-px">
                  {event.timestamp.toLocaleTimeString("en-US", {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span
                  className={`${
                    event.status === "complete"
                      ? "text-[var(--color-real)]"
                      : event.status === "failed"
                        ? "text-[var(--color-ghost)]"
                        : "text-[var(--text-secondary)]"
                  }`}
                >
                  {event.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
