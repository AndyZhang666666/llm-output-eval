import agreement from "../../../validation/results/agreement.json";
import consistency from "../../../validation/results/consistency.json";
import { DIMENSIONS, SCORED_DIMENSIONS } from "@/lib/dimensions";
import Link from "next/link";

export default function ValidationPage() {
  return (
    <div className="space-y-6">
      <div className="eval-intro">
        <h1>先确认，尺子本身靠谱吗。</h1>
        <p>
          以下为仓库保存的历史校验，不是本次重新调用模型的结果。高排序相关，不等于每个分数都准确。
        </p>
      </div>
      <section className="replay-panel">
        <h2>这次校验能支持什么</h2>
        <p>
          模型：{consistency.model} · 记录于 {consistency.at.slice(0, 10)} ·{" "}
          {consistency.items.length} 条作者标注样本，每条 {consistency.runs}{" "}
          次。
        </p>
        <p className="replay-note">
          标注者同时编写了评分规则，缺少独立复核；这些结果只能描述当前样本与该版裁判，不能外推到所有文本。
        </p>
        <p className="replay-note">
          当前版本新增严格字段校验、原文定位与本机复核；没有重新调用模型。这些历史成绩不代表新版本已通过新的真实模型效果实验。
        </p>
        <div className="replay-facts">
          <div>
            <span>总分排序相关 Spearman ρ</span>
            <strong>{agreement.overall.spearman}</strong>
            <span>与作者标注排序比较，不是准确率</span>
          </div>
          <div>
            <span>五维三次完全一致的样本</span>
            <strong>
              {consistency.fully_stable_items} / {consistency.items.length}
            </strong>
            <span>temperature 0 也不代表确定性</span>
          </div>
        </div>
      </section>
      <section className="replay-panel">
        <h2>把一致性拆开看</h2>
        <div className="replay-table-wrap">
          <table className="replay-table">
            <thead>
              <tr>
                <th>维度</th>
                <th>与作者 ±1 分</th>
                <th>平均标准差</th>
                <th>发生波动的样本</th>
              </tr>
            </thead>
            <tbody>
              {SCORED_DIMENSIONS.map((id) => (
                <tr key={id}>
                  <th>{DIMENSIONS[id].labelZh}</th>
                  <td>
                    {Math.round(agreement.per_dimension[id].within_1 * 100)}%
                  </td>
                  <td>{consistency.summary[id].mean_sd.toFixed(2)}</td>
                  <td>
                    {consistency.summary[id].items_with_any_change} /{" "}
                    {consistency.items.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="replay-panel">
        <h2>分数对了，理由也可能错</h2>
        <p>
          报告保留了人物判断与原文不符、作者标签需修正等分歧。低分应触发复核，而不是直接让模型重写。三个重复样本的极差也不是置信区间。
        </p>
        <div className="replay-actions">
          <Link href="/bad-cases/">查看具体低分证据</Link>
          <a href="https://github.com/AndyZhang666666/llm-output-eval/blob/main/validation/judge-validation.md">
            阅读完整校验报告
          </a>
          <a href="https://github.com/AndyZhang666666/llm-output-eval/tree/main/validation/results">
            核对原始结果
          </a>
        </div>
      </section>
    </div>
  );
}
