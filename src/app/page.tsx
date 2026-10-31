"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { SafetyCard } from "@/components/DimensionCard";
import { EvidenceReview } from "@/components/EvidenceReview";
import { ImportPanel } from "@/components/ImportPanel";
import { ErrorBanner } from "@/components/ui";
import { evaluateText } from "@/lib/api";
import { collectBadCases } from "@/lib/badcases";
import { REPLAY_ITEMS, replayItem } from "@/lib/replay";
import { recordKey, REVIEW_STATES } from "@/lib/review";
import { useReviews, storeReviews, currentReviews } from "@/lib/review-store";
import { importedRecord, mergeImportedReviews, reportMarkdown, EXTERNAL_STORAGE, type ImportRecord } from "@/lib/import-report";
import { locateEvidence } from "@/lib/evidence";
import { DIMENSIONS, SCORED_DIMENSIONS } from "@/lib/dimensions";
import { useSettings } from "@/lib/settings";
import type { EvaluationResult, ScoredDimensionId } from "@/lib/types";
function subscribeURL(cb:()=>void){window.addEventListener('popstate',cb);return()=>window.removeEventListener('popstate',cb);}
export default function EvaluatePage(){const query=useSyncExternalStore(subscribeURL,()=>location.search,()=>"");return <EvaluateWorkspace key={query} initialQuery={query}/>;}
function EvaluateWorkspace({initialQuery}:{initialQuery:string}){
 const {settings,hasKey,loaded}=useSettings(),params=new URLSearchParams(initialQuery);
 const initialId=REPLAY_ITEMS.some(i=>i.id===params.get('sample'))?params.get('sample')!:'e06';
 const initialDim=SCORED_DIMENSIONS.includes(params.get('dimension') as ScoredDimensionId)?params.get('dimension') as ScoredDimensionId:'structure';
 const [sampleId,sampleSet]=useState(initialId),[runIndex,runSet]=useState(0),[text,textSet]=useState(replayItem(initialId).text),[result,resultSet]=useState<EvaluationResult|null>(replayItem(initialId).runs[0]);
 const [origin,originSet]=useState<'history'|'external'|'own'|'run'>('history'),[externalKey,externalSet]=useState(''),[fileName,fileSet]=useState(''),[notice,noticeSet]=useState('');
 const [dimension,dimSet]=useState<ScoredDimensionId>(initialDim),[quote,quoteSet]=useState(replayItem(initialId).runs[0].dimensions.find(d=>d.id===initialDim)?.evidence[0]??'');
 const [busy,busySet]=useState(false),[error,errorSet]=useState<string|null>(null),[mobile,mobileSet]=useState('review');
 const request=useRef<AbortController|null>(null),resultPanel=useRef<HTMLElement>(null),sourceDoc=useRef<HTMLElement>(null);
 const reviews=useReviews();
 function importRecord(record:ImportRecord,restored=false){
  request.current?.abort();request.current=null;busySet(false);textSet(record.sourceText);resultSet(record.originalResult);externalSet(record.key);originSet('external');fileSet(record.fileName);errorSet(null);
  quoteSet(record.originalResult.dimensions.find(d=>d.id===dimension)?.evidence[0]??'');
  storeReviews(mergeImportedReviews(currentReviews(),record));
  try{localStorage.setItem(EXTERNAL_STORAGE,JSON.stringify({version:1,recordKey:record.key,sourceText:record.sourceText,originalResult:record.originalResult,reviews:[]}));noticeSet(restored?'已恢复上次导入材料；本机复核独立保留。':'已导入，原始评分与评语完整保留；外部声明未经认证。');}catch{noticeSet('本机保存不可用，材料仅留本页，仍可复核与导出。');}
 }
 useEffect(()=>{let active=true;if(!params.has('sample')){try{const raw=localStorage.getItem(EXTERNAL_STORAGE);if(raw)importedRecord(raw,'本机导入草稿').then(r=>{if(active)importRecord(r,true);}).catch(()=>{if(active)noticeSet('上次导入草稿无法恢复，未覆盖保存内容。');});}catch{noticeSet('存储不可用，仍可导入、复核与导出。');}}return()=>{active=false;request.current?.abort();};},[]); // Restore once; explicit history links always win.
 useEffect(()=>()=>request.current?.abort(),[settings.baseUrl,settings.model,settings.apiKey]);
 function showSample(id:string,index=0){const item=replayItem(id),r=item.runs[index]??item.runs[0];sampleSet(item.id);runSet(index);textSet(item.text);resultSet(r);originSet('history');externalSet('');quoteSet(r.dimensions.find(d=>d.id===dimension)?.evidence[0]??'');errorSet(null);noticeSet('历史记录原分不变；复核意见单独保存。');}
 function chooseDimension(id:ScoredDimensionId){dimSet(id);quoteSet(result?.dimensions.find(d=>d.id===id)?.evidence[0]??'');}
 async function run(){errorSet(null);if(!hasKey){errorSet('尚未配置模型接口。你的材料已保留，可以导入已有结果继续复核，或前往设置后明确发起评测。');return;}const c=new AbortController();request.current=c;busySet(true);resultSet(null);try{const [r]=await evaluateText(text,1,settings,c.signal);if(request.current!==c)return;resultSet(r);originSet('run');externalSet('');quoteSet(r.dimensions.find(d=>d.id===dimension)?.evidence[0]??'');collectBadCases(r,'single');}catch(e){if(request.current===c)errorSet((e as Error).message);}finally{if(request.current===c){request.current=null;busySet(false);}}}
 const key=result?(origin==='external'?externalKey:recordKey(origin==='history'?sampleId:'own',runIndex,text,result)):'';
 const sourceLabel=origin==='external'?'外部导入，未经认证':origin==='history'?'历史记录回放':origin==='run'?'本次模型运行':'用户原文，尚无有效评测';
 const mine=reviews.items.filter(r=>r.key===key),reviewed=mine.filter(r=>r.state!=='unreviewed').length,disputed=mine.filter(r=>r.state==='unsupported').length,context=mine.filter(r=>r.state==='needs_context').length;
 const selected=result?.dimensions.find(d=>d.id===dimension),located=quote?locateEvidence(text,quote):null;
 const next=SCORED_DIMENSIONS.slice(SCORED_DIMENSIONS.indexOf(dimension)+1).concat(SCORED_DIMENSIONS.slice(0,SCORED_DIMENSIONS.indexOf(dimension)+1)).find(id=>!mine.some(r=>r.dimension===id&&r.state!=='unreviewed'));
 useEffect(()=>{const node=resultPanel.current;if(node&&key&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const a=node.animate([{opacity:.7,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:180});return()=>a.cancel();}},[key,dimension]);
 function editText(value:string){textSet(value);resultSet(null);quoteSet('');externalSet('');originSet('own');errorSet(null);noticeSet('原文已改变，旧评测已失效。输入仍保留，不会自动切回历史样本。');}
 return <>
 <div className="eval-intro"><h1>文本评测与复核</h1><p>导入自己的原文与评分，逐条核对证据，带走一份可追溯的复核报告。</p></div>
 <ImportPanel disabled={busy} onImport={r=>importRecord(r)}/>
 <div className="replay-selects history-toolbar"><label className="replay-picker">历史样本<select aria-label="选择历史样本" disabled={busy} value={sampleId} onChange={e=>showSample(e.target.value)}>{REPLAY_ITEMS.map(i=><option key={i.id} value={i.id}>{i.label}</option>)}</select></label><label className="replay-picker">历史运行<select aria-label="选择历史运行" disabled={busy} value={runIndex} onChange={e=>showSample(sampleId,Number(e.target.value))}>{replayItem(sampleId).runs.map((_,i)=><option key={i} value={i}>第{i+1}次记录</option>)}</select></label><button disabled={busy} onClick={()=>showSample(sampleId,runIndex)}>载入所选历史记录</button><Link href={`/compare/?sample=${sampleId}&dimension=${dimension}`}>查看版本比较 →</Link></div>
 <div className="eval-summary"><span><b>{sourceLabel}</b>{result&&<> · 原始均分 {result.overall.toFixed(2)}/5</>}</span><span>已复核 {reviewed}/5 · 存疑 {disputed} · 待补上下文 {context}</span></div>
 {notice&&<p className="replay-note" role="status">{notice}</p>}<ErrorBanner message={error}/>
 {result&&<div className="dimension-nav" role="group" aria-label="当前复核维度">{SCORED_DIMENSIONS.map(id=>{const d=result.dimensions.find(d=>d.id===id)!,v=mine.find(r=>r.dimension===id);return <button key={id} aria-pressed={dimension===id} onClick={()=>chooseDimension(id)}><span>{DIMENSIONS[id].labelZh}</span><b>{d.score}/5</b><small>{REVIEW_STATES[v?.state??'unreviewed']}</small></button>;})}</div>}
 <div className="review-mobile-tabs" role="group" aria-label="工作区面板"><button aria-pressed={mobile==='source'} onClick={()=>mobileSet('source')}>原文</button><button aria-pressed={mobile==='review'} onClick={()=>mobileSet('review')}>当前评语与复核</button></div>
 <div className="eval-workspace focused-workspace" data-mobile={mobile}>
 <section className="eval-source source-column" aria-label="当前原文"><div className="review-heading"><h2>原文</h2><span>{text.length} 字</span></div>
 {result?<><article ref={sourceDoc} className="source-document" tabIndex={0} aria-label="原文与定位引用">{located?<>{text.slice(0,located.start)}<mark data-source-match>{text.slice(located.start,located.end)}</mark>{text.slice(located.end)}</>:text}</article><details className="edit-source"><summary>修改原文（使当前评测失效）</summary><textarea aria-label="修改原文" value={text} disabled={busy} onChange={e=>editText(e.target.value)} rows={9}/></details></>:<label className="review-field">待评原文<textarea aria-label="待评原文" value={text} disabled={busy} onChange={e=>editText(e.target.value)} rows={15}/></label>}
 <p className="replay-note">{origin==='external'?`${fileName} · 模型、时间与原分为文件声明，未作认证。`:origin==='history'?replayItem(sampleId).note:'修改原文后需重新评测或导入匹配的结果。'}</p>
 <div className="review-actions"><button onClick={run} disabled={busy||!text.trim()}>{busy?'正在评测…':hasKey?'使用已配置接口评测':'评测我的原文'}</button>{busy&&<button onClick={()=>request.current?.abort()}>取消</button>}{loaded&&!hasKey&&<button onClick={()=>document.getElementById("interface-settings")?.click()}>配置接口（可选）</button>}</div>
 </section>
 <section ref={resultPanel} className="eval-results review-column" aria-label="当前维度评语与复核">{result&&selected?<>
 <div className="current-dimension"><div><p>当前维度</p><h2>{DIMENSIONS[dimension].labelZh}</h2></div><strong>{selected.score}<small>/5</small></strong></div>
 <div className="quote-list"><p className="replay-note">原始引用 · 点击定位；定位成功不等于论证成立。</p>{selected.evidence.map((q,i)=>{const found=locateEvidence(text,q);return <button key={i} aria-pressed={q===quote} onClick={()=>{quoteSet(q);if(innerWidth<700)mobileSet('source');requestAnimationFrame(()=>sourceDoc.current?.querySelector('mark')?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));}}><span>“{q}”</span><small>{found?'可定位':'无法定位 · 保留原引用'}</small></button>;})}</div>
 <div id="evidence-review"><EvidenceReview key={key} recordKey={key} sourceText={text} result={result} dimension={dimension} quote={quote} sourceLabel={sourceLabel}/></div>
 <button className="next-review" disabled={!next} onClick={()=>next&&chooseDimension(next)}>{next?'下一项待复核 →':'五维已复核，可导出报告'}</button>
 <details className="safety-detail"><summary>原始安全分类（不作为发布许可）</summary><SafetyCard s={result.safety}/></details>
 <button className="primary markdown-export" onClick={()=>{const value=reportMarkdown(key,text,result,reviews.items,sourceLabel),url=URL.createObjectURL(new Blob([value],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='eval-review.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>导出可读 Markdown 报告</button>
 </>:<div className="review-empty">{busy?'等待本次返回，不展示旧分数。':'当前原文没有有效评测。请导入匹配的结果，或配置接口后明确发起评测；原文不会被历史样本替换。'}</div>}</section></div>
 </>;
}
