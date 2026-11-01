"use client";
import { useSyncExternalStore } from 'react';
import { ACTION_STORAGE, decodeActions, type ReviewAction } from './actions';
type Snapshot = { items: ReviewAction[]; notice: string };
const empty: Snapshot = { items: [], notice: '' };
let memory: Snapshot | null = null,preserveUnreadable=false;
const listeners = new Set<()=>void>();
function read(): Snapshot {
  if(memory)return memory;
  try{const raw=localStorage.getItem(ACTION_STORAGE);let items:ReviewAction[]=[];if(raw){const payload=JSON.parse(raw);if(payload.version!==1||!Array.isArray(payload.items))throw Error('处理清单格式无效');items=decodeActions(payload.items);}memory={items,notice:''};}
  catch{preserveUnreadable=true;memory={items:[],notice:'处理清单未能从本机恢复，旧存储未被覆盖；当前仍可操作与导出。'};}
  return memory;
}
function subscribe(cb:()=>void){listeners.add(cb);const change=()=>{memory=null;cb();};window.addEventListener('storage',change);return()=>{listeners.delete(cb);window.removeEventListener('storage',change);};}
export function storeActions(items: ReviewAction[]){
  const checked=decodeActions(items);
  let notice='处理进度已保存在本机；不改变原始评分。';
  try{if(preserveUnreadable)throw Error('保留旧存储');localStorage.setItem(ACTION_STORAGE,JSON.stringify({version:1,items:checked}));}catch{notice='处理项暂留本页，请及时导出；旧存储未被覆盖，本机保存不可用。';}
  memory={items:checked,notice};listeners.forEach(cb=>cb());
}
export function currentActions(){return read().items;}
export function mergeActions(items: ReviewAction[]){const existing=read().items,next=[...existing,...items.filter(a=>!existing.some(b=>a.id===b.id&&a.key===b.key))];if(next.length>500)return '本机处理清单已满，导入处理项未覆盖旧项；可先导出备份后移除已完成项。';storeActions(next);return '';}
export function useActions(){return useSyncExternalStore(subscribe,read,()=>empty);}
