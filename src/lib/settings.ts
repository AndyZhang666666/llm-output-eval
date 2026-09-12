"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { JudgeSettings } from "./types";

/**
 * Judge connection settings live in localStorage only.
 *
 * The key never touches our server except as a pass-through header on each
 * request. There is no account, no sync, no cookie. Clearing site data wipes
 * it. This is the whole "BYO key" story.
 *
 * Read through useSyncExternalStore rather than useEffect+setState: the server
 * snapshot is "not loaded" so SSR and the first client render agree, and the
 * real value swaps in without a cascading re-render.
 */

const STORAGE_KEY = "llm-output-eval:settings:v1";

export const DEFAULT_SETTINGS: JudgeSettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
};

const listeners = new Set<() => void>();
let cache: { raw: string | null; value: JudgeSettings } | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): JudgeSettings {
  const raw = readRaw();
  // Return a stable object when storage has not changed; uSES compares by identity.
  if (cache && cache.raw === raw) return cache.value;
  let value = DEFAULT_SETTINGS;
  if (raw) {
    try {
      value = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<JudgeSettings>) };
    } catch {
      value = DEFAULT_SETTINGS;
    }
  }
  cache = { raw, value };
  return value;
}

function getServerSnapshot(): JudgeSettings | null {
  return null;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function saveSettings(s: JudgeSettings): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  listeners.forEach((l) => l());
}

export function useSettings() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const loaded = snap !== null;
  const settings = snap ?? DEFAULT_SETTINGS;
  const update = useCallback((next: JudgeSettings) => saveSettings(next), []);
  return { settings, update, loaded, hasKey: settings.apiKey.trim().length > 0 };
}
