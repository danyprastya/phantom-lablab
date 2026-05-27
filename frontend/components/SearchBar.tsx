"use client";

import { useState, useEffect, useRef } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

const PLACEHOLDER_QUERIES = [
  "software engineer fintech remote",
  "data scientist new york",
  "product manager healthcare berlin",
  "frontend developer web3 san francisco",
  "devops engineer cloud london",
  "machine learning engineer biotech boston",
];

/**
 * SearchBar — Primary search input for Phantom.
 *
 * Features:
 * - Single text field for role + location (plain English)
 * - Animated cycling placeholder text showing example queries
 * - Submit button with loading state
 * - Keyboard submit (Enter key)
 */
export default function SearchBar({ onSearch, isLoading = false }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Animate placeholder text — typing effect
  useEffect(() => {
    const target = PLACEHOLDER_QUERIES[placeholderIndex];
    let charIndex = 0;
    let timeout: NodeJS.Timeout;

    if (isTyping) {
      // Type forward
      const typeForward = () => {
        if (charIndex <= target.length) {
          setDisplayedPlaceholder(target.substring(0, charIndex));
          charIndex++;
          timeout = setTimeout(typeForward, 50 + Math.random() * 30);
        } else {
          // Pause at end, then start erasing
          timeout = setTimeout(() => setIsTyping(false), 2000);
        }
      };
      typeForward();
    } else {
      // Erase backward
      let eraseIndex = target.length;
      const typeBackward = () => {
        if (eraseIndex >= 0) {
          setDisplayedPlaceholder(target.substring(0, eraseIndex));
          eraseIndex--;
          timeout = setTimeout(typeBackward, 25);
        } else {
          // Move to next placeholder
          setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_QUERIES.length);
          setIsTyping(true);
        }
      };
      typeBackward();
    }

    return () => clearTimeout(timeout);
  }, [placeholderIndex, isTyping]);

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
      <div className="relative group">
        {/* Glow effect behind the input */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--accent-primary)] via-purple-500 to-[var(--accent-secondary)] rounded-2xl opacity-0 group-hover:opacity-20 group-focus-within:opacity-30 blur-lg transition-all duration-500" />

        <div className="relative flex items-center bg-[var(--bg-card)] border border-[var(--border-medium)] rounded-2xl overflow-hidden transition-all duration-300 group-focus-within:border-[var(--accent-primary)] group-focus-within:shadow-[0_0_30px_var(--accent-glow)]">
          {/* Search icon */}
          <div className="pl-5 pr-2 text-[var(--text-muted)]">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>

          <input
            ref={inputRef}
            id="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={displayedPlaceholder}
            disabled={isLoading}
            className="flex-1 py-4 px-2 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] text-base outline-none disabled:opacity-50 font-[var(--font-sans)]"
            autoComplete="off"
            spellCheck={false}
          />

          <button
            type="submit"
            id="search-button"
            disabled={isLoading || query.trim().length < 3}
            className="mr-2 px-6 py-2.5 bg-[var(--accent-primary)] hover:bg-[#6b4ce6] text-white font-medium rounded-xl transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_20px_var(--accent-glow)] active:scale-95 text-sm"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="opacity-25"
                  />
                  <path
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    className="opacity-75"
                  />
                </svg>
                Scanning
              </span>
            ) : (
              "Scan Jobs"
            )}
          </button>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
        Enter a job role and location — Phantom will find and verify postings across 4 data sources
      </p>
    </form>
  );
}
