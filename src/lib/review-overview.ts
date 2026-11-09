import {SCORED_DIMENSIONS} from './dimensions';
import type {Review} from './review';
import type {EvaluationResult,ScoredDimensionId} from './types';
import type {ImportRecord} from './import-report';

export function summarizeReviews(records:{key:string;originalResult:EvaluationResult}[],items:Review[]){
 const unique=[...new Map(records.map(r=>[r.key,r])).values()];
 const observations=unique.flatMap(r=>SCORED_DIMENSIONS.map(id=>({r,id,review:items.find(v=>v.key===r.key&&v.dimension===id)})));
 const reviewed=observations.filter(x=>x.review&&x.review.state!=='unreviewed');
 const reviewedSamples=unique.filter(r=>SCORED_DIMENSIONS.every(id=>reviewed.some(x=>x.r.key===r.key&&x.id===id))).length;
 const pairs=observations.filter(x=>x.review?.humanScore!==undefined);
 const absoluteTotal=pairs.reduce((sum,x)=>sum+Math.abs(x.review!.humanScore!-x.r.originalResult.dimensions.find(d=>d.id===x.id)!.score),0);
 return {samples:unique.length,reviewedSamples,dimensions:observations.length,reviewed:reviewed.length,
 supported:reviewed.filter(x=>x.review?.state==='supported').length,
 disputed:reviewed.filter(x=>x.review?.state==='unsupported').length,
 context:reviewed.filter(x=>x.review?.state==='needs_context').length,
 pairs:pairs.length,meanAbsoluteDifference:pairs.length?absoluteTotal/pairs.length:null};
}

// Review disagreements take precedence over a large model-only delta.
export function priorityDimension(a:ImportRecord[],b:ImportRecord[],items:Review[]):ScoredDimensionId{
 const value=(records:ImportRecord[],id:ScoredDimensionId)=>records.length?records.reduce((s,r)=>s+r.originalResult.dimensions.find(d=>d.id===id)!.score,0)/records.length:0;
 const ranked=SCORED_DIMENSIONS.map((id,index)=>({id,index,
   dispute:[...a,...b].some(r=>items.some(v=>v.key===r.key&&v.dimension===id&&(v.state==='unsupported'||v.state==='needs_context'))),
   human:Math.max(0,...[...a,...b].map(r=>{const h=items.find(v=>v.key===r.key&&v.dimension===id)?.humanScore;return h===undefined?0:Math.abs(h-r.originalResult.dimensions.find(d=>d.id===id)!.score);})),
   delta:Math.abs(value(a,id)-value(b,id)),
 }));
 ranked.sort((x,y)=>Number(y.dispute)-Number(x.dispute)||y.human-x.human||y.delta-x.delta||x.index-y.index);
 return ranked[0].id;
}

/** A distribution of human review states, not judge accuracy. */
export function calibrationSummary(key:string,items:Review[]){
 const own=SCORED_DIMENSIONS.map(id=>items.find(v=>v.key===key&&v.dimension===id)).filter((v):v is Review=>!!v&&v.state!=='unreviewed');
 return {reviewed:own.length,supported:own.filter(v=>v.state==='supported').length,disputed:own.filter(v=>v.state==='unsupported').length,context:own.filter(v=>v.state==='needs_context').length,priority:own.filter(v=>v.state==='unsupported'||v.state==='needs_context').map(v=>v.dimension)};
}
