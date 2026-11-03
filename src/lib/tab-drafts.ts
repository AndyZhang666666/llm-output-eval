// Per-tab work in progress only. No interface settings or credentials enter this store.
export const DRAFT_PREFIX='llm-output-eval:tab-draft:v1:';
type Fields=Record<string,string|boolean>;
type State<T>={value:T;notice:string;saved:boolean};
const memory=new Map<string,State<Fields>>(),blocked=new Set<string>();
export function decodeDraft<T extends Fields>(raw:string,initial:T):T{
 if(raw.length>4*1024*1024)throw Error('暂存草稿过大');
 const p:unknown=JSON.parse(raw);
 if(!p||typeof p!=='object'||Array.isArray(p)||!('version' in p)||p.version!==1||!('value' in p)||!p.value||typeof p.value!=='object'||Array.isArray(p.value))throw Error('暂存草稿格式无效');
 const input=p.value as Record<string,unknown>,out={...initial};
 for(const key of Object.keys(initial)){
  if(typeof input[key]!==typeof initial[key])throw Error('暂存草稿字段无效');
  if(typeof input[key]==='string'&&(input[key] as string).length>4*1024*1024)throw Error('暂存字段过长');
  (out as Fields)[key]=input[key] as string|boolean;
 }
 return out;
}
export function readTabDraft<T extends Fields>(key:string,initial:T):State<T>{
 const cached=memory.get(key);if(cached)return cached as State<T>;
 let value=initial,notice='未提交文字暂存本标签页；不会上传。',saved=true;
 try{const raw=sessionStorage.getItem(DRAFT_PREFIX+key);if(raw)value=decodeDraft(raw,initial);}
 catch{blocked.add(key);saved=false;notice='标签页草稿无法读取，旧值未覆盖；新输入暂留页面内存，刷新前请复制带走。';}
 const state={value,notice,saved};memory.set(key,state);return state;
}
export function writeTabDraft<T extends Fields>(key:string,value:T):State<T>{
 let notice='未提交文字暂存本标签页；不会上传。',saved=true;
 try{const raw=JSON.stringify({version:1,value});if(new TextEncoder().encode(raw).length>4*1024*1024)throw Error('草稿超出自动暂存范围');if(blocked.has(key))throw Error('保留旧草稿');sessionStorage.setItem(DRAFT_PREFIX+key,raw);}
 catch{saved=false;notice='标签页存储不可用，旧值未覆盖；输入暂留页面内存，刷新或关闭前请复制带走。';}
 const state={value,notice,saved};memory.set(key,state);return state;
}

export function protectTabDraft(key:string){blocked.add(key);const prior=memory.get(key);if(prior)memory.set(key,{...prior,saved:false,notice:'草稿无法恢复，旧值未覆盖；当前输入暂留内存，刷新前请复制带走。'});}
