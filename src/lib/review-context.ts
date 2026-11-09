import {SCORED_DIMENSIONS} from './dimensions';
import type {ScoredDimensionId} from './types';

// A human interpretation layer: never part of an original result or its ID.
export const PURPOSES={undeclared:'用途未声明',complete:'完整短篇',opening:'开场 / 片段',other:'其他创意文本'} as const;
export type Purpose=keyof typeof PURPOSES;
export const APPLICABILITY={applicable:'适用于这次用途',not_applicable:'不适用于这次用途',needs_context:'需要更多上下文'} as const;
export type Applicability=keyof typeof APPLICABILITY;
export type ApplicabilityNote={dimension:ScoredDimensionId;applicability:Applicability;reason:string};
export type ReviewContext={purpose:Purpose;judgments:ApplicabilityNote[];updatedAt:string};
export function validateReviewContext(value:unknown):ReviewContext{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('用途与适用性说明格式无效');
 const v=value as Record<string,unknown>;
 if(typeof v.purpose!=='string'||!Object.hasOwn(PURPOSES,v.purpose)||!Array.isArray(v.judgments)||v.judgments.length>5||typeof v.updatedAt!=='string'||!Number.isFinite(Date.parse(v.updatedAt)))throw Error('用途与适用性说明字段无效');
 const seen=new Set<string>();
 const judgments=v.judgments.map(raw=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('维度适用性说明格式无效');
  const r=raw as Record<string,unknown>;
  if(!SCORED_DIMENSIONS.includes(r.dimension as ScoredDimensionId)||seen.has(String(r.dimension))||typeof r.applicability!=='string'||!Object.hasOwn(APPLICABILITY,r.applicability)||typeof r.reason!=='string'||r.reason.length>500)throw Error('维度适用性说明字段无效');
  if(r.applicability==='not_applicable'&&!r.reason.trim())throw Error('请说明为什么该判断不适用于这份用途');
  seen.add(String(r.dimension));
  return {dimension:r.dimension as ScoredDimensionId,applicability:r.applicability as Applicability,reason:r.reason};
 });
 return {purpose:v.purpose as Purpose,judgments,updatedAt:v.updatedAt};
}
export function contextMarkdown(context:ReviewContext|undefined){return context?[`材料用途（人工声明）：${PURPOSES[context.purpose]}`,...context.judgments.map(j=>`- ${j.dimension}：${APPLICABILITY[j.applicability]}${j.reason?'；'+j.reason:''}`),'用途和适用性不改模型原分或原始均分。']:['材料用途：未声明；未将既有五维标准自动视为适用。'];}
