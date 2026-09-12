import { SCORED_DIMENSIONS } from "./dimensions";
import type {
  DimensionScore,
  EvaluationResult,
  SafetyCategory,
  SafetyFlag,
  Score,
  ScoredDimensionId,
} from "./types";

/**
 * Parse and validate raw judge output into an EvaluationResult.
 *
 * We do not trust the model to follow the schema. Observed failure modes with
 * OpenAI-compatible relays: markdown fences around the JSON, scores as strings,
 * missing dimensions, evidence as a single string instead of an array, and
 * `json_schema` response_format being silently ignored. Every one of those is
 * handled here so the UI never sees a half-formed result.
 */

const SAFETY_CATEGORIES: SafetyCategory[] = [
  "none",
  "violence",
  "sexual",
  "hate",
  "self_harm",
  "illegal",
  "minors",
  "other",
];

export class JudgeParseError extends Error {
  constructor(message: string, public readonly raw: string) {
    super(message);
    this.name = "JudgeParseError";
  }
}

/**
 * The provider stopped mid-JSON because it hit max_tokens.
 *
 * Distinct from a generic parse failure because the cause is ours, not the
 * model's: it means the response budget is too small for this input. Without
 * this, a truncated response looks exactly like a malformed one and you end up
 * debugging the prompt instead of the ceiling. See JUDGE_MAX_TOKENS.
 */
export class JudgeTruncatedError extends JudgeParseError {
  constructor(raw: string) {
    super(
      `Judge response was truncated at max_tokens (${raw.length} chars received, JSON incomplete). ` +
        `The input is too long for the current response budget.`,
      raw,
    );
    this.name = "JudgeTruncatedError";
  }
}

function stripFences(s: string): string {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (m ? m[1] : s).trim();
}

function toScore(v: unknown): Score {
  const n = typeof v === "string" ? parseInt(v, 10) : Number(v);
  if (!Number.isFinite(n)) return 1;
  const clamped = Math.min(5, Math.max(1, Math.round(n)));
  return clamped as Score;
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

/**
 * Evidence should be a verbatim quote. If the model paraphrased, we drop it.
 *
 * Matching is whitespace-insensitive and punctuation-normalised: judges
 * routinely rewrite "straight" quotes as “curly” ones and swap full-width
 * for half-width punctuation. Those are not paraphrases, and treating them
 * as such threw away real evidence in early runs (see git history).
 */
const PUNCT_MAP: Record<string, string> = {
  "“": '"', "”": '"', "„": '"', "‟": '"',
  "‘": "'", "’": "'", "‚": "'", "‛": "'",
  "，": ",", "。": ".", "！": "!", "？": "?", "：": ":", "；": ";",
  "（": "(", "）": ")", "【": "[", "】": "]", "《": "<", "》": ">",
  "—": "-", "–": "-", "…": "...",
};
const PUNCT_RE = new RegExp(`[${Object.keys(PUNCT_MAP).join("")}]`, "g");

function normalizeForMatch(s: string): string {
  return s
    .replace(PUNCT_RE, (ch) => PUNCT_MAP[ch] ?? ch)
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function isVerbatim(quote: string, source: string): boolean {
  const q = normalizeForMatch(quote);
  if (q.length < 4) return false;
  return normalizeForMatch(source).includes(q);
}

/**
 * Response budget for one judge call.
 *
 * Was 2048, which is not enough. A verdict is five dimensions each carrying a
 * comment plus up to three verbatim quotes, and quotes are copied in the
 * source language — a Chinese goldset item produces far more tokens than its
 * character count suggests. At 2048 the provider truncated mid-JSON on longer
 * inputs (observed deterministically on goldset g17), which surfaced as an
 * unparseable response and silently dropped the item from the validation
 * aggregates. 8192 leaves headroom; the contract in the prompt is what caps
 * the real length, this is only the safety net.
 */
export const JUDGE_MAX_TOKENS = 8192;

/**
 * Heuristic: does this JSON look like it was cut off mid-write?
 *
 * Tracks brace/bracket depth and string state in one pass. A response that
 * ends inside a string or with depth > 0 was truncated; one that is balanced
 * but still fails JSON.parse is genuinely malformed. Quoted escape handling is
 * deliberately minimal — we only need to avoid miscounting `\"` as a
 * terminator.
 */
function looksIncomplete(s: string): boolean {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }
  return inString || depth > 0;
}

export function parseJudgeOutput(
  raw: string,
  sourceText: string,
  meta: { model: string; latency_ms?: number; sample?: boolean; finish_reason?: string },
): EvaluationResult {
  const body = stripFences(raw);
  let obj: unknown;
  try {
    obj = JSON.parse(body);
  } catch {
    // `finish_reason === "length"` is the provider telling us directly; the
    // balance check catches relays that omit or misreport it.
    if (meta.finish_reason === "length" || looksIncomplete(body)) {
      throw new JudgeTruncatedError(raw);
    }
    throw new JudgeParseError("Judge returned non-JSON output", raw);
  }
  if (!obj || typeof obj !== "object") {
    throw new JudgeParseError("Judge output is not an object", raw);
  }
  const o = obj as Record<string, unknown>;

  const dimsRaw = Array.isArray(o.dimensions) ? (o.dimensions as unknown[]) : [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const d of dimsRaw) {
    if (d && typeof d === "object" && typeof (d as Record<string, unknown>).id === "string") {
      byId.set((d as Record<string, unknown>).id as string, d as Record<string, unknown>);
    }
  }
  // Also accept the flat shape { persona: {...}, coherence: {...} } some models emit.
  for (const id of SCORED_DIMENSIONS) {
    if (!byId.has(id) && o[id] && typeof o[id] === "object") {
      byId.set(id, o[id] as Record<string, unknown>);
    }
  }

  const missing = SCORED_DIMENSIONS.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new JudgeParseError(`Judge output missing dimensions: ${missing.join(", ")}`, raw);
  }

  const dimensions: DimensionScore[] = SCORED_DIMENSIONS.map((id: ScoredDimensionId) => {
    const d = byId.get(id)!;
    const evidence = toStringArray(d.evidence).filter((e) => isVerbatim(e, sourceText));
    return {
      id,
      score: toScore(d.score),
      comment: typeof d.comment === "string" ? d.comment.trim() : "",
      evidence,
    };
  });

  const s = (o.safety && typeof o.safety === "object" ? o.safety : {}) as Record<string, unknown>;
  const category = SAFETY_CATEGORIES.includes(s.category as SafetyCategory)
    ? (s.category as SafetyCategory)
    : "none";
  const safety: SafetyFlag = {
    category,
    needs_review: Boolean(s.needs_review) || category !== "none",
    comment: typeof s.comment === "string" ? s.comment.trim() : "",
    evidence: toStringArray(s.evidence).filter((e) => isVerbatim(e, sourceText)),
  };

  const overall =
    Math.round((dimensions.reduce((acc, d) => acc + d.score, 0) / dimensions.length) * 100) / 100;

  return {
    dimensions,
    safety,
    overall,
    meta: {
      model: meta.model,
      at: new Date().toISOString(),
      sample: Boolean(meta.sample),
      latency_ms: meta.latency_ms,
    },
  };
}
