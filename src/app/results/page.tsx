"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import SearchBar from "@/components/SearchBar";
import LoadingAgent from "@/components/LoadingAgent";
import JobCard from "@/components/JobCard";
import JobDetailDrawer from "@/components/JobDetailDrawer";

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

interface AgentStep {
  agent_name: string;
  status: "querying" | "processing" | "complete" | "failed";
  message: string;
  timestamp: Date;
}

/**
 * Results Page — Displays scan results with streaming updates.
 *
 * Connects to the backend via SSE (through the Next.js API route proxy)
 * and displays:
 * 1. LoadingAgent panel during scanning
 * 2. JobCards as they arrive, ranked by score
 * 3. Final sorted results
 */
function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";

  const [isScanning, setIsScanning] = useState(false);
  const [agentEvents, setAgentEvents] = useState<AgentStep[]>([]);
  const [jobResults, setJobResults] = useState<JobResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanComplete, setScanComplete] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobResult | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const startScan = useCallback(
    async (searchQuery: string) => {
      setIsScanning(true);
      setAgentEvents([]);
      setJobResults([]);
      setError(null);
      setScanComplete(false);

      try {
        // Connect to SSE stream via Next.js API proxy
        const response = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            errData.error || `Scan failed with status ${response.status}`
          );
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response stream available");
        }

        // SSE spec: events are separated by double newlines (\n\n).
        // Network chunks can arrive mid-line so we must buffer until \n\n.
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Split on double-newline to extract complete SSE events
          const eventBlocks = buffer.split("\n\n");
          buffer = eventBlocks.pop() ?? ""; // keep last incomplete chunk

          for (const block of eventBlocks) {
            if (!block.trim()) continue;
            // Find the data: field line inside this event block
            const dataLine = block
              .split("\n")
              .find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            const jsonStr = dataLine.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;
            try {
              const eventData = JSON.parse(jsonStr);
              handleStreamEvent(eventData);
            } catch {
              if (process.env.NODE_ENV === "development") {
                console.warn("Malformed SSE data:", jsonStr.slice(0, 100));
              }
            }
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred";
        setError(message);
      } finally {
        setIsScanning(false);
        setScanComplete(true);
      }
    },
    []
  );

  const handleStreamEvent = (event: {
    event_type: string;
    agent_name?: string;
    status?: string;
    message?: string;
    data?: Record<string, unknown>;
  }) => {
    switch (event.event_type) {
      case "agent_status":
        setAgentEvents((prev) => [
          ...prev,
          {
            agent_name: event.agent_name || "unknown",
            status: (event.status as AgentStep["status"]) || "querying",
            message: event.message || "",
            timestamp: new Date(),
          },
        ]);
        break;

      case "job_result":
        if (event.data) {
          setJobResults((prev) => {
            const updated = [...prev, event.data as unknown as JobResult];
            // Keep sorted by score (highest first)
            updated.sort((a, b) => b.score - a.score);
            return updated;
          });
        }
        break;

      case "scan_complete":
        setScanComplete(true);
        setIsScanning(false);
        // If complete event has full sorted data, use it
        if (event.data && (event.data as { jobs?: JobResult[] }).jobs) {
          const jobs = (event.data as { jobs: JobResult[] }).jobs;
          setJobResults(jobs);
        }
        break;

      case "error":
        setError(event.message || "An error occurred during scanning");
        setIsScanning(false);
        break;
    }
  };

  // Auto-start scan when page loads with a query
  useEffect(() => {
    if (query && !isScanning && !scanComplete) {
      startScan(query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleNewSearch = (newQuery: string) => {
    router.push(`/results?q=${encodeURIComponent(newQuery)}`);
  };

  // Count verdicts for summary stats
  const realCount = jobResults.filter((j) => j.verdict === "Real").length;
  const suspiciousCount = jobResults.filter(
    (j) => j.verdict === "Suspicious"
  ).length;
  const ghostCount = jobResults.filter((j) => j.verdict === "Ghost").length;

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] relative">
      {/* Background */}
      <div className="fixed inset-0 bg-grid opacity-50 pointer-events-none" />
      <div className="fixed inset-0 bg-radial-glow pointer-events-none" />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-6">
            <button
              onClick={() => router.push("/")}
              className="text-xl font-bold bg-gradient-to-r from-white to-[var(--accent-secondary)] bg-clip-text text-transparent hover:opacity-80 transition-opacity"
            >
              Phantom
            </button>
            <div className="flex-1">
              <SearchBar onSearch={handleNewSearch} isLoading={isScanning} />
            </div>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Query Info */}
          {query && (
            <div className="mb-6 animate-fade-in">
              <h1 className="text-sm text-[var(--text-muted)]">
                Results for{" "}
                <span className="text-[var(--text-primary)] font-medium">
                  &ldquo;{query}&rdquo;
                </span>
              </h1>
            </div>
          )}

          {/* Loading State */}
          {isScanning && (
            <div className="mb-8">
              <LoadingAgent events={agentEvents} />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="glass-card p-6 mb-8 border-[var(--color-ghost)]/20 animate-fade-in">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-ghost)] mb-1">
                    Scan Error
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {error}
                  </p>
                  <button
                    onClick={() => query && startScan(query)}
                    className="mt-3 px-4 py-1.5 bg-[var(--accent-primary)] hover:bg-[#6b4ce6] text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Retry Scan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Results Summary Bar */}
          {jobResults.length > 0 && (
            <div className="flex items-center gap-4 mb-6 animate-fade-in">
              <span className="text-sm text-[var(--text-secondary)]">
                {jobResults.length} jobs analysed
              </span>
              <div className="flex items-center gap-3">
                {realCount > 0 && (
                  <span className="flex items-center gap-1.5 text-xs verdict-real px-2 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-real)]" />
                    {realCount} Real
                  </span>
                )}
                {suspiciousCount > 0 && (
                  <span className="flex items-center gap-1.5 text-xs verdict-suspicious px-2 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-suspicious)]" />
                    {suspiciousCount} Suspicious
                  </span>
                )}
                {ghostCount > 0 && (
                  <span className="flex items-center gap-1.5 text-xs verdict-ghost px-2 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ghost)]" />
                    {ghostCount} Ghost
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Job Cards */}
          {jobResults.length > 0 && (
            <div className="space-y-4 stagger-children">
              {jobResults.map((job, index) => (
                <JobCard
                  key={`${job.company}-${job.job_title}-${index}`}
                  {...job}
                  index={index}
                  onClick={() => {
                    setSelectedJob(job);
                    setIsDrawerOpen(true);
                  }}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {scanComplete && jobResults.length === 0 && !error && (
            <div className="text-center py-16 animate-fade-in">
              <span className="text-4xl mb-4 block">👻</span>
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                No results found
              </h3>
              <p className="text-sm text-[var(--text-muted)]">
                Try a different search query — for example, &ldquo;software
                engineer fintech remote&rdquo;
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Job Detail Drawer overlay */}
      <JobDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        job={selectedJob}
      />
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] loading-dot" />
            <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] loading-dot" />
            <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] loading-dot" />
          </div>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
