import { SCORED_DIMENSIONS, DIMENSIONS } from './dimensions';
import { decodeReviews, reviewReport, REVIEW_STATES, type Review } from './review';
import type { EvaluationResult } from './types';
import { ACTION_KINDS, decodeActions, type ReviewAction } from './actions';
import type { ComparisonConditions } from './task-package';
import { commentGloss } from './comment-gloss';
import {calibrationSummary} from './review-overview';
export const MAX_IMPORT_BYTES = 1024 * 1024;
export const EXTERNAL_STORAGE = 'llm-output-eval:external:v1';
export type ImportRecord = { key: string; sourceText: string; originalResult: EvaluationResult; reviews: Review[]; fileName: string; actions?: ReviewAction[]; conditions?: ComparisonConditions; name?:string };
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
function string(x: unknown, name: string, max: number) { if(typeof x!=='string'||x.length>max)throw Error(`${name}须为不超过${max}字的文本`);return x; }
function evidence(x: unknown, name: string) { if(!Array.isArray(x)||x.length>100)throw Error(`${name}须为最多100条的引用数组`);x.forEach(q=>string(q,name,10000)); }
// Unlike model-response parsing, imports never discard unlocated quotations or fix scores.
export function parseReviewImport(raw: string) {
  if(new TextEncoder().encode(raw).length>MAX_IMPORT_BYTES)throw Error('仅支持单份、最大1MB的 JSON');
  let p: unknown;try{p=JSON.parse(raw);}catch{throw Error('JSON 无法解析，请检查括号、引号和文件格式');}
  if(object(p)&&p.kind==='saved-results-comparison')throw Error('这是完整对照报告，请在“版本对照 → 恢复完整对照报告”导入；此入口只接收单份材料');
  return validateReviewPayload(p);
}
// Internal containers validate the same structure, after their own byte gate.
// Envelope metadata must not make a once-valid external file unreadable.
export function validateReviewPayload(p:unknown) {
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
  if(r.meta.time_basis!==undefined&&!['declared-run','import-time'].includes(r.meta.time_basis as string))throw Error('时间来源声明无效');
  const reviews=p.reviews===undefined?[]:decodeReviews(JSON.stringify({version:1,items:p.reviews}));
  if(reviews.length>5||new Set(reviews.map(x=>x.dimension)).size!==reviews.length)throw Error('单篇复核每个维度最多一条');
  if(reviews.some(x=>p.recordKey&&x.key!==p.recordKey))throw Error('复核记录不属于本篇 recordKey');
  const actions=decodeActions(p.actions);
  if(actions.some(x=>p.recordKey&&x.key!==p.recordKey))throw Error('处理项不属于本篇 recordKey');
  let conditions: ComparisonConditions | undefined;
  if(p.conditions!==undefined){
    if(!object(p.conditions))throw Error('比较条件声明格式无效');
    conditions={};
    for(const key of ['rubricId','promptId'] as const)if(p.conditions[key]!==undefined)conditions[key]=string(p.conditions[key],key,200);
    if(p.conditions.temperature!==undefined){if(typeof p.conditions.temperature!=='number'||!Number.isFinite(p.conditions.temperature)||p.conditions.temperature<0||p.conditions.temperature>2)throw Error('温度须为0到2的数值');conditions.temperature=p.conditions.temperature;}
  }
  const name=p.name===undefined?undefined:string(p.name,'材料名称',100);
  return {sourceText:p.sourceText as string,originalResult:r as unknown as EvaluationResult,reviews,actions,conditions,name};
}
const canonical=(x: unknown): string => Array.isArray(x)?'['+x.map(canonical).join(',')+']':object(x)?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
export async function importedRecord(raw: string,fileName='粘贴的 JSON'): Promise<ImportRecord> {
  const parsed=parseReviewImport(raw);
  return identifyRecord(parsed,fileName);
}
export async function recordFromPayload(payload:unknown,fileName='对照报告中的材料'):Promise<ImportRecord>{return identifyRecord(validateReviewPayload(payload),fileName);}
async function identifyRecord(parsed:ReturnType<typeof validateReviewPayload>,fileName:string):Promise<ImportRecord>{
  // Hash all source/result contents, including metadata. Evolving reviews are separate state.
  const bytes=new TextEncoder().encode(canonical({sourceText:parsed.sourceText,originalResult:parsed.originalResult}));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const key='external:sha256:'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  const reviews=decodeReviews(JSON.stringify({version:1,items:parsed.reviews.map(x=>({...x,key}))}));
  const actions=decodeActions(parsed.actions.map(x=>({...x,key})));
  return {...parsed,key,fileName,reviews,actions};
}
export function prepareImportedHumanState(record:ImportRecord,currentReviews:Review[],currentActions:ReviewAction[]){
 const incomingReviews=decodeReviews(JSON.stringify({version:1,items:record.reviews})),incomingActions=decodeActions(record.actions??[]);
 if(incomingReviews.some(v=>v.key!==record.key)||incomingActions.some(a=>a.key!==record.key))throw Error('人工复核或处理项不属于当前材料');
 const reviews=[...currentReviews,...incomingReviews.filter(v=>!currentReviews.some(x=>x.key===v.key&&x.dimension===v.dimension))];
 if(reviews.length>500)throw Error('本机复核已满500条；请先导出并清理，当前材料未被替换');
 const actions=[...currentActions,...incomingActions.filter(a=>!currentActions.some(x=>x.key===a.key&&x.id===a.id))];
 return {reviews:decodeReviews(JSON.stringify({version:1,items:reviews})),actions:decodeActions(actions)};
}
export function mergeImportedReviews(current: Review[], record: ImportRecord) {
  return [...current,...record.reviews.filter(r=>!current.some(x=>x.key===record.key&&x.dimension===r.dimension))].slice(-500);
}
export function reportMarkdown(key: string,text: string,result: EvaluationResult,items: Review[],source: string, actions: ReviewAction[]=[]) {
  const r=reviewReport(key,text,result,items),reviews=r.reviews,calibration=calibrationSummary(key,items);
  const ownActions=actions.filter(a=>a.key===key),open=ownActions.filter(a=>a.status==='open');
  return ['# 文本评测复核报告','',`来源：${source}`,`原记录声明的模型：${result.meta.model}；${result.meta.time_basis==='import-time'?'导入时间（未声明外部运行时间）':'原记录时间声明'}：${result.meta.at}`,
    '', '## 人工复核汇总统计',`支持 ${calibration.supported} 项 · 存疑 ${calibration.disputed} 项 · 需上下文 ${calibration.context} 项（已复核 ${calibration.reviewed}/5）`,calibration.priority.length?'优先校准维度：'+calibration.priority.map(id=>DIMENSIONS[id].labelZh).join('、'):'尚无存疑或待上下文维度；不代表裁判准确。','这些是本机人工判断分布，不是模型准确率或发布结论。', '', '## 未解决事项', ...(open.length?open.map(a=>`- [ ] ${DIMENSIONS[a.dimension].labelZh} · ${ACTION_KINDS[a.kind]}：${a.text}`):['暂无未完成处理项；这不代表内容通过或评语正确。']),
    ...reviews.filter(v=>v.state==='unsupported'||v.state==='needs_context').map(v=>`- ${DIMENSIONS[v.dimension].labelZh}：${REVIEW_STATES[v.state]}${v.note?'；'+v.note:''}`),
    '', '## 复核概况',
    `原始五维均分：${result.overall.toFixed(2)} / 5（未被复核改写）`,
    `已复核 ${reviews.filter(x=>x.state!=='unreviewed').length}/5；存疑 ${reviews.filter(x=>x.state==='unsupported').length}；待补上下文 ${reviews.filter(x=>x.state==='needs_context').length}`,'',
    ...SCORED_DIMENSIONS.flatMap(id=>{const d=result.dimensions.find(d=>d.id===id)!,v=reviews.find(x=>x.dimension===id),gloss=commentGloss(d);return [`## ${DIMENSIONS[id].labelZh} · ${d.score}/5`,`原评语：${d.comment}`,...(gloss?['',`评语释义（随记录提供）：${gloss}`]:[]),'',...d.evidence.map(q=>`引用：${q}`),'',`复核：${REVIEW_STATES[v?.state??'unreviewed']}`,`人工参考分：${v?.humanScore===undefined?'未填写':v.humanScore+'/5'}；人工−模型差：${v?.humanScore===undefined?'暂无':v.humanScore-d.score}（人工参考不是金标）`,`备注：${v?.note||'未填写'}`,''];}),
    ...(ownActions.some(a=>a.status==='done')?['## 已完成处理项',...ownActions.filter(a=>a.status==='done').map(a=>`- [x] ${ACTION_KINDS[a.kind]}：${a.text}`),'完成处理不代表重新评测，原始分数未改变。']:[]),
    '## 原文',text,'','## 边界',...r.limits.map(x=>'- '+x),'本报告记录人工复核，不授予自动发布许可。'].join('\n');
}
export function importTemplate() {
  const text='林推开门，把钥匙放在桌上。她等了一会儿，说：“我们明天再谈。”';
  return {version:1,sourceText:text,originalResult:{dimensions:SCORED_DIMENSIONS.map(id=>({id,score:3,comment:'格式示例，请替换为你的原始评语。',evidence:['林推开门，把钥匙放在桌上。']})),safety:{category:'none',needs_review:false,comment:'格式示例，未作实际安全评测。',evidence:[]},overall:3,meta:{model:'替换为原始模型名称',at:'2026-10-30T00:00:00.000Z',sample:false}},reviews:[]};
}
