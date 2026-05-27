/**
 * Phantom — API Route Proxy (/api/scan)
 *
 * Proxies scan requests from the frontend to the Python FastAPI backend.
 * This hides the backend URL from the client and keeps all traffic
 * routed through Next.js.
 *
 * Flow: Browser → Next.js /api/scan → FastAPI /api/scan → SSE stream back
 */

import { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    if (!body.query || typeof body.query !== "string" || body.query.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Query must be at least 3 characters" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Forward to Python backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: body.query.trim() }),
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text().catch(() => "Unknown error");
      return new Response(
        JSON.stringify({ error: `Backend error: ${errorText}` }),
        {
          status: backendResponse.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Stream the SSE response back to the client
    // The backend returns EventSourceResponse, we forward it as-is
    if (backendResponse.body) {
      return new Response(backendResponse.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    return new Response(
      JSON.stringify({ error: "No response body from backend" }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("API proxy error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to connect to the scanning service. Make sure the backend is running.",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
