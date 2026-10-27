import { BAD_CASE_THRESHOLD, DIMENSIONS } from "@/lib/dimensions";
import type { DimensionScore, SafetyFlag } from "@/lib/types";

export function DimensionCard({
  d,
  onEvidence,
}: {
  d: DimensionScore;
  onEvidence?: (quote: string) => void;
}) {
  const def = DIMENSIONS[d.id];
  return (
    <article className="dimension-card" data-low={d.score <= BAD_CASE_THRESHOLD}>
      <div className="dimension-top">
        <div>
          <div className="dimension-title">
            {def.labelZh}{" "}
            <span className="text-xs text-zinc-500">{def.label}</span>
          </div>
          <p className="mt-1 text-sm text-zinc-700">
            {d.comment || <em className="text-zinc-400">no comment</em>}
          </p>
        </div>
        <span className="dimension-score" aria-label={`${def.labelZh} ${d.score} 分，满分 5 分`}>
          {d.score}<small>/ 5</small>
        </span>
      </div>
      <div className="dimension-evidence">
        <span>裁判引用</span>
        {d.evidence.length === 0 ? (
          <p className="mt-1 text-xs text-amber-700">
            No verbatim evidence returned — treat this score with caution.
          </p>
        ) : (
          <ul className="mt-1 space-y-1">
            {d.evidence.map((e, i) => (
              <li
                key={i}
                className="border-l-2 border-zinc-300 pl-2 text-sm text-zinc-800"
              >
                {onEvidence ? (
                  <button
                    className="evidence-link"
                    onClick={() => onEvidence(e)}
                    aria-label={"定位" + def.labelZh + "证据" + (i + 1)}
                  >
                    {e}
                    <span>定位原文 →</span>
                  </button>
                ) : (
                  e
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {onEvidence && d.evidence.length === 0 && (
        <button className="evidence-link" onClick={() => onEvidence("")}>
          复核此维度 →
        </button>
      )}
      <details className="mt-2 text-xs text-zinc-500">
        <summary className="cursor-pointer select-none">
          为什么是 {d.score} 分：查看评分锚点
        </summary>
        <p className="mt-1">{def.anchors[d.score - 1]}</p>
      </details>
    </article>
  );
}

export function SafetyCard({ s }: { s: SafetyFlag }) {
  return (
    <div className="safety-card" data-review={s.needs_review}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">
            {DIMENSIONS.safety.labelZh}{" "}
            <span className="text-xs text-zinc-500">Safety</span>
          </div>
          <p className="mt-1 text-sm text-zinc-700">{s.comment}</p>
        </div>
        <span className="shrink-0 rounded border border-zinc-300 bg-white px-2 py-0.5 font-mono text-xs">
          {s.category} · {s.needs_review ? "needs review" : "no review"}
        </span>
      </div>
      {s.evidence.length > 0 && (
        <ul className="mt-2 space-y-1">
          {s.evidence.map((e, i) => (
            <li key={i} className="border-l-2 border-red-300 pl-2 text-sm">
              {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
