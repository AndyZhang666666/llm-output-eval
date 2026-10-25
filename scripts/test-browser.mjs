import assert from "node:assert/strict";
import fs from "node:fs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const url = process.env.TEST_URL || "http://127.0.0.1:8804/llm-output-eval/";
const out = process.env.EVIDENCE_DIR || "/tmp/eval-browser";
fs.mkdirSync(out, { recursive: true });
const replay = JSON.parse(fs.readFileSync("src/data/replay.json", "utf8"));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await ctx.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let requests = 0,
  mode = "ok",
  release;
const ids = ["persona", "coherence", "pacing", "dialogue", "structure"];
await page.route("https://eval-mock.invalid/**", async (route) => {
  requests++;
  if (mode === "hold") await new Promise((r) => (release = r));
  const content =
    route.request().postDataJSON()?.messages?.at(-1)?.content || "";
  const score = content.includes("B稿") ? 4 : content.includes("A稿") ? 2 : 3;
  const result = {
    dimensions: ids.map((id, i) => ({
      id,
      score:
        mode === "invalid" && i === 0
          ? "bad"
          : score === 3 && i === 0
            ? 2
            : score,
      comment: "模拟接口的评语，未调用真实模型",
      evidence: ["原文测试证据。"],
    })),
    safety: {
      category: "none",
      needs_review: false,
      comment: "模拟安全分类",
      evidence: [],
    },
  };
  await route
    .fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(result) },
          },
        ],
      }),
    })
    .catch(() => {});
});
async function nav(name) {
  await page
    .locator(".eval-nav")
    .getByRole("link", { name: new RegExp(name) })
    .click();
}
async function saveDownload(name, file) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  const d = await pending;
  await d.saveAs(out + "/" + file);
  return fs.readFileSync(out + "/" + file, "utf8");
}
async function settings() {
  await page.locator(".eval-header>button").click();
  await page.getByRole("dialog", { name: "可选接口设置" }).waitFor();
}
try {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page.getByLabel("回放原文", { exact: true }).getAttribute("readonly"),
    "",
  );
  for (const item of replay.items) {
    await page.getByLabel("选择历史样本").selectOption(item.id);
    for (let i = 0; i < 3; i++) {
      await page.getByLabel("历史运行").selectOption(String(i));
      await page.waitForFunction(
        (expected) =>
          document
            .querySelector(".score-summary strong")
            ?.textContent?.trim()
            .startsWith(expected),
        item.runs[i].overall.toFixed(2),
      );
      assert.equal(
        await page.getByLabel("回放原文", { exact: true }).inputValue(),
        item.text,
      );
    }
  }
  assert.equal(requests, 0);
  await page.getByLabel("选择历史样本").selectOption("e06");
  await page.getByLabel("历史运行").selectOption("0");
  await page
    .getByRole("button", { name: "定位结构完整性证据1", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  assert.ok(await page.locator("[data-evidence-match]").isVisible());
  await page.getByLabel("你的复核判断").selectOption("unsupported");
  await page
    .getByLabel("修改建议或复核备注")
    .fill("引用存在，但尚不能支持这个结论；需要补充结尾。");
  let packet = JSON.parse(await saveDownload("导出本篇复核", "review.json"));
  assert.equal(packet.originalResult.overall, replay.items[0].runs[0].overall);
  assert.equal(packet.originalResult.meta.sample, true);
  assert.equal(
    packet.reviews.find((x) => x.dimension === "structure").state,
    "unsupported",
  );
  assert.equal(packet.sourceText, replay.items[0].text);
  await page.getByLabel("历史运行").selectOption("1");
  assert.equal(
    await page.getByLabel("你的复核判断").inputValue(),
    "unreviewed",
  );
  await page.getByLabel("历史运行").selectOption("0");
  assert.equal(
    await page.getByLabel("你的复核判断").inputValue(),
    "unsupported",
  );
  await page.reload();
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page.getByLabel("你的复核判断").inputValue(),
    "unsupported",
  );
  await nav("版本对比");
  await page.getByRole("button", { name: "同文自对照", exact: true }).click();
  packet = JSON.parse(
    await saveDownload("导出历史对照", "historical-compare.json"),
  );
  assert.deepEqual(packet.samples[0], packet.samples[1]);
  assert.equal(packet.kind, "historical-comparison");
  await nav("Bad Cases");
  const exportButton = page.getByRole("button", { name: /^导出回放示例 CSV/ });
  const csv = await saveDownload(
    await exportButton.innerText(),
    "historical-badcases.csv",
  );
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /回放:/);
  await page.getByRole("link", { name: "定位并复核 →" }).first().click();
  await page.waitForURL((u) => u.searchParams.has("sample"));
  await page.getByLabel("你的复核判断").waitFor();
  assert.equal(
    await page.getByLabel("选择历史样本").inputValue(),
    new URL(page.url()).searchParams.get("sample"),
  );
  await settings();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  // All following network responses are browser-stubbed. No real API or key is used.
  await settings();
  await page.getByLabel("HTTPS Base URL").fill("https://eval-mock.invalid/v1");
  await page.getByLabel("模型名", { exact: true }).fill("mock");
  await page
    .getByLabel("API Key", { exact: true })
    .fill("test-only-not-secret");
  await page.getByRole("button", { name: "应用设置", exact: true }).click();
  assert.equal(requests, 0);
  assert.ok(
    !(await page.evaluate(() => JSON.stringify(localStorage))).includes(
      "test-only-not-secret",
    ),
  );
  await page
    .getByLabel("待评文本", { exact: true })
    .fill("这里是原文测试证据。角色做出改变。");
  assert.equal(await page.locator(".score-summary").count(), 0);
  await page.getByRole("button", { name: "评测当前文本", exact: true }).click();
  await page.locator(".score-summary").waitFor();
  assert.equal(requests, 1);
  packet = JSON.parse(await saveDownload("导出本篇复核", "mocked-run.json"));
  assert.equal(packet.originalResult.meta.sample, false);
  assert.equal(packet.originalResult.meta.model, "mock");
  mode = "invalid";
  await page.getByRole("button", { name: "评测当前文本", exact: true }).click();
  await page.getByText(/未将异常输出转换成评分/).waitFor();
  assert.equal(requests, 2);
  assert.equal(await page.locator(".score-summary").count(), 0);
  mode = "hold";
  const waiting = page.waitForRequest(
    "https://eval-mock.invalid/v1/chat/completions",
  );
  await page.getByRole("button", { name: "评测当前文本", exact: true }).click();
  await waiting;
  await page.getByRole("button", { name: "取消评测", exact: true }).click();
  release?.();
  await page.getByText(/评测已取消/).waitFor();
  assert.equal(requests, 3);
  mode = "ok";
  await nav("版本对比");
  await page.getByLabel("V1", { exact: true }).fill("A稿 原文测试证据。");
  await page.getByLabel("V2", { exact: true }).fill("B稿 原文测试证据。");
  await page.getByRole("combobox", { name: "每版运行次数" }).selectOption("1");
  await page
    .getByRole("button", { name: "对比 / Compare", exact: true })
    .click();
  await page
    .getByRole("button", { name: "导出本组对比", exact: true })
    .waitFor();
  assert.equal(requests, 5);
  assert.match(
    await page.locator("main").innerText(),
    /仅单次，无法观察重复波动/,
  );
  packet = JSON.parse(
    await saveDownload("导出本组对比", "mocked-comparison.json"),
  );
  assert.equal(packet.results[0].runs.length, 1);
  assert.equal(packet.results[0].overall.mean, 2);
  assert.equal(packet.results[1].overall.mean, 4);
  await settings();
  await page.getByLabel("模型名", { exact: true }).fill("mock-new-model");
  await page.getByRole("button", { name: "应用设置", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "导出本组对比", exact: true })
      .count(),
    0,
  );
  await page.getByText(/接口设置已改变，旧分数未用于当前比较/).waitFor();
  assert.equal(requests, 5);
  await page.getByLabel("V1", { exact: true }).fill("改过的A稿 原文测试证据。");
  assert.equal(
    await page
      .getByRole("button", { name: "导出本组对比", exact: true })
      .count(),
    0,
  );
  await nav("Bad Cases");
  await page.getByRole("button", { name: /我的运行记录/ }).click();
  assert.ok((await page.locator("tbody tr").count()) > 0);
  await settings();
  await page
    .getByRole("button", { name: "清除Key并使用回放", exact: true })
    .click();
  assert.equal(requests, 5);
  for (const route of [
    "",
    "compare/",
    "bad-cases/",
    "validation/",
    "iteration/",
  ]) {
    await page.goto(url + route);
    await page.waitForLoadState("networkidle");
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [1440, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForFunction(
        () => document.documentElement.scrollWidth <= innerWidth,
        {},
        { timeout: 2500 },
      );
      assert.equal(await page.locator(".eval-nav a").count(), 5);
      for (const link of await page.locator(".eval-nav a").all()) {
        const b = await link.boundingBox();
        assert.ok(
          b && b.x >= 0 && b.x + b.width <= width + 1,
          "All five navigation links fit without sideways scrolling",
        );
      }
    }
  }
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: out + "/mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: out + "/desktop.png", fullPage: true });
  await page.evaluate(() => {
    localStorage.setItem("llm-output-eval:bad-cases:v1", "{}");
    localStorage.setItem(
      "llm-output-eval:reviews:v1",
      '{"version":1,"items":[{}]}',
    );
    localStorage.setItem(
      "llm-output-eval:settings:v1",
      JSON.stringify({ apiKey: { broken: true }, baseUrl: 3 }),
    );
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
  assert.match(await page.locator("main").innerText(), /无法恢复/);
  assert.ok(
    !(
      await page.evaluate(() =>
        localStorage.getItem("llm-output-eval:settings:v1"),
      )
    ).includes("apiKey"),
  );
  await page.goto(url + "bad-cases/");
  await page.waitForLoadState("networkidle");
  assert.match(await page.locator("main").innerText(), /记录损坏/);
  const blocked = await browser.newContext();
  await blocked.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw Error("blocked");
      },
    }),
  );
  const p = await blocked.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url);
  await p.waitForLoadState("networkidle");
  await p.getByLabel("你的复核判断").selectOption("needs_context");
  assert.match(await p.locator("main").innerText(), /本地保存不可用/);
  await blocked.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 18 historical records, quote-to-source keyboard navigation, isolated local review/JSON, history comparison and low-score CSV/handoff, native modal, mocked schema errors/cancel/call cap/stale results, five routes × four widths, corrupt and blocked storage, no real model calls or page errors.",
  );
} finally {
  await browser.close();
}
