"use client";

import { useState } from "react";
import Link from "next/link";
import { replayItem, replayStats } from "@/lib/replay";
import { DIMENSIONS, SCORED_DIMENSIONS } from "@/lib/dimensions";
import { formatRange } from "@/lib/stats";
import { downloadJson } from "@/lib/review";

export function ReplayCompare() {
  const [control, setControl] = useState(false);
  const ids = control ? ["g01", "g01"] : ["e06", "g07"];
  const a = replayItem(ids[0]),
    b = replayItem(ids[1]);
  const sa = replayStats(a.id),
    sb = replayStats(b.id);
  const structureA = sa.stats.find((d) => d.id === "structure")!;
  const structureB = sb.stats.find((d) => d.id === "structure")!;
  const delta = structureB.mean - structureA.mean;
  return (
    <div className="space-y-6">
      <div className="eval-intro">
        <h1>改了以后，真的更好吗？</h1>
        <p>
          同一故事的截断稿与完整稿，各保留 3
          次历史评分。先看差异，再回到原文判断它是否值得改。
        </p>
      </div>
      <div className="replay-toolbar" aria-label="选择对照样本">
        <button aria-pressed={!control} onClick={() => setControl(false)}>
          截断稿与完整稿
        </button>
        <button aria-pressed={control} onClick={() => setControl(true)}>
          同文自对照
        </button>
        <span>历史回放 · 不调用模型 · 每版 {sa.runs.length} 次记录</span>
        <button
          onClick={() =>
            downloadJson(
              {
                version: 1,
                kind: "historical-comparison",
                samples: [a, b],
                aggregates: [sa, sb],
                limits: [
                  "同故事的截断与完整历史样本，不是线上改稿实验",
                  "极差只描述已保存记录，不是置信区间或显著性",
                  "同文自对照读取相同记录，不代表独立重复评测",
                ],
              },
              "eval-historical-comparison.json",
            )
          }
        >
          导出历史对照
        </button>
      </div>
      <section className="replay-decision" aria-live="polite">
        <div>
          <h2>
            {control
              ? "相同记录，不应制造一个赢家。"
              : "完整样本的结构分，在这组记录中更高。"}
          </h2>
          <p>
            {control
              ? "两侧读取同一份原始记录，差值应为零。即便如此，单侧不同运行之间仍可能有波动。"
              : "这里只比较补完前后的历史样本，不代表一次线上改稿实验，也不证明任何改写都有效。"}
          </p>
        </div>
        <div className="replay-delta">
          <span>结构完整性 · 3 次均值</span>
          <strong>
            {structureA.mean.toFixed(2)} <span>→</span>{" "}
            {structureB.mean.toFixed(2)}
          </strong>
          <span>
            差值 {delta > 0 ? "+" : ""}
            {delta.toFixed(2)} / 5
          </span>
        </div>
      </section>
      <div className="replay-compare-grid">
        <section className="replay-panel">
          <h2>五个维度，分别比较</h2>
          <div className="replay-table-wrap">
            <table className="replay-table">
              <caption>
                均值（最小值～最大值）；区间是已保存运行的极差，不是置信区间。
              </caption>
              <thead>
                <tr>
                  <th>维度</th>
                  <th>V1 均值（极差）</th>
                  <th>V2 均值（极差）</th>
                  <th>差值</th>
                </tr>
              </thead>
              <tbody>
                {SCORED_DIMENSIONS.map((id, i) => {
                  const x = sa.stats[i],
                    y = sb.stats[i];
                  const d = Math.round((y.mean - x.mean) * 100) / 100;
                  return (
                    <tr key={id}>
                      <th>{DIMENSIONS[id].labelZh}</th>
                      <td>{formatRange(x)}</td>
                      <td>{formatRange(y)}</td>
                      <td className={d > 0 ? "replay-positive" : ""}>
                        {d > 0 ? "+" : ""}
                        {d.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="replay-note">
            每版只有 3
            次记录，不能据此声称统计显著或保证模型稳定。存在重叠时，优先复核证据而不是追逐小数差。
          </p>
        </section>
        <aside className="replay-panel">
          <h2>为什么有这个差别</h2>
          <p className="replay-note">
            下面是各版本第 1 次记录中的结构评语，不是重新生成的解释。
          </p>
          <h3>V1 · {a.id}</h3>
          <p>
            {a.runs[0].dimensions.find((d) => d.id === "structure")!.comment}
          </p>
          <h3>V2 · {b.id}</h3>
          <p>
            {b.runs[0].dimensions.find((d) => d.id === "structure")!.comment}
          </p>
          <Link href={`/?sample=${a.id}&dimension=structure`} className="replay-link">
            回到低分原文，查看修改依据 →
          </Link>
        </aside>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[a, b].map((item, index) => (
          <section className="replay-panel" key={index}>
            <h2>
              V{index + 1} · {item.label}
            </h2>
            <p className="replay-story">{item.text}</p><Link href={`/?sample=${item.id}&dimension=structure`}>复核此版本的结构评语 →</Link>
            <details className="replay-records">
              <summary>查看 {item.runs.length} 次原始分数及来源</summary>
              <ul>
                {item.runs.map((run, i) => (
                  <li key={i}>
                    第 {i + 1} 次 ·{" "}
                    {run.dimensions
                      .map((d) => `${DIMENSIONS[d.id].labelZh} ${d.score}`)
                      .join(" / ")}{" "}
                    · {run.meta.at}
                  </li>
                ))}
              </ul>
              <a
                href={`https://github.com/AndyZhang666666/llm-output-eval/blob/main/validation/results/consistency.json`}
              >
                GitHub 原始记录 · {item.id}
              </a>
            </details>
          </section>
        ))}
      </div>
    </div>
  );
}
