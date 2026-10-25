import { JUDGE_MAX_TOKENS, JudgeParseError, parseJudgeOutput } from "./judge";
import { JUDGE_SYSTEM_PROMPT, buildJudgeUserPrompt } from "./prompts";
import type { EvaluationResult, JudgeSettings } from "./types";
export const MAX_RUNS = 5;
const MAX_CHARS = 20000,
  TIMEOUT_MS = 90000;
async function callOnce(
  settings: JudgeSettings,
  text: string,
  signal: AbortSignal,
): Promise<EvaluationResult> {
  const started = Date.now(),
    ctrl = new AbortController(),
    abort = () => ctrl.abort();
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, TIMEOUT_MS);
  try {
    const endpoint = settings.baseUrl.endsWith("/")
      ? settings.baseUrl.slice(0, -1)
      : settings.baseUrl;
    const r = await fetch(endpoint + "/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + settings.apiKey,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0,
        response_format: { type: "json_object" },
        max_tokens: JUDGE_MAX_TOKENS,
        messages: [
          { role: "system", content: JUDGE_SYSTEM_PROMPT },
          { role: "user", content: buildJudgeUserPrompt(text) },
        ],
      }),
    });
    if (!r.ok)
      throw Error("接口返回 HTTP " + r.status + "；本次未形成完整评测结果。");
    const data = await r.json(),
      choice = data?.choices?.[0],
      content = choice?.message?.content;
    if (typeof content !== "string" || !content.trim())
      throw Error("接口没有返回可解析的内容。");
    return parseJudgeOutput(content, text, {
      model: settings.model,
      latency_ms: Date.now() - started,
      finish_reason: choice.finish_reason,
    });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
// No invisible retry: one click makes at most the declared number of requests.
export async function evaluateText(
  text: string,
  runs: number,
  settings: JudgeSettings,
  signal?: AbortSignal,
): Promise<EvaluationResult[]> {
  if (!settings.apiKey?.trim()) throw Error("未配置Key，可继续浏览历史回放。");
  if (!text.trim() || text.length > MAX_CHARS)
    throw Error("文本须为1到20000字符。");
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_RUNS)
    throw Error("运行次数须为1到5的整数。");
  let u: URL;
  try {
    u = new URL(settings.baseUrl);
  } catch {
    throw Error("接口地址无效。");
  }
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !settings.model.trim()
  )
    throw Error("请填写HTTPS接口与模型名，地址不含密钥或查询参数。");
  if (signal?.aborted) throw Error("评测已取消。");
  const group = new AbortController(),
    abort = () => group.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    return await Promise.all(
      Array.from({ length: runs }, () =>
        callOnce(settings, text, group.signal),
      ),
    );
  } catch (e) {
    const cancelled = signal?.aborted;
    group.abort();
    if (cancelled) throw Error("评测已取消，已返回的接口请求可能仍会计费。");
    if (e instanceof JudgeParseError)
      throw Error(e.message + " 未将异常输出转换成评分。");
    if (e instanceof Error && e.name === "AbortError")
      throw Error("接口请求超时，未形成完整结果；可手动重试。");
    if (e instanceof TypeError)
      throw Error("接口或网络不可达，请核对地址及服务商跨域支持。");
    throw e;
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}
