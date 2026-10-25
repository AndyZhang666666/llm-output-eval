"use client";

import { useId, useRef } from "react";

export function SampleBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="eval-notice">
      <strong>历史评测回放。</strong>{" "}
      来自仓库已保存的模型输出，不调用接口，不重新评分。
      输入、分数与记录一一对应；编辑自己的文本需另行配置接口。
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      <strong>本次未形成完整结果。</strong> {message}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  rows = 16,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  readOnly?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>
            {value.length} 字符{readOnly ? " · 回放原文" : ""}
          </span>
          {!readOnly && (
            <>
              <button
                type="button"
                className="hover:underline"
                onClick={() => fileRef.current?.click()}
              >
                Upload .txt
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,text/plain"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) onChange(await f.text());
                  e.target.value = "";
                }}
              />
            </>
          )}
        </div>
      </div>
      <textarea
        id={inputId}
        readOnly={readOnly}
        className="w-full resize-y rounded-md border border-zinc-300 bg-white p-4 text-sm leading-relaxed focus:border-zinc-500 focus:outline-none"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste the generated text here…"
      />
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-600">
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
      {label}
    </div>
  );
}
