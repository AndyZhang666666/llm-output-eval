import data from "@/data/replay.json";
import { aggregateRuns } from "./stats";
import { BAD_CASE_THRESHOLD } from "./dimensions";
import type { BadCase, EvaluationResult } from "./types";

export const REPLAY_ITEMS = data.items.map((item) => ({
  ...item,
  runs: item.runs as EvaluationResult[],
}));
export const REPLAY = {
  model: data.model,
  at: data.recordedAt,
  source: data.source,
};
export const replayItem = (id: string) =>
  REPLAY_ITEMS.find((x) => x.id === id) ?? REPLAY_ITEMS[0];
export const replayStats = (id: string) => aggregateRuns(replayItem(id).runs);
// Separate read-only examples. Never write these records into the visitor's real-run store.
export const REPLAY_BAD_CASES: BadCase[] = REPLAY_ITEMS.flatMap((item) =>
  item.runs[0].dimensions
    .filter((d) => d.score <= BAD_CASE_THRESHOLD)
    .map((d) => ({
      id: `replay-${item.id}-${d.id}`,
      source: `回放:${item.id}`,
      dimension: d.id,
      score: d.score,
      comment: d.comment,
      evidence: d.evidence.join("\n"),
      at: item.runs[0].meta.at,
    })),
);
