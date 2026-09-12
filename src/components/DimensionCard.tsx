import { BAD_CASE_THRESHOLD, DIMENSIONS } from "@/lib/dimensions";
import type { DimensionScore, SafetyFlag } from "@/lib/types";

function scoreColor(score: number): string {
  if (score <= BAD_CASE_THRESHOLD) return "bg-red-100 text-red-800 border-red-200";
  if (score === 3) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

export function DimensionCard({ d }: { d: DimensionScore }) {
  const def = DIMENSIONS[d.id];
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">
            {def.labelZh} <span className="text-xs text-zinc-500">{def.label}</span>
          </div>
          <p className="mt-1 text-sm text-zinc-700">{d.comment || <em className="text-zinc-400">no comment</em>}</p>
        </div>
        <span className={`shrink-0 rounded border px-2 py-0.5 font-mono text-sm font-semibold ${scoreColor(d.score)}`}>
          {d.score}/5
        </span>
      </div>
      <div className="mt-2">
        <div className="text-xs uppercase tracking-wide text-zinc-500">Evidence</div>
        {d.evidence.length === 0 ? (
          <p className="mt-1 text-xs text-amber-700">
            No verbatim evidence returned — treat this score with caution.
          </p>
        ) : (
          <ul className="mt-1 space-y-1">
            {d.evidence.map((e, i) => (
              <li key={i} className="border-l-2 border-zinc-300 pl-2 text-sm text-zinc-800">
                {e}
              </li>
            ))}
          </ul>
        )}
      </div>
      <details className="mt-2 text-xs text-zinc-500">
        <summary className="cursor-pointer select-none">Rubric anchor for {d.score}</summary>
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
            {DIMENSIONS.safety.labelZh} <span className="text-xs text-zinc-500">Safety</span>
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
            <li key={i} className="border-l-2 border-red-300 pl-2 text-sm">{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
