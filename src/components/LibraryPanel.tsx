"use client";
import Link from 'next/link';
import {useState} from 'react';
import {useLibrary,renameLibraryRecord,deleteLibraryRecord} from '@/lib/library-store';
import type {ImportRecord} from '@/lib/import-report';
import {currentReviews,storeReviews} from '@/lib/review-store';
import {downloadJson,reviewReport} from '@/lib/review';
import {currentActions,storeActions} from '@/lib/action-store';

export function LibraryPanel({onOpen,disabled}:{onOpen:(r:ImportRecord)=>void;disabled:boolean}){
 const {data,notice}=useLibrary();const [message,setMessage]=useState('');
 return <details className="material-library"><summary>我的资料库 <span>{data.records.length}/20</span></summary><div className="library-body"><p className="replay-note">只在当前浏览器保存，最多20份，不会自动覆盖旧资料。重要材料请导出；删除后无法从本站找回。</p>{data.records.length===0?<p className="library-empty">尚无保存材料。导入结果后会尝试加入资料库；历史回放不会自动混入。</p>:<ol className="library-list">{data.records.map(r=><li key={r.key}><div className="library-record"><label>材料名称（可直接编辑）<input aria-label={'材料名称：'+r.name} defaultValue={r.name} key={r.key+r.name} maxLength={100} disabled={disabled} onBlur={e=>{if(!e.target.value.trim()){e.target.value=r.name;setMessage('材料名不能为空，已保留原名。');}else renameLibraryRecord(r.key,e.target.value);}}/></label><p>{r.sourceText.length}字 · 原均分{r.originalResult.overall.toFixed(2)}/5 · {r.originalResult.meta.model} · {r.originalResult.meta.time_basis==='import-time'?'导入时刻':'记录时间声明'} {r.originalResult.meta.at}</p></div><div className="library-record-actions"><button disabled={disabled} onClick={()=>onOpen(r)}>打开复核</button><button onClick={()=>downloadJson({...reviewReport(r.key,r.sourceText,r.originalResult,currentReviews()),conditions:r.conditions,actions:currentActions().filter(a=>a.key===r.key),name:r.name},'eval-'+r.name.slice(0,30)+'.json')}>导出</button><Link href={'/compare/?record='+encodeURIComponent(r.key)}>用于对照</Link><button disabled={disabled} onClick={()=>{if(window.confirm('从本机删除“'+r.name+'”及其复核、处理项？已导出的文件不受影响。')){deleteLibraryRecord(r.key);storeReviews(currentReviews().filter(v=>v.key!==r.key));storeActions(currentActions().filter(a=>a.key!==r.key));setMessage('已从本机资料库删除；当前打开的材料仍可导出，需要时可重新保存。');}}}>删除</button></div></li>)}</ol>}<p role="status" className="replay-note">{message||notice}</p></div></details>;
}
