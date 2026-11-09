"use client";
import {useState} from 'react';
import {useReviewContexts,saveReviewContext} from '@/lib/context-store';
import {PURPOSES,APPLICABILITY,type Purpose,type Applicability} from '@/lib/review-context';
import {useTabDraft} from '@/lib/use-tab-draft';
import {DIMENSIONS} from '@/lib/dimensions';
import type {ScoredDimensionId} from '@/lib/types';

export function ReviewApplicability({recordKey,dimension}:{recordKey:string;dimension:ScoredDimensionId}){
 const store=useReviewContexts(),context=store.items[recordKey],[notice,setNotice]=useState('');
 return <section className="review-applicability"><label className="review-field">这份材料用来做什么？<select aria-label="模型记录的材料用途" disabled={!store.ready} value={context?.purpose||'undeclared'} onChange={e=>{try{saveReviewContext(recordKey,{purpose:e.target.value as Purpose,judgments:context?.judgments||[],updatedAt:new Date().toISOString()});}catch(error){setNotice((error as Error).message);}}}>{Object.entries(PURPOSES).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label><p className="purpose-warning">{context?.purpose==='opening'||context?.purpose==='other'?'片段不一定需要完整叙事弧。先判断标准是否适用，再核查原评语；不会删除结构分或重算均分。':context?.purpose==='complete'?'完整短篇仍需逐维判断标准的适用性；材料用途不能证明评价正确。':'用途尚未声明，不默认完整性标准适用。'}</p><ApplicabilityEditor key={recordKey+dimension+store.ready} recordKey={recordKey} dimension={dimension}/><p role="status" className="replay-note">{notice||store.notice}</p></section>;
}
function ApplicabilityEditor({recordKey,dimension}:{recordKey:string;dimension:ScoredDimensionId}){
 const store=useReviewContexts(),context=store.items[recordKey],saved=context?.judgments.find(j=>j.dimension===dimension),[initial]=useState(()=>({applicability:saved?.applicability||'needs_context',reason:saved?.reason||''}));
 const [draft,setDraft,status]=useTabDraft('applicability:'+recordKey+':'+dimension,initial),[notice,setNotice]=useState('');
 return <details><summary>这条{DIMENSIONS[dimension].labelZh}判断，适不适用？{saved?' · 已记录':''}</summary><label className="review-field">人工判断的适用性<select aria-label="原判断适用性" value={draft.applicability} onChange={e=>setDraft({...draft,applicability:e.target.value as Applicability})}>{Object.entries(APPLICABILITY).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label><label className="review-field">原因{draft.applicability==='not_applicable'?'（必填）':'（选填）'}<textarea aria-label="原判断适用性原因" rows={2} maxLength={500} value={draft.reason} onChange={e=>setDraft({...draft,reason:e.target.value})}/></label><button disabled={!store.ready||!status.ready} onClick={()=>{try{saveReviewContext(recordKey,{purpose:context?.purpose||'undeclared',judgments:[...(context?.judgments||[]).filter(j=>j.dimension!==dimension),{dimension,applicability:draft.applicability,reason:draft.reason}],updatedAt:new Date().toISOString()});setNotice('适用性已另存，原始模型评分保持。');}catch(error){setNotice((error as Error).message);}}}>保存适用性说明</button><p role="status" className="replay-note">{notice||status.notice}</p></details>;
}
