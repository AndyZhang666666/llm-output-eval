"use client";

import { useMemo, useState } from "react";
import { toCsv, useBadCases } from "@/lib/badcases";
import { BAD_CASE_THRESHOLD, DIMENSIONS, SCORED_DIMENSIONS } from "@/lib/dimensions";
import type { ScoredDimensionId } from "@/lib/types";
import { REPLAY_BAD_CASES } from '@/lib/replay';
import Link from 'next/link';

/**
 * Bad Case list: every dimension that scored <= BAD_CASE_THRESHOLD on any
 * real run, with the sentence the judge pointed at. This is the page a
 * writer actually opens — "show me the lines that dragged the score down"
 * is more actionable than "coherence: 2".
 */
export default function BadCasesPage() {
  const { items: realItems, clear } = useBadCases();
  const [showReplay, setShowReplay] = useState(true);
  const items = showReplay ? REPLAY_BAD_CASES : realItems;
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
            <h1 className="text-2xl font-semibold">低分之后，具体改什么？</h1>
          <p className="text-sm text-zinc-600">
            ≤ {BAD_CASE_THRESHOLD} 分的维度与历史原文证据。回放案例只读，与你的真实运行记录完全分开。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-40"
          >
            导出{showReplay ? '回放示例' : '我的记录'} CSV ({filtered.length})
          </button>
          <button
            onClick={() => {
              if (realItems.length && window.confirm("清空保存在此浏览器的真实评测记录？")) clear();
            }}
            disabled={showReplay || realItems.length === 0}
            className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            清空我的记录
          </button>
        </div>
      </div>

      <div className="replay-toolbar">
        <button aria-pressed={showReplay} onClick={() => {setShowReplay(true);setSource('all');}}>历史回放示例</button>
        <button aria-pressed={!showReplay} onClick={() => {setShowReplay(false);setSource('all');}}>我的运行记录（{realItems.length}）</button>
        <Link href="/compare/">对照完整稿看结构是否改善 →</Link>
      </div>
      {showReplay && <p className="replay-note">来源：公开校验集中 6 个样本各自第 1 次记录。分数不是本次生成；原文可在单篇评测中切换查看。证据需要人工复核，低分本身不等于评语正确。</p>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setDim("all")}
          className={`rounded-full border px-3 py-1 text-xs ${
            dim === "all" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 hover:bg-zinc-100"
          }`}
        >
          全部 ({items.length})
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
              ? "还没有真实评测记录。可以先切回历史回放示例，无需接口。"
            : "当前筛选没有低分记录，可以切换维度或来源。"}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white" role="region" aria-label="低分案例表，可横向滚动" tabIndex={0}>
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">维度</th>
                <th className="px-3 py-2">分数</th>
                <th className="px-3 py-2">原文证据</th>
                <th className="px-3 py-2">原始评语</th>
                <th className="px-3 py-2">来源</th>
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
