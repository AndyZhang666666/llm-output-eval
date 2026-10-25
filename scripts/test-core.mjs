import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  parseJudgeOutput,
  JudgeParseError,
  JudgeTruncatedError,
} = require("./.core-test/judge.js");
const { locateEvidence } = require("./.core-test/evidence.js");
const { aggregateRuns, comparisonReading } = require("./.core-test/stats.js");
const {
  decodeReviews,
  recordKey,
  reviewReport,
} = require("./.core-test/review.js");
const { decodeBadCases, toCsv } = require("./.core-test/records.js");
const { evaluateText } = require("./.core-test/api.js");
const ids = ["persona", "coherence", "pacing", "dialogue", "structure"],
  source = "角色说：“原文测试证据。” 随后离开。";
const data = () => ({
  dimensions: ids.map((id) => ({
    id,
    score: 3,
    comment: "可复核判断",
    evidence: ["原文测试证据。"],
  })),
  safety: {
    category: "none",
    needs_review: false,
    comment: "模型判断，仍需人工复核",
    evidence: [],
  },
});
const parsed = () =>
  parseJudgeOutput(JSON.stringify(data()), source, { model: "mock" });
test("合法五维数值和数字字符串可解析，平均分从维度计算", () => {
  const d = data();
  d.dimensions[0].score = "4";
  const r = parseJudgeOutput(JSON.stringify(d), source, { model: "mock" });
  assert.equal(r.overall, 3.2);
  assert.equal(r.dimensions[0].score, 4);
});
test("非法分数不被补成1分、四舍五入或截断数字", () => {
  for (const value of [undefined, null, true, 0, 6, 3.2, "", "bad", "3 bad"]) {
    const d = data();
    d.dimensions[0].score = value;
    assert.throws(
      () => parseJudgeOutput(JSON.stringify(d), source, { model: "mock" }),
      JudgeParseError,
    );
  }
});
test("缺失或重复维度拒绝，截断JSON独立报错", () => {
  const d = data();
  d.dimensions.push(d.dimensions[0]);
  assert.throws(
    () => parseJudgeOutput(JSON.stringify(d), source, { model: "mock" }),
    /duplicate/,
  );
  assert.throws(
    () => parseJudgeOutput('{"dimensions":[', source, { model: "mock" }),
    JudgeTruncatedError,
  );
});
test("缺失/非法安全分类不伪造none，非none总是要求人工", () => {
  for (const safety of [
    undefined,
    {},
    { category: "unknown", needs_review: false },
    { category: "none", needs_review: "false" },
  ]) {
    const d = data();
    d.safety = safety;
    assert.throws(
      () => parseJudgeOutput(JSON.stringify(d), source, { model: "mock" }),
      JudgeParseError,
    );
  }
  const d = data();
  d.safety.category = "violence";
  assert.equal(
    parseJudgeOutput(JSON.stringify(d), source, { model: "mock" }).safety
      .needs_review,
    true,
  );
});
test("归一定位返回原文索引，重复引用标明多处，改写不匹配", () => {
  const s = "😀他说：“Hello， 世界！” 然后说Hello,世界!";
  const q = "“hello,世界!”";
  const m = locateEvidence(s, q);
  assert.ok(m);
  assert.equal(s.slice(m.start, m.end), "“Hello， 世界！”");
  assert.equal(m.method, "normalized");
  assert.equal(locateEvidence(s, "他提到了别的东西"), null);
  assert.equal(locateEvidence("重复证据；重复证据", "重复证据").matches, 2);
});
test("非原文引用被剔除，低分仍保留且可见缺证据", () => {
  const d = data();
  d.dimensions[0].score = 1;
  d.dimensions[0].evidence = ["完全捏造的证据句"];
  const r = parseJudgeOutput(JSON.stringify(d), source, { model: "mock" });
  assert.equal(r.dimensions[0].score, 1);
  assert.deepEqual(r.dimensions[0].evidence, []);
});
test("聚合不为缺失维度补1分，不接受与维度矛盾的总分", () => {
  const r = parsed();
  assert.equal(aggregateRuns([r, r]).overall.mean, 3);
  assert.throws(() =>
    aggregateRuns([{ ...r, dimensions: r.dimensions.slice(1) }]),
  );
  assert.throws(() => aggregateRuns([{ ...r, overall: 5 }]));
  assert.throws(() => aggregateRuns([]));
});
test("比较只描述样本，不把极差分离称作显著改善或稳定", () => {
  const a = { mean: 2, min: 2, max: 2 },
    b = { mean: 4, min: 4, max: 4 };
  assert.match(comparisonReading(a, b, 1, 1).label, /仅单次/);
  assert.match(comparisonReading(a, b, 3, 3).label, /极差未重叠/);
  assert.doesNotMatch(
    comparisonReading(a, b, 3, 3).label,
    /better|显著|确定|更好/,
  );
  assert.equal(comparisonReading(a, a, 3, 3).delta, 0);
});
test("18条历史输出聚合可用且没有改动原记录", () => {
  const d = JSON.parse(fs.readFileSync("src/data/replay.json"));
  const before = JSON.stringify(d);
  assert.equal(d.items.length, 6);
  for (const item of d.items) {
    assert.equal(item.runs.length, 3);
    aggregateRuns(item.runs);
  }
  assert.equal(JSON.stringify(d), before);
});
test("复核按具体文本与运行隔离，导出不改变原分数", () => {
  const r = parsed(),
    key = recordKey("x", 0, source, r);
  assert.notEqual(key, recordKey("x", 1, source, r));
  assert.notEqual(key, recordKey("x", 0, source + "变动", r));
  const items = [
    {
      key,
      dimension: "persona",
      state: "unsupported",
      note: "证据不足",
      updatedAt: "2026-10-25T01:00:00Z",
    },
  ];
  assert.deepEqual(decodeReviews(JSON.stringify({ version: 1, items })), items);
  const before = JSON.stringify(r),
    packet = reviewReport(key, source, r, [
      ...items,
      { ...items[0], key: "else" },
    ]);
  assert.equal(packet.reviews.length, 1);
  assert.equal(JSON.stringify(r), before);
  assert.equal(packet.originalResult.dimensions[0].score, 3);
  assert.throws(() =>
    decodeReviews(
      JSON.stringify({
        version: 1,
        items: [{ ...items[0], state: "auto-approved" }],
      }),
    ),
  );
});
test("低分记录损坏不崩溃为真记录，CSV转义公式与引号", () => {
  assert.throws(() => decodeBadCases("{}"));
  assert.throws(() => decodeBadCases('[{"score":1}]'));
  const b = {
    id: "one",
    source: "=1+2",
    dimension: "persona",
    score: 1,
    comment: '他说"不支持"',
    evidence: "@wrong",
    at: "2026-10-25T01:00:00Z",
  };
  assert.deepEqual(decodeBadCases(JSON.stringify([b])), [b]);
  const csv = toCsv([b]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /'=1\+2/);
  assert.match(csv, /'@wrong/);
  assert.match(csv, /""不支持""/);
});
const cfg = {
  apiKey: "mock-no-real-secret",
  baseUrl: "https://mock.invalid/v1",
  model: "mock",
};
test("请求额度明确：非法输入0次，失败不暗中重试", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("", { status: 503 });
  };
  try {
    for (const n of [0, NaN, 1.5, 6])
      await assert.rejects(evaluateText(source, n, cfg));
    await assert.rejects(evaluateText(source, 1, { ...cfg, apiKey: "" }));
    assert.equal(calls, 0);
    await assert.rejects(evaluateText(source, 1, cfg));
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("取消停止整个批次，不自动重试或生成分数", async () => {
  const original = globalThis.fetch;
  let calls = 0,
    aborted = 0;
  globalThis.fetch = async (_, opts) =>
    new Promise((resolve, reject) => {
      calls++;
      opts.signal.addEventListener("abort", () => {
        aborted++;
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
  try {
    const c = new AbortController(),
      pending = evaluateText(source, 3, cfg, c.signal);
    c.abort();
    await assert.rejects(pending, /取消/);
    assert.equal(calls, 3);
    assert.equal(aborted, 3);
  } finally {
    globalThis.fetch = original;
  }
});
