"use client";
import {useState} from 'react';
import {useActions,currentActions,storeActions} from '@/lib/action-store';
import {ACTION_KINDS,type ReviewAction} from '@/lib/actions';
import {DIMENSIONS} from '@/lib/dimensions';
import type {ScoredDimensionId} from '@/lib/types';
import {useTabDraft} from '@/lib/use-tab-draft';
const ACTION_DRAFT={kind:'comment_check',text:''};

export function ActionList({recordKey,dimension,canAdd,evidence,showAll=false}:{recordKey:string;dimension?:ScoredDimensionId;canAdd:boolean;evidence?:string;showAll?:boolean}){
 const {items,notice}=useActions();const [draft,setDraft,draftStatus]=useTabDraft('action-editor:'+recordKey+':'+(dimension||'all'),ACTION_DRAFT),[message,setMessage]=useState('');
 const kind=draft.kind as ReviewAction['kind'],text=draft.text,setKind=(kind:ReviewAction['kind'])=>setDraft({...draft,kind}),setText=(text:string)=>setDraft(previous=>({...previous,text}));
 const own=items.filter(a=>a.key===recordKey&&(showAll||!dimension||a.dimension===dimension));
 function add(){if(!text.trim()||!dimension)return;try{storeActions([...currentActions(),{id:crypto.randomUUID(),key:recordKey,dimension,kind,text:text.trim(),status:'open',updatedAt:new Date().toISOString(),...(evidence?{evidence:evidence.slice(0,2000)}:{})}]);setText('');setMessage('处理项已加入，完成状态与模型评分独立。');}catch(e){setMessage((e as Error).message);}}
 return <section className="action-list" aria-label={showAll?'本篇处理清单':dimension?'当前维度处理清单':'本篇处理清单'}><div className="action-heading"><h3>{showAll?'本篇处理清单':dimension?'下一步处理':'未解决与已完成事项'}</h3><span>{own.filter(a=>a.status==='open').length}项待处理</span></div>
 {!canAdd&&dimension&&<p className="replay-note">将判断设为“存疑”或“需要上下文”后，可添加核查评语或修改原文的任务。</p>}
 {canAdd&&dimension&&<div className="action-create"><p className="action-scope">添加至{DIMENSIONS[dimension].labelZh} · 未提交输入随维度保留</p><fieldset><legend>要处理什么</legend>{Object.entries(ACTION_KINDS).map(([value,label])=><label key={value}><input type="radio" name={'action-kind-'+dimension} value={value} checked={kind===value} onChange={()=>setKind(value as ReviewAction['kind'])}/>{label}</label>)}</fieldset>{evidence&&<blockquote className="action-evidence">关联原文：{evidence}</blockquote>}<label className="review-field">具体要做的事<textarea value={text} disabled={!draftStatus.ready} onChange={e=>setText(e.target.value)} rows={2} maxLength={500} placeholder={kind==='comment_check'?'例如：核查评语是否忽略了后半段的角色动机。':'例如：为第二幕的转折补充前因，完成后重新评测。'}/></label><button onClick={add} disabled={!draftStatus.ready||!text.trim()}>加入处理清单</button></div>}
 {own.length>0?<ul>{own.map(a=><li key={a.id} data-done={a.status==='done'}><label><input type="checkbox" checked={a.status==='done'} onChange={e=>storeActions(currentActions().map(x=>x.id===a.id&&x.key===a.key?{...x,status:e.target.checked?'done':'open',updatedAt:new Date().toISOString()}:x))}/><span><small>{(!dimension||showAll)&&DIMENSIONS[a.dimension].labelZh+' · '}{ACTION_KINDS[a.kind]}</small>{a.text}{a.evidence&&<blockquote>{a.evidence}</blockquote>}</span></label><button aria-label={'删除处理项：'+a.text} onClick={()=>storeActions(currentActions().filter(x=>!(x.id===a.id&&x.key===a.key)))}>移除</button></li>)}</ul>:<p className="replay-note">没有处理项。未添加任务不代表已通过评审。</p>}
 <p className="replay-note">勾选完成只记录你的处理进度；不会重评，也不会修改原始分数。</p><p role="status" className="replay-note">{message||notice||(!draftStatus.saved?draftStatus.notice:'')}</p></section>;
}
