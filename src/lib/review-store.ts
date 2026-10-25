"use client";
import { useSyncExternalStore } from "react";
import { decodeReviews, REVIEW_STORAGE, type Review } from "./review";
type Snapshot = { items: Review[]; ready: boolean; notice: string };
const empty: Snapshot = {
  items: [],
  ready: false,
  notice: "只记录你的判断，不改动历史分数。",
};
const listeners = new Set<() => void>();
let volatile: Snapshot | null = null,
  cache: { raw: string | null; snapshot: Snapshot } | null = null;
function read(): Snapshot {
  if (volatile) return volatile;
  let raw: string | null = null,
    notice = empty.notice;
  try {
    raw = localStorage.getItem(REVIEW_STORAGE);
  } catch {
    notice = "本地存储不可用，复核暂留本页，请及时导出。";
  }
  if (cache && cache.raw === raw) return cache.snapshot;
  let items: Review[] = [];
  try {
    items = decodeReviews(raw);
  } catch {
    notice = "本机复核记录无法恢复，仍可核对和导出。";
  }
  const snapshot = { items, ready: true, notice };
  cache = { raw, snapshot };
  return snapshot;
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
export function storeReviews(items: Review[]) {
  const next = items.slice(-500);
  let notice = "已保存至当前浏览器；这不是重新评测或准确率认证。";
  try {
    localStorage.setItem(
      REVIEW_STORAGE,
      JSON.stringify({ version: 1, items: next }),
    );
  } catch {
    notice = "本地保存不可用，复核暂留本页，请及时导出。";
  }
  volatile = { items: next, ready: true, notice };
  listeners.forEach((cb) => cb());
}
export function currentReviews() {
  return read().items;
}
export function useReviews() {
  return useSyncExternalStore(subscribe, read, () => empty);
}
