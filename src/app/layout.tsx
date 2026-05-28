import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
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
  title: "Verity — Hiring Intelligence Agent",
  description:
    "Discover real jobs, expose ghost postings. Verity autonomously searches, verifies, and scores job listings across 4 live data sources.",
  keywords: [
    "ghost jobs",
    "hiring intelligence",
    "job search",
    "ghost job detector",
    "hiring reality score",
  ],
  icons: {
    icon: [
      { url: "/favicons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicons/favicon.ico" },
    ],
    apple: [
      { url: "/favicons/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
  manifest: "/favicons/site.webmanifest",
  openGraph: {
    title: "Verity — Hiring Intelligence Agent",
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
      className={`${plusJakartaSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
