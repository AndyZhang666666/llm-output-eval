import type { EvaluationResult, JudgeSettings } from "./types";

/** Client wrapper for POST /api/evaluate. Throws with a readable message. */
export async function evaluateText(
  text: string,
  runs: number,
  settings: JudgeSettings,
): Promise<EvaluationResult[]> {
  const r = await fetch("/api/evaluate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-judge-key": settings.apiKey,
      "x-judge-base-url": settings.baseUrl,
      "x-judge-model": settings.model,
    },
    body: JSON.stringify({ text, runs }),
  });
  const data = (await r.json().catch(() => ({}))) as {
    results?: EvaluationResult[];
    error?: string;
  };
  if (!r.ok || !data.results) {
    throw new Error(data.error || `Request failed with HTTP ${r.status}`);
  }
  return data.results;
}
