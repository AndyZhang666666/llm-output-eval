import type { ImportRecord } from './import-report';
import { aggregateRuns } from './stats';

export function comparisonWarnings(a: ImportRecord, b: ImportRecord): string[] {
  const messages: string[] = [];
  if (a.originalResult.meta.model !== b.originalResult.meta.model) messages.push('模型声明不同，分差不能归因于改稿');
  else if (['未提供', '未知', 'unknown'].includes(a.originalResult.meta.model.toLowerCase())) messages.push('模型信息缺失，无法确认比较条件');
  for (const [key, label] of [['rubricId', '评分规则'], ['promptId', 'Prompt版本'], ['temperature', '温度']] as const) {
    const x = a.conditions?.[key], y = b.conditions?.[key];
    if (x === undefined || y === undefined) messages.push(`${label}未完整声明，不能确认条件一致`);
    else if (x !== y) messages.push(`${label}声明不同，不能直接归因于文本变化`);
  }
  return messages;
}
export function compatibleRun(primary: ImportRecord, extra: ImportRecord) {
  if (primary.key === extra.key) return false;
  if (primary.sourceText !== extra.sourceText || primary.originalResult.meta.model !== extra.originalResult.meta.model) return false;
  return (['rubricId', 'promptId', 'temperature'] as const).every(k => primary.conditions?.[k] === extra.conditions?.[k]);
}
export function aggregateRecords(records: ImportRecord[]) {
  if (!records.length || records.some((r, i) => i > 0 && !compatibleRun(records[0], r)) || new Set(records.map(r => r.key)).size !== records.length) throw Error('仅可汇合同一原文、相同模型及相同声明条件的不同记录');
  return aggregateRuns(records.map(r => r.originalResult));
}
// A bounded textual cue, not a semantic diff: common prefix/suffix is retained.
export function changedRange(text: string, other: string) {
  let start = 0;
  while (start < text.length && start < other.length && text[start] === other[start]) start++;
  let end = text.length, right = other.length;
  while (end > start && right > start && text[end - 1] === other[right - 1]) { end--; right--; }
  return { start, end };
}
