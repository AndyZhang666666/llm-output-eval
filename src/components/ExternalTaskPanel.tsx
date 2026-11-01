"use client";
import {useRef,useState} from 'react';
import {buildTaskPackage,importTaskResponse} from '@/lib/task-package';
import type {ImportRecord} from '@/lib/import-report';

/* Intent: a writer brings a text and uses an AI they already have. The handoff,
   not connection settings, is the focal action; the red Swiss rule marks progress. */
export function ExternalTaskPanel({onImport,disabled,seedText}:{onImport:(record:ImportRecord)=>void;disabled:boolean;seedText?:string}){
 const [text,setText]=useState(''),[raw,setRaw]=useState(''),[model,setModel]=useState(''),[at,setAt]=useState(''),[used,setUsed]=useState(false),[temperature,setTemperature]=useState('');
 const [packed,setPacked]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),ticket=useRef(0);
 async function prepare(){try{const value=buildTaskPackage(text);setPacked(value);setNotice('任务包已准备；请在你使用的AI中运行，完成后返回这里。');try{await navigator.clipboard.writeText(value);setNotice('完整任务包已复制。本站不会获知外部对话，返回结果须由你粘贴。');}catch{setNotice('剪贴板不可用，请展开下方任务包全选复制。');}}catch(e){setNotice((e as Error).message);}}
 async function accept(){const id=++ticket.current;setBusy(true);setNotice('');try{const r=await importTaskResponse(text,raw,model,at?new Date(at).toISOString():new Date().toISOString(),used,at?'declared-run':'import-time');if(temperature!==''){const t=Number(temperature);if(!Number.isFinite(t)||t<0||t>2)throw Error('温度须为0到2');r.conditions={...r.conditions,temperature:t};}if(ticket.current===id){onImport(r);setNotice('结果已检查并打开。原分、原评语和外部引用均保留。');}}catch(e){if(ticket.current===id)setNotice((e as Error).message+'；当前复核材料未被替换。');}finally{if(ticket.current===id)setBusy(false);}}
 function invalidate(value:string){ticket.current++;setBusy(false);setText(value);setPacked('');setRaw('');setUsed(false);setNotice('原文变化后需复制新的任务包，旧返回内容已清空。');}
 return <details className="external-task" id="my-text"><summary><span>用我的文本完成评测</span><small>无需本站 Key · 使用你已有的 AI</small></summary><div className="task-handoff">
  <p>这里专注短剧、故事等创意文本的五维评测。你负责在外部AI中运行，本站检查返回格式并帮助复核，不代替服务商认证。</p>
  <ol className="task-steps"><li><b>01</b> 准备原文</li><li><b>02</b> 交给已有AI</li><li><b>03</b> 带回结果复核</li></ol>
  <label className="review-field">我的原文<textarea aria-label="外部任务原文" disabled={busy||disabled} value={text} onChange={e=>invalidate(e.target.value)} maxLength={20000} rows={5} placeholder="粘贴你的故事或剧本，最多20000字符"/></label>
  {seedText&&<button className="seed-source" disabled={busy||disabled} onClick={()=>invalidate(seedText)}>使用下方当前原文</button>}
  <div className="review-actions"><button className="primary" onClick={prepare} disabled={disabled||busy||!text.trim()}>复制完整评测任务包</button><span className="replay-note">包含五维锚点、裁判规则、你的原文和返回格式。</span></div>
  {packed&&<details className="task-package"><summary>查看／手动复制任务包</summary><textarea aria-label="完整外部评测任务包" readOnly value={packed} rows={8}/><p className="replay-note">会将原文交给你选择的外部AI，请先确认适合在该服务处理。</p></details>}
  <div className="handoff-return"><h3>AI返回后，把结果放在这里</h3><label className="review-field">返回的JSON<textarea aria-label="外部AI返回JSON" disabled={busy||disabled} value={raw} onChange={e=>setRaw(e.target.value)} rows={5} maxLength={1024*1024} placeholder='{"dimensions":[…],"safety":{…},"overall":3.2}'/></label>
  <div className="declaration-grid"><label className="review-field">模型名称（你声明的）<input disabled={busy||disabled} value={model} onChange={e=>setModel(e.target.value)} maxLength={300} placeholder="例如：模型名称；不知道可填未提供"/></label><label className="review-field">外部运行时间（选填）<input disabled={busy||disabled} type="datetime-local" value={at} onChange={e=>setAt(e.target.value)}/><small>未填时使用导入时间，不代表服务商运行时间。</small></label><label className="review-field">温度（选填）<input disabled={busy||disabled} type="number" min="0" max="2" step="0.1" value={temperature} onChange={e=>setTemperature(e.target.value)} placeholder="不确定请留空"/></label></div>
  <label className="package-confirm"><input disabled={busy||disabled} type="checkbox" checked={used} onChange={e=>setUsed(e.target.checked)}/>我使用了上述任务包，没有改动评分规则或Prompt。此项是我的声明。</label>
  <div className="review-actions"><button className="primary" disabled={disabled||busy||!text.trim()||!raw.trim()||!model.trim()} onClick={accept}>{busy?'正在检查…':'检查结果，进入复核'}</button>{busy&&<button onClick={()=>{ticket.current++;setBusy(false);setNotice('本次导入已取消，原材料未被替换。');}}>取消导入</button>}</div></div>
  {notice&&<p className="task-notice" role="status">{notice}</p>}
 </div></details>;
}
