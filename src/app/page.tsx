"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { DimensionCard, SafetyCard } from "@/components/DimensionCard";
import { EvidenceReview } from "@/components/EvidenceReview";
import { ScoreRadar } from "@/components/ScoreRadar";
import { ErrorBanner, SampleBanner, TextInput } from "@/components/ui";
import { evaluateText } from "@/lib/api";
import { collectBadCases } from "@/lib/badcases";
import { REPLAY_ITEMS, replayItem } from "@/lib/replay";
import { recordKey } from "@/lib/review";
import { SCORED_DIMENSIONS } from "@/lib/dimensions";
import { useSettings } from "@/lib/settings";
import type { EvaluationResult, ScoredDimensionId } from "@/lib/types";
function subscribeURL(cb: () => void) {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
}
const readURL = () => location.search,
  serverURL = () => "";
export default function EvaluatePage() {
  const query = useSyncExternalStore(subscribeURL, readURL, serverURL);
  return <EvaluateWorkspace key={query} initialQuery={query} />;
}
function EvaluateWorkspace({ initialQuery }: { initialQuery: string }) {
  const { settings, hasKey, loaded } = useSettings();
  const p = new URLSearchParams(initialQuery),
    queryId = p.get("sample"),
    queryDim = p.get("dimension");
  const initialId =
    queryId && REPLAY_ITEMS.some((i) => i.id === queryId) ? queryId : "e06";
  const initialDim =
    queryDim && SCORED_DIMENSIONS.includes(queryDim as ScoredDimensionId)
      ? (queryDim as ScoredDimensionId)
      : "structure";
  const [sampleId, sampleSet] = useState(initialId),
    [runIndex, runSet] = useState(0);
  const [text, textSet] = useState(replayItem(initialId).text),
    [result, resultSet] = useState<EvaluationResult | null>(
      replayItem(initialId).runs[0],
    );
  const [dimension, dimSet] = useState<ScoredDimensionId>(initialDim),
    [quote, quoteSet] = useState(
      replayItem(initialId).runs[0].dimensions.find((d) => d.id === initialDim)
        ?.evidence[0] ?? "",
    );
  const [busy, busySet] = useState(false),
    [error, errorSet] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null),
    reviewRef = useRef<HTMLDivElement>(null);
  function showSample(id: string, index = 0) {
    const item = replayItem(id),
      r = item.runs[index] ?? item.runs[0];
    sampleSet(item.id);
    runSet(index);
    textSet(item.text);
    resultSet(r);
    const d = r.dimensions.find((x) => x.id === dimension)!;
    quoteSet(d.evidence[0] ?? "");
    errorSet(null);
  }
  useEffect(
    () => () => request.current?.abort(),
    [settings.baseUrl, settings.model, settings.apiKey],
  );
  function locate(id: ScoredDimensionId, q: string) {
    dimSet(id);
    quoteSet(q);
    requestAnimationFrame(() => {
      reviewRef.current?.focus({ preventScroll: true });
      reviewRef.current?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
  }
  async function run() {
    errorSet(null);
    if (!hasKey) {
      showSample(sampleId, runIndex);
      return;
    }
    const c = new AbortController();
    request.current = c;
    busySet(true);
    resultSet(null);
    try {
      const [r] = await evaluateText(text, 1, settings, c.signal);
      if (request.current !== c) return;
      resultSet(r);
      quoteSet(r.dimensions.find((d) => d.id === dimension)?.evidence[0] ?? "");
      collectBadCases(r, "single");
    } catch (e) {
      if (request.current === c)
        errorSet(e instanceof Error ? e.message : String(e));
    } finally {
      if (request.current === c) {
        request.current = null;
        busySet(false);
      }
    }
  }
  const key = result
    ? recordKey(result.meta.sample ? sampleId : "own", runIndex, text, result)
    : "";
  return (
    <>
      <div className="eval-intro">
        <h1>找到该改的那一句。</h1>
        <p>
          先定位引用，再判断评语能否成立。复核意见留在本机，不改变历史分数；无需Key即可完成整条审阅流程。
        </p>
      </div>
      {result && (
        <div className="eval-summary">
          <span>
            当前五维均分 <b>{result.overall.toFixed(2)}/5</b> ·{" "}
            {result.meta.sample ? "历史回放" : "本次运行"}
          </span>
          <a href="#evidence-review">核对原文与评语 →</a>
        </div>
      )}
      <div className="eval-workspace">
        <section className="eval-source">
          <div className="replay-selects">
            <label className="replay-picker">
              选择历史样本
              <select
                disabled={busy}
                value={sampleId}
                onChange={(e) => showSample(e.target.value)}
              >
                {REPLAY_ITEMS.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="replay-picker">
              历史运行
              <select
                disabled={busy}
                value={runIndex}
                onChange={(e) => showSample(sampleId, Number(e.target.value))}
              >
                {replayItem(sampleId).runs.map((_, i) => (
                  <option key={i} value={i}>
                    第{i + 1}次记录
                  </option>
                ))}
              </select>
            </label>
          </div>
          <TextInput
            label={hasKey ? "待评文本" : "回放原文"}
            value={text}
            onChange={(v) => {
              textSet(v);
              resultSet(null);
              quoteSet("");
            }}
            rows={
              hasKey
                ? 10
                : Math.min(
                    12,
                    Math.max(5, text.split(String.fromCharCode(10)).length + 1),
                  )
            }
            readOnly={!hasKey || busy}
          />
          <p className="replay-note">{replayItem(sampleId).note}</p>
          <div className="review-actions">
            <button className="primary" onClick={run} disabled={busy}>
              {busy ? "正在评测…" : hasKey ? "评测当前文本" : "恢复本次回放"}
            </button>
            {busy && (
              <button
                onClick={() => {
                  request.current?.abort();
                }}
              >
                取消评测
              </button>
            )}
            {loaded && !hasKey && (
              <Link href="/compare/">对照截断稿与完整稿 →</Link>
            )}
          </div>
          <div ref={reviewRef} tabIndex={-1} id="evidence-review">
            {result && (
              <EvidenceReview
                key={key}
                recordKey={key}
                sourceText={text}
                result={result}
                dimension={dimension}
                quote={quote}
              />
            )}
          </div>
        </section>
        <section className="eval-results" aria-label="评分与证据">
          <ErrorBanner message={error} />
          {result ? (
            <>
              <SampleBanner show={result.meta.sample} />
              <div className="replay-panel score-summary">
                <div>
                  <p>五维平均分 · 不作自动发布结论</p>
                  <strong>
                    {result.overall.toFixed(2)} <small>/ 5</small>
                  </strong>
                  <p className="replay-note">
                    {result.meta.model} · {result.meta.at.slice(0, 10)} ·{" "}
                    {result.meta.sample
                      ? "历史第" + (runIndex + 1) + "次记录"
                      : "本次运行"}
                  </p>
                </div>
                <ScoreRadar
                  series={[
                    {
                      name: "评分",
                      values: SCORED_DIMENSIONS.map(
                        (id) =>
                          result.dimensions.find((d) => d.id === id)!.score,
                      ),
                      color: "#24624d",
                    },
                  ]}
                  height={190}
                />
              </div>
              <p className="replay-note">
                维度按低分优先排列。点击引用可以定位原文并记录你的判断。
              </p>
              <div className="dimension-list">
                {[...result.dimensions]
                  .sort((a, b) => a.score - b.score)
                  .map((d) => (
                    <DimensionCard
                      key={d.id}
                      d={d}
                      onEvidence={(q) => locate(d.id, q)}
                    />
                  ))}
                <SafetyCard s={result.safety} />
              </div>
            </>
          ) : (
            !error && (
              <div className="review-empty">
                {busy
                  ? "等待本次返回，不展示旧分数。"
                  : "文本已改变，需重新评测；也可切回历史样本。"}
              </div>
            )
          )}
        </section>
      </div>
    </>
  );
}
