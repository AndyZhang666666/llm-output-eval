"use client";

import { useState } from "react";
import { ScoreRadar } from "@/components/ScoreRadar";
import { ErrorBanner, SampleBanner, Spinner, TextInput } from "@/components/ui";
import { evaluateText } from "@/lib/api";
import { collectBadCases } from "@/lib/badcases";
import { DIMENSIONS, SCORED_DIMENSIONS } from "@/lib/dimensions";
import { SAMPLE_RESULT, SAMPLE_TEXT, SAMPLE_TEXT_V2 } from "@/lib/sample";
import { useSettings } from "@/lib/settings";
import { aggregateRuns, formatRange } from "@/lib/stats";
import type { MultiRunResult } from "@/lib/types";

/**
 * Version comparison.
 *
 * Each version is scored independently N times (default 3) and we compare the
 * aggregates. We do NOT show the judge both versions in one prompt — pairwise
 * prompting is exposed to position bias (measured in validation/), and
 * independent scoring gives absolute numbers that can be tracked across more
 * than two versions later.
 *
 * "Confident" delta: the two ranges do not overlap. If V1 scored 3–4 and V2
 * scored 4–5 on a dimension, the 1-point mean difference could be noise; we
 * say so instead of pretending the number is precise.
 */

const RUN_OPTIONS = [1, 3, 5];

function verdict(a: { min: number; max: number; mean: number }, b: { min: number; max: number; mean: number }) {
  const delta = Math.round((b.mean - a.mean) * 100) / 100;
  const overlap = !(b.min > a.max || b.max < a.min);
  if (delta === 0) return { delta, label: "unchanged", tone: "text-zinc-600" };
  if (overlap) return { delta, label: delta > 0 ? "up, within noise" : "down, within noise", tone: "text-zinc-600" };
  return { delta, label: delta > 0 ? "better" : "worse", tone: delta > 0 ? "text-emerald-700 font-medium" : "text-red-700 font-medium" };
}

export default function ComparePage() {
  const { settings, hasKey, loaded } = useSettings();
  const [v1, setV1] = useState(SAMPLE_TEXT);
  const [v2, setV2] = useState(SAMPLE_TEXT_V2);
  const [runs, setRuns] = useState(3);
  const [r1, setR1] = useState<MultiRunResult | null>(null);
  const [r2, setR2] = useState<MultiRunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    if (!hasKey) {
      // Sample mode uses the same frozen result for both sides — it can only
      // demonstrate the layout, not a real comparison. Banner says so.
      const s = aggregateRuns([SAMPLE_RESULT]);
      setR1(s);
      setR2(s);
      return;
    }
    if (!v1.trim() || !v2.trim()) {
      setError("Both versions need text.");
      return;
    }
    setBusy(true);
    setR1(null);
    setR2(null);
    try {
      const [a, b] = await Promise.all([
        evaluateText(v1, runs, settings),
        evaluateText(v2, runs, settings),
      ]);
      setR1(aggregateRuns(a));
      setR2(aggregateRuns(b));
      a.forEach((x) => collectBadCases(x, "v1"));
      b.forEach((x) => collectBadCases(x, "v2"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const isSample = r1?.runs[0]?.meta.sample ?? false;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <TextInput label="V1" value={v1} onChange={setV1} rows={12} />
        <TextInput label="V2" value={v2} onChange={setV2} rows={12} />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={run}
          disabled={busy}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy ? "Scoring…" : hasKey ? "对比 / Compare" : "浏览示例 / Browse sample"}
        </button>
        <label className="flex items-center gap-2 text-sm">
          Runs per version
          <select
            value={runs}
            onChange={(e) => setRuns(Number(e.target.value))}
            className="rounded border border-zinc-300 px-2 py-1 text-sm"
          >
            {RUN_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span className="text-xs text-zinc-500">
            {runs === 1 ? "1 run cannot show variance" : `${runs * 2} judge calls total`}
          </span>
        </label>
        {busy && <Spinner label={`Running ${runs} × 2 judge calls in parallel`} />}
        {loaded && !hasKey && <span className="text-xs text-zinc-500">No key set — sample mode.</span>}
      </div>

      <ErrorBanner message={error} />

      {r1 && r2 && (
        <>
          <SampleBanner show={isSample} />
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-2 text-sm font-medium">Radar (means over {r1.runs.length} runs)</div>
              <ScoreRadar
                series={[
                  { name: "V1", values: r1.stats.map((s) => s.mean), color: "#71717a" },
                  { name: "V2", values: r2.stats.map((s) => s.mean), color: "#2563eb" },
                ]}
                height={320}
              />
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-2 text-sm font-medium">Score table</div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="py-1">Dimension</th>
                    <th className="py-1">V1 mean (range)</th>
                    <th className="py-1">V2 mean (range)</th>
                    <th className="py-1">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {SCORED_DIMENSIONS.map((id, i) => {
                    const a = r1.stats[i];
                    const b = r2.stats[i];
                    const v = verdict(a, b);
                    return (
                      <tr key={id} className="border-t border-zinc-100">
                        <td className="py-1.5">{DIMENSIONS[id].labelZh}</td>
                        <td className="py-1.5 font-mono">{formatRange(a)}</td>
                        <td className="py-1.5 font-mono">{formatRange(b)}</td>
                        <td className={`py-1.5 ${v.tone}`}>
                          <span className="font-mono">{v.delta > 0 ? "+" : ""}{v.delta}</span>
                          <span className="ml-2 text-xs">{v.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-zinc-300 font-medium">
                    <td className="py-1.5">Overall</td>
                    <td className="py-1.5 font-mono">{formatRange(r1.overall)}</td>
                    <td className="py-1.5 font-mono">{formatRange(r2.overall)}</td>
                    <td className={`py-1.5 ${verdict(r1.overall, r2.overall).tone}`}>
                      <span className="font-mono">
                        {verdict(r1.overall, r2.overall).delta > 0 ? "+" : ""}
                        {verdict(r1.overall, r2.overall).delta}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 text-xs text-zinc-500">
                Range = min–max across runs. A delta is only called &quot;better&quot; / &quot;worse&quot; when the two
                ranges do not overlap; otherwise it is within run-to-run noise.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-2 text-sm font-medium">Per-dimension read</div>
            <ul className="space-y-2 text-sm">
              {SCORED_DIMENSIONS.map((id, i) => {
                const a = r1.stats[i];
                const b = r2.stats[i];
                const v = verdict(a, b);
                const cA = r1.runs[0].dimensions[i].comment;
                const cB = r2.runs[0].dimensions[i].comment;
                return (
                  <li key={id} className="border-l-2 border-zinc-200 pl-3">
                    <div>
                      <span className="font-medium">{DIMENSIONS[id].labelZh}</span>
                      <span className={`ml-2 text-xs ${v.tone}`}>{v.label}</span>
                      {a.sd > 0 || b.sd > 0 ? (
                        <span className="ml-2 text-xs text-zinc-500">
                          sd V1 {a.sd} · V2 {b.sd}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-600">
                      <span className="text-zinc-400">V1:</span> {cA}
                    </div>
                    <div className="text-xs text-zinc-600">
                      <span className="text-zinc-400">V2:</span> {cB}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
