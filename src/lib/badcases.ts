"use client";

import { useCallback, useSyncExternalStore } from "react";
import { BAD_CASE_THRESHOLD } from "./dimensions";
import type { BadCase, EvaluationResult } from "./types";
import { decodeBadCases } from "./records";
export { toCsv } from "./records";

/**
 * Bad cases are collected in localStorage as a side effect of every judge run.
 *
 * Why not a database: the spec is explicit that there is no user system and
 * no persistence layer. A visitor's bad cases are theirs, on their machine,
 * and disappear with site data. That is the right scope for a demo tool and
 * keeps the deploy story to "a static site on GitHub Pages" with zero infra.
 *
 * Sample-data results are never collected — the list must only contain
 * things a model actually said about text the visitor actually pasted.
 */

const STORAGE_KEY = "llm-output-eval:bad-cases:v1";
const MAX_ITEMS = 500;

const listeners = new Set<() => void>();
const EMPTY: BadCase[] = [];
type Snapshot = { items: BadCase[]; notice: string };
const INITIAL: Snapshot = { items: EMPTY, notice: "" };
const UNAVAILABLE: Snapshot = {
  items: EMPTY,
  notice: "本地存储不可用，仍可浏览回放与导出当前记录。",
};
let cache: { raw: string | null; snapshot: Snapshot } | null = null;
let volatile: Snapshot | null = null;
let idSequence = 0;

function read(): Snapshot {
  if (typeof window === "undefined") return INITIAL;
  if (volatile) return volatile;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return UNAVAILABLE;
  }
  if (cache && cache.raw === raw) return cache.snapshot;
  let value: BadCase[] = EMPTY;
  let notice = "";
  if (raw) {
    try {
      value = decodeBadCases(raw);
    } catch {
      value = EMPTY;
      notice = "旧运行记录损坏，未将其当作真实低分案例。";
    }
  }
  const snapshot = { items: value, notice };
  cache = { raw, snapshot };
  return snapshot;
}

function write(items: BadCase[]): void {
  const next = items.slice(0, MAX_ITEMS);
  let notice = "";
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    notice = "保存失败，记录暂留本页内存，请及时导出。";
  }
  volatile = { items: next, notice };
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const changed = () => {
    volatile = null;
    cache = null;
    cb();
  };
  window.addEventListener("storage", changed);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", changed);
  };
}

/** Extract low-scoring dimensions from a result and prepend them to the store. */
export function collectBadCases(
  result: EvaluationResult,
  source: string,
): BadCase[] {
  if (result.meta.sample) return [];
  const fresh: BadCase[] = [];
  const runId =
    globalThis.crypto?.randomUUID?.() ?? Date.now() + "-" + ++idSequence;
  for (const d of result.dimensions) {
    if (d.score > BAD_CASE_THRESHOLD) continue;
    // One row per evidence sentence so each can be filtered/exported on its own.
    // A low score with no evidence still gets a row — that itself is worth seeing.
    const evidences = d.evidence.length > 0 ? d.evidence : [""];
    for (const evidence of evidences) {
      fresh.push({
        id: `${runId}-${d.id}-${fresh.length}`,
        source,
        dimension: d.id,
        score: d.score,
        comment: d.comment,
        evidence,
        at: result.meta.at,
      });
    }
  }
  if (fresh.length > 0) write([...fresh, ...read().items]);
  return fresh;
}

export function useBadCases() {
  const snapshot = useSyncExternalStore(subscribe, read, () => INITIAL);
  const clear = useCallback(() => write([]), []);
  return { ...snapshot, clear };
}
