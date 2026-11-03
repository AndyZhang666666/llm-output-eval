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
import { ActionList } from './ActionList';
import { currentActions } from '@/lib/action-store';
import type { ComparisonConditions } from '@/lib/task-package';
export function EvidenceReview({
  recordKey,
  sourceText,
  result,
  dimension,
  quote,
  sourceLabel,
  conditions,
  showContext = true,
  compact = false,
}: {
  recordKey: string;
  sourceText: string;
  result: EvaluationResult;
  dimension: ScoredDimensionId;
  quote: string;
  sourceLabel?: string;
  conditions?: ComparisonConditions;
  showContext?: boolean;
  compact?: boolean;
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
  function update(nextState: ReviewState, nextNote: string, humanScore = current?.humanScore) {
    const prior = currentReviews();
    const entry: Review = {
      key: recordKey,
      dimension,
      state: nextState,
      note: nextNote.slice(0, 500),
      ...(humanScore === undefined ? {} : {humanScore}),
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
      {!compact && <><div className="review-heading">
        <h2>核对原文与评语</h2>
        <span>已复核 {count}/5 维</span>
      </div>
      <p className="replay-note">
        当前维度：{DIMENSIONS[dimension].labelZh} · 原评分 {selected.score}
        /5。可点击右侧引用切换定位。
      </p></>}
      {compact && <h3>你的复核</h3>}
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
      ) : <p className="replay-note">引用已在原文中标出，仍需判断它是否支持原评语。</p>}
      {!compact && <blockquote>{selected.comment || "原记录没有评语。"}</blockquote>}
      <fieldset className="review-decisions" disabled={!ready}>
        <legend>你的复核判断</legend>
          {Object.entries(REVIEW_STATES).map(([key, label]) => (
            <label key={key} data-selected={state===key}><input type="radio" name={'review-state-'+recordKey+'-'+dimension} checked={state===key} onChange={()=>update(key as ReviewState,note)}/><span>{label}</span></label>
          ))}
      </fieldset>
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
      <div className="human-reference">
        <label className="review-field">人工参考分（选填，不是金标）<select aria-label="人工参考分" disabled={!ready} value={current?.humanScore ?? ''} onChange={e=>{
          const value=e.target.value===''?undefined:Number(e.target.value);
          // Passing undefined must clear this optional field rather than using the default.
          const prior=currentReviews().filter(x=>!(x.key===recordKey&&x.dimension===dimension));
          store([...prior,{key:recordKey,dimension,state,note,...(value===undefined?{}:{humanScore:value}),updatedAt:new Date().toISOString()}]);
        }}><option value="">未填写</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label>
        <p>模型原分 {selected.score}/5 · 人工参考 {current?.humanScore===undefined?'未填写':current.humanScore+'/5'} · 人工−模型 {current?.humanScore===undefined?'暂无':(current.humanScore-selected.score>0?'+':'')+(current.humanScore-selected.score)}</p>
        <small>状态与参考分分别记录；填分不等于证据已支持。撤回不改原分或独立处理项。</small>
        <button disabled={!current} onClick={()=>store(currentReviews().filter(x=>!(x.key===recordKey&&x.dimension===dimension)))}>撤回本维度人工层</button>
      </div>
      <ActionList key={recordKey+dimension} recordKey={recordKey} dimension={dimension} canAdd={state==='unsupported'||state==='needs_context'}/>
      <p className="replay-note" role="status">
        {notice}
      </p>
      <div className="review-actions">
        <button
          className="primary"
          disabled={!ready}
          onClick={() =>
            downloadJson(
              {...reviewReport(recordKey, sourceText, result, items),source:sourceLabel||"见原记录的来源声明",conditions,actions:currentActions().filter(a=>a.key===recordKey)},
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
