"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

export default function HowItWorksPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

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

  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0 w-full h-full"
      />
      <header className="w-full bg-white border-b border-[#e6f4f0] sticky top-0 z-30">
        <nav className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/assets/logo.svg"
              alt="Verity Logo"
              width={82}
              height={30}
              priority
            />
          </Link>
          <div className="flex items-center gap-8">
            <Link
              href="/how-it-works"
              className="text-[13px] font-bold text-[#009966] hover:opacity-80 transition-opacity"
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

      <main className="relative flex-1 max-w-5xl mx-auto w-full px-6 py-20 z-10">
        {/* Hero */}
        <div className="text-center mb-20 animate-fade-in-up">
          <span className="inline-block border border-[#009966] text-[#009966] text-[11px] font-bold tracking-wider uppercase px-4 py-1.5 rounded-full mb-5">
            Under The Hood
          </span>
          <h1 className="text-4xl sm:text-[44px] font-medium text-[#161513] tracking-tight leading-[1.15] mb-5">
            How Verity works
          </h1>
          <p className="text-[14px] sm:text-base text-slate-500 max-w-[620px] mx-auto leading-relaxed font-normal">
            Verity doesn&apos;t guess. It investigates. Every job posting is run
            through 4 independent live data sources and scored by AI — so you
            only see roles that are genuinely hiring.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-12 mb-20">
          {/* Step 1 */}
          <div className="bg-white border border-[#e6f4f0] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] p-6 animate-fade-in-up">
            <div className="flex items-start gap-5">
              <div className="shrink-0 w-11 h-11 bg-[#F0FDF4] rounded-xl flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#009966"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Step 1 — You Search
                </p>
                <h3 className="text-[15px] font-bold text-[#161513] mb-2">
                  You describe the role
                </h3>
                <p className="text-[14px] text-slate-500 leading-relaxed">
                  Type any job title, skill, or location in plain language.
                  Verity understands natural queries like &apos;senior engineer
                  fintech Jakarta&apos; or &apos;remote product designer
                  SEA&apos;.
                </p>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white border border-[#e6f4f0] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] p-6 animate-fade-in-up">
            <div className="flex items-start gap-5">
              <div className="shrink-0 w-11 h-11 bg-[#F0FDF4] rounded-xl flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#009966"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Step 2 — Verity Discovers
                </p>
                <h3 className="text-[15px] font-bold text-[#161513] mb-2">
                  We find the postings
                </h3>
                <p className="text-[14px] text-slate-500 leading-relaxed">
                  Verity&apos;s SERP agent scans Google search results in real
                  time to find active job listings across Indeed, LinkedIn,
                  Glassdoor, and company career pages — all in one search.
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white border border-[#e6f4f0] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] p-6 animate-fade-in-up">
            <div className="flex items-start gap-5">
              <div className="shrink-0 w-11 h-11 bg-[#F0FDF4] rounded-xl flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#009966"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Step 3 — 4 Agents Investigate
                </p>
                <h3 className="text-[15px] font-bold text-[#161513] mb-2">
                  4 agents run in parallel
                </h3>
                <p className="text-[14px] text-slate-500 leading-relaxed mb-5">
                  Simultaneously, four specialized agents go to work on every
                  posting.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[#F0FDF4] border border-[#e6f4f0] rounded-xl p-4">
                    <h4 className="text-[13px] font-bold text-[#009966] mb-1">
                      Indeed Scraper
                    </h4>
                    <p className="text-[12px] text-slate-500 leading-relaxed">
                      Checks posting age, repost history, and how long the role
                      has been live
                    </p>
                  </div>
                  <div className="bg-[#F0FDF4] border border-[#e6f4f0] rounded-xl p-4">
                    <h4 className="text-[13px] font-bold text-[#009966] mb-1">
                      LinkedIn Scraper
                    </h4>
                    <p className="text-[12px] text-slate-500 leading-relaxed">
                      Pulls company headcount trends and growth trajectory over
                      90 days
                    </p>
                  </div>
                  <div className="bg-[#F0FDF4] border border-[#e6f4f0] rounded-xl p-4">
                    <h4 className="text-[13px] font-bold text-[#009966] mb-1">
                      Web Unlocker
                    </h4>
                    <p className="text-[12px] text-slate-500 leading-relaxed">
                      Reads the company careers page, press releases, and funding
                      news
                    </p>
                  </div>
                  <div className="bg-[#F0FDF4] border border-[#e6f4f0] rounded-xl p-4">
                    <h4 className="text-[13px] font-bold text-[#009966] mb-1">
                      Glassdoor Agent
                    </h4>
                    <p className="text-[12px] text-slate-500 leading-relaxed">
                      Scans recent employee reviews for red flags like hiring
                      freezes or layoffs
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-white border border-[#e6f4f0] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] p-6 animate-fade-in-up">
            <div className="flex items-start gap-5">
              <div className="shrink-0 w-11 h-11 bg-[#F0FDF4] rounded-xl flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#009966"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Step 4 — AI Scores It
                </p>
                <h3 className="text-[15px] font-bold text-[#161513] mb-2">
                  AI synthesizes a Hiring Reality Score
                </h3>
                <p className="text-[14px] text-slate-500 leading-relaxed">
                  All signals are combined into a score from 0 to 100.
                  Deterministic rules handle the facts. AI handles the nuance.
                  The result: a clear verdict — Real, Suspicious, or Ghost —
                  with plain-English reasoning you can trust.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Anti-hallucination */}
        <div className="text-center mb-20 animate-fade-in-up">
          <h2 className="text-2xl sm:text-3xl font-medium text-[#161513] tracking-tight mb-4">
            Built to never make things up
          </h2>
          <p className="text-[14px] sm:text-base text-slate-500 max-w-[620px] mx-auto leading-relaxed mb-8">
            Most AI tools generate plausible-sounding answers from memory.
            Verity is different. Every signal is sourced from live web data.
            Every claim includes a citation. The AI can only work with what the
            scrapers actually found — if a data point is missing, it says so.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="px-4 py-2 bg-[#F0FDF4] border border-[#e6f4f0] rounded-full text-[12px] font-bold text-[#009966]">
              Closed-context prompting
            </span>
            <span className="px-4 py-2 bg-[#F0FDF4] border border-[#e6f4f0] rounded-full text-[12px] font-bold text-[#009966]">
              Source-tagged signals
            </span>
            <span className="px-4 py-2 bg-[#F0FDF4] border border-[#e6f4f0] rounded-full text-[12px] font-bold text-[#009966]">
              Confidence flagging
            </span>
          </div>
        </div>

        {/* Score Legend */}
        <div className="mb-20 animate-fade-in-up">
          <h2 className="text-2xl sm:text-3xl font-medium text-[#161513] tracking-tight text-center mb-4">
            What the scores mean
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-8">
            <div className="bg-white border border-[#e6f4f0] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full bg-[#009966]" />
                <span className="text-[15px] font-bold text-[#161513]">
                  75–100 Real
                </span>
              </div>
              <p className="text-[13px] text-slate-500 leading-relaxed">
                Strong signals of active hiring. Fresh posting, growing
                headcount, no red flags. Worth your time.
              </p>
            </div>
            <div className="bg-white border border-[#e6f4f0] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full bg-[#d97706]" />
                <span className="text-[15px] font-bold text-[#161513]">
                  40–74 Suspicious
                </span>
              </div>
              <p className="text-[13px] text-slate-500 leading-relaxed">
                Mixed signals. Proceed with caution. The role may be real but
                something doesn&apos;t add up.
              </p>
            </div>
            <div className="bg-white border border-[#e6f4f0] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full bg-[#dc2626]" />
                <span className="text-[15px] font-bold text-[#161513]">
                  0–39 Ghost
                </span>
              </div>
              <p className="text-[13px] text-slate-500 leading-relaxed">
                Multiple red flags detected. Stale posting, flat or shrinking
                headcount, or known hiring freeze.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center animate-fade-in-up">
          <h2 className="text-2xl sm:text-3xl font-medium text-[#161513] tracking-tight mb-6">
            Ready to stop wasting time on ghost jobs?
          </h2>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-[#009966] hover:bg-[#008055] text-white text-[13px] font-bold rounded-lg transition-all duration-200"
          >
            Start scanning
          </Link>
        </div>
      </main>
    </div>
  );
}
