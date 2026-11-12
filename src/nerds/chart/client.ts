import type { ChartAnswer } from "./spec";

export async function askForChart(q: string, signal?: AbortSignal): Promise<ChartAnswer> {
  const response = await fetch("/api/nerds-of-fashion/chart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q }),
    signal,
  });
  if (!response.ok) return { q, spec: null, reason: "unavailable", ms: 0 };
  return (await response.json()) as ChartAnswer;
}
