"use client";

import { useRef } from "react";

export function SampleBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <strong>示例数据 / Sample data.</strong> No API key is set, so this is a frozen judge output captured
      while building the app — not a live result for the text you see. Add a key in Settings to run for real.
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      <strong>Judge call failed.</strong> {message}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  rows = 16,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>{value.length} chars</span>
          <button type="button" className="hover:underline" onClick={() => fileRef.current?.click()}>
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
        </div>
      </div>
      <textarea
        className="w-full resize-y rounded-md border border-zinc-300 bg-white p-3 font-mono text-sm leading-relaxed focus:border-zinc-500 focus:outline-none"
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
