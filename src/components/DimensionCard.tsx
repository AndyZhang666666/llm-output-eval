import { BAD_CASE_THRESHOLD, DIMENSIONS } from "@/lib/dimensions";
import type { DimensionScore, SafetyFlag } from "@/lib/types";

function scoreColor(score: number): string {
  if (score <= BAD_CASE_THRESHOLD)
    return "bg-red-100 text-red-800 border-red-200";
  if (score === 3) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

export function DimensionCard({
  d,
  onEvidence,
}: {
  d: DimensionScore;
  onEvidence?: (quote: string) => void;
}) {
  const def = DIMENSIONS[d.id];
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">
            {def.labelZh}{" "}
            <span className="text-xs text-zinc-500">{def.label}</span>
          </div>
          <p className="mt-1 text-sm text-zinc-700">
            {d.comment || <em className="text-zinc-400">no comment</em>}
          </p>
        </div>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 font-mono text-sm font-semibold ${scoreColor(d.score)}`}
        >
          {d.score}/5
        </span>
      </div>
      <div className="mt-2">
        <div className="text-xs text-zinc-600">原文证据</div>
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
    </div>
  );
}

export function SafetyCard({ s }: { s: SafetyFlag }) {
  const tone = s.needs_review
    ? "border-red-300 bg-red-50"
    : "border-zinc-200 bg-white";
  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
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
