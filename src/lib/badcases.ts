"use client";

import { useCallback, useSyncExternalStore } from "react";
import { BAD_CASE_THRESHOLD } from "./dimensions";
import type { BadCase, EvaluationResult } from "./types";

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
let cache: { raw: string | null; value: BadCase[] } | null = null;
const EMPTY: BadCase[] = [];

function read(): BadCase[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (cache && cache.raw === raw) return cache.value;
  let value: BadCase[] = EMPTY;
  if (raw) {
    try {
      value = JSON.parse(raw) as BadCase[];
    } catch {
      value = EMPTY;
    }
  }
  cache = { raw, value };
  return value;
}

function write(items: BadCase[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** Extract low-scoring dimensions from a result and prepend them to the store. */
export function collectBadCases(result: EvaluationResult, source: string): BadCase[] {
  if (result.meta.sample) return [];
  const fresh: BadCase[] = [];
  for (const d of result.dimensions) {
    if (d.score > BAD_CASE_THRESHOLD) continue;
    // One row per evidence sentence so each can be filtered/exported on its own.
    // A low score with no evidence still gets a row — that itself is worth seeing.
    const evidences = d.evidence.length > 0 ? d.evidence : [""];
    for (const evidence of evidences) {
      fresh.push({
        id: `${result.meta.at}-${d.id}-${fresh.length}`,
        source,
        dimension: d.id,
        score: d.score,
        comment: d.comment,
        evidence,
        at: result.meta.at,
      });
    }
  }
  if (fresh.length > 0) write([...fresh, ...read()]);
  return fresh;
}

export function useBadCases() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  const clear = useCallback(() => write([]), []);
  return { items, clear };
}

/** CSV with a UTF-8 BOM so Excel opens Chinese text correctly. */
export function toCsv(items: BadCase[]): string {
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const header = ["at", "source", "dimension", "score", "comment", "evidence"];
  const rows = items.map((b) =>
    [b.at, b.source, b.dimension, b.score, b.comment, b.evidence].map(esc).join(","),
  );
  return "\uFEFF" + [header.join(","), ...rows].join("\n");
}
