import { SCORED_DIMENSIONS } from "./dimensions";
import type { BadCase } from "./types";
export function decodeBadCases(raw: string | null): BadCase[] {
  if (!raw) return [];
  if (raw.length > 2_000_000) throw Error("记录过大");
  const v: unknown = JSON.parse(raw);
  if (!Array.isArray(v) || v.length > 500) throw Error("记录格式不支持");
  const valid = v.every(
    (x) =>
      x &&
      typeof x === "object" &&
      typeof x.id === "string" &&
      x.id.length <= 500 &&
      typeof x.source === "string" &&
      x.source.length <= 120 &&
      SCORED_DIMENSIONS.includes(x.dimension) &&
      Number.isInteger(x.score) &&
      x.score >= 1 &&
      x.score <= 2 &&
      typeof x.comment === "string" &&
      x.comment.length <= 8000 &&
      typeof x.evidence === "string" &&
      x.evidence.length <= 20000 &&
      typeof x.at === "string" &&
      Number.isFinite(Date.parse(x.at)),
  );
  if (!valid) throw Error("记录字段损坏");
  return v as BadCase[];
}
export function toCsv(items: BadCase[]): string {
  const esc = (v: string | number) => {
    let s = String(v);
    if (/^\s*[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      ["at", "source", "dimension", "score", "comment", "evidence"].join(","),
      ...items.map((b) =>
        [b.at, b.source, b.dimension, b.score, b.comment, b.evidence]
          .map(esc)
          .join(","),
      ),
    ].join("\n")
  );
}
