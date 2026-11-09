export type JSONTransport={raw:string;normalized:string;wrapper:'plain'|'json-fence'};
// Only transport wrappers are removed; field values are never repaired.
export function normalizeTaskJSON(raw:string){
 const text=raw.trim();if(!text.startsWith('```'))return text;
 const matched=/^```(?:json)?\s*\n([\s\S]*?)\n```$/i.exec(text);
 if(!matched||matched[1].includes('```'))throw Error('只接受一个完整JSON代码块，代码块之外不能有其他说明');
 return matched[1].trim();
}
export function transportFor(raw:string):JSONTransport{return {raw,normalized:normalizeTaskJSON(raw),wrapper:raw.trim().startsWith('```')?'json-fence':'plain'};}
export function validateTransport(value:unknown):JSONTransport{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('原始粘贴记录格式无效');const v=value as Record<string,unknown>;
 if(typeof v.raw!=='string'||new TextEncoder().encode(v.raw).length>1024*1024||typeof v.normalized!=='string'||!['plain','json-fence'].includes(String(v.wrapper)))throw Error('原始粘贴记录字段无效');
 const expected=transportFor(v.raw);if(expected.normalized!==v.normalized||expected.wrapper!==v.wrapper)throw Error('规范化记录与原始粘贴内容不一致；不会修正原分或引用');return expected;
}
