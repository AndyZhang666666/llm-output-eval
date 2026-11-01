"use client";
import {useEffect,useState} from 'react';
import {ReplayCompare} from '@/components/ReplayCompare';
import {LiveCompare} from '@/components/LiveCompare';
import {SavedCompare} from '@/components/SavedCompare';
import {useSettings} from '@/lib/settings';
export default function ComparePage(){
 const {hasKey}=useSettings();const [mode,setMode]=useState('mine');
 useEffect(()=>{if(new URLSearchParams(location.search).has('sample'))requestAnimationFrame(()=>setMode('history'));},[]);
 return <><div className="compare-modes" role="group" aria-label="对照来源"><button aria-pressed={mode==='mine'} onClick={()=>setMode('mine')}>我的结果对照</button><button aria-pressed={mode==='history'} onClick={()=>setMode('history')}>体验历史对照</button><button aria-pressed={mode==='live'} onClick={()=>setMode('live')}>接口运行（可选）</button></div>
 {mode==='mine'?<SavedCompare/>:mode==='history'?<ReplayCompare/>:hasKey?<LiveCompare/>:<section className="no-interface"><h1>接口是可选项。</h1><p>无需Key，也能比较自己已评测的两份结果。配置可信接口后才会发送原文，运行次数会在请求前展示。</p><div className="review-actions"><button className="primary" onClick={()=>setMode('mine')}>比较已有结果</button><button onClick={()=>document.getElementById('interface-settings')?.click()}>配置自己的接口</button></div></section>}</>;
}
