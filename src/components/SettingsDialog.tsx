"use client";

import { useState } from "react";
import type { JudgeSettings } from "@/lib/types";

const PRESETS: { label: string; baseUrl: string; model: string }[] = [
  { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { label: "Moonshot", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  { label: "Zhipu", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  {
    label: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
  },
];

export function SettingsDialog({
  settings,
  onSave,
  onClose,
}: {
  settings: JudgeSettings;
  onSave: (s: JudgeSettings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<JudgeSettings>(settings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Judge settings</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Any OpenAI-compatible <code>/chat/completions</code> endpoint works. The key is saved only in
          this browser.
        </p>

        <div className="mt-4 flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setDraft({ ...draft, baseUrl: p.baseUrl, model: p.model })}
              className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
            >
              {p.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm">
          <span className="text-zinc-700">Base URL</span>
          <input
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 font-mono text-sm"
            value={draft.baseUrl}
            onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="text-zinc-700">Model</span>
          <input
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 font-mono text-sm"
            value={draft.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="text-zinc-700">API key</span>
          <input
            type="password"
            autoComplete="off"
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 font-mono text-sm"
            value={draft.apiKey}
            placeholder="sk-..."
            onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
          />
        </label>

        <div className="mt-5 flex justify-between">
          <button
            type="button"
            onClick={() => {
              onSave({ ...draft, apiKey: "" });
              onClose();
            }}
            className="text-sm text-red-600 hover:underline"
          >
            Clear key
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm hover:bg-zinc-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onSave({ ...draft, baseUrl: draft.baseUrl.trim(), model: draft.model.trim(), apiKey: draft.apiKey.trim() });
                onClose();
              }}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
