import { SCORED_DIMENSIONS, DIMENSIONS } from './dimensions';
import { decodeReviews, reviewReport, REVIEW_STATES, type Review } from './review';
import type { EvaluationResult } from './types';
export const MAX_IMPORT_BYTES = 1024 * 1024;
export const EXTERNAL_STORAGE = 'llm-output-eval:external:v1';
export type ImportRecord = { key: string; sourceText: string; originalResult: EvaluationResult; reviews: Review[]; fileName: string };
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
function string(x: unknown, name: string, max: number) { if(typeof x!=='string'||x.length>max)throw Error(`${name}须为不超过${max}字的文本`);return x; }
function evidence(x: unknown, name: string) { if(!Array.isArray(x)||x.length>100)throw Error(`${name}须为最多100条的引用数组`);x.forEach(q=>string(q,name,10000)); }
// Unlike model-response parsing, imports never discard unlocated quotations or fix scores.
export function parseReviewImport(raw: string) {
  if(new TextEncoder().encode(raw).length>MAX_IMPORT_BYTES)throw Error('仅支持单份、最大1MB的 JSON');
  let p: unknown;try{p=JSON.parse(raw);}catch{throw Error('JSON 无法解析，请检查括号、引号和文件格式');}
  if(!object(p)||p.version!==1||!object(p.originalResult))throw Error('需要 version:1、sourceText、originalResult 与可选 reviews；请使用模板');
  string(p.sourceText,'原文',600000);if(!(p.sourceText as string).trim())throw Error('原文不能为空');
  const r=p.originalResult;
  if(!Array.isArray(r.dimensions)||r.dimensions.length!==5)throw Error('只支持创意文本的五个既有维度');
  const ids=new Set();
  for(const d of r.dimensions){
    if(!object(d)||!SCORED_DIMENSIONS.includes(d.id as never)||ids.has(d.id))throw Error('五个维度须各出现一次：persona / coherence / pacing / dialogue / structure');
    ids.add(d.id);
    if(typeof d.score!=='number'||!Number.isInteger(d.score)||d.score<1||d.score>5)throw Error(`${d.id} 的原始分数须为1–5整数，不会自动修正`);
    string(d.comment,'评语',10000);evidence(d.evidence,'原始引用');
  }
  const expected=Math.round(r.dimensions.reduce((sum,d)=>sum+(d as {score:number}).score,0)/5*100)/100;
  if(typeof r.overall!=='number'||!Number.isFinite(r.overall)||Math.abs(r.overall-expected)>1e-8)throw Error(`均分与五维原分不一致，应为 ${expected.toFixed(2)}；未修改原文件`);
  if(!object(r.safety)||!['none','violence','sexual','hate','self_harm','illegal','minors','other'].includes(r.safety.category as string)||typeof r.safety.needs_review!=='boolean')throw Error('safety 分类或 needs_review 格式无效');
  string(r.safety.comment,'安全评语',10000);evidence(r.safety.evidence,'安全引用');
  if(!object(r.meta)||typeof r.meta.sample!=='boolean')throw Error('meta 须含 model、ISO时间 at 与布尔 sample');
  string(r.meta.model,'模型名称',300);string(r.meta.at,'记录时间',80);
  if(!r.meta.model||!Number.isFinite(Date.parse(r.meta.at as string)))throw Error('模型名称或记录时间无效');
  if(r.meta.latency_ms!==undefined&&(typeof r.meta.latency_ms!=='number'||!Number.isFinite(r.meta.latency_ms)||r.meta.latency_ms<0))throw Error('latency_ms 须为非负数');
  const reviews=p.reviews===undefined?[]:decodeReviews(JSON.stringify({version:1,items:p.reviews}));
  if(reviews.length>5||new Set(reviews.map(x=>x.dimension)).size!==reviews.length)throw Error('单篇复核每个维度最多一条');
  if(reviews.some(x=>p.recordKey&&x.key!==p.recordKey))throw Error('复核记录不属于本篇 recordKey');
  return {sourceText:p.sourceText as string,originalResult:r as unknown as EvaluationResult,reviews};
}
const canonical=(x: unknown): string => Array.isArray(x)?'['+x.map(canonical).join(',')+']':object(x)?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
export async function importedRecord(raw: string,fileName='粘贴的 JSON'): Promise<ImportRecord> {
  const parsed=parseReviewImport(raw);
  // Hash all source/result contents, including metadata. Evolving reviews are separate state.
  const bytes=new TextEncoder().encode(canonical({sourceText:parsed.sourceText,originalResult:parsed.originalResult}));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const key='external:sha256:'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  return {...parsed,key,fileName,reviews:parsed.reviews.map(x=>({...x,key}))};
}
export function mergeImportedReviews(current: Review[], record: ImportRecord) {
  return [...current,...record.reviews.filter(r=>!current.some(x=>x.key===record.key&&x.dimension===r.dimension))].slice(-500);
}
export function reportMarkdown(key: string,text: string,result: EvaluationResult,items: Review[],source: string) {
  const r=reviewReport(key,text,result,items),reviews=r.reviews;
  return ['# 文本评测复核报告','',`来源：${source}`,`原记录声明的模型：${result.meta.model}；时间：${result.meta.at}`,
    `原始五维均分：${result.overall.toFixed(2)} / 5（未被复核改写）`,
    `已复核 ${reviews.filter(x=>x.state!=='unreviewed').length}/5；存疑 ${reviews.filter(x=>x.state==='unsupported').length}；待补上下文 ${reviews.filter(x=>x.state==='needs_context').length}`,'',
    ...SCORED_DIMENSIONS.flatMap(id=>{const d=result.dimensions.find(d=>d.id===id)!,v=reviews.find(x=>x.dimension===id);return [`## ${DIMENSIONS[id].labelZh} · ${d.score}/5`,`原评语：${d.comment}`,'',...d.evidence.map(q=>`引用：${q}`),'',`复核：${REVIEW_STATES[v?.state??'unreviewed']}`,`备注：${v?.note||'未填写'}`,''];}),
    '## 原文',text,'','## 边界',...r.limits.map(x=>'- '+x),'本报告记录人工复核，不授予自动发布许可。'].join('\n');
}
export function importTemplate() {
  const text='林推开门，把钥匙放在桌上。她等了一会儿，说：“我们明天再谈。”';
  return {version:1,sourceText:text,originalResult:{dimensions:SCORED_DIMENSIONS.map(id=>({id,score:3,comment:'格式示例，请替换为你的原始评语。',evidence:['林推开门，把钥匙放在桌上。']})),safety:{category:'none',needs_review:false,comment:'格式示例，未作实际安全评测。',evidence:[]},overall:3,meta:{model:'替换为原始模型名称',at:'2026-10-30T00:00:00.000Z',sample:false}},reviews:[]};
}
