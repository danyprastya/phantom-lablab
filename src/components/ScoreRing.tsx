"use client";

import { useState, useEffect } from "react";

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function ScoreRing({
  score,
  size = 80,
  strokeWidth = 6,
  className = "",
}: ScoreRingProps) {
  const [animated, setAnimated] = useState(false);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - score / 100);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const getColor = () => {
    if (score >= 75) return "var(--color-real)";
    if (score >= 40) return "var(--color-suspicious)";
    return "var(--color-ghost)";
  };

  const getGlow = () => {
    if (score >= 75) return "var(--color-real-glow)";
    if (score >= 40) return "var(--color-suspicious-glow)";
    return "var(--color-ghost-glow)";
  };

  const getLabel = () => {
    if (score >= 75) return "Real";
    if (score >= 40) return "Suspicious";
    return "Ghost";
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Hiring Reality Score: ${score} out of 100 — ${getLabel()}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="score-ring-track"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="score-ring-fill"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={animated ? dashoffset : circumference}
          style={{
            filter: `drop-shadow(0 0 6px ${getGlow()})`,
          }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-bold leading-none"
          style={{
            fontSize: size * 0.28,
            color: getColor(),
          }}
        >
          {score}
        </span>
        <span
          className="text-[var(--text-muted)] leading-none mt-0.5"
          style={{ fontSize: size * 0.11 }}
        >
          /100
        </span>
      </div>
    </div>
  );
}
