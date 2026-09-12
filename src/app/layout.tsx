import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "llm-output-eval",
  description:
    "An eval harness for long-form generated text: 6 dimensions, LLM-as-judge, evidence sentences, multi-run variance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
