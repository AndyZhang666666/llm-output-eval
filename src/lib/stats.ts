import { SCORED_DIMENSIONS } from "./dimensions";
import type { DimensionStats, EvaluationResult, MultiRunResult } from "./types";

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
  if (runs.length === 0)
    throw new Error("aggregateRuns needs at least one run");
  for (const r of runs) {
    if (
      r.dimensions.length !== SCORED_DIMENSIONS.length ||
      new Set(r.dimensions.map((d) => d.id)).size !==
        SCORED_DIMENSIONS.length ||
      SCORED_DIMENSIONS.some(
        (id) =>
          !r.dimensions.some(
            (d) =>
              d.id === id &&
              Number.isInteger(d.score) &&
              d.score >= 1 &&
              d.score <= 5,
          ),
      )
    )
      throw Error("Invalid run dimensions; missing scores were not imputed.");
    const expected = round2(
      r.dimensions.reduce((sum, d) => sum + d.score, 0) /
        SCORED_DIMENSIONS.length,
    );
    if (!Number.isFinite(r.overall) || Math.abs(expected - r.overall) > 1e-9)
      throw Error("Run overall disagrees with dimension scores.");
  }
  const stats: DimensionStats[] = SCORED_DIMENSIONS.map((id) => {
    const scores = runs.map(
      (r) => r.dimensions.find((d) => d.id === id)!.score,
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
export function formatRange(s: {
  mean: number;
  min: number;
  max: number;
}): string {
  if (s.min === s.max) return String(s.mean);
  return `${s.mean} (${s.min}–${s.max})`;
}

/** Saved extrema are descriptions, not confidence bounds or a significance test. */
export function comparisonReading(
  a: { mean: number; min: number; max: number },
  b: { mean: number; min: number; max: number },
  nA: number,
  nB: number,
) {
  const delta = round2(b.mean - a.mean),
    overlap = !(b.min > a.max || b.max < a.min);
  if (nA < 2 || nB < 2)
    return { delta, label: "仅单次，无法观察重复波动", tone: "text-zinc-700" };
  if (delta === 0)
    return { delta, label: "本组均值相同", tone: "text-zinc-700" };
  return {
    delta,
    label:
      (delta > 0 ? "本组均值较高" : "本组均值较低") +
      (overlap ? "；极差重叠" : "；极差未重叠"),
    tone: "text-zinc-700",
  };
}
