"use client";

import { useState } from "react";
import { DimensionCard, SafetyCard } from "@/components/DimensionCard";
import { ScoreRadar } from "@/components/ScoreRadar";
import { ErrorBanner, SampleBanner, Spinner, TextInput } from "@/components/ui";
import { evaluateText } from "@/lib/api";
import { collectBadCases } from "@/lib/badcases";
import { SAMPLE_RESULT, SAMPLE_TEXT } from "@/lib/sample";
import { useSettings } from "@/lib/settings";
import type { EvaluationResult } from "@/lib/types";

export default function EvaluatePage() {
  const { settings, hasKey, loaded } = useSettings();
  const [text, setText] = useState(SAMPLE_TEXT);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    if (!hasKey) {
      // Sample mode: show the frozen output so the layout can be explored.
      // The banner and meta.sample make it impossible to mistake for a real run.
      setResult(SAMPLE_RESULT);
      return;
    }
    if (!text.trim()) {
      setError("Text is empty.");
      return;
    }
    setBusy(true);
    try {
      const [r] = await evaluateText(text, 1, settings);
      setResult(r);
      collectBadCases(r, "single");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <section>
        <TextInput label="待评文本 / Text to evaluate" value={text} onChange={setText} />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={run}
            disabled={busy}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {busy ? "Scoring…" : hasKey ? "评分 / Score" : "浏览示例 / Browse sample"}
          </button>
          {busy && <Spinner label="One judge call, usually 10–30 s" />}
          {loaded && !hasKey && (
            <span className="text-xs text-zinc-500">No key set — sample mode.</span>
          )}
        </div>
      </section>

      <section>
        <ErrorBanner message={error} />
        {result && (
          <>
            <SampleBanner show={result.meta.sample} />
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Overall (mean of 5)</div>
                  <div className="font-mono text-3xl font-semibold">{result.overall.toFixed(2)}</div>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  <div>{result.meta.model}</div>
                  {result.meta.latency_ms && <div>{(result.meta.latency_ms / 1000).toFixed(1)} s</div>}
                </div>
              </div>
              <ScoreRadar
                series={[{ name: "score", values: result.dimensions.map((d) => d.score), color: "#18181b" }]}
              />
            </div>
            <div className="mt-4 space-y-3">
              {result.dimensions.map((d) => (
                <DimensionCard key={d.id} d={d} />
              ))}
              <SafetyCard s={result.safety} />
            </div>
          </>
        )}
        {!result && !error && (
          <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            Results appear here: overall score, radar, and per-dimension score + comment + verbatim evidence.
          </div>
        )}
      </section>
    </div>
  );
}
