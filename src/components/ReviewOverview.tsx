"use client";
import Link from 'next/link';
import {REPLAY_ITEMS} from '@/lib/replay';
import {recordKey} from '@/lib/review';
import {useReviews} from '@/lib/review-store';
import {useLibrary} from '@/lib/library-store';
import {summarizeReviews} from '@/lib/review-overview';
export function ReviewOverview(){
 const library=useLibrary(),reviews=useReviews();
 const records=[...REPLAY_ITEMS.flatMap(item=>item.runs.map((r,i)=>({key:recordKey(item.id,i,item.text,r),originalResult:r}))),...library.data.records];
 const s=summarizeReviews(records,reviews.items);
 const abnormal=REPLAY_ITEMS.find(item=>item.runs[0].dimensions.some(d=>!d.evidence.length||d.score<=2));
 const target=abnormal?.runs[0].dimensions.find(d=>!d.evidence.length||d.score<=2)?.id;
 return <details className="review-overview"><summary>本机复核概况 <span>{reviews.ready?`已复核 ${s.reviewedSamples} / ${s.samples} 篇（${s.reviewed} / ${s.dimensions} 项五维判断）`:'正在读取本机记录'}</span></summary>
 <dl><div><dt>已完整复核记录</dt><dd>{s.reviewedSamples} / {s.samples} 篇</dd></div><div><dt>已作五维判断</dt><dd>{s.reviewed} / {s.dimensions} 项</dd></div><div><dt>在已复核判断中支持证据</dt><dd>{s.supported} / {s.reviewed} 项</dd></div><div><dt>有人工参考分可比较</dt><dd>{s.pairs} / {s.dimensions} 项</dd></div></dl>
 <p>存疑 {s.disputed} · 待补上下文 {s.context}。人工−模型绝对分差均值：{s.meanAbsoluteDifference===null?'暂无可比较参考分':s.meanAbsoluteDifference.toFixed(2)+`（${s.pairs}对）`}。</p>
 <p>每篇的五项均已判断，才计为完整复核。这里按评测记录计篇，同一原文的不同运行分别计数。范围为内置历史各次记录＋本机资料库，未入库的接口运行不纳入。未复核和未知不算支持，人工参考不等于金标准确率；此概况不会改写历史校验指标。</p>
 {abnormal&&target?<Link href={`/?sample=${abnormal.id}&dimension=${target}`}>打开真实存在的低分／缺引文记录 →</Link>:<p>当前没有符合条件的可访问异常记录。</p>}
 </details>;
}
