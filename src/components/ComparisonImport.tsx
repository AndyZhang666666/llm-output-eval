"use client";
import {useRef,useState} from 'react';
import {useTabDraft} from '@/lib/use-tab-draft';
import {importComparisonReport,MAX_COMPARISON_BYTES,type SavedComparison} from '@/lib/comparison';

const EMPTY_COMPARISON_DRAFT={raw:''};
export function ComparisonImport({onImport,disabled=false}:{onImport:(report:SavedComparison)=>void;disabled?:boolean}){
 const [draft,setDraft,draftStatus]=useTabDraft('comparison-report',EMPTY_COMPARISON_DRAFT);
 const raw=draft.raw,setRaw=(raw:string)=>setDraft({raw});
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),sequence=useRef(0);
 async function accept(text:string,ticket=++sequence.current){if(ticket!==sequence.current)return;setBusy(true);setNotice('');try{const report=await importComparisonReport(text);if(ticket===sequence.current){onImport(report);setNotice('完整对照已恢复。两侧名称、原始结果和人工记录已检查；比较结论按当前记录重新计算。');}}catch(e){if(ticket===sequence.current)setNotice((e as Error).message+'。当前两侧材料与名称未被替换。');}finally{if(ticket===sequence.current)setBusy(false);}}
 return <details className="comparison-report-import"><summary>恢复完整对照报告 <span>导入之前导出的A/B报告JSON</span></summary><div><p className="replay-note" role="status">{draftStatus.notice} 大于4MB的粘贴草稿只留内存；完整报告仍按原48MB上限校验。</p><p>这会同时恢复两侧与版本名称；只想更换一侧，请使用下方对应的单份材料导入。最大48MB，每侧最多20份记录。</p><label className="review-field">上传完整对照报告<input aria-label="上传完整对照报告" type="file" accept=".json,application/json" disabled={busy||!draftStatus.ready||disabled} onChange={async e=>{const input=e.currentTarget,file=input.files?.[0];if(!file)return;if(file.size>MAX_COMPARISON_BYTES){setNotice('报告超过48MB，当前对照未被替换。');input.value='';return;}const ticket=++sequence.current;setBusy(true);try{await accept(await file.text(),ticket);}catch{if(ticket===sequence.current)setNotice('文件读取失败，当前对照未被替换。');}finally{input.value='';if(ticket===sequence.current)setBusy(false);}}}/></label><label className="review-field">或粘贴完整对照JSON<textarea aria-label="粘贴完整对照JSON" value={raw} onChange={e=>setRaw(e.target.value)} rows={5} disabled={busy||!draftStatus.ready||disabled}/></label><div className="review-actions"><button className="primary" disabled={busy||!draftStatus.ready||disabled||!raw.trim()} onClick={()=>accept(raw)}>{busy?'正在校验两侧…':'检查并恢复完整对照'}</button>{busy&&<button onClick={()=>{sequence.current++;setBusy(false);setNotice('恢复已取消，当前两侧与名称未被替换。');}}>取消恢复</button>}</div><p role="status" className="replay-note">{notice}</p></div></details>;
}
