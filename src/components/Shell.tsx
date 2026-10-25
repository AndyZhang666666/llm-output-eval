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
  { href: "/validation", label: "裁判校验", en: "" },
  { href: "/iteration", label: "迭代记录", en: "" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentPath =
    pathname.replace(/^\/llm-output-eval/, "").replace(/\/$/, "") || "/";
  const [open, setOpen] = useState(false);
  const { settings, update, hasKey, loaded, notice } = useSettings();

  return (
    <div className="eval-shell min-h-screen text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="eval-header mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="eval-header-left flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight">
              <span className="eval-wordmark">
                文本评测台<span>llm-output-eval</span>
              </span>
            </Link>
            <nav
              className="eval-nav flex gap-1 text-sm"
              aria-label="评测工具导航"
            >
              {NAV.map((n) => {
                const active = currentPath === n.href;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-md px-3 py-1.5 ${
                      active
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {n.label}
                    {n.en && (
                      <span className="ml-1 text-xs opacity-60">{n.en}</span>
                    )}
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
                !loaded
                  ? "bg-zinc-300"
                  : hasKey
                    ? "bg-emerald-500"
                    : "bg-zinc-400"
              }`}
            />
            {loaded && hasKey ? settings.model : "接口设置（可选）"}
          </button>
        </div>
      </header>
      <main className="eval-main mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="eval-footer mx-auto max-w-6xl px-4 pb-8 pt-4 text-xs text-zinc-600">
        默认体验为历史评测回放，不调用模型、不产生 API
        费用。可选接口自行提供；Key 仅在当前页面内存，手动请求才发给所选服务商。
        {notice}
        <a href="https://github.com/AndyZhang666666/llm-output-eval">
          源码与更新记录
        </a>
      </footer>
      {open && (
        <SettingsDialog
          settings={settings}
          onSave={update}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
