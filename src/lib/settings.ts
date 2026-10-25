"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { JudgeSettings } from "./types";
const STORAGE_KEY = "llm-output-eval:settings:v1";
export const DEFAULT_SETTINGS: JudgeSettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
};
const listeners = new Set<() => void>();
let memory: JudgeSettings | null = null,
  cache: { raw: string | null; value: JudgeSettings } | null = null;
let notice = "";
function getSnapshot(): JudgeSettings {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    notice = "本地存储不可用，接口配置仅留当前页面。";
  }
  if (cache && cache.raw === raw) return cache.value;
  let value = DEFAULT_SETTINGS;
  if (raw) {
    try {
      const d = JSON.parse(raw);
      value = {
        baseUrl:
          typeof d.baseUrl === "string" ? d.baseUrl : DEFAULT_SETTINGS.baseUrl,
        model: typeof d.model === "string" ? d.model : DEFAULT_SETTINGS.model,
        apiKey: "",
      };
    } catch {
      notice = "旧接口配置无法恢复，已使用默认值。";
    }
  }
  cache = { raw, value };
  return value;
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  const changed = () => {
    memory = null;
    cache = null;
    cb();
  };
  window.addEventListener("storage", changed);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", changed);
  };
}
export function saveSettings(s: JudgeSettings): void {
  if (
    typeof s.baseUrl !== "string" ||
    typeof s.model !== "string" ||
    typeof s.apiKey !== "string"
  )
    throw Error("接口配置格式不正确。");
  const baseUrl = s.baseUrl.trim(),
    model = s.model.trim(),
    apiKey = s.apiKey.trim();
  if (apiKey) {
    let u: URL;
    try {
      u = new URL(baseUrl);
    } catch {
      throw Error("请填写有效HTTPS接口地址。");
    }
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      !model
    )
      throw Error(
        "请使用HTTPS接口并填写模型名，地址不应包含密钥、查询或片段。",
      );
  }
  memory = { baseUrl, model, apiKey };
  cache = null;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ baseUrl, model }),
    );
    notice = "Key仅保留当前页面内存，刷新即清除。";
  } catch {
    notice = "配置仅留当前页面，Key不保存；回放仍可使用。";
  }
  listeners.forEach((cb) => cb());
}
export function useSettings() {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d && Object.hasOwn(d, "apiKey")) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            baseUrl:
              typeof d.baseUrl === "string"
                ? d.baseUrl
                : DEFAULT_SETTINGS.baseUrl,
            model:
              typeof d.model === "string" ? d.model : DEFAULT_SETTINGS.model,
          }),
        );
        cache = null;
        notice = "旧版持久化Key已清除，按需重新输入即可。";
        listeners.forEach((cb) => cb());
      }
    } catch {}
  }, []);
  const snap = useSyncExternalStore(subscribe, getSnapshot, () => null),
    settings = snap ?? DEFAULT_SETTINGS;
  const update = useCallback((next: JudgeSettings) => saveSettings(next), []);
  return {
    settings,
    update,
    loaded: snap !== null,
    hasKey: Boolean(settings.apiKey.trim()),
    notice,
  };
}
