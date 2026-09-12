"use client";

import { useMemo, useState } from "react";
import { toCsv, useBadCases } from "@/lib/badcases";
import { BAD_CASE_THRESHOLD, DIMENSIONS, SCORED_DIMENSIONS } from "@/lib/dimensions";
import type { ScoredDimensionId } from "@/lib/types";

/**
 * Bad Case list: every dimension that scored <= BAD_CASE_THRESHOLD on any
 * real run, with the sentence the judge pointed at. This is the page a
 * writer actually opens — "show me the lines that dragged the score down"
 * is more actionable than "coherence: 2".
 */
export default function BadCasesPage() {
  const { items, clear } = useBadCases();
  const [dim, setDim] = useState<ScoredDimensionId | "all">("all");
  const [source, setSource] = useState<string>("all");

  const sources = useMemo(() => Array.from(new Set(items.map((i) => i.source))).sort(), [items]);
  const filtered = useMemo(
    () =>
      items.filter(
        (i) => (dim === "all" || i.dimension === dim) && (source === "all" || i.source === source),
      ),
    [items, dim, source],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) c[i.dimension] = (c[i.dimension] ?? 0) + 1;
    return c;
  }, [items]);

  function exportCsv() {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bad-cases-${dim}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Bad Cases</h1>
          <p className="text-sm text-zinc-600">
            Every dimension scored ≤ {BAD_CASE_THRESHOLD} on a real run, with the judge&apos;s evidence sentence.
            Stored in this browser only; sample-mode results are never collected.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-40"
          >
            Export CSV ({filtered.length})
          </button>
          <button
            onClick={() => {
              if (items.length && window.confirm("Clear all bad cases stored in this browser?")) clear();
            }}
            disabled={items.length === 0}
            className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setDim("all")}
          className={`rounded-full border px-3 py-1 text-xs ${
            dim === "all" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 hover:bg-zinc-100"
          }`}
        >
          All ({items.length})
        </button>
        {SCORED_DIMENSIONS.map((id) => (
          <button
            key={id}
            onClick={() => setDim(id)}
            className={`rounded-full border px-3 py-1 text-xs ${
              dim === id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 hover:bg-zinc-100"
            }`}
          >
            {DIMENSIONS[id].labelZh} ({counts[id] ?? 0})
          </button>
        ))}
        {sources.length > 1 && (
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="ml-auto rounded border border-zinc-300 px-2 py-1 text-xs"
          >
            <option value="all">all sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          {items.length === 0
            ? "Nothing yet. Run a real evaluation (with a key) on the Evaluate or Compare page; low-scoring dimensions land here."
            : "No bad cases match this filter."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Dimension</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Evidence</th>
                <th className="px-3 py-2">Judge comment</th>
                <th className="px-3 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-t border-zinc-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2">{DIMENSIONS[b.dimension].labelZh}</td>
                  <td className="px-3 py-2 font-mono text-red-700">{b.score}</td>
                  <td className="px-3 py-2">
                    {b.evidence ? (
                      <span className="border-l-2 border-red-300 pl-2">{b.evidence}</span>
                    ) : (
                      <span className="text-xs text-amber-700">no verbatim evidence returned</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{b.comment}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500">
                    {b.source}
                    <br />
                    {b.at.slice(0, 16).replace("T", " ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
