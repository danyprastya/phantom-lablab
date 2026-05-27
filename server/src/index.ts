import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { serve } from "@hono/node-server";
import { env } from "./config/env.js";
import { checkRateLimit, clearRateLimits } from "./middleware/rate-limiter.js";
import { runScan } from "./lib/orchestration/orchestrator.js";
import { clearCache } from "./lib/orchestration/cache.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: env.FRONTEND_URL,
    allowMethods: ["POST", "GET", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  })
);

function sanitiseQuery(query: string): string {
  return query
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s\-.,/()&+]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

app.post("/api/scan", async (c) => {
  const ip = c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown";
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return c.json({ error: limit.message }, 429);
  }

  let body: { query?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.query || typeof body.query !== "string" || body.query.trim().length < 3) {
    return c.json({ error: "Query too short. Please enter a job role and location." }, 400);
  }

  const query = sanitiseQuery(body.query.trim());
  console.log(`Scan request: "${query}"`);

  return streamSSE(c, async (stream) => {
    try {
      for await (const event of runScan({ query })) {
        await stream.writeSSE({
          event: event.event_type,
          data: JSON.stringify(event),
        });
      }
    } catch (err) {
      console.error(`Scan pipeline error: ${err}`);
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          event_type: "error",
          agent_name: null,
          status: null,
          message: `An error occurred during the scan: ${err instanceof Error ? err.message : String(err)}`,
          data: null,
        }),
      });
    }
  });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy", service: "phantom-api" });
});

app.get("/", (c) => {
  return c.json({
    name: "Phantom API",
    version: "1.0.0",
    description: "Hiring intelligence agent",
  });
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Phantom API running at http://localhost:${info.port}`);
  console.log(`CORS allowed origin: ${env.FRONTEND_URL}`);
});

process.on("SIGTERM", () => {
  console.log("Shutting down...");
  clearCache();
  clearRateLimits();
  server.close();
});

process.on("SIGINT", () => {
  console.log("Shutting down...");
  clearCache();
  clearRateLimits();
  server.close();
});
