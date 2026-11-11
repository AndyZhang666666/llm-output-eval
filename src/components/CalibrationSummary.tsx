"use client";
import {useRef,useState} from 'react';
import {useReviews} from '@/lib/review-store';
import {calibrationSummary} from '@/lib/review-overview';
import {DIMENSIONS} from '@/lib/dimensions';
import {useReviewContexts} from '@/lib/context-store';
import {rubricPatchMemo} from '@/lib/task-loops';
import type {EvaluationResult} from '@/lib/types';
export function CalibrationSummary({recordKey,sourceText,result}:{recordKey:string;sourceText:string;result:EvaluationResult}){
 const reviews=useReviews(),contexts=useReviewContexts(),s=calibrationSummary(recordKey,reviews.items),memo=rubricPatchMemo(recordKey,sourceText,result,reviews.items,contexts.items[recordKey]);
 const details=useRef<HTMLDetailsElement>(null),[notice,setNotice]=useState('');
 async function copy(){try{await navigator.clipboard.writeText(memo);setNotice('Rubric Patch 草稿已复制；请人工核查后再决定是否提出规则修改。');}catch{if(details.current)details.current.open=true;setNotice('剪贴板不可用，请在展开的备忘中全选复制。');}}
 return <section className="calibration-summary" aria-label="五维复核校准小结"><div><h2>这份评价，哪里需要再核查？</h2><p>支持 <b>{s.supported}</b> 项 · 存疑 <b>{s.disputed}</b> 项 · 需上下文 <b>{s.context}</b> 项</p></div><div className="calibration-priority"><p>{s.priority.length?<>优先校准：{s.priority.map(id=>DIMENSIONS[id].labelZh).join('、')}</>:'尚无优先校准提示；未复核不等于通过。'}<small>人工判断分布，不是模型准确率。</small></p><details ref={details} className="rubric-patch"><summary>展开 Rubric Patch 备忘（草稿）</summary><p>仅汇总这份记录的明确问题、原始引用与人工备注；待人工审阅，不自动应用到正式规则或评分。</p><textarea aria-label="Rubric Patch 备忘草稿" readOnly value={memo} rows={10}/></details><button onClick={copy}>复制 Rubric Patch 备忘</button><p className="replay-note" role="status">{notice}</p></div></section>;
}
