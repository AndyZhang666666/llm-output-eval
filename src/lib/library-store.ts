"use client";
import {useSyncExternalStore} from 'react';
import {EXTERNAL_STORAGE, importedRecord, type ImportRecord} from './import-report';
import {addToLibrary,decodeLibrary,EMPTY_LIBRARY,LIBRARY_STORAGE,type LibraryData} from './library';
type Snapshot = {data:LibraryData;notice:string;ready:boolean};
const empty:Snapshot={data:EMPTY_LIBRARY,notice:'',ready:false};
let memory:Snapshot|null=null,initialized:Promise<LibraryData>|null=null,preserveUnreadable=false;
const listeners=new Set<()=>void>();
function read():Snapshot{
 if(memory)return memory;
 try{memory={data:decodeLibrary(localStorage.getItem(LIBRARY_STORAGE)),notice:'',ready:true};}
 catch{preserveUnreadable=true;memory={data:EMPTY_LIBRARY,notice:'本机资料库无法读取；旧内容未被覆盖，仍可导入与导出当前材料。',ready:true};}
 return memory;
}
function publish(data:LibraryData){
 let notice='资料已保存在当前浏览器。';
 try{if(preserveUnreadable)throw Error('保留不可读的旧数据');localStorage.setItem(LIBRARY_STORAGE,JSON.stringify(data));}catch{notice='本机保存不可用；旧资料未被覆盖，新资料暂留本页，刷新可能丢失，请及时导出。';}
 memory={data,notice,ready:true};listeners.forEach(cb=>cb());return data;
}
export function saveLibraryRecord(record:ImportRecord,name:string){return publish(addToLibrary(read().data,record,name));}
export function activateLibraryRecord(key:string){const data=read().data;if(!data.records.some(r=>r.key===key))return;publish({...data,activeKey:key});}
export function renameLibraryRecord(key:string,name:string){if(!name.trim())return;const data=read().data;publish({...data,records:data.records.map(r=>r.key===key?{...r,name:name.trim().slice(0,100)}:r)});}
export function deleteLibraryRecord(key:string){const data=read().data;publish({...data,activeKey:data.activeKey===key?'':data.activeKey,records:data.records.filter(r=>r.key!==key)});}
export function currentLibrary(){return read().data;}
export function initializeLibrary():Promise<LibraryData>{
 if(initialized)return initialized;
 initialized=(async()=>{
  const data=read().data;
  try{
   const old=localStorage.getItem(EXTERNAL_STORAGE);
   if(old){
    const record=await importedRecord(old,'迁移的上次导入材料');
    const next=saveLibraryRecord(record,'上次导入材料');
    // Remove the legacy slot only after a successful persistent save.
    if(localStorage.getItem(LIBRARY_STORAGE)===JSON.stringify(next))localStorage.removeItem(EXTERNAL_STORAGE);
    return next;
   }
  }catch(e){memory={...read(),notice:(e as Error).message+'；旧草稿未被删除。'};listeners.forEach(cb=>cb());}
  return data;
 })();return initialized;
}
function subscribe(cb:()=>void){listeners.add(cb);const change=()=>{memory=null;cb();};window.addEventListener('storage',change);return()=>{listeners.delete(cb);window.removeEventListener('storage',change);};}
export function useLibrary(){return useSyncExternalStore(subscribe,read,()=>empty);}
