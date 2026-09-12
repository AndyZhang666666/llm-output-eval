import type { EvaluationResult } from "./types";

/**
 * Sample data for browsing the UI without an API key.
 *
 * These are REAL judge outputs (gemini-2.5-flash, temperature 0) captured
 * while building the app, frozen so the interface can be explored offline.
 * Every screen that renders them shows a "示例数据 / sample data" banner; they
 * must never be presented as a live result. `meta.sample` is true on all of
 * them and the UI keys off that flag, not off this file.
 */

export const SAMPLE_TEXT = `林晚推开门，屋里一片漆黑。
"你回来了。"父亲的声音从沙发那边传来，没有开灯。
"爸，你怎么不开灯？"
"电费。"他顿了顿，"你妈的药又涨价了。"
林晚没说话，把手里的辞职信塞回包里。她原本准备今晚告诉他，她不想再去那家公司了。
"吃了吗？"父亲问。
"吃了。"她撒了谎。`;

export const SAMPLE_TEXT_V2 = `林晚推开门，屋里一片漆黑。
"你回来了。"父亲的声音从沙发那边传来，没有开灯。
"爸，你怎么不开灯？"
"电费。"他顿了顿，"你妈的药又涨价了。"
林晚没说话，把手里的辞职信塞回包里。她原本准备今晚告诉他，她不想再去那家公司了。
"吃了吗？"父亲问。
"吃了。"她撒了谎。
她走进厨房，摸黑打开冰箱。里面只有半瓶酱油和三个鸡蛋。
"爸，"她背对着客厅，"我明天涨工资了。"
沙发那边沉默了很久。然后她听见打火机的声音。
"那就好。"父亲说。`;

export const SAMPLE_RESULT: EvaluationResult = {
  dimensions: [
    {
      id: "persona",
      score: 4,
      comment: "父亲节俭而隐忍，林晚体谅家庭又压抑自身意愿，人物行为基本一致且有明确性格倾向。",
      evidence: ['"电费。"他顿了顿，"你妈的药又涨价了。"', "林晚没说话，把手里的辞职信塞回包里。"],
    },
    {
      id: "coherence",
      score: 4,
      comment: "黑暗、药费、辞职和撒谎之间形成清晰的因果与情绪联系，但辞职信最终如何处理尚未展开。",
      evidence: ["林晚没说话，把手里的辞职信塞回包里。", '"吃了。"她撒了谎。'],
    },
    {
      id: "pacing",
      score: 5,
      comment: "篇幅短而信息密度高，几乎每个动作和对白都推动家庭压力与人物冲突，结尾还留下了继续阅读的悬念。",
      evidence: ['"电费。"他顿了顿，"你妈的药又涨价了。"', "她原本准备今晚告诉他，她不想再去那家公司了。"],
    },
    {
      id: "dialogue",
      score: 4,
      comment: "对白简短自然并带有潜台词，能够表现父亲的经济压力和林晚的隐瞒，只有少量信息承担了直接交代功能。",
      evidence: ['"爸，你怎么不开灯？"', '"吃了。"她撒了谎。'],
    },
    {
      id: "structure",
      score: 2,
      comment: "文本建立了家庭经济困境与辞职冲突，但停留在铺垫和悬念阶段，没有形成完整的后续发展或结局。",
      evidence: ["她原本准备今晚告诉他，她不想再去那家公司了。", '"吃了。"她撒了谎。'],
    },
  ],
  safety: {
    category: "none",
    needs_review: false,
    comment: "文本仅描写家庭经济压力和人物隐瞒，没有明显的安全风险内容。",
    evidence: [],
  },
  overall: 3.8,
  meta: { model: "gemini-2.5-flash", at: "2026-09-12T16:07:50.830Z", sample: true, latency_ms: 18932 },
};
