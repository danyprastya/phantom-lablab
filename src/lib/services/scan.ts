"use client";

import { JobResult, StreamEvent } from "@/lib/types";
import { runMockScan } from "@/lib/mockScan";

interface ScanStreamHandlers {
  onEvent: (event: StreamEvent) => void;
  onComplete: (jobs: JobResult[]) => void;
  onError: (err: any) => void;
}

export async function executeScan(query: string, handlers: ScanStreamHandlers): Promise<void> {
  const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

  if (isMock) {
    try {
      await runMockScan(
        (mockEvent) => {
          handlers.onEvent({
            event_type: "agent_status",
            agent_name: mockEvent.agent_name,
            status: mockEvent.status,
            message: mockEvent.message,
            data: null,
          });
        },
        (jobs) => {
          handlers.onComplete(jobs);
        }
      );
    } catch (err) {
      handlers.onError(err);
    }
    return;
  }

  try {
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Null response stream");

    const decoder = new TextDecoder();
    let buffer = "";
    const accumulatedJobs: JobResult[] = [];
    let completed = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (!completed && accumulatedJobs.length > 0) {
          completed = true;
          handlers.onComplete(accumulatedJobs);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        if (!block.trim()) continue;
        const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        const jsonStr = dataLine.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;

        const event = JSON.parse(jsonStr) as StreamEvent;

        if (event.event_type === "scan_complete") {
          completed = true;
          if (event.data?.jobs) {
            handlers.onComplete(event.data.jobs as JobResult[]);
          } else {
            handlers.onComplete(accumulatedJobs);
          }
          continue;
        }

        if (event.event_type === "error") {
          handlers.onError(event.message || "Scan error");
          continue;
        }

        if (event.event_type === "job_result" && event.data) {
          accumulatedJobs.push(event.data as unknown as JobResult);
          continue;
        }

        if (event.event_type === "agent_status") {
          handlers.onEvent(event);
        }
      }
    }
  } catch (err) {
    handlers.onError(err);
  }
}
