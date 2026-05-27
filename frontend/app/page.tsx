"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";

/**
 * Phantom — Landing/Search Page
 *
 * Hero page with product tagline and search input.
 * On submit, navigates to /results with the query as a search param.
 */
export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = useCallback(
    (query: string) => {
      setIsLoading(true);
      // Navigate to results page with query
      router.push(`/results?q=${encodeURIComponent(query)}`);
    },
    [router]
  );

  return (
    <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid" />
      <div className="absolute inset-0 bg-radial-glow" />

      {/* Floating orbs for depth */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[var(--accent-primary)] rounded-full opacity-[0.03] blur-[100px] animate-float" />
      <div
        className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-purple-500 rounded-full opacity-[0.03] blur-[120px] animate-float"
        style={{ animationDelay: "1.5s" }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-3xl mx-auto px-6 text-center">
        {/* Logo / Brand */}
        <div className="mb-8 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--accent-glow)] border border-[var(--border-accent)] mb-6">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
            <span className="text-xs font-medium text-[var(--accent-secondary)] tracking-wider uppercase">
              Hiring Intelligence Agent
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-white via-[var(--text-primary)] to-[var(--accent-secondary)] bg-clip-text text-transparent">
              Phantom
            </span>
          </h1>

          <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
            Discover real jobs. Expose ghost postings.
            <br />
            <span className="text-[var(--text-muted)]">
              Phantom searches, verifies, and scores job listings across 4 live
              data sources — so you never waste time on fake postings.
            </span>
          </p>
        </div>

        {/* Search Bar */}
        <div
          className="animate-fade-in-up"
          style={{ animationDelay: "0.15s" }}
        >
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />
        </div>

        {/* Feature Pills */}
        <div
          className="mt-12 flex flex-wrap justify-center gap-3 animate-fade-in-up"
          style={{ animationDelay: "0.3s" }}
        >
          {[
            { icon: "🔍", label: "4-Source Verification" },
            { icon: "⚡", label: "Real-Time Scoring" },
            { icon: "🛡️", label: "Anti-Hallucination" },
            { icon: "📊", label: "Cited Sources" },
          ].map((feature) => (
            <div
              key={feature.label}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)]"
            >
              <span>{feature.icon}</span>
              <span>{feature.label}</span>
            </div>
          ))}
        </div>

        {/* How it works — mini explainer */}
        <div
          className="mt-16 animate-fade-in-up"
          style={{ animationDelay: "0.45s" }}
        >
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-4">
            How it works
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {[
              "You type a job query",
              "→",
              "Phantom searches 4 live sources",
              "→",
              "AI scores each posting",
              "→",
              "Ghost jobs exposed",
            ].map((step, i) =>
              step === "→" ? (
                <span
                  key={i}
                  className="text-[var(--accent-primary)] text-sm hidden sm:inline"
                >
                  →
                </span>
              ) : (
                <span
                  key={i}
                  className="text-xs text-[var(--text-secondary)] px-3 py-1.5 bg-[var(--bg-secondary)] rounded-lg"
                >
                  {step}
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 mt-auto pb-6 text-center">
        <p className="text-xs text-[var(--text-muted)]">
          Built with{" "}
          <span className="text-[var(--accent-secondary)]">Bright Data</span> ·
          Powered by live web intelligence
        </p>
      </footer>
    </main>
  );
}
