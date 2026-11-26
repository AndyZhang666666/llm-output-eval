import "../../public/continuity-shell.css";
import Script from "next/script";
import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import "./globals.css";
import "./swiss.css";
import "./workspace.css";
import "./product-depth.css";
import "./craft.css";
import "./demo-help.css";
import "./task-clarity.css";
import "./manuscripts.css";
import "./navigation.css";
import "./proof-workbench.css";

export const metadata: Metadata = {
  title: "文本评测台 · llm-output-eval",
  description:
    "有原文依据的文本质量评测，包含历史评分回放、版本比较、低分案例及裁判校验。无需 Key 即可体验。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full">
        <div className="demo-context" data-demo-card="eval" data-guide-zh="点进一个评分维度，查引文是否支持评语；原始分数始终单独保留。" data-guide-en="Inspect one dimension and test whether its quotation supports the comment. The original score stays on record."><div className="context-row"><a href="/works/#project-eval">← 返回作品卡</a><strong>Eval Lab</strong><button type="button" aria-label="Switch to English">EN</button></div><output aria-live="polite">点进一个评分维度，查引文是否支持评语；原始分数始终单独保留。</output></div>
        <Script src="/llm-output-eval/continuity-shell.js" strategy="afterInteractive" /><Script src="/llm-output-eval/continuity-labels.js" strategy="afterInteractive" />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
