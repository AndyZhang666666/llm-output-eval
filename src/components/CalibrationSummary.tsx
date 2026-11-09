"use client";
import {useReviews} from '@/lib/review-store';
import {calibrationSummary} from '@/lib/review-overview';
import {DIMENSIONS} from '@/lib/dimensions';
export function CalibrationSummary({recordKey}:{recordKey:string}){
 const reviews=useReviews(),s=calibrationSummary(recordKey,reviews.items);
 return <section className="calibration-summary" aria-label="五维复核校准小结" aria-live="polite"><div><h2>这份评价，哪里需要再核查？</h2><p>支持 <b>{s.supported}</b> 项 · 存疑 <b>{s.disputed}</b> 项 · 需上下文 <b>{s.context}</b> 项</p></div><p>{s.priority.length?<>优先校准：{s.priority.map(id=>DIMENSIONS[id].labelZh).join('、')}</>:'尚无优先校准提示；未复核不等于通过。'}<small>人工判断分布，不是模型准确率。</small></p></section>;
}
