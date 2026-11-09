"use client";
import {useSyncExternalStore} from 'react';
import {decodeManuscripts,EMPTY_MANUSCRIPTS,MANUSCRIPT_STORAGE,type ManuscriptData} from './manuscripts';
type Snapshot={data:ManuscriptData;notice:string;ready:boolean};
const empty:Snapshot={data:EMPTY_MANUSCRIPTS,notice:'',ready:false};let memory:Snapshot|null=null,preserveUnreadable=false;const listeners=new Set<()=>void>();
function read():Snapshot{if(memory)return memory;try{memory={data:decodeManuscripts(localStorage.getItem(MANUSCRIPT_STORAGE)),notice:'',ready:true};}catch{preserveUnreadable=true;memory={data:EMPTY_MANUSCRIPTS,notice:'原文稿存储无法读取，旧数据未覆盖；新工作可暂留本页并导出。',ready:true};}return memory;}
function subscribe(cb:()=>void){listeners.add(cb);const change=()=>{memory=null;cb();};window.addEventListener('storage',change);return()=>{listeners.delete(cb);window.removeEventListener('storage',change);};}
export function currentManuscripts(){return read().data;}
export function storeManuscripts(data:ManuscriptData){const checked=decodeManuscripts(JSON.stringify(data));let notice='文稿与人工审阅已保存于本机，没有上传。';try{if(preserveUnreadable)throw Error('保留旧存储');localStorage.setItem(MANUSCRIPT_STORAGE,JSON.stringify(checked));}catch{notice='保存不可用，当前工作暂留本页；旧数据未覆盖，请及时导出。';}memory={data:checked,notice,ready:true};listeners.forEach(cb=>cb());}
export function useManuscripts(){return useSyncExternalStore(subscribe,read,()=>empty);}
