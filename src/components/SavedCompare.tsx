"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ImportPanel} from './ImportPanel';
import {ComparisonImport} from './ComparisonImport';
import {useLibrary,initializeLibrary,saveLibraryRecord,saveLibraryRecords} from '@/lib/library-store';
import {useReviews,currentReviews,storeReviews} from '@/lib/review-store';
import {currentActions,storeActions,useActions} from '@/lib/action-store';
import {downloadJson} from '@/lib/review';
import {aggregateRecords,changedRange,comparisonWarnings,compatibleRun,type SavedComparison} from '@/lib/comparison';
import {prepareImportedHumanState,type ImportRecord} from '@/lib/import-report';
import {DIMENSIONS,SCORED_DIMENSIONS} from '@/lib/dimensions';
import {formatRange} from '@/lib/stats';

function TextDifference({text,other}:{text:string;other:string}){const range=changedRange(text,other);return <article className="compare-original">{text.slice(0,range.start)}<mark>{text.slice(range.start,range.end)}</mark>{text.slice(range.end)}</article>;}
/* Compare saved observations; a declared condition is not a quality certificate. */
export function SavedCompare(){
 const library=useLibrary(),reviews=useReviews(),actionState=useActions();const [a,setA]=useState<ImportRecord[]>([]),[b,setB]=useState<ImportRecord[]>([]),[nameA,setNameA]=useState('版本A'),[nameB,setNameB]=useState('版本B'),[dimension,setDimension]=useState(SCORED_DIMENSIONS[0]),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;initializeLibrary().then(data=>{if(!active)return;const key=new URLSearchParams(location.search).get('record');const r=data.records.find(r=>r.key===key);if(r)setA([r]);});return()=>{active=false;};},[]);
 const sides=[{label:nameA,setName:setNameA,records:a,set:setA,letter:'A'},{label:nameB,setName:setNameB,records:b,set:setB,letter:'B'}];
 const complete=a.length>0&&b.length>0,statsA=a.length?aggregateRecords(a):null,statsB=b.length?aggregateRecords(b):null,warnings=complete?comparisonWarnings(a[0],b[0]):[];
 const same=complete&&a[0].sourceText===b[0].sourceText;
 function load(record:ImportRecord,set:(records:ImportRecord[])=>void){const human=prepareImportedHumanState(record,currentReviews(),currentActions());let selected=record,message='资料已载入；外部原分和评语保留。重复资料沿用已保存的条件声明。';try{const saved=saveLibraryRecord(record,record.name||record.sourceText.slice(0,28));selected=saved.records.find(r=>r.key===record.key)||record;}catch(e){message=(e as Error).message;}storeReviews(human.reviews);storeActions(human.actions);set([selected]);setMessage(message);}
 function restoreComparison(value:SavedComparison){
  let human={reviews:currentReviews(),actions:currentActions()};
  for(const record of value.sides.flat())human=prepareImportedHumanState(record,human.reviews,human.actions);
  let message='完整对照已恢复，名称与两侧原始结果保留。';
  try{saveLibraryRecords(value.sides.flat());}catch(e){message+=' '+(e as Error).message+'；本次两侧暂留本页，资料库未写入任何一半，仍可导出完整对照。';}
  storeReviews(human.reviews);storeActions(human.actions);setA(value.sides[0]);setB(value.sides[1]);setNameA(value.labels[0]);setNameB(value.labels[1]);setMessage(message);
 }
 function report(){return {version:1,kind:'saved-results-comparison',labels:[nameA,nameB],sides:[a,b].map(records=>records.map(r=>({...r,reviews:currentReviews().filter(v=>v.key===r.key),actions:currentActions().filter(v=>v.key===r.key)}))),warnings,limits:['只描述保存的记录，不宣称显著性、因果改善或发布许可','相同原文的重复记录也不代表受控独立实验','条件来自用户和文件声明，未作认证']};}
 return <><div className="eval-intro"><h1>两份结果，<br/>哪些差异值得改？</h1><p>用自己的已评测结果对照原文、理由和人工分歧。无需Key，不重新调用模型；原始记录不会被改写。</p></div>
 <ComparisonImport onImport={restoreComparison}/>
 <div className="saved-compare-inputs">{sides.map(side=><section className="comparison-slot" key={side.letter} aria-label={'版本'+side.letter+'资料'}><div className="slot-title"><b>{side.letter}</b><label>版本名称<input value={side.label} maxLength={80} onChange={e=>side.setName(e.target.value)}/></label></div>
 <label className="review-field">从本机资料库选择<select aria-label={'选择版本'+side.letter+'材料'} value={library.data.records.some(r=>r.key===side.records[0]?.key)?side.records[0]?.key:''} onChange={e=>{const r=library.data.records.find(r=>r.key===e.target.value);side.set(r?[r]:[]);}}><option value="">选择材料，或在下方导入</option>{library.data.records.map(r=><option key={r.key} value={r.key}>{r.name} · {r.originalResult.meta.model}</option>)}</select></label>
 <ImportPanel disabled={false} onImport={r=>load(r,side.set)}/>
 {side.records.length>0&&<><p className="replay-note">{side.records[0].originalResult.meta.model} · {side.records[0].originalResult.meta.at} · {side.records.length}份保存记录，来源声明未经认证</p><details className="repeat-runs"><summary>追加同文重复记录（可选）</summary><p>仅列出同一原文、相同模型与相同声明条件的不同记录。缺失条件仍会显示提醒；不会把同一份记录重复计数。</p>{library.data.records.filter(r=>compatibleRun(side.records[0],r)).map(r=><label key={r.key}><input type="checkbox" checked={side.records.some(v=>v.key===r.key)} disabled={side.records.length>=20&&!side.records.some(v=>v.key===r.key)} onChange={e=>side.set(e.target.checked?[...side.records,r]:side.records.filter(v=>v.key!==r.key))}/>{r.name} · {r.originalResult.meta.at}</label>)}{!library.data.records.some(r=>compatibleRun(side.records[0],r))&&<p>资料库暂无匹配的同文运行。</p>}</details></>}
 </section>)}</div>
 <p role="status" className="replay-note">{[message,library.notice,...[reviews.notice,actionState.notice].filter(n=>/不可用|暂留|无法恢复|未被覆盖/.test(n))].filter(Boolean).join(' ')}</p>
 {!complete&&<div className="compare-await"><b>先选两份结果。</b><p>可以直接导入两份现有复核JSON。没有评测结果？先用自己的文本生成外部任务包，或体验一组历史对照。</p><Link href="/#my-text">用我的文本开始 →</Link></div>}
 {complete&&statsA&&statsB&&<>
 <section className="comparison-context"><h2>{same?'同一原文的不同观察。':'不同版本，先核对比较条件。'}</h2><p>{same?'原文相同，分差可能来自模型和运行条件；不能当成改稿收益。':'高分不直接等于更值得采用；先看修改区域、评语依据和你自己的复核。'}</p>{a[0].key===b[0].key&&<p>两侧选择了同一份原始记录，不能充当两次独立评测。</p>}{warnings.length>0?<ul>{warnings.map(w=><li key={w}>{w}</li>)}</ul>:<p>两侧声明条件一致；仅为声明，未独立认证，仍不构成受控实验。</p>}<p>{a.length>1||b.length>1?'重复记录按保存内容汇总均值与最小～最大值。极差不是置信区间，也不检验显著性。':'每侧只有一次观察，不能据此判断稳定性或统计显著性。'}</p><button onClick={()=>downloadJson(report(),'eval-saved-comparison.json')}>导出本次对照</button></section>
 <div className="comparison-table"><table><caption>五维原始观察 · 分差=B−A，只描述所选记录</caption><thead><tr><th>维度</th><th>{nameA||'版本A'}</th><th>{nameB||'版本B'}</th><th>分差</th></tr></thead><tbody>{SCORED_DIMENSIONS.map((id,i)=><tr key={id}><th><button aria-pressed={dimension===id} onClick={()=>setDimension(id)}>{DIMENSIONS[id].labelZh}</button></th><td>{a.length===1?statsA.stats[i].mean:formatRange(statsA.stats[i])}</td><td>{b.length===1?statsB.stats[i].mean:formatRange(statsB.stats[i])}</td><td>{(statsB.stats[i].mean-statsA.stats[i].mean).toFixed(2)}</td></tr>)}</tbody></table></div>
 <section className="comparison-comments"><h2>{DIMENSIONS[dimension].labelZh} · 看理由，不只看分差</h2><div className="comment-columns">{sides.map(side=><div key={side.letter}><h3>{side.label||'版本'+side.letter}</h3>{side.records.map((r,i)=>{const d=r.originalResult.dimensions.find(d=>d.id===dimension)!,review=reviews.items.find(v=>v.key===r.key&&v.dimension===dimension);return <article key={r.key}><small>保存记录{i+1} · 原评分{d.score}/5</small><p>{d.comment}</p>{d.evidence.length?d.evidence.map((q,j)=><blockquote key={j}>{q}</blockquote>):<p>原记录没有引用。</p>}<p className="review-inline-status">人工复核：{review?.state==='unsupported'?'存疑':review?.state==='needs_context'?'待补上下文':review?.state==='supported'?'证据支持':'尚未复核'}{review?.note?' · '+review.note:''}</p>{library.data.records.some(saved=>saved.key===r.key)?<Link href={'/?record='+encodeURIComponent(r.key)+'&dimension='+dimension}>打开这份记录核对原文 →</Link>:<p className="replay-note">此材料暂留当前对照；请先导出完整报告，或腾出资料库后重新恢复，再进入单篇复核。</p>}</article>;})}</div>)}</div></section>
 <details className="comparison-texts" open><summary>对照原文 · 标出首尾公共内容之间的变化区域</summary><p className="replay-note">这里只提示文本变化区域，不是语义或逐句差异判断；较远的多处修改可能合并显示。</p><div>{sides.map((side,i)=><section key={side.letter}><h3>{side.label||'版本'+side.letter}</h3><TextDifference text={side.records[0].sourceText} other={(i===0?b:a)[0].sourceText}/></section>)}</div></details>
 </>}
 </>;
}
