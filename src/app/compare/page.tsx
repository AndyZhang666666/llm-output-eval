"use client";

import { useEffect, useRef, useState } from "react";
import { ScoreRadar } from "@/components/ScoreRadar";
import { ErrorBanner, SampleBanner, Spinner, TextInput } from "@/components/ui";
import { evaluateText } from "@/lib/api";
import { collectBadCases } from "@/lib/badcases";
import { DIMENSIONS, SCORED_DIMENSIONS } from "@/lib/dimensions";
import { SAMPLE_TEXT, SAMPLE_TEXT_V2 } from "@/lib/sample";
import { useSettings } from "@/lib/settings";
import { aggregateRuns, formatRange, comparisonReading } from "@/lib/stats";
import { downloadJson } from "@/lib/review";
import type { MultiRunResult, JudgeSettings } from "@/lib/types";
import { ReplayCompare } from "@/components/ReplayCompare";

/**
 * Version comparison.
 *
 * Each version is scored independently N times (default 3) and we compare the
 * aggregates. We do NOT show the judge both versions in one prompt — pairwise
 * prompting is exposed to position bias (measured in validation/), and
 * independent scoring gives absolute numbers that can be tracked across more
 * than two versions later.
 *
 * Extrema describe the saved sample only. Neither overlap nor separation
 * establishes noise, significance, general stability or a release decision.
 */

const RUN_OPTIONS = [1, 3, 5];

type Range = { min: number; max: number; mean: number };

export default function ComparePage() {
  const { settings, hasKey, loaded } = useSettings();
  const [v1, setV1] = useState(SAMPLE_TEXT);
  const [v2, setV2] = useState(SAMPLE_TEXT_V2);
  const [runs, setRuns] = useState(3);
  const [savedR1, setR1] = useState<MultiRunResult | null>(null);
  const [savedR2, setR2] = useState<MultiRunResult | null>(null);
  const [sourceConfig, setSourceConfig] = useState<JudgeSettings | null>(null);
  const r1 = sourceConfig === settings ? savedR1 : null,
    r2 = sourceConfig === settings ? savedR2 : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => request.current?.abort(),
    [settings.baseUrl, settings.model, settings.apiKey],
  );
  const verdict = (a: Range, b: Range) =>
    comparisonReading(a, b, r1?.runs.length ?? runs, r2?.runs.length ?? runs);
  function invalidate() {
    setR1(null);
    setR2(null);
    setError(null);
  }

  async function run() {
    setError(null);
    if (!hasKey) {
      return;
    }
    if (!v1.trim() || !v2.trim()) {
      setError("Both versions need text.");
      return;
    }
    setBusy(true);
    setR1(null);
    setR2(null);
    setSourceConfig(settings);
    const c = new AbortController();
    request.current = c;
    try {
      const [a, b] = await Promise.all([
        evaluateText(v1, runs, settings, c.signal),
        evaluateText(v2, runs, settings, c.signal),
      ]);
      if (request.current !== c) return;
      setR1(aggregateRuns(a));
      setR2(aggregateRuns(b));
      a.forEach((x) => collectBadCases(x, "v1"));
      b.forEach((x) => collectBadCases(x, "v2"));
    } catch (e) {
      c.abort();
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (request.current === c) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  const isSample = r1?.runs[0]?.meta.sample ?? false;

  if (!hasKey) return <ReplayCompare />;

  return (
    <div className="space-y-6">
      <div className="eval-intro">
        <h1>把差异留在证据上。</h1>
        <p>
          每版独立运行，报告本组均值与极差。极差不是置信区间；修改文本、运行次数或接口后，旧结果不再用于当前比较。
        </p>
      </div>
      {savedR1 && !r1 && !busy && (
        <p role="status" className="replay-note">
          接口设置已改变，旧分数未用于当前比较，请重新运行。
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <TextInput
          label="V1"
          value={v1}
          onChange={(v) => {
            setV1(v);
            invalidate();
          }}
          rows={12}
          readOnly={busy}
        />
        <TextInput
          label="V2"
          value={v2}
          onChange={(v) => {
            setV2(v);
            invalidate();
          }}
          rows={12}
          readOnly={busy}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={run}
          disabled={busy}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy
            ? "Scoring…"
            : hasKey
              ? "对比 / Compare"
              : "浏览示例 / Browse sample"}
        </button>
        <label className="flex items-center gap-2 text-sm">
          每版运行次数
          <select
            value={runs}
            onChange={(e) => {
              setRuns(Number(e.target.value));
              invalidate();
            }}
            disabled={busy}
            className="rounded border border-zinc-300 px-2 py-1 text-sm"
          >
            {RUN_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-xs text-zinc-500">
            {runs === 1
              ? "1 run cannot show variance"
              : `${runs * 2} judge calls total`}
          </span>
        </label>
        {busy && (
          <button
            className="review-cancel"
            onClick={() => request.current?.abort()}
          >
            取消对比
          </button>
        )}
        {r1 && r2 && (
          <button
            className="review-cancel"
            onClick={() =>
              downloadJson(
                {
                  version: 1,
                  kind: "own-comparison",
                  texts: [v1, v2],
                  results: [r1, r2],
                  limits: [
                    "极差只描述本组运行，不是置信区间或显著性结论",
                    "评分不代表发布许可，原文与评语需要人工复核",
                  ],
                },
                "eval-comparison.json",
              )
            }
          >
            导出本组对比
          </button>
        )}
        {busy && (
          <Spinner label={`Running ${runs} × 2 judge calls in parallel`} />
        )}
        {loaded && !hasKey && (
          <span className="text-xs text-zinc-500">
            No key set — sample mode.
          </span>
        )}
      </div>

      <ErrorBanner message={error} />

      {r1 && r2 && (
        <>
          <SampleBanner show={isSample} />
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-2 text-sm font-medium">
                Radar (means over {r1.runs.length} runs)
              </div>
              <ScoreRadar
                series={[
                  {
                    name: "V1",
                    values: r1.stats.map((s) => s.mean),
                    color: "#71717a",
                  },
                  {
                    name: "V2",
                    values: r2.stats.map((s) => s.mean),
                    color: "#2563eb",
                  },
                ]}
                height={320}
              />
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-2 text-sm font-medium">Score table</div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-zinc-600">
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
                          <span className="font-mono">
                            {v.delta > 0 ? "+" : ""}
                            {v.delta}
                          </span>
                          <span className="ml-2 text-xs">{v.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-zinc-300 font-medium">
                    <td className="py-1.5">Overall</td>
                    <td className="py-1.5 font-mono">
                      {formatRange(r1.overall)}
                    </td>
                    <td className="py-1.5 font-mono">
                      {formatRange(r2.overall)}
                    </td>
                    <td
                      className={`py-1.5 ${verdict(r1.overall, r2.overall).tone}`}
                    >
                      <span className="font-mono">
                        {verdict(r1.overall, r2.overall).delta > 0 ? "+" : ""}
                        {verdict(r1.overall, r2.overall).delta}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 text-xs text-zinc-500">
                极差仅描述已保存运行；重叠不等于确认“只是噪声”，不重叠也不证明显著改善。每版最多5次，先复核原文和判断依据。
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
                      <span className="font-medium">
                        {DIMENSIONS[id].labelZh}
                      </span>
                      <span className={`ml-2 text-xs ${v.tone}`}>
                        {v.label}
                      </span>
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
