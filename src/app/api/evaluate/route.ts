import { NextResponse } from "next/server";
import { JUDGE_MAX_TOKENS, JudgeParseError, parseJudgeOutput } from "@/lib/judge";
import { JUDGE_SYSTEM_PROMPT, buildJudgeUserPrompt } from "@/lib/prompts";
import type { EvaluateRequest, EvaluationResult } from "@/lib/types";

/**
 * POST /api/evaluate
 *
 * Thin proxy so the browser never talks to the model provider directly.
 * The visitor's key arrives in `x-judge-key` and is forwarded once, never
 * logged, never stored. There is intentionally no server-side fallback key:
 * this app is BYO-key by design so nobody can burn the author's quota.
 *
 * Runs are executed in parallel. Cap is 5 to keep a single click bounded.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_RUNS = 5;
const MAX_CHARS = 20_000;
const TIMEOUT_MS = 90_000;

interface ChatCompletion {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  error?: { message?: string };
}

async function callJudgeOnce(
  baseUrl: string,
  apiKey: string,
  model: string,
  text: string,
): Promise<EvaluationResult> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
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
      model,
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
async function callJudge(
  baseUrl: string,
  apiKey: string,
  model: string,
  text: string,
): Promise<EvaluationResult> {
  try {
    return await callJudgeOnce(baseUrl, apiKey, model, text);
  } catch (e) {
    const status = (e as Error & { status?: number }).status;
    const transient =
      (e instanceof JudgeParseError && !(e instanceof JudgeTruncatedError)) ||
      (e instanceof Error && e.name === "AbortError") ||
      status === undefined ||
      status >= 500;
    if (!transient) throw e;
    return await callJudgeOnce(baseUrl, apiKey, model, text);
  }
}

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-judge-key")?.trim();
  const baseUrl = req.headers.get("x-judge-base-url")?.trim() || "https://api.openai.com/v1";
  const model = req.headers.get("x-judge-model")?.trim() || "gpt-4o-mini";

  if (!apiKey) {
    return NextResponse.json(
      { error: "No API key. Open Settings and paste your own key (it stays in your browser)." },
      { status: 401 },
    );
  }

  let body: EvaluateRequest;
  try {
    body = (await req.json()) as EvaluateRequest;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Text is too long (${text.length} chars, limit ${MAX_CHARS})` },
      { status: 413 },
    );
  }
  const runs = Math.min(MAX_RUNS, Math.max(1, Math.floor(body.runs ?? 1)));

  try {
    const results = await Promise.all(
      Array.from({ length: runs }, () => callJudge(baseUrl, apiKey, model, text)),
    );
    return NextResponse.json({ results });
  } catch (e) {
    if (e instanceof JudgeParseError) {
      return NextResponse.json(
        { error: `${e.message} Raw output (first 300 chars): ${e.raw.slice(0, 300)}` },
        { status: 502 },
      );
    }
    const msg = e instanceof Error ? (e.name === "AbortError" ? "Judge timed out" : e.message) : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
