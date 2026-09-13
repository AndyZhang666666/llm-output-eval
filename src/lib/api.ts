import { JUDGE_MAX_TOKENS, JudgeParseError, JudgeTruncatedError, parseJudgeOutput } from "./judge";
import { JUDGE_SYSTEM_PROMPT, buildJudgeUserPrompt } from "./prompts";
import type { EvaluationResult, JudgeSettings } from "./types";

/**
 * Browser-side judge client. The visitor's key goes straight from their
 * browser to the provider they chose — this app has no server at all (it is
 * a static export on GitHub Pages), so there is nothing in between that could
 * log, store, or fall back to a key of its own.
 *
 * This used to be a Next.js Route Handler proxy. Moving the call into the
 * browser was the price of a static deployment, and it turned out to be the
 * more honest design: "we don't store your key" is a stronger claim when
 * there is no process that could.
 *
 * Runs are executed in parallel. Cap is 5 to keep a single click bounded.
 */

export const MAX_RUNS = 5;
const MAX_CHARS = 20_000;
const TIMEOUT_MS = 90_000;

interface ChatCompletion {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  error?: { message?: string };
}

async function callJudgeOnce(settings: JudgeSettings, text: string): Promise<EvaluationResult> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        // 0 is not "deterministic" (see validation/judge-validation.md) but it
        // is the lowest-variance setting most relays honour.
        temperature: 0,
        response_format: { type: "json_object" },
        max_tokens: JUDGE_MAX_TOKENS,
        messages: [
          { role: "system", content: JUDGE_SYSTEM_PROMPT },
          { role: "user", content: buildJudgeUserPrompt(text) },
        ],
      }),
      signal: ctrl.signal,
    });
    const data = (await r.json().catch(() => ({}))) as ChatCompletion;
    if (!r.ok) {
      const err = new Error(data.error?.message || `Provider returned HTTP ${r.status}`);
      (err as Error & { status?: number }).status = r.status;
      throw err;
    }
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    if (!content) throw new Error("Provider returned an empty completion");
    return parseJudgeOutput(content, text, {
      model: settings.model,
      latency_ms: Date.now() - started,
      finish_reason: choice?.finish_reason,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One retry on transient failures only (5xx, timeout, empty completion,
 * unparseable JSON). 4xx means the key/model/URL is wrong — retrying that
 * just doubles the visitor's wait for the same error.
 *
 * Truncation is excluded: it is deterministic for a given input and budget, so
 * a second call returns the same half-written JSON. Reporting it immediately is
 * more useful than making the visitor wait twice for it.
 */
async function callJudge(settings: JudgeSettings, text: string): Promise<EvaluationResult> {
  try {
    return await callJudgeOnce(settings, text);
  } catch (e) {
    const status = (e as Error & { status?: number }).status;
    const transient =
      (e instanceof JudgeParseError && !(e instanceof JudgeTruncatedError)) ||
      (e instanceof Error && e.name === "AbortError") ||
      status === undefined ||
      status >= 500;
    if (!transient) throw e;
    return await callJudgeOnce(settings, text);
  }
}

/** Score `text` `runs` times in parallel. Throws with a readable message. */
export async function evaluateText(
  text: string,
  runs: number,
  settings: JudgeSettings,
): Promise<EvaluationResult[]> {
  if (!settings.apiKey?.trim()) {
    throw new Error("No API key. Open Settings and paste your own key (it stays in your browser).");
  }
  if (text.length > MAX_CHARS) {
    throw new Error(`Text is too long (${text.length} chars, limit ${MAX_CHARS})`);
  }
  const n = Math.min(MAX_RUNS, Math.max(1, Math.floor(runs)));
  try {
    return await Promise.all(Array.from({ length: n }, () => callJudge(settings, text)));
  } catch (e) {
    if (e instanceof JudgeParseError) {
      throw new Error(`${e.message} Raw output (first 300 chars): ${e.raw.slice(0, 300)}`);
    }
    if (e instanceof Error && e.name === "AbortError") throw new Error("Judge timed out");
    if (e instanceof TypeError && /fetch/i.test(e.message)) {
      // A bare TypeError from fetch in the browser almost always means CORS
      // or an unreachable host — the provider never answered at all.
      throw new Error(
        `Could not reach ${settings.baseUrl}. Check the base URL, and note that the provider must allow browser requests (CORS).`,
      );
    }
    throw e;
  }
}
