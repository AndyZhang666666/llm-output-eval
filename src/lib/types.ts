/**
 * Core result types for the evaluator.
 *
 * Everything the UI renders, every validation script emits, and every judge
 * response we accept is expressed in these shapes. Keeping them in one place
 * means "what does a score look like" has exactly one answer.
 */

/** The five scored dimensions. `safety` is deliberately not in this union. */
export type ScoredDimensionId =
  | "persona"
  | "coherence"
  | "pacing"
  | "dialogue"
  | "structure";

/** All dimensions, including the unscored safety flag. */
export type DimensionId = ScoredDimensionId | "safety";

/** Integer 1-5. Kept as a plain number for JSON friendliness; validated on parse. */
export type Score = 1 | 2 | 3 | 4 | 5;

export interface DimensionScore {
  id: ScoredDimensionId;
  score: Score;
  /** One-sentence rationale from the judge. */
  comment: string;
  /**
   * Verbatim sentence(s) copied from the input text that support the score.
   * Empty array is allowed (e.g. when the text is empty or unreadable) but the
   * UI treats it as a warning: a score without evidence is hard to trust.
   */
  evidence: string[];
}

/** Safety is a categorical flag, not a 1-5 score. See dimensions.ts for why. */
export type SafetyCategory =
  | "none"
  | "violence"
  | "sexual"
  | "hate"
  | "self_harm"
  | "illegal"
  | "minors"
  | "other";

export interface SafetyFlag {
  category: SafetyCategory;
  /** Whether a human should look at this before it ships. */
  needs_review: boolean;
  comment: string;
  evidence: string[];
}

/** A single judge run on a single text. */
export interface EvaluationResult {
  dimensions: DimensionScore[];
  safety: SafetyFlag;
  /** Unweighted mean of the five scored dimensions, 1-5, rounded to 2 decimals. */
  overall: number;
  /** Metadata the client attaches after the call; not produced by the model. */
  meta: {
    model: string;
    /** ISO timestamp. */
    at: string;
    /** True when this result comes from bundled sample data, not a real model call. */
    sample: boolean;
    /** Judge latency in ms, if known. */
    latency_ms?: number;
  };
}

/** Aggregation over N runs of the same text (used by the compare page). */
export interface DimensionStats {
  id: ScoredDimensionId;
  mean: number;
  min: number;
  max: number;
  /** Population standard deviation. */
  sd: number;
  runs: Score[];
}

export interface MultiRunResult {
  runs: EvaluationResult[];
  stats: DimensionStats[];
  overall: { mean: number; min: number; max: number; sd: number };
}

/** One row on the Bad Case page: a low-scoring dimension plus its evidence. */
export interface BadCase {
  id: string;
  /** Where it came from: "single", "v1", "v2". */
  source: string;
  dimension: ScoredDimensionId;
  score: Score;
  comment: string;
  evidence: string;
  at: string;
}

/** Request body for POST /api/evaluate. */
export interface EvaluateRequest {
  text: string;
  /** Defaults to 1. Capped server-side. */
  runs?: number;
}

/** Client-side connection settings, persisted in localStorage. */
export interface JudgeSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}
