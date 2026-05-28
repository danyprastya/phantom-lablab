"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import JobCard from "@/components/JobCard";
import JobDetailDrawer from "@/components/JobDetailDrawer";
import LoadingAgent from "@/components/LoadingAgent";
import { executeScan } from "@/lib/services/scan";

/**
 * Verity — Landing/Search Page
 *
 * Three-state page flow:
 *   State 1 "default"  — Search card + suggestion pills + history cards
 *   State 2 "scanning" — Search card (loading) + live agent log, history hidden
 *   State 3 "results"  — Search card (active) + results section, log hidden
 */

type PageState = "default" | "scanning" | "results";
type Verdict = "Real" | "Suspicious" | "Ghost";

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
  verdict: Verdict;
  confidence: "High" | "Medium" | "Low";
  signals: Signal[];
  summary: string;
  sources_checked: number;
  salary?: string;
}

interface AgentStep {
  agent_name: string;
  status: "querying" | "processing" | "complete" | "failed";
  message: string;
  timestamp: Date;
}

// Static history shown in default state
const historyJobs: JobResult[] = [
  {
    job_title: "Senior Frontend Engineer",
    company: "GoTo Group",
    location: "Jakarta, Indonesia",
    url: "",
    score: 75,
    verdict: "Real",
    confidence: "High",
    signals: [],
    summary: "",
    sources_checked: 3,
    salary: "Rp8.000.000 - 15.000.000",
  },
  {
    job_title: "Senior Frontend Engineer",
    company: "GoTo Group",
    location: "Jakarta, Indonesia",
    url: "",
    score: 75,
    verdict: "Real",
    confidence: "High",
    signals: [],
    summary: "",
    sources_checked: 3,
    salary: "Rp8.000.000 - 15.000.000",
  },
  {
    job_title: "Senior Frontend Engineer",
    company: "GoTo Group",
    location: "Jakarta, Indonesia",
    url: "",
    score: 75,
    verdict: "Real",
    confidence: "High",
    signals: [],
    summary: "",
    sources_checked: 3,
    salary: "Rp8.000.000 - 15.000.000",
  },
];

export default function HomePage() {
  // ── Page state ───────────────────────────────────────────────────
  const [pageState, setPageState] = useState<PageState>("default");
  const [searchQuery, setSearchQuery] = useState("");
  const [jobResults, setJobResults] = useState<JobResult[]>([]);
  const [agentEvents, setAgentEvents] = useState<AgentStep[]>([]);
  const [activeFilter, setActiveFilter] = useState<Verdict | null>(null);

  // ── Drawer state ─────────────────────────────────────────────────
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobResult | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const resultsRef = useRef<HTMLDivElement>(null);

  // ── Interactive Dot Grid ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };
    window.addEventListener("mousemove", handleMouseMove);

    const handleMouseLeave = () => {
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };
    document.body.addEventListener("mouseleave", handleMouseLeave);

    const gridSize = 11;
    const squareSize = 1.5;
    const activeRadius = 130;

    let currentMouse = { x: -1000, y: -1000 };
    let focusProgress = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      currentMouse.x += (mouseRef.current.x - currentMouse.x) * 0.12;
      currentMouse.y += (mouseRef.current.y - currentMouse.y) * 0.12;

      const activeEl = typeof document !== "undefined" ? document.activeElement : null;
      const isSearchFocused = activeEl && activeEl.id === "search-input";

      if (isSearchFocused) {
        focusProgress += (1 - focusProgress) * 0.08;
      } else {
        focusProgress += (0 - focusProgress) * 0.08;
      }

      const baseR = Math.round(0 + focusProgress * (208 - 0));
      const baseG = Math.round(153 + focusProgress * (250 - 153));
      const baseB = Math.round(102 + focusProgress * (229 - 102));
      const baseOpacity = 0.07 + focusProgress * (0.95 - 0.07);

      for (let y = 0; y < height; y += gridSize) {
        for (let x = 0; x < width; x += gridSize) {
          const dx = x - currentMouse.x;
          const dy = y - currentMouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let r = baseR;
          let g = baseG;
          let b = baseB;
          let opacity = baseOpacity;

          if (dist < activeRadius) {
            const ratio = 1 - dist / activeRadius;
            opacity = baseOpacity + ratio * (0.75 - baseOpacity);
            r = Math.round(baseR + ratio * (0 - baseR));
            g = Math.round(baseG + ratio * (153 - baseG));
            b = Math.round(baseB + ratio * (102 - baseB));
          }

          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
          ctx.fillRect(x - squareSize / 2, y - squareSize / 2, squareSize, squareSize);
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.body.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // ── Search handler — switches between mock and real scan ─────────
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    setPageState("scanning");
    setAgentEvents([]);
    setJobResults([]);
    setActiveFilter(null);

    await executeScan(query, {
      onEvent: (event) => {
        setAgentEvents((prev) => {
          const idx = prev.findIndex((e) => e.agent_name === event.agent_name);
          const next = {
            agent_name: event.agent_name || "unknown",
            status: event.status || "querying",
            message: event.message || "",
            timestamp: new Date(),
          };
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = next;
            return updated;
          }
          return [...prev, next];
        });
      },
      onComplete: (jobs) => {
        const sorted = [...jobs].sort((a, b) => b.score - a.score);
        setJobResults(sorted);
        setPageState("results");
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 250);
      },
      onError: (err) => {
        console.error("Scan Stream Error: ", err);
        setPageState("results");
      }
    });
  }, []);

  // ── Filter toggle — single-select, click active to deselect ────
  const toggleFilter = (verdict: Verdict) => {
    setActiveFilter((prev) => (prev === verdict ? null : verdict));
  };

  // null = show all; otherwise filter to matching verdict
  const filteredResults =
    activeFilter === null
      ? jobResults
      : jobResults.filter((j) => j.verdict === activeFilter);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      {/* Interactive Background Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0 w-full h-full"
      />

      {/* Navbar */}
      <header className="w-full bg-white border-b border-[#e6f4f0] sticky top-0 z-30">
        <nav className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center">
            <Image
              src="/assets/logo.svg"
              alt="Verity Logo"
              width={82}
              height={30}
              priority
            />
          </a>
          <div className="flex items-center gap-8">
            <Link
              href="/how-it-works"
              className="text-[13px] font-bold text-[#161513] hover:opacity-80 transition-opacity"
            >
              How it Works
            </Link>
            <Link
              href="/about"
              className="text-[13px] font-bold text-[#161513] hover:opacity-80 transition-opacity"
            >
              About
            </Link>
            <a
              href="https://github.com/danyprastya/phantom-lablab"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4.5 py-2 bg-[#009966] hover:bg-[#008055] text-white text-[13px] font-bold rounded-lg transition-all duration-200"
            >
              Github
            </a>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="relative flex-1 flex flex-col items-center max-w-5xl mx-auto w-full px-6 pb-20 z-10 text-center">

        {/* Badge — always visible */}
        <div className="mt-14 mb-5 animate-fade-in-up">
          <span className="inline-block border border-[#009966] text-[#009966] text-[11px] font-bold tracking-wider uppercase px-4 py-1.5 rounded-full">
            Hiring Intelligence Agent
          </span>
        </div>

        {/* Headline — always visible */}
        <h1
          className="text-4xl sm:text-[44px] font-medium text-[#161513] tracking-tight leading-[1.15] mb-5 animate-fade-in-up"
          style={{ animationDelay: "0.05s" }}
        >
          Discover real jobs.
          <br />
          Expose ghost postings.
        </h1>

        {/* Subtext tagline — always visible */}
        <p
          id="subtext-para"
          className="text-[14px] sm:text-base text-slate-500 max-w-[550px] mx-auto leading-relaxed mb-9 animate-fade-in-up font-normal"
          style={{ animationDelay: "0.1s" }}
        >
          <span className="font-bold text-[#161513]">Verity</span> searches,
          verifies, and scores job listings across 4 live data sources — so you
          never waste time on fake postings.
        </p>

        {/* Search Card — always visible, transforms between states */}
        <div
          className="w-full max-w-2xl mx-auto mb-6 animate-fade-in-up"
          style={{ animationDelay: "0.15s" }}
        >
          <SearchBar
            onSearch={handleSearch}
            isLoading={pageState === "scanning"}
          />
        </div>

        {/* State 2 — Scanning: Live agent log */}
        {pageState === "scanning" && (
          <div
            className="w-full max-w-2xl mx-auto mb-8"
            style={{ animation: "fadeIn 200ms ease-out forwards" }}
          >
            <LoadingAgent events={agentEvents} />
          </div>
        )}

        {/* State 3 — Results section */}
        {pageState === "results" && (
          <div
            ref={resultsRef}
            className="w-full text-left"
            style={{ animation: "fadeInUp 400ms ease-out 150ms both" }}
          >
            {/* Results header */}
            <div className="mb-3">
              <p className="text-[13px] text-slate-400 mb-1">
                {jobResults.length} jobs analysed
              </p>
              <p className="text-[14px] text-[#161513]">
                Results for{" "}
                <span className="font-bold text-[#009966]">{searchQuery}</span>
              </p>
            </div>

            {/* Filter pills — single select, null = all */}
            <div className="flex items-center gap-2 mb-6">
              {(["Real", "Suspicious", "Ghost"] as Verdict[]).map((verdict) => {
                const isActive = activeFilter === verdict;
                return (
                  <button
                    key={verdict}
                    onClick={() => toggleFilter(verdict)}
                    className={`px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border transition-all duration-150 cursor-pointer ${
                      isActive
                        ? "bg-[#009966] border-[#009966] text-white"
                        : "bg-white border-slate-300 text-slate-700 hover:border-[#009966] hover:text-[#009966]"
                    }`}
                  >
                    {verdict.toUpperCase()}
                  </button>
                );
              })}
            </div>

            {/* Job Cards — 3-column grid with stagger */}
            {filteredResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {filteredResults.map((job, idx) => (
                  <div
                    key={`${job.company}-${job.job_title}-${idx}`}
                    style={{
                      animation: `fadeInUp 300ms ease-out ${idx * 100}ms both`,
                    }}
                  >
                    <JobCard
                      {...job}
                      index={idx}
                      variant="result"
                      onClick={() => {
                        setSelectedJob(job);
                        setIsDrawerOpen(true);
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-slate-400">
                  No results match the selected filters.
                </p>
              </div>
            )}
          </div>
        )}

        {/* State 1 — Default: History section */}
        {pageState === "default" && (
          <div
            className="w-full text-left animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            <h2
              id="history-title"
              className="text-[13px] text-[#161513] font-bold mb-4"
            >
              History
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {historyJobs.map((job, idx) => (
                <JobCard
                  key={idx}
                  {...job}
                  index={idx}
                  onClick={() => {
                    setSelectedJob(job);
                    setIsDrawerOpen(true);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Job Detail Drawer */}
      <JobDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        job={selectedJob}
      />
    </div>
  );
}
