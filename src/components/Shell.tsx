"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SettingsDialog } from "./SettingsDialog";
import { useSettings } from "@/lib/settings";

const NAV = [
  { href: "/", label: "单篇评测", en: "Evaluate" },
  { href: "/compare", label: "版本对比", en: "Compare" },
  { href: "/bad-cases", label: "Bad Cases", en: "" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { settings, update, hasKey, loaded } = useSettings();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight">
              llm-output-eval
            </Link>
            <nav className="flex gap-1 text-sm">
              {NAV.map((n) => {
                const active = pathname === n.href;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`rounded-md px-3 py-1.5 ${
                      active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {n.label}
                    {n.en && <span className="ml-1 text-xs opacity-60">{n.en}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100"
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                !loaded ? "bg-zinc-300" : hasKey ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            {loaded && hasKey ? settings.model : "设置 API Key"}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4 text-xs text-zinc-500">
        Your API key stays in this browser&apos;s localStorage and goes directly from your browser to the
        provider you chose. This is a static site with no server — there is nothing in between that could
        store it.
      </footer>
      {open && <SettingsDialog settings={settings} onSave={update} onClose={() => setOpen(false)} />}
    </div>
  );
}
