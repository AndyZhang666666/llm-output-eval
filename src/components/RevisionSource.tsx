"use client";
import {useMemo,useRef,useState} from 'react';
import {inlineChanges,revisionTaskPackage} from '@/lib/task-loops';
import type {TextRevision} from '@/lib/manuscripts';

/* Intent: authors inspect exact edits before handing this version to their AI.
   Hierarchy: source remains primary, native controls secondary. Existing paper,
   ink, red rules, type and spacing remain; no new elevation or motion. */
export function RevisionSource({revision,previous,version,hasVersions}:{revision:TextRevision;previous?:TextRevision;version:number;hasVersions:boolean}){
 const [showDiff,setShowDiff]=useState(false),[packed,setPacked]=useState(''),[notice,setNotice]=useState('');
 const fallback=useRef<HTMLDetailsElement>(null);
 const diff=useMemo(()=>showDiff&&previous?inlineChanges(previous.sourceText,revision.sourceText):null,[showDiff,previous,revision.sourceText]);
 async function copy(){try{const value=revisionTaskPackage(revision,version);setPacked(value);try{await navigator.clipboard.writeText(value);setNotice(`V${version}送评 Prompt 已复制；请在自己的AI中明确运行，结果仍需带回核查。`);}catch{if(fallback.current)fallback.current.open=true;setNotice('剪贴板不可用；请在下方本版 Prompt 中全选复制。');}}catch(e){setNotice((e as Error).message);}}
 return <>
  <div className="revision-source-controls"><button onClick={copy}>复制本版（V{version}）送评 Prompt</button>{hasVersions&&<label className="inline-diff-toggle"><input type="checkbox" disabled={!previous} checked={showDiff} onChange={e=>setShowDiff(e.target.checked)}/>显示与上一版改动对比</label>}</div>
  {hasVersions&&!previous&&<p className="replay-note">V1 是首个保存版本，没有上一版，改动对比不可用。</p>}
  {diff&&<><p className="inline-diff-legend">对比保存顺序的上一版 V{version-1}：<ins>新增文字（下划线）</ins> · <del>删除文字（删除线）</del>。这是文字差异，不代表质量改善。</p>{diff.bounded&&<p className="replay-note">改动较大，中间改动按整段删除／新增展示；两版原文完整保留。</p>}</>}
  <article id="manuscript-source" tabIndex={0} className="source-document">{diff?diff.parts.map((part,i)=>part.kind==='add'?<ins key={i}>{part.text}</ins>:part.kind==='delete'?<del key={i}>{part.text}</del>:<span key={i}>{part.text}</span>):revision.sourceText}</article>
  {diff&&!diff.parts.some(p=>p.kind!=='equal')&&<p className="replay-note">两版正文完全一致；用途变化不会伪造成文字改动。</p>}
  <p className="replay-note">选中本版原文可以带入人工引用。删除标记属于上一版，保存引用仍以本版原文核查。人工意见不会改写原始评价。</p>
  <details ref={fallback} className="task-package revision-prompt"><summary>查看／手动复制本版送评 Prompt</summary>{packed?<textarea aria-label={`V${version}送评 Prompt`} readOnly value={packed} rows={8}/>:<p>点击上方复制按钮准备本版 Prompt。</p>}<p className="replay-note">包含未改动的既有五维规则、锚点和本版原文；仅准备外部任务，不调用模型。请确认原文适合交给你选择的服务。</p></details>
  <p className="replay-note" role="status">{notice}</p>
 </>;
}
