import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Phantom — Hiring Intelligence Agent",
  description:
    "Discover real jobs, expose ghost postings. Phantom autonomously searches, verifies, and scores job listings across 4 live data sources.",
  keywords: [
    "ghost jobs",
    "hiring intelligence",
    "job search",
    "ghost job detector",
    "hiring reality score",
  ],
  openGraph: {
    title: "Phantom — Hiring Intelligence Agent",
    description:
      "The only tool that finds jobs, verifies them across 4 live data sources, and returns cited, scored intelligence.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
        {children}
      </body>
    </html>
  );
}
