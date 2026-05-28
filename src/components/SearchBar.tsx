"use client";

import { useState, useRef, useEffect } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

/**
 * SearchBar — Primary search input for Verity.
 *
 * Two visual states driven by `isLoading`:
 *   Default  — label + text input + suggestion pills + search button
 *   Scanning — label + 8-spoke spinner + animated "Finding....." text (pills + button hidden)
 *
 * Transitions:
 *   Pills + button:  max-height 0 + opacity 0, 200ms ease-in
 *   Input text:      opacity 0, 150ms
 *   Spinner/Finding: opacity 1, 200ms, delayed 150ms after pills disappear
 *   Card height:     max-height shrinks via the pills container collapse, 250ms ease-in-out
 *   Dots:            animate 1→2→3→4→5→1, 400ms per step while loading
 */
export default function SearchBar({ onSearch, isLoading = false }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [dotCount, setDotCount] = useState(5);
  const inputRef = useRef<HTMLInputElement>(null);

  // Animated dot counter: cycles 1→5 while loading
  useEffect(() => {
    if (!isLoading) {
      setDotCount(5);
      return;
    }
    setDotCount(1);
    const interval = setInterval(() => {
      setDotCount((prev) => (prev >= 5 ? 1 : prev + 1));
    }, 400);
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length >= 3 && !isLoading) {
      onSearch(trimmed);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl mx-auto"
      id="search-form"
    >
      <div className="bg-white border border-[#e6f4f0] rounded-xl overflow-hidden text-left emerald-glow-card">

        {/* ── Top label bar — always visible ── */}
        <div className="bg-[#F0FDF4] border-b border-[#e6f4f0] py-3 px-5">
          <label
            htmlFor="search-input"
            className="text-[11px] text-[#009966] font-bold uppercase tracking-wider block"
          >
            Find your job now
          </label>
        </div>

        {/* ── Input row — switches between text input and Finding state ── */}
        <div className="relative px-5 pt-5 pb-3" style={{ minHeight: "52px" }}>

          {/* Normal text input — fades out when loading */}
          <input
            ref={inputRef}
            id="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {}}
            onBlur={() => {}}
            placeholder="Search your dream job"
            disabled={isLoading}
            className="w-full bg-transparent text-[#161513] placeholder-slate-400 text-lg font-semibold outline-none transition-opacity duration-150"
            style={{ opacity: isLoading ? 0 : 1, pointerEvents: isLoading ? "none" : "auto" }}
            autoComplete="off"
            spellCheck={false}
          />

          {/* Finding row — fades in when loading, overlaid on top of input */}
          <div
            className="absolute inset-x-5 flex items-center gap-3 transition-opacity duration-200"
            style={{
              top: "20px",
              opacity: isLoading ? 1 : 0,
              pointerEvents: isLoading ? "auto" : "none",
              transitionDelay: isLoading ? "150ms" : "0ms",
            }}
          >
            {/* 8-spoke radial spinner */}
            <svg
              width="18"
              height="18"
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
            <span className="text-lg font-semibold text-slate-400">
              Finding{".".repeat(dotCount)}
            </span>
          </div>
        </div>

        {/* ── Suggestions + button — collapse on loading ── */}
        <div
          className="overflow-hidden"
          style={{
            maxHeight: isLoading ? "0px" : "120px",
            opacity: isLoading ? 0 : 1,
            transition: isLoading
              ? "max-height 250ms ease-in, opacity 200ms ease-in"
              : "max-height 250ms ease-out, opacity 250ms ease-out",
          }}
        >
          <div className="flex items-end justify-between gap-4 px-5 pb-5 pt-1">
            <div className="flex-1">
              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-2.5">
                Suggestion
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  "Software Engineer · Remote",
                  "Product Designer · Jakarta",
                  "Data Analyst · Fintech",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      if (!isLoading) setQuery(suggestion);
                    }}
                    className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-[#009966] hover:text-[#009966] rounded-full text-xs text-slate-700 font-semibold transition-all duration-200 cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Search button */}
            <button
              type="submit"
              id="search-button"
              disabled={isLoading || query.trim().length < 3}
              className="shrink-0 w-11 h-11 bg-[#009966] hover:bg-[#008055] text-white flex items-center justify-center rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md cursor-pointer"
              aria-label="Search"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
