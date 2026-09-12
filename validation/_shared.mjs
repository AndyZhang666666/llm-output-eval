/**
 * Shared helpers for the validation scripts.
 *
 * The scripts must use the SAME prompt and SAME parser as the app, otherwise
 * the report would describe a different judge than the one visitors get.
 * `npm run validate:build` compiles src/lib/* into validation/.lib (CommonJS)
 * so plain Node can import it without a bundler.
 *
 * Env (never committed): LLM_BASE_URL, LLM_API_KEY, JUDGE_MODEL.
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
export const here = dirname(fileURLToPath(import.meta.url));

if (!existsSync(join(here, ".lib/prompts.js"))) {
  console.error("validation/.lib missing — run `npm run validate:build` first.");
  process.exit(1);
}

export const { JUDGE_SYSTEM_PROMPT, buildJudgeUserPrompt, PAIRWISE_SYSTEM_PROMPT, buildPairwiseUserPrompt } =
  require("./.lib/prompts.js");
// JUDGE_MAX_TOKENS lives in judge.ts so the app and these scripts share one
// response budget — a mismatch would make validation describe a different
// judge than the one visitors get.
export const { parseJudgeOutput, JudgeParseError, JudgeTruncatedError, JUDGE_MAX_TOKENS } = require("./.lib/judge.js");
export const { SCORED_DIMENSIONS } = require("./.lib/dimensions.js");

// Minimal .env loader so scripts work with the project's .env without a dependency.
const envPath = join(here, "..", ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export const BASE_URL = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
export const API_KEY = process.env.LLM_API_KEY;
export const MODEL = process.env.JUDGE_MODEL ?? "gpt-4o-mini";
if (!API_KEY) {
  console.error("LLM_API_KEY not set (put it in .env or the environment).");
  process.exit(1);
}

export function loadGoldset() {
  return readFileSync(join(here, "goldset.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
}

async function chat(system, user, { retries = 1, maxTokens = JUDGE_MAX_TOKENS } = {}) {
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 120_000);
    try {
      const r = await fetch(`${BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0,
          response_format: { type: "json_object" },
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: ctrl.signal,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error?.message || `HTTP ${r.status}`);
      const choice = data.choices?.[0];
      const content = choice?.message?.content;
      if (!content) throw new Error("empty completion");
      // Returned rather than stashed on the function object: pool() runs
      // several workers concurrently and a shared slot would race.
      return { content, finishReason: choice?.finish_reason };
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise((res) => setTimeout(res, 1500));
    } finally {
      clearTimeout(t);
    }
  }
}

/** One judge run on one text, parsed with the app's parser. */
export async function judge(text) {
  const started = Date.now();
  const { content, finishReason } = await chat(JUDGE_SYSTEM_PROMPT, buildJudgeUserPrompt(text));
  return parseJudgeOutput(content, text, {
    model: MODEL,
    latency_ms: Date.now() - started,
    finish_reason: finishReason,
  });
}

/** Pairwise A/B preference, used only by position-bias.mjs. */
export async function pairwise(a, b) {
  const { content } = await chat(PAIRWISE_SYSTEM_PROMPT, buildPairwiseUserPrompt(a, b), { maxTokens: 1024 });
  const cleaned = content.replace(/```(?:json)?/gi, "").trim();
  return JSON.parse(cleaned);
}

/** Run tasks with bounded concurrency; the relay rate-limits above ~4. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

export function scoreOf(result, dim) {
  return result.dimensions.find((d) => d.id === dim).score;
}

export function saveResult(name, data) {
  const dir = join(here, "results");
  mkdirSync(dir, { recursive: true });
  const p = join(dir, name);
  writeFileSync(p, JSON.stringify(data, null, 2));
  console.log(`saved ${p}`);
}

export function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
export function sd(xs) {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}
export const r2 = (n) => Math.round(n * 100) / 100;
