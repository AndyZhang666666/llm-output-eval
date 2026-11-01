import {recordFromPayload, type ImportRecord } from './import-report';
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
export const MAX_COMPARISON_BYTES=48*1024*1024;
export type SavedComparison={labels:[string,string];sides:[ImportRecord[],ImportRecord[]]};
export async function importComparisonReport(raw:string):Promise<SavedComparison>{
 if(new TextEncoder().encode(raw).length>MAX_COMPARISON_BYTES)throw Error('完整对照报告最大48MB');
 let p:unknown;try{p=JSON.parse(raw);}catch{throw Error('对照报告JSON无法解析');}
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('需要完整对照报告对象');
 const report=p as Record<string,unknown>;
 if(report.version!==1||report.kind!=='saved-results-comparison'||!Array.isArray(report.labels)||report.labels.length!==2||report.labels.some(n=>typeof n!=='string'||n.length>80)||!Array.isArray(report.sides)||report.sides.length!==2)throw Error('需要本工具导出的saved-results-comparison v1报告，含两侧资料和版本名称');
 const sides:ImportRecord[][]=[];
 for(const [sideIndex,side] of report.sides.entries()){
  if(!Array.isArray(side)||side.length<1||side.length>20)throw Error(`第${sideIndex+1}侧须有1到20份记录`);
  const records:ImportRecord[]=[];
  for(const value of side){
   if(!value||typeof value!=='object'||Array.isArray(value))throw Error('对照中的材料无效');
   const record=value as Record<string,unknown>;
   if(typeof record.key!=='string')throw Error('对照材料缺少稳定标识');
   const loaded=await recordFromPayload({...record,version:1,recordKey:record.key},typeof record.fileName==='string'?record.fileName:'对照报告中的材料');
   if(loaded.key!==record.key)throw Error('材料标识与完整原文、原始结果不一致；未恢复任何一侧');
   records.push(loaded);
  }
  aggregateRecords(records); // Validate grouping and duplicates before any caller mutation.
  sides.push(records);
 }
 return {labels:report.labels as [string,string],sides:sides as [ImportRecord[],ImportRecord[]]};
}
