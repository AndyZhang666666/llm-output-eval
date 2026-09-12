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
 * Evidence should be a verbatim quote. If the model paraphrased, we keep the
 * quote but the UI marks it. Whitespace-insensitive substring check is enough;
 * exact matching fails on trivial punctuation differences.
 */
export function isVerbatim(quote: string, source: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const q = norm(quote);
  if (q.length < 4) return false;
  return norm(source).includes(q);
}

export function parseJudgeOutput(
  raw: string,
  sourceText: string,
  meta: { model: string; latency_ms?: number; sample?: boolean },
): EvaluationResult {
  let obj: unknown;
  try {
    obj = JSON.parse(stripFences(raw));
  } catch {
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
