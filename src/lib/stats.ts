import { SCORED_DIMENSIONS } from "./dimensions";
import type {
  DimensionStats,
  EvaluationResult,
  MultiRunResult,
  Score,
} from "./types";

/**
 * Aggregate N judge runs of the same text.
 *
 * Population SD (divide by N) rather than sample SD: we are describing the
 * spread of the runs we actually have, not estimating a population. With N=3
 * the difference is large enough to matter when reporting "±" ranges.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function describe(values: number[]) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return {
    mean: round2(mean),
    min: Math.min(...values),
    max: Math.max(...values),
    sd: round2(Math.sqrt(variance)),
  };
}

export function aggregateRuns(runs: EvaluationResult[]): MultiRunResult {
  if (runs.length === 0) throw new Error("aggregateRuns needs at least one run");
  const stats: DimensionStats[] = SCORED_DIMENSIONS.map((id) => {
    const scores = runs.map(
      (r) => r.dimensions.find((d) => d.id === id)?.score ?? (1 as Score),
    );
    return { id, runs: scores, ...describe(scores) };
  });
  return {
    runs,
    stats,
    overall: describe(runs.map((r) => r.overall)),
  };
}

/** "3.67 (3–4)" style label; collapses to "4" when there is no spread. */
export function formatRange(s: { mean: number; min: number; max: number }): string {
  if (s.min === s.max) return String(s.mean);
  return `${s.mean} (${s.min}–${s.max})`;
}
