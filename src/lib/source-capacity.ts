// Capacity for new/editable material. Existing imported reports have their own
// byte-bounded compatibility path and are never truncated by this limit.
export const MAX_NEW_SOURCE_CHARS=20000;
export function newSourceCapacityError(text:string){return text.length>MAX_NEW_SOURCE_CHARS?`原文已有${text.length}字符，超过新任务的${MAX_NEW_SOURCE_CHARS}字符上限。完整输入已保留；请另存或精简后再发起任务。`:'';}
