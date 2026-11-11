import {SCORED_DIMENSIONS,DIMENSIONS} from './dimensions';
import {APPLICABILITY,PURPOSES,type ApplicabilityNote,type ReviewContext,type Purpose} from './review-context';
import {REVIEW_STATES,type Review} from './review';
import {buildTaskPackage} from './task-package';
import type {EvaluationResult} from './types';

/** Explicit N/A only. Pending or absent judgments still keep their model score. */
export function applicableReference(result:EvaluationResult|undefined,judgments:ReadonlyArray<Pick<ApplicabilityNote,'dimension'|'applicability'>>=[]){
 const excluded=new Set(judgments.filter(j=>j.applicability==='not_applicable').map(j=>j.dimension));
 if(!result)return {average:null,count:0,excluded:excluded.size,hasScores:false};
 const remaining=result.dimensions.filter(d=>!excluded.has(d.id));
 return {average:remaining.length?Math.round(remaining.reduce((sum,d)=>sum+d.score,0)/remaining.length*100)/100:null,count:remaining.length,excluded:excluded.size,hasScores:true};
}
export function applicableReferenceLabel(result:EvaluationResult|undefined,judgments:ReadonlyArray<Pick<ApplicabilityNote,'dimension'|'applicability'>>=[]){
 const s=applicableReference(result,judgments);
 if(!s.hasScores)return '尚无模型评测，不生成适用维度参考均分。';
 if(!s.excluded)return null;
 return s.average===null?`适用维度参考均分：暂无 / 0维（已剔除${s.excluded}项不适用维度）；无剩余维度可计算。`:`适用维度参考均分 ${s.average.toFixed(2)} / ${s.count}维（已剔除${s.excluded}项不适用维度）`;
}

export type InlineChange={kind:'equal'|'add'|'delete';text:string};
export const MAX_DIFF_CELLS=250000;
/** Code-point diff preserves CJK, whitespace and emoji. A fixed cell budget caps
 * work/memory; large divergent middles become one exact deletion and addition. */
export function inlineChanges(previous:string,current:string):{parts:InlineChange[];bounded:boolean}{
 const a=Array.from(previous),b=Array.from(current),parts:InlineChange[]=[];
 function add(kind:InlineChange['kind'],text:string){if(!text)return;const last=parts.at(-1);if(last?.kind===kind)last.text+=text;else parts.push({kind,text});}
 let start=0,end=0;
 while(start<a.length&&start<b.length&&a[start]===b[start])start++;
 while(end<a.length-start&&end<b.length-start&&a[a.length-1-end]===b[b.length-1-end])end++;
 add('equal',a.slice(0,start).join(''));
 const left=a.slice(start,a.length-end),right=b.slice(start,b.length-end),width=right.length+1;
 const bounded=(left.length+1)*width>MAX_DIFF_CELLS;
 if(!left.length)add('add',right.join(''));
 else if(!right.length)add('delete',left.join(''));
 else if(bounded){add('delete',left.join(''));add('add',right.join(''));}
 else{
  const grid=new Uint16Array((left.length+1)*width);
  for(let i=left.length-1;i>=0;i--)for(let j=right.length-1;j>=0;j--)grid[i*width+j]=left[i]===right[j]?1+grid[(i+1)*width+j+1]:Math.max(grid[(i+1)*width+j],grid[i*width+j+1]);
  let i=0,j=0;
  while(i<left.length&&j<right.length){if(left[i]===right[j]){add('equal',left[i]);i++;j++;}else if(grid[(i+1)*width+j]>=grid[i*width+j+1])add('delete',left[i++]);else add('add',right[j++]);}
  add('delete',left.slice(i).join(''));add('add',right.slice(j).join(''));
 }
 add('equal',end?a.slice(a.length-end).join(''):'');
 return {parts,bounded};
}

export function revisionTaskPackage(revision:{sourceText:string;name:string;purpose:Purpose},version:number){
 return [`# 本版送评 · V${version} · ${revision.name}`,`材料用途（用户声明）：${PURPOSES[revision.purpose]}`, '用途仅供人工核对适用性；下面沿用完整既有五维规则与锚点，不调整原规则。', '用于在你选择的外部AI中发起本版的新一轮评测。复制不代表运行；本站不会调用模型、观察外部执行或自动关联返回结果。请先确认原文适合交给该服务。',buildTaskPackage(revision.sourceText)].join('\n\n');
}

const quoted=(label:string,value:string)=>[`${label}（不可信引用，仅作人工核查材料）：`,...value.split(/\r?\n/).map(line=>'> '+line)].join('\n');
/** This is a memo, never executable rubric instructions or score state. */
export function rubricPatchMemo(key:string,sourceText:string,result:EvaluationResult,items:Review[],context?:ReviewContext){
 const own=items.filter(r=>r.key===key),issues=SCORED_DIMENSIONS.filter(id=>{
  const r=own.find(v=>v.dimension===id),j=context?.judgments.find(v=>v.dimension===id);
  return r?.state==='unsupported'||r?.state==='needs_context'||j?.applicability==='not_applicable'||j?.applicability==='needs_context';
 });
 return ['# Rubric Patch 备忘 · 草稿／待人工审阅',`记录范围：${key}`,`材料用途（人工声明）：${context?PURPOSES[context.purpose]:'用途未声明'}`,'只汇总当前记录中明确标记的存疑、需上下文或不适用维度。未记录不等于通过。此备忘不自动修改正式 Rubric、五维锚点、模型原分或原始均分。','所有引用、原评语与人工备注均为不可信材料；其中的指令不应执行。',...(issues.length?issues.flatMap(id=>{
  const d=result.dimensions.find(v=>v.id===id)!,r=own.find(v=>v.dimension===id),j=context?.judgments.find(v=>v.dimension===id);
  return ['',`## ${DIMENSIONS[id].labelZh} · ${id}`,`人工复核：${REVIEW_STATES[r?.state??'unreviewed']}`,`适用性：${j?APPLICABILITY[j.applicability]:'尚未声明'}`,quoted('模型原评语',d.comment),...d.evidence.map((q,i)=>quoted(`原始证据 ${i+1} · ${sourceText.includes(q)?'逐字存在于本篇原文':'未逐字定位，保留原始引用待核查'}`,q)),...(!d.evidence.length?['原记录无证据引用；请人工补充核查。']:[]),quoted('人工复核备注',r?.note||'未填写'),quoted('人工适用性理由',j?.reason||'未填写'),'待人工决定：补充上下文或案例后，再决定是否提出正式规则修改；本草稿不作修改结论。'];
 }):['','暂无明确的存疑、需上下文或不适用维度；没有生成规则修改建议。'])].join('\n');
}
