"use client";
import { commentGloss } from "@/lib/comment-gloss";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { SafetyCard } from "@/components/DimensionCard";
import { EvidenceReview } from "@/components/EvidenceReview";
import { ImportPanel } from "@/components/ImportPanel";
import { ExternalTaskPanel } from "@/components/ExternalTaskPanel";
import { LibraryPanel } from "@/components/LibraryPanel";
import { ActionList } from "@/components/ActionList";
import { ReviewOverview } from "@/components/ReviewOverview";
import { ErrorBanner } from "@/components/ui";
import { evaluateText } from "@/lib/api";
import { collectBadCases } from "@/lib/badcases";
import { REPLAY_ITEMS, replayItem } from "@/lib/replay";
import { recordKey, REVIEW_STATES, downloadText } from "@/lib/review";
import { useReviews, storeReviews, currentReviews } from "@/lib/review-store";
import { prepareImportedHumanState, reportMarkdown, type ImportRecord } from "@/lib/import-report";
import { initializeLibrary,saveLibraryRecord,useLibrary } from '@/lib/library-store';
import { currentActions,storeActions,useActions } from '@/lib/action-store';
import { locateEvidence } from "@/lib/evidence";
import { DIMENSIONS, SCORED_DIMENSIONS } from "@/lib/dimensions";
import { useSettings } from "@/lib/settings";
import type { EvaluationResult, ScoredDimensionId } from "@/lib/types";
import type { ComparisonConditions } from '@/lib/task-package';
import {readTabDraft,writeTabDraft} from '@/lib/tab-drafts';
const EMPTY_SOURCE_DRAFT={text:'',active:false};
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
 const [conditions,conditionsSet]=useState<ComparisonConditions|undefined>(),library=useLibrary(),actions=useActions();
 const request=useRef<AbortController|null>(null),resultPanel=useRef<HTMLElement>(null),sourceDoc=useRef<HTMLElement>(null);
 const reviews=useReviews();
 const [unfinished,setUnfinished]=useState(''),[transientSource,setTransientSource]=useState(false);
 useEffect(()=>{if(!transientSource)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[transientSource]);
 function keepSourceInactive(){const prior=readTabDraft('unfinished-source',EMPTY_SOURCE_DRAFT);const saved=writeTabDraft('unfinished-source',{...prior.value,active:false});setTransientSource(!saved.saved);}
 function importRecord(record:ImportRecord,restored=false,focus=true){
  const human=prepareImportedHumanState(record,currentReviews(),currentActions());
  let nextConditions=record.conditions,message=restored?'已恢复保存的材料；本机复核独立保留。':'已导入，原始评分与评语完整保留；外部声明未经认证。';
  try{const saved=saveLibraryRecord(record,record.name?.trim()||record.sourceText.slice(0,28).replace(/\s+/g,' ')||record.fileName);nextConditions=saved.records.find(r=>r.key===record.key)?.conditions;}catch(e){message=(e as Error).message;}
  storeReviews(human.reviews);storeActions(human.actions);if(!restored)keepSourceInactive();
  request.current?.abort();request.current=null;busySet(false);textSet(record.sourceText);resultSet(record.originalResult);externalSet(record.key);originSet('external');fileSet(record.fileName);errorSet(null);
  quoteSet(record.originalResult.dimensions.find(d=>d.id===dimension)?.evidence[0]??'');conditionsSet(nextConditions);noticeSet(message);mobileSet('review');if(focus)requestAnimationFrame(()=>{resultPanel.current?.focus({preventScroll:true});resultPanel.current?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
 }
 // Restoring browser storage is an external event. Dimension changes must not restart it.
 const restoreRecord=useEffectEvent((record:ImportRecord)=>importRecord(record,true,false));
 useEffect(()=>{
  let active=true;
  initializeLibrary().then(data=>{if(!active)return;const params=new URLSearchParams(initialQuery),draft=readTabDraft('unfinished-source',EMPTY_SOURCE_DRAFT);setUnfinished(draft.value.text);if(!params.has('sample')&&!params.has('record')&&draft.value.active){textSet(draft.value.text);resultSet(null);quoteSet('');externalSet('');conditionsSet(undefined);originSet('own');mobileSet('source');setTransientSource(!draft.saved);noticeSet('已恢复未评原文；旧分数仍失效。'+draft.notice);return;}if(params.has('sample'))return;const requested=params.get('record'),record=data.records.find(r=>r.key===(requested||data.activeKey));if(record){try{restoreRecord(record);}catch(e){noticeSet((e as Error).message+'；当前材料未被替换。');}}else if(requested)noticeSet('此资料不在当前浏览器。可导入原JSON恢复，未把历史案例冒充所选资料。');});
  return()=>{active=false;request.current?.abort();};
 },[initialQuery]); // Explicit history links always win over the saved import.
 useEffect(()=>()=>request.current?.abort(),[settings.baseUrl,settings.model,settings.apiKey]);
 function showSample(id:string,index=0){keepSourceInactive();const item=replayItem(id),r=item.runs[index]??item.runs[0];sampleSet(item.id);runSet(index);textSet(item.text);resultSet(r);originSet('history');externalSet('');conditionsSet(undefined);quoteSet(r.dimensions.find(d=>d.id===dimension)?.evidence[0]??'');errorSet(null);noticeSet('历史记录原分不变；复核意见单独保存。');}
 function chooseDimension(id:ScoredDimensionId){dimSet(id);quoteSet(result?.dimensions.find(d=>d.id===id)?.evidence[0]??'');}
 async function run(){errorSet(null);if(!hasKey){errorSet('尚未配置模型接口。你的材料已保留，可以导入已有结果继续复核，或前往设置后明确发起评测。');return;}const c=new AbortController();request.current=c;busySet(true);resultSet(null);try{const [r]=await evaluateText(text,1,settings,c.signal);if(request.current!==c)return;resultSet(r);originSet('run');externalSet('');quoteSet(r.dimensions.find(d=>d.id===dimension)?.evidence[0]??'');collectBadCases(r,'single');}catch(e){if(request.current===c)errorSet((e as Error).message);}finally{if(request.current===c){request.current=null;busySet(false);}}}
 const key=result?(origin==='external'?externalKey:recordKey(origin==='history'?sampleId:'own',runIndex,text,result)):'';
 const sourceLabel=origin==='external'?'外部导入，未经认证':origin==='history'?'历史记录回放':origin==='run'?'本次模型运行':'用户原文，尚无有效评测';
 const mine=reviews.items.filter(r=>r.key===key),reviewed=mine.filter(r=>r.state!=='unreviewed').length,disputed=mine.filter(r=>r.state==='unsupported').length,context=mine.filter(r=>r.state==='needs_context').length;
 const selected=result?.dimensions.find(d=>d.id===dimension),located=quote?locateEvidence(text,quote):null;
 const next=SCORED_DIMENSIONS.slice(SCORED_DIMENSIONS.indexOf(dimension)+1).concat(SCORED_DIMENSIONS.slice(0,SCORED_DIMENSIONS.indexOf(dimension)+1)).find(id=>!mine.some(r=>r.dimension===id&&r.state!=='unreviewed'));
 useEffect(()=>{const node=resultPanel.current;if(node&&key&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const a=node.animate([{opacity:.7,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:180});return()=>a.cancel();}},[key,dimension]);
 function editText(value:string){const saved=writeTabDraft('unfinished-source',{text:value,active:true});setUnfinished(value);setTransientSource(!saved.saved);mobileSet('source');textSet(value);resultSet(null);quoteSet('');externalSet('');conditionsSet(undefined);originSet('own');errorSet(null);noticeSet('原文已改变，旧评测已失效。'+saved.notice);}
 return <>
 <div className="eval-intro"><div><p className="workspace-kicker">创意文本 · 五维证据复核</p><h1>把评分，放回原文里。</h1></div><p>并置原文、引文与评语。保留模型原分，单独记录你的判断。</p></div>
 <ReviewOverview/>
 <section className="material-toolbar" aria-label="选择待复核材料">
 <ExternalTaskPanel disabled={busy} seedText={text} onImport={r=>importRecord(r)}/>
 <LibraryPanel disabled={busy} onOpen={r=>{try{importRecord(r,true);}catch(e){noticeSet((e as Error).message+'；当前材料未被替换。');}}}/>
 <div className="record-tools"><ImportPanel disabled={busy} onImport={r=>importRecord(r)}/>
 <details className="history-source"><summary>更换历史记录 <span>{origin==='history'?replayItem(sampleId).label:'浏览内置对照样本'}</span></summary>
 <div className="replay-selects history-toolbar"><label className="replay-picker">历史样本<select aria-label="选择历史样本" disabled={busy} value={sampleId} onChange={e=>showSample(e.target.value)}>{REPLAY_ITEMS.map(i=><option key={i.id} value={i.id}>{i.label}</option>)}</select></label><label className="replay-picker">历史运行<select aria-label="选择历史运行" disabled={busy} value={runIndex} onChange={e=>showSample(sampleId,Number(e.target.value))}>{replayItem(sampleId).runs.map((_,i)=><option key={i} value={i}>第{i+1}次记录</option>)}</select></label><button disabled={busy} onClick={()=>showSample(sampleId,runIndex)}>载入所选历史记录</button><Link href={`/compare/?sample=${sampleId}&dimension=${dimension}`} title={origin==='history'?undefined:'历史示例不包含当前材料，不会比较当前导入结果。'}>{origin==='history'?'查看版本比较 →':'查看历史对照示例 →'}</Link></div>
 </details></div></section>
 {unfinished&&origin!=='own'&&<button className="unfinished-source" disabled={busy} onClick={()=>editText(unfinished)}>恢复未评原文（使当前评测失效）</button>}
 <div className="eval-summary"><span><b>{sourceLabel}</b>{result&&<> · 原始均分 {result.overall.toFixed(2)}/5</>}</span><span className="review-progress"><progress value={reviewed} max={5} aria-label="五维复核进度"/>已复核 {reviewed}/5 · 存疑 {disputed} · 待补上下文 {context}</span></div>
 {origin==='external'&&result&&<div className="material-context"><span>{library.data.records.find(r=>r.key===key)?.name||'当前材料尚未保存至资料库'}</span>{library.data.records.some(r=>r.key===key)?<Link href={'/compare/?record='+encodeURIComponent(key)}>用这份材料做版本对照 →</Link>:<span>此材料尚未入库，前往对照前请先导出JSON。</span>}{!library.data.records.some(r=>r.key===key)&&<button onClick={()=>{try{saveLibraryRecord({key,sourceText:text,originalResult:result,reviews:mine,fileName,conditions},text.slice(0,28));}catch(e){noticeSet((e as Error).message);}}}>保存到资料库</button>}</div>}
 <p className="library-notice" role="status">{library.notice}</p>
 {notice&&<p className="replay-note" role="status">{notice}</p>}<ErrorBanner message={error}/>
 <div className="review-desk" data-has-result={!!result}>
 {result&&<div className="dimension-nav" role="group" aria-label="当前复核维度">{SCORED_DIMENSIONS.map((id,i)=>{const d=result.dimensions.find(d=>d.id===id)!,v=mine.find(r=>r.dimension===id);return <button key={id} aria-pressed={dimension===id} onClick={()=>chooseDimension(id)}><span><i>{String(i+1).padStart(2,'0')}</i>{DIMENSIONS[id].labelZh}</span><b>{d.score}/5</b><small>{REVIEW_STATES[v?.state??'unreviewed']}</small></button>;})}</div>}
 <div className="review-mobile-tabs" role="group" aria-label="工作区面板"><button aria-pressed={mobile==='source'} onClick={()=>mobileSet('source')}>原文</button><button aria-pressed={mobile==='review'} onClick={()=>mobileSet('review')}>当前评语与复核</button></div>
 <div className="eval-workspace focused-workspace" data-mobile={mobile}>
 <section className="eval-source source-column" aria-label="当前原文"><div className="review-heading"><h2>原文</h2><span>{text.length} 字</span></div>
 {result?<><article ref={sourceDoc} className="source-document" tabIndex={0} aria-label="原文与定位引用">{located?<>{text.slice(0,located.start)}<mark data-source-match>{text.slice(located.start,located.end)}</mark>{text.slice(located.end)}</>:text}</article><details className="edit-source"><summary>修改原文（使当前评测失效）</summary><textarea aria-label="修改原文" value={text} disabled={busy} onChange={e=>editText(e.target.value)} rows={9}/></details></>:<label className="review-field">待评原文<textarea aria-label="待评原文" value={text} disabled={busy} onChange={e=>editText(e.target.value)} rows={15}/></label>}
 <p className="replay-note">{origin==='external'?`${fileName} · 模型、时间与原分为文件声明，未作认证。`:origin==='history'?replayItem(sampleId).note:'修改原文后需重新评测或导入匹配的结果。'}</p>
 <details className="record-meta"><summary>原始记录声明</summary>{result&&<p>{result.meta.model} · {result.meta.time_basis==='import-time'?'导入时间（外部运行时间未声明）：':''}{result.meta.at}{origin==='external'?' · 仅为文件声明，未经认证':''}</p>}</details><div className="review-actions">{hasKey?<button onClick={run} disabled={busy||!text.trim()}>{busy?'正在评测…':'使用已配置接口评测'}</button>:<a href="#my-text" onClick={()=>{const panel=document.getElementById('my-text');if(panel instanceof HTMLDetailsElement)panel.open=true;}}>用已有AI评测这段原文</a>}{busy&&<button onClick={()=>request.current?.abort()}>取消</button>}{loaded&&!hasKey&&<button onClick={()=>document.getElementById("interface-settings")?.click()}>配置接口（可选）</button>}</div>
 </section>
 <section ref={resultPanel} id="review-workspace" tabIndex={-1} className="eval-results review-column" aria-label="当前维度评语与复核">{result&&selected?<>
 <div className="current-dimension"><div><p>当前维度 · 原始评分</p><h2>{DIMENSIONS[dimension].labelZh}</h2></div><strong>{selected.score}<small>/5</small></strong></div>
 <details className="rubric-inspect"><summary>评分标准 · 这档与相邻档差在哪里？</summary><p className="replay-note">以下为本工具现有五维标准；外部记录是否实际使用，由导入声明决定。</p><ol>{DIMENSIONS[dimension].anchors.map((anchor,i)=><li key={i} data-current={i+1===selected.score}><b>{i+1}分{i+1===selected.score?' · 原评分':''}</b><span>{anchor}</span></li>)}</ol></details>
 <p className="judge-comment">{selected.comment||'原记录没有评语。'}</p>
 {commentGloss(selected)&&<p className="comment-gloss"><span>评语释义 · 随记录提供</span>{commentGloss(selected)}</p>}
 <div className="quote-list"><p className="replay-note">原始引用 · 点击定位；定位成功不等于论证成立。</p>{selected.evidence.map((q,i)=>{const found=locateEvidence(text,q);return <button key={i} aria-pressed={q===quote} onClick={()=>{quoteSet(q);if(innerWidth<700)mobileSet('source');requestAnimationFrame(()=>sourceDoc.current?.querySelector('mark')?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));}}><span>“{q}”</span><small>{found?'可定位':'无法定位 · 保留原引用'}</small></button>;})}</div>
 <div id="evidence-review"><EvidenceReview key={key} recordKey={key} sourceText={text} result={result} dimension={dimension} quote={quote} sourceLabel={sourceLabel} conditions={conditions} showContext={false} compact/></div>
 <button className="next-review" disabled={!next} onClick={()=>next&&chooseDimension(next)}>{next?'下一项待复核 →':'五维已复核，可导出报告'}</button>
 <details className="safety-detail"><summary>原始安全分类（不作为发布许可）</summary><SafetyCard s={result.safety}/></details>
 <button className="primary markdown-export" onClick={()=>{downloadText(reportMarkdown(key,text,result,reviews.items,sourceLabel,actions.items),'eval-review.md');}}>导出报告 · 未解决事项在前</button>
 </>:<div className="review-empty">{busy?'等待本次返回，不展示旧分数。':'当前原文没有有效评测。请导入匹配的结果，或配置接口后明确发起评测；原文不会被历史样本替换。'}</div>}</section></div></div>
 {result&&<ActionList recordKey={key} canAdd={false}/>}
 </>;
}
