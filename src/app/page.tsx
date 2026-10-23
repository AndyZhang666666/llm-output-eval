"use client";

import { useState } from "react";
import { DimensionCard, SafetyCard } from "@/components/DimensionCard";
import { ScoreRadar } from "@/components/ScoreRadar";
import { ErrorBanner, SampleBanner, Spinner, TextInput } from "@/components/ui";
import { evaluateText } from "@/lib/api";
import { collectBadCases } from "@/lib/badcases";
import { REPLAY_ITEMS, replayItem } from "@/lib/replay";
import Link from 'next/link';
import { useSettings } from "@/lib/settings";
import type { EvaluationResult } from "@/lib/types";

export default function EvaluatePage() {
  const { settings, hasKey, loaded } = useSettings();
  const [sampleId, setSampleId] = useState('e06');
  const [text, setText] = useState(replayItem('e06').text);
  const [result, setResult] = useState<EvaluationResult | null>(replayItem('e06').runs[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    if (!hasKey) {
      // Sample mode: show the frozen output so the layout can be explored.
      // The banner and meta.sample make it impossible to mistake for a real run.
      setText(replayItem(sampleId).text);
      setResult(replayItem(sampleId).runs[0]);
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
    <>
    <div className="eval-intro">
      <h1>找到该改的那一句。</h1>
      <p>看分数，也看原文依据。先体验一段历史评测，再对照版本变化与低分案例。</p>
    </div>
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <section>
        <label className="replay-picker">选择历史样本
          <select value={sampleId} onChange={e => {
            const item = replayItem(e.target.value); setSampleId(item.id); setText(item.text); setResult(item.runs[0]); setError(null);
          }}>{REPLAY_ITEMS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        </label>
        <TextInput label="待评文本" value={text} onChange={v => { setText(v); setResult(null); }} readOnly={!hasKey} />
        <p className="replay-note">{replayItem(sampleId).note}</p>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={run}
            disabled={busy}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {busy ? "正在评测…" : hasKey ? "评测当前文本" : "恢复原文回放"}
          </button>
          {busy && <Spinner label="One judge call, usually 10–30 s" />}
          {loaded && !hasKey && (
            <Link className="text-sm underline" href="/compare/">看这段文本如何改进 →</Link>
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
                  <div className="text-sm text-zinc-600">五维平均分，不作为自动发布结论</div>
                  <div className="text-3xl font-semibold tabular-nums">{result.overall.toFixed(2)} <span className="text-base font-normal text-zinc-500">/ 5</span></div>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  <div>{result.meta.model}</div>
                  <div>{result.meta.at.slice(0, 10)} · {result.meta.sample ? '历史第 1 次记录' : '本次运行'}</div>
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
    </>
  );
}
