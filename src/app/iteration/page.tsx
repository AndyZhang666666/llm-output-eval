import Link from "next/link";

export default function IterationPage() {
  return (
    <div className="space-y-6">
      <div className="eval-intro">
        <h1>从评分规则，到评审工作台。</h1>
        <p>
          这是一个项目的两轮迭代，不是两个独立作品。先定义怎样评，再解决如何比较、复查与使用。
        </p>
      </div>
      <section className="replay-panel">
        <h2>V1 · creative-eval：先校准尺子</h2>
        <p>
          为短剧片段建立五维评分锚点、原文证据要求和非法输入拦截。发现裁判偏松、解析失败后，分别修改打分基准与输出校验。
        </p>
        <p className="replay-note">
          V1 使用 40 条构造样本，其中 32
          条带作者标注。其维度、规则和样本口径独立保留；这里不将旧版成绩与 V2
          合并，也不据此声称新版质量提高。
        </p>
        <div className="replay-actions">
          <a href="https://github.com/AndyZhang666666/creative-eval">
            V1 源码与历史校验
          </a>
          <a href="https://github.com/AndyZhang666666/creative-eval/blob/main/docs/PRD.md">
            V1 产品判断
          </a>
        </div>
      </section>
      <section className="replay-panel">
        <h2>V2 · llm-output-eval：让评审可追溯</h2>
        <p>
          将评分做成单篇核验、重复版本对照、低分案例整理和裁判校验。默认用历史回放，让没有接口的访客也能检查完整路径。
        </p>
        <p className="replay-note">
          V2 的历史校验使用另一套 30 条作者标注样本。公开回放取其中 6 个样本的
          18 次输出，不是新跑的实验。作者同时编写规则，仍缺独立复核。
        </p>
        <div className="replay-actions">
          <Link href="/">查看原文与评分</Link>
          <Link href="/compare/">比较版本与波动</Link>
          <Link href="/bad-cases/">查看低分证据</Link>
          <Link href="/validation/">检查裁判</Link>
        </div>
      </section>
      <section className="replay-panel">
        <h2>下一轮不急着加更多评分</h2>
        <p>
          优先独立复核标签、预留未参与调参的样本，再测试不同裁判。重复运行只能看稳定性，引用原文也不自动证明判断正确。产品目标是减少有依据的复查成本，不是用高分替代人工终审。
        </p>
      </section>
    </div>
  );
}
