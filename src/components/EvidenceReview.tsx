"use client";
import { DIMENSIONS } from "@/lib/dimensions";
import { locateEvidence } from "@/lib/evidence";
import {
  REVIEW_STATES,
  downloadJson,
  reviewReport,
  type Review,
  type ReviewState,
} from "@/lib/review";
import { useReviews, storeReviews, currentReviews } from "@/lib/review-store";
import type { EvaluationResult, ScoredDimensionId } from "@/lib/types";
export function EvidenceReview({
  recordKey,
  sourceText,
  result,
  dimension,
  quote,
  sourceLabel,
  showContext = true,
}: {
  recordKey: string;
  sourceText: string;
  result: EvaluationResult;
  dimension: ScoredDimensionId;
  quote: string;
  sourceLabel?: string;
  showContext?: boolean;
}) {
  const { items, ready, notice } = useReviews();
  const current = items.find(
      (x) => x.key === recordKey && x.dimension === dimension,
    ),
    state = current?.state ?? "unreviewed",
    note = current?.note ?? "";
  const located = quote ? locateEvidence(sourceText, quote) : null;
  const selected = result.dimensions.find((d) => d.id === dimension)!;
  const count = items.filter(
    (x) => x.key === recordKey && x.state !== "unreviewed",
  ).length;
  const store = storeReviews;
  function update(nextState: ReviewState, nextNote: string) {
    const prior = currentReviews();
    const entry: Review = {
      key: recordKey,
      dimension,
      state: nextState,
      note: nextNote.slice(0, 500),
      updatedAt: new Date().toISOString(),
    };
    store(
      [
        ...prior.filter(
          (x) => !(x.key === recordKey && x.dimension === dimension),
        ),
        entry,
      ].slice(-500),
    );
  }
  return (
    <section className="evidence-review" aria-label="原文证据复核">
      <div className="review-heading">
        <h2>核对原文与评语</h2>
        <span>已复核 {count}/5 维</span>
      </div>
      <p className="replay-note">
        当前维度：{DIMENSIONS[dimension].labelZh} · 原评分 {selected.score}
        /5。可点击右侧引用切换定位。
      </p>
      {located && showContext ? (
        <>
          <p className="evidence-context">
            {sourceText.slice(Math.max(0, located.start - 60), located.start)}
            <mark data-evidence-match>
              {sourceText.slice(located.start, located.end)}
            </mark>
            {sourceText.slice(located.end, located.end + 100)}
          </p>
          <p className="replay-note">
            {located.method === "exact"
              ? "逐字定位"
              : "按标点、空白和大小写归一定位"}{" "}
            ·{" "}
            {located.matches > 1
              ? located.matches + "处匹配，显示第1处"
              : "1处匹配"}
            。找到引用不等于评语成立。
          </p>
        </>
      ) : !located ? (
        <p className="review-empty">
          {quote
            ? "这条原始引用无法在当前原文中定位，请核查原始记录。"
            : "此维度没有可定位引用，仍可记录“证据不足”或需要上下文。"}
        </p>
      ) : <p className="replay-note">引用已在左侧原文标出，仍需判断它是否支持原评语。</p>}
      <blockquote>{selected.comment || "原记录没有评语。"}</blockquote>
      <label className="review-field">
        你的复核判断
        <select
          value={state}
          disabled={!ready}
          onChange={(e) => update(e.target.value as ReviewState, note)}
        >
          {Object.entries(REVIEW_STATES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="review-field">
        修改建议或复核备注
        <textarea
          maxLength={500}
          rows={3}
          value={note}
          disabled={!ready}
          onChange={(e) => update(state, e.target.value)}
          placeholder="例如：引用存在，但不能支撑‘没有可识别角色’这一判断。"
        />
      </label>
      <p className="replay-note" role="status">
        {notice}
      </p>
      <div className="review-actions">
        <button
          className="primary"
          disabled={!ready}
          onClick={() =>
            downloadJson(
              {...reviewReport(recordKey, sourceText, result, items),source:sourceLabel||"见原记录的来源声明"},
              "eval-review.json",
            )
          }
        >
          导出本篇复核
        </button>
        <button
          disabled={!ready || !items.some((x) => x.key === recordKey)}
          onClick={() => store(items.filter((x) => x.key !== recordKey))}
        >
          清除本篇复核
        </button>
      </div>
    </section>
  );
}
