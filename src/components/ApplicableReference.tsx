import {applicableReferenceLabel} from '@/lib/task-loops';
import type {EvaluationResult} from '@/lib/types';
import type {ApplicabilityNote} from '@/lib/review-context';
export function ApplicableReference({result,judgments,source}:{result:EvaluationResult;judgments?:ReadonlyArray<Pick<ApplicabilityNote,'dimension'|'applicability'>>;source?:string}){
 const label=applicableReferenceLabel(result,judgments);
 return label?<div className="applicable-reference" aria-live="polite"><p>{label}</p>{source&&<small>适用性来源：{source}</small>}<small>只按明确“不适用”排除；待补上下文与未声明仍保留。仅供人工参考，模型五维原分与原始均分不变。</small></div>:null;
}
