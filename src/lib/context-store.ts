"use client";
import {useSyncExternalStore} from 'react';
import {validateReviewContext,type ReviewContext} from './review-context';
export const CONTEXT_STORAGE='llm-output-eval:review-contexts:v1';
type Snapshot={items:Record<string,ReviewContext>;notice:string;ready:boolean};
const empty:Snapshot={items:{},notice:'',ready:false};let memory:Snapshot|null=null,preserveUnreadable=false;const listeners=new Set<()=>void>();
export function decodeContexts(raw:string|null):Record<string,ReviewContext>{
 if(!raw)return {};if(raw.length>2*1024*1024)throw Error('用途说明存储超过2MB');
 const p=JSON.parse(raw);if(!p||p.version!==1||!p.items||typeof p.items!=='object'||Array.isArray(p.items)||Object.keys(p.items).length>500)throw Error('用途说明格式无效');
 const pairs=Object.entries(p.items).map(([key,value])=>{if(key.length>800||!key)throw Error('用途说明记录编号无效');return [key,validateReviewContext(value)] as const;});return Object.fromEntries(pairs);
}
function read():Snapshot{if(memory)return memory;try{memory={items:decodeContexts(localStorage.getItem(CONTEXT_STORAGE)),notice:'',ready:true};}catch{preserveUnreadable=true;memory={...empty,ready:true,notice:'旧用途说明未能读取，旧存储保留；本页仍可记录并导出。'};}return memory;}
function subscribe(cb:()=>void){listeners.add(cb);const change=()=>{memory=null;cb();};window.addEventListener('storage',change);return()=>{listeners.delete(cb);window.removeEventListener('storage',change);};}
export function currentContexts(){return read().items;}
export function saveReviewContext(key:string,context:ReviewContext){
 const items=decodeContexts(JSON.stringify({version:1,items:{...read().items,[key]:context}}));
 let notice='用途和适用性已另存于人工解释层；原始评分未改变。';
 try{if(preserveUnreadable)throw Error('保留旧存储');localStorage.setItem(CONTEXT_STORAGE,JSON.stringify({version:1,items}));}catch{notice='用途说明暂留本页，旧存储未覆盖；请及时导出报告。';}
 memory={items,notice,ready:true};listeners.forEach(cb=>cb());
}
export function mergeReviewContext(key:string,context:ReviewContext|undefined){if(context&&!currentContexts()[key])saveReviewContext(key,context);}
export function useReviewContexts(){return useSyncExternalStore(subscribe,read,()=>empty);}
