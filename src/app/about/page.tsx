"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

export default function AboutPage() {
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
              className="text-[13px] font-bold text-[#161513] hover:opacity-80 transition-opacity"
            >
              How it Works
            </Link>
            <Link
              href="/about"
              className="text-[13px] font-bold text-[#009966] hover:opacity-80 transition-opacity"
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
            Our Story
          </span>
          <h1 className="text-4xl sm:text-[44px] font-medium text-[#161513] tracking-tight leading-[1.15] mb-5">
            Built for job seekers who deserve better
          </h1>
          <p className="text-[14px] sm:text-base text-slate-500 max-w-[620px] mx-auto leading-relaxed font-normal">
            Verity was built during a 5-day hackathon by a two-person team in
            Indonesia. We built it because we&apos;ve seen firsthand how ghost
            jobs waste people&apos;s time, energy, and hope.
          </p>
        </div>

        {/* Problem */}
        <div className="mb-20 animate-fade-in-up">
          <h2 className="text-2xl sm:text-3xl font-medium text-[#161513] tracking-tight text-center mb-4">
            The ghost job problem is real
          </h2>
          <p className="text-[14px] sm:text-base text-slate-500 max-w-[620px] mx-auto leading-relaxed text-center mb-8">
            Studies estimate that up to 50% of online job listings are ghost
            postings — roles that companies keep live with no real intent to
            hire. They&apos;re used for talent pooling, competitor research, or
            simply forgotten. The result: job seekers spend hours crafting cover
            letters for roles that were never going to be filled.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white border border-[#e6f4f0] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] p-6 text-center">
              <p className="text-3xl font-bold text-[#009966] mb-2">~50%</p>
              <p className="text-[13px] text-slate-500 leading-relaxed">
                of job listings may be ghost postings
              </p>
            </div>
            <div className="bg-white border border-[#e6f4f0] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] p-6 text-center">
              <p className="text-3xl font-bold text-[#009966] mb-2">
                Hours wasted
              </p>
              <p className="text-[13px] text-slate-500 leading-relaxed">
                per application on unresponsive roles
              </p>
            </div>
            <div className="bg-white border border-[#e6f4f0] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] p-6 text-center">
              <p className="text-3xl font-bold text-[#009966] mb-2">0 tools</p>
              <p className="text-[13px] text-slate-500 leading-relaxed">
                existed to detect this — until now
              </p>
            </div>
          </div>
        </div>

        {/* Solution */}
        <div className="text-center mb-20 animate-fade-in-up">
          <h2 className="text-2xl sm:text-3xl font-medium text-[#161513] tracking-tight mb-4">
            We built the truth layer for hiring
          </h2>
          <p className="text-[14px] sm:text-base text-slate-500 max-w-[620px] mx-auto leading-relaxed">
            Verity is the first tool to cross-reference live data from 4
            independent sources to score every job posting for hiring intent.
            Think of it as Carfax — but for job listings. Before you invest
            hours in an application, Verity tells you if the role is worth your
            time.
          </p>
        </div>

        {/* Tech */}
        <div className="text-center mb-20 animate-fade-in-up">
          <h2 className="text-2xl sm:text-3xl font-medium text-[#161513] tracking-tight mb-4">
            Powered by real data, not AI guessing
          </h2>
          <p className="text-[14px] sm:text-base text-slate-500 max-w-[620px] mx-auto leading-relaxed mb-8">
            Verity is built on Bright Data&apos;s web intelligence infrastructure
            — the same technology used by Fortune 500 companies for market
            research.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="px-4 py-2 bg-[#F0FDF4] border border-[#e6f4f0] rounded-full text-[12px] font-bold text-[#009966]">
              Indeed Scraper
            </span>
            <span className="px-4 py-2 bg-[#F0FDF4] border border-[#e6f4f0] rounded-full text-[12px] font-bold text-[#009966]">
              LinkedIn Scraper
            </span>
            <span className="px-4 py-2 bg-[#F0FDF4] border border-[#e6f4f0] rounded-full text-[12px] font-bold text-[#009966]">
              Web Unlocker
            </span>
            <span className="px-4 py-2 bg-[#F0FDF4] border border-[#e6f4f0] rounded-full text-[12px] font-bold text-[#009966]">
              SERP API
            </span>
          </div>
        </div>

        {/* Team */}
        <div className="mb-20 animate-fade-in-up">
          <h2 className="text-2xl sm:text-3xl font-medium text-[#161513] tracking-tight text-center mb-8">
            The team
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-white border border-[#e6f4f0] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] p-6">
              <h3 className="text-[15px] font-bold text-[#161513] mb-2">
                Dany Prastya
              </h3>
              <p className="text-[13px] text-slate-500 leading-relaxed mb-3">
                Full-stack engineer. Built the entire scraping pipeline, scoring
                engine, and backend in 5 days.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href="https://github.com/danyprastya"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F0FDF4] border border-[#e6f4f0] rounded-full text-[11px] font-bold text-[#009966] hover:bg-[#e6f7f0] transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  GitHub
                </a>
                <a
                  href="https://www.linkedin.com/in/danyprastya/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F0FDF4] border border-[#e6f4f0] rounded-full text-[11px] font-bold text-[#009966] hover:bg-[#e6f7f0] transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  LinkedIn
                </a>
              </div>
            </div>
            <div className="bg-white border border-[#e6f4f0] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.015)] p-6">
              <h3 className="text-[15px] font-bold text-[#161513] mb-2">
                Bilal Arief
              </h3>
              <p className="text-[13px] text-slate-500 leading-relaxed mb-3">
                Designer. Designed the full product from brand identity to every
                screen, and made sure it looked like it deserved to win.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href="https://github.com/bilalarief"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F0FDF4] border border-[#e6f4f0] rounded-full text-[11px] font-bold text-[#009966] hover:bg-[#e6f7f0] transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  GitHub
                </a>
                <a
                  href="https://www.linkedin.com/in/bilalarief/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F0FDF4] border border-[#e6f4f0] rounded-full text-[11px] font-bold text-[#009966] hover:bg-[#e6f7f0] transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  LinkedIn
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Hackathon */}
        <div className="text-center mb-20 animate-fade-in-up">
          <h2 className="text-2xl sm:text-3xl font-medium text-[#161513] tracking-tight mb-4">
            Built at LabLab Hackathon 2026
          </h2>
          <p className="text-[14px] sm:text-base text-slate-500 max-w-[620px] mx-auto leading-relaxed mb-6">
            Verity was created as a submission for the LabLab hackathon powered
            by Bright Data. Built in 5 days. Designed to solve a real problem
            for millions of job seekers across Southeast Asia and beyond.
          </p>
          <span className="inline-block border border-[#009966] text-[#009966] text-[11px] font-bold tracking-wider uppercase px-4 py-1.5 rounded-full">
            Bright Data Hackathon 2026
          </span>
        </div>

        {/* CTA */}
        <div className="text-center animate-fade-in-up">
          <h2 className="text-2xl sm:text-3xl font-medium text-[#161513] tracking-tight mb-6">
            Try Verity for yourself
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
