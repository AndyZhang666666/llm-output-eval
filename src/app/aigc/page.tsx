"use client";
import {useState} from 'react';
import {AIGC_INPUT,AIGC_VERSIONS} from '@/lib/aigc-example';
import {DIMENSIONS,SCORED_DIMENSIONS} from '@/lib/dimensions';
import {locateEvidence} from '@/lib/evidence';
import type {ScoredDimensionId} from '@/lib/types';
export default function AigcExample(){
 const [dimension,setDimension]=useState<ScoredDimensionId>('structure'),[quote,setQuote]=useState<{side:string;text:string}|null>(null);
 return <><div className="eval-intro"><div><p className="workspace-kicker">冻结合成演示 · 未调用模型</p><h1>规则变了，为什么还要复核？</h1></div><p>同一输入的两版短剧。规则、输出、分数与评语全部人工编写，只演示检查方法，不是实际改写实验。</p></div>
 <section className="aigc-source"><h2>两版共享的输入</h2><p>{AIGC_INPUT}</p></section>
 <p className="priority-note">V1 的结构分更高，却违反输入约束。这不是更高分＝更可用；也不能用 V2 的平均分宣称新规则提升了模型。</p>
 <div className="aigc-dimensions" role="group" aria-label="合成场景比较维度">{SCORED_DIMENSIONS.map(id=><button key={id} aria-pressed={dimension===id} onClick={()=>{setDimension(id);setQuote(null);}}>{DIMENSIONS[id].labelZh}</button>)}</div>
 <div className="aigc-columns">{AIGC_VERSIONS.map(version=>{const d=version.result.dimensions.find(d=>d.id===dimension)!,found=quote?.side===version.id?locateEvidence(version.output,quote.text):null;return <article key={version.id}>
 <h2>{version.title}</h2><p className="aigc-rule">规则差异：{version.rules}</p>
 <div className="aigc-output" tabIndex={0} aria-label={version.id+'合成输出'}>{found?<>{version.output.slice(0,found.start)}<mark>{version.output.slice(found.start,found.end)}</mark>{version.output.slice(found.end)}</>:version.output}</div>
 <h3>{DIMENSIONS[dimension].labelZh} · 合成原分 {d.score}/5</h3><p>{d.comment}</p>
 {d.evidence.map(q=><button className="aigc-quote" key={q} aria-pressed={quote?.side===version.id&&quote.text===q} onClick={()=>setQuote({side:version.id,text:q})}>定位引用：“{q}”</button>)}
 <details><summary>查看五维原分</summary><ul>{version.result.dimensions.map(row=><li key={row.id}>{DIMENSIONS[row.id].labelZh}：{row.score}/5</li>)}</ul><p>原始均分 {version.result.overall.toFixed(2)}。数值为合成夹具，不是测得提升。</p></details>
 </article>;})}</div><section className="aigc-source"><h2>如果继续验证</h2><p>先确认输入约束、创作目标和评分锚点是否一致，再让独立标注者盲评未参与调整的材料。当前没有真实产线收益、模型效果或因果提升的结论；演示时间字段仅用于夹具格式。</p></section>
 </>;
}
