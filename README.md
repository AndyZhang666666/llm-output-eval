# llm-output-eval

给长文本生成结果打分，并证明打分器本身可信。

粘贴一段剧本 → 5 个维度各给 1-5 分，每个分数附**原文逐字证据句**，外加一个不打分的安全分类。附一套校准脚本和一份如实的校验报告：同一条连打 3 次稳不稳、和人标的一不一样、换顺序会不会改判。

- **姊妹项目**：[creative-eval](https://github.com/AndyZhang666666/creative-eval)（短剧剧本评分裁判）· [filing-eval](https://github.com/AndyZhang666666/filing-eval)（公告摘要事实核查）
- **校验报告**：[`validation/judge-validation.md`](validation/judge-validation.md) —— 所有数字都能在 `validation/results/` 里找到出处

## 它解决什么问题

「让 LLM 给文本打分」不难，难的是回答一个问题：**这个分数能信几分？**

裁判是一把尺子。没校准的尺子量出来的数字看着很像结论，其实是噪声。所以这个仓库有两半：一半是评测工具本身，另一半是对裁判的校准 —— 30 条人工标注的金标集，三项检查，一份把发现的问题都写出来的报告。

## 三个页面

| 页面 | 你拿到什么 |
|---|---|
| **单篇评测** | 一段文本 → 5 维分数、每维一句评语、支撑分数的原文句子、安全分类 |
| **版本对比** | 两个版本 → 各自独立连跑 N 次，每维给均值 ± 极差；只有极差不重叠才敢说「更好 / 更差」 |
| **Bad Case** | 所有真实运行里 ≤2 分的维度，按维度和来源筛选，可导出 CSV |

## 五个维度

每一档写的是**可观察的行为**（2 分长什么样、4 分长什么样），不是「差 → 好」。

| 维度 | 1 分 | 5 分 |
|---|---|---|
| 人设一致性 persona | 角色可互换或自相矛盾 | 每句台词都能认出是谁说的 |
| 剧情连贯性 coherence | 拼不出因果链 | 每个转折都有前文铺垫 |
| 节奏与钩子密度 pacing | 大部分是填充 | 钩子按稳定节奏落地 |
| 对白自然度 dialogue | 引号里装的是旁白 | 潜台词在干活 |
| 结构完整性 structure | 半句话停住 | 结尾让开头有了新意思 |

**安全不打分。**「3/5 安全」没有意义，唯一有用的输出是「要不要人来看一眼」。所以它输出一个分类加 `needs_review` 标记。

为什么是 5 个不是 10 个：每多一维都要多花 token、多一份方差、写剧本的人更难据此改稿。5 个覆盖了剧本审读里真正反复出现的问题。

## 为什么强制逐字证据

裁判必须原文引用。引用会拿回原文比对，**不是逐字就静默丢掉**（见 `src/lib/judge.ts`）。比对前先把弯引号和全角标点归一 —— 裁判换标点是常态，一开始把这当成「改写」误杀了不少真证据（见 git 历史）。

这一步把分数从「意见」变成「可反驳的东西」：某维给了 2 分却一条证据都没留下，说明裁判在断言而非论证，这和「我不同意这个分」是两种不同的问题。

## 裁判校准

`validation/` 是校准脚本。它通过 `npm run validate:build` 引入**和应用完全相同的 prompt 和解析器** —— 否则报告描述的是一个没人用的裁判。

三项检查，全部跑在 30 条金标集上（24 条常规 + 6 条边界：空文本、乱码、跑题、人设崩塌、超长、截断）：

1. **一致性** —— 同一段文本、同一个 prompt、`temperature: 0`，跑 3 次。分数动了多少？
2. **一致率** —— 模型 3 次均值 vs 人工标注：完全一致率、±1 一致率、MAE、每维 Spearman ρ
3. **位置偏差** —— 10 对有明显优劣的文本正反两个顺序各判一次，外加 4 组 A=B 完全相同的对照，对照里任何非 tie 都是纯偏差

结论、方法、失败案例都在 [`validation/judge-validation.md`](validation/judge-validation.md)。一句话版：`temperature: 0` 不等于确定性；顺序换了裁判不翻判，但会变成「不表态」。

> 数字只对产出它们的 prompt 成立。改了 `src/lib/prompts.ts` 必须重跑 `npm run validate`。

## 怎么用

```bash
npm install
npm run dev          # http://localhost:3000
```

不需要任何环境变量。自带 key：点页头的 **设置 API Key**，粘任何兼容 OpenAI 协议的 key。它存在 `localStorage` 里，通过 `/api/evaluate` 转发 —— 服务端没有兜底 key，所以部署出去也烧不到作者的额度。

内置 OpenAI、DeepSeek、Moonshot、智谱、Gemini 五个预设；任何兼容 OpenAI 协议的端点都能用。

### 跑校准

```bash
cp .env.example .env      # LLM_BASE_URL / LLM_API_KEY / JUDGE_MODEL
npm run validate          # 构建 + 三项检查，约 5 分钟
```

迭代 prompt 时用这两个，不用每次跑全量：

```bash
npm run validate:build
node validation/spot.mjs g17           # 单条跑 3 次，只看分数
node validation/probe-raw.mjs g17 5    # 看原始 finish_reason / usage，查解析失败
```

`spot.mjs` 告诉你「解析失败了」，`probe-raw.mjs` 告诉你「为什么」。一个静默的截断 bug 就是靠这个区分抓出来的：旧的 `max_tokens: 2048` 把中文判定在 JSON 中间切断，表现成「输出不是 JSON」，而不是一个明显的预算错误。

部署见 [`DEPLOY.md`](DEPLOY.md)。

## 目录

```
src/
  app/
    page.tsx               单篇评测
    compare/page.tsx       版本对比 —— 两版各连跑 N 次
    bad-cases/page.tsx     Bad Case —— 筛选 + CSV 导出
    api/evaluate/route.ts  代理；访客的 key 只在这一次请求里存在
  lib/
    dimensions.ts          5 个维度 + 安全分类，含 1-5 档锚点
    prompts.ts             裁判 prompt —— 应用和校准脚本的唯一来源
    judge.ts               容错解析；逐字校验；截断检测
    badcases.ts            localStorage 收集 + CSV
    stats.ts               均值 / 极值 / 总体标准差
validation/
  goldset.jsonl            30 条人工标注样本
  consistency.mjs          检查 1
  agreement.mjs            检查 2
  position-bias.mjs        检查 3
  spot.mjs / probe-raw.mjs 排查工具
  judge-validation.md      报告
```

## 已知局限

- **单一标注者。** 金标集 30 条，一个人标的。够抓系统性问题（裁判对跑题输入偏松、pacing 比其他维度噪），不够宣称一个总体准确率。
- **没有标注者间一致性。** 只有一个标注者，就说不清「分歧」里多少是裁判的问题、多少是一个人的口味。
- **只测了中英文**，而且中文样本是更苛刻的情况 —— 逐字引用在中文里更费 token。
- **对比页刻意不用 pairwise 提问。** 成对比较会暴露给位置偏差（上面测过）。它对每一版独立打分，这样多于两版时数字仍可比。
