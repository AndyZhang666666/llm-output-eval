import { SCORED_DIMENSIONS } from "./dimensions";
import type { EvaluationResult, ScoredDimensionId } from "./types";
export const REVIEW_STORAGE = "llm-output-eval:reviews:v1";
export const REVIEW_STATES = {
  unreviewed: "待复核",
  supported: "证据支持该判断",
  unsupported: "证据不足或评语存疑",
  needs_context: "需要更多上下文",
} as const;
export type ReviewState = keyof typeof REVIEW_STATES;
export type Review = {
  key: string;
  dimension: ScoredDimensionId;
  state: ReviewState;
  note: string;
  updatedAt: string;
};
export function recordKey(
  sample: string,
  index: number,
  text: string,
  result: EvaluationResult,
) {
  let hash = 2166136261;
  for (const ch of text + JSON.stringify(result.dimensions)) {
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  }
  return [
    sample,
    index,
    result.meta.model,
    result.meta.at,
    (hash >>> 0).toString(16),
  ].join(":");
}
export function decodeReviews(raw: string | null): Review[] {
  if (!raw) return [];
  if (raw.length > 700000) throw Error("复核记录过大");
  const p: unknown = JSON.parse(raw);
  if (
    !p ||
    typeof p !== "object" ||
    !("version" in p) ||
    p.version !== 1 ||
    !("items" in p) ||
    !Array.isArray(p.items) ||
    p.items.length > 500
  )
    throw Error("复核记录格式不支持");
  return p.items.map((x: Review) => {
    if (
      !x ||
      typeof x.key !== "string" ||
      x.key.length > 800 ||
      !SCORED_DIMENSIONS.includes(x.dimension) ||
      !Object.hasOwn(REVIEW_STATES, x.state) ||
      typeof x.note !== "string" ||
      x.note.length > 500 ||
      typeof x.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(x.updatedAt))
    )
      throw Error("复核字段不支持");
    return {
      key: x.key,
      dimension: x.dimension,
      state: x.state,
      note: x.note,
      updatedAt: x.updatedAt,
    };
  });
}
export function reviewReport(
  key: string,
  sourceText: string,
  result: EvaluationResult,
  items: Review[],
) {
  return {
    version: 1,
    recordKey: key,
    sourceText,
    originalResult: result,
    reviews: items.filter((x) => x.key === key),
    limits: [
      "复核为访客在本机记录的判断，不改动原始评分或历史校验指标",
      "引用定位允许标点、空白与大小写归一；定位成功不等于论证成立",
      "未复核不等于通过，安全分类不等于发布许可",
    ],
  };
}
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
