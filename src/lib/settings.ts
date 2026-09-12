"use client";

import { useCallback, useEffect, useState } from "react";
import type { JudgeSettings } from "./types";

/**
 * Judge connection settings live in localStorage only.
 *
 * The key never touches our server except as a pass-through header on each
 * request. There is no account, no sync, no cookie. Clearing site data wipes
 * it. This is the whole "BYO key" story.
 */

const STORAGE_KEY = "llm-output-eval:settings:v1";

export const DEFAULT_SETTINGS: JudgeSettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
};

export function loadSettings(): JudgeSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<JudgeSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: JudgeSettings): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function useSettings() {
  const [settings, setSettings] = useState<JudgeSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setLoaded(true);
  }, []);

  const update = useCallback((next: JudgeSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  return { settings, update, loaded, hasKey: settings.apiKey.trim().length > 0 };
}
