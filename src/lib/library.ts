import { parseReviewImport, type ImportRecord } from './import-report';
export const LIBRARY_STORAGE = 'llm-output-eval:library:v1';
export const MAX_LIBRARY = 20;
export type LibraryRecord = ImportRecord & { name: string; savedAt: string };
export type LibraryData = { version: 1; activeKey: string; records: LibraryRecord[] };
export const EMPTY_LIBRARY: LibraryData = { version: 1, activeKey: '', records: [] };
export function decodeLibrary(raw: string | null): LibraryData {
  if (!raw) return EMPTY_LIBRARY;
  const v = JSON.parse(raw);
  if (!v || v.version !== 1 || !Array.isArray(v.records) || v.records.length > MAX_LIBRARY || typeof v.activeKey !== 'string') throw Error('资料库格式无效');
  const keys = new Set();
  const records: LibraryRecord[] = v.records.map((r: LibraryRecord) => {
    if (!r || typeof r.key !== 'string' || !/^external:sha256:[0-9a-f]{64}$/.test(r.key) || keys.has(r.key) || typeof r.name !== 'string' || !r.name.trim() || r.name.length > 100 || !Number.isFinite(Date.parse(r.savedAt)) || typeof r.fileName !== 'string') throw Error('资料库记录无效');
    keys.add(r.key);
    const parsed = parseReviewImport(JSON.stringify({ ...r, version: 1, recordKey: r.key }));
    return { ...parsed, key: r.key, name: r.name, fileName: r.fileName, savedAt: r.savedAt };
  });
  return { version: 1, activeKey: records.some(r => r.key === v.activeKey) ? v.activeKey : '', records };
}
export function addToLibrary(data: LibraryData, record: ImportRecord, name: string, now = new Date().toISOString()): LibraryData {
  const present = data.records.find(r => r.key === record.key);
  if (present) return { ...data, activeKey: record.key }; // A repeat never overwrites saved declarations.
  if (data.records.length >= MAX_LIBRARY) throw Error('资料库已满20份；当前材料仍可复核和导出。请先导出并删除一份，再保存；不会自动淘汰旧资料');
  const title = name.trim().slice(0, 100) || '未命名材料';
  // Human state lives in its own stores. Keeping stale imported copies here
  // would resurrect a deliberately cleared review when a material is reopened.
  return { version: 1, activeKey: record.key, records: [{ ...record, reviews:[], actions:[], name: title, savedAt: now }, ...data.records] };
}
