import { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { runScan } from "@/lib/orchestration/orchestrator";

export const maxDuration = 45;

function sanitiseQuery(query: string): string {
  return query
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s\-.,/()&+]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";

  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return new Response(JSON.stringify({ error: limit.message }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { query?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.query || typeof body.query !== "string" || body.query.trim().length < 3) {
    return new Response(
      JSON.stringify({ error: "Query too short. Please enter a job role and location." }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const query = sanitiseQuery(body.query.trim());
  console.log(`Scan request: "${query}"`);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runScan({ query })) {
          const line = `event: ${event.event_type}\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(line));
        }
      } catch (err) {
        console.error(`Scan pipeline error: ${err}`);
        const errorEvent = {
          event_type: "error",
          agent_name: null,
          status: null,
          message: `An error occurred: ${err instanceof Error ? err.message : String(err)}`,
          data: null,
        };
        const line = `event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`;
        controller.enqueue(encoder.encode(line));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
