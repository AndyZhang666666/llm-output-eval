import {SCORED_DIMENSIONS,DIMENSIONS} from './dimensions';
import {decodeActions,type ReviewAction} from './actions';
import {reportMarkdown,recordFromPayload,validateReviewPayload,type ImportRecord} from './import-report';
import type {Review} from './review';
import {PURPOSES,type Purpose,APPLICABILITY} from './review-context';
export {PURPOSES,type Purpose,APPLICABILITY} from './review-context';
export const MANUSCRIPT_STORAGE='llm-output-eval:manuscripts:v2';
export const MAX_MANUSCRIPT_BYTES=8*1024*1024;
export const MAX_MANUSCRIPT_REPORT_BYTES=24*1024*1024;
export type Observation={dimension:(typeof SCORED_DIMENSIONS)[number];note:string;evidence:string;applicability:keyof typeof APPLICABILITY;reason:string;updatedAt:string};
export type TextRevision={id:string;name:string;sourceText:string;purpose:Purpose;createdAt:string;parentId:string|null;observations:Observation[];addressedActions:ReviewAction[];assessmentKeys:string[]};
export type Manuscript={id:string;name:string;createdAt:string;activeRevisionId:string;revisions:TextRevision[];assessmentSnapshots:ImportRecord[]};
export type ManuscriptData={version:2;projects:Manuscript[];activeProjectId:string};
export const EMPTY_MANUSCRIPTS:ManuscriptData={version:2,projects:[],activeProjectId:''};
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
function string(x:unknown,label:string,max:number,allowEmpty=true){if(typeof x!=='string'||x.length>max||(!allowEmpty&&!x.trim()))throw Error(`${label}无效或超过${max}字`);return x;}
function date(x:unknown){const s=string(x,'记录时间',80,false);if(!Number.isFinite(Date.parse(s)))throw Error('记录时间无效');return s;}
export function validateManuscript(value:unknown):Manuscript{
 if(!object(value)||!Array.isArray(value.revisions)||value.revisions.length<1||value.revisions.length>20)throw Error('每份文稿须有1到20个版本');
 const id=string(value.id,'文稿编号',200,false),name=string(value.name,'文稿名称',100,false),activeRevisionId=string(value.activeRevisionId,'当前版本',200,false),ids=new Set<string>();
 const revisions:TextRevision[]=value.revisions.map((raw:unknown)=>{
  if(!object(raw))throw Error('文稿版本格式无效');
  const rid=string(raw.id,'版本编号',200,false);if(ids.has(rid))throw Error('文稿版本编号重复');ids.add(rid);
  if(!Object.hasOwn(PURPOSES,String(raw.purpose)))throw Error('材料用途无效');
  const text=string(raw.sourceText,'原文',20000,false);
  if(!Array.isArray(raw.observations)||raw.observations.length>5)throw Error('人工审阅须按五维分别保存');
  const seen=new Set<string>();
  const observations:Observation[]=raw.observations.map((o:unknown)=>{
   if(!object(o)||!SCORED_DIMENSIONS.includes(o.dimension as never)||seen.has(String(o.dimension))||!Object.hasOwn(APPLICABILITY,String(o.applicability)))throw Error('人工审阅维度或适用性无效');seen.add(String(o.dimension));
   if(o.applicability==='not_applicable'&&(typeof o.reason!=='string'||!o.reason.trim()))throw Error('不适用时请填写原因');
   const evidence=string(o.evidence,'人工引用',2000);if(evidence&&!text.includes(evidence))throw Error('人工引用不在该版本原文中，请重新选择');
   return {dimension:o.dimension as Observation['dimension'],note:string(o.note,'审阅意见',2000),evidence,applicability:o.applicability as Observation['applicability'],reason:string(o.reason,'适用性理由',500),updatedAt:date(o.updatedAt)};
  });
  if(!Array.isArray(raw.assessmentKeys)||raw.assessmentKeys.length>20||raw.assessmentKeys.some(k=>typeof k!=='string'||k.length>800)||new Set(raw.assessmentKeys).size!==raw.assessmentKeys.length)throw Error('关联评测编号无效');
  const parentId=raw.parentId===null?null:string(raw.parentId,'父版本',200,false);
  return {id:rid,name:string(raw.name,'版本名称',100,false),sourceText:text,purpose:raw.purpose as Purpose,createdAt:date(raw.createdAt),parentId,observations,addressedActions:decodeActions(raw.addressedActions),assessmentKeys:raw.assessmentKeys as string[]};
 });
 const snapshots:ImportRecord[]=value.assessmentSnapshots===undefined?[]:(Array.isArray(value.assessmentSnapshots)&&value.assessmentSnapshots.length<=20?value.assessmentSnapshots.map((raw:unknown)=>{if(!object(raw)||typeof raw.key!=='string'||raw.key.length>800)throw Error('原始评测快照无效');const parsed=validateReviewPayload({...raw,version:1});return {...parsed,key:raw.key,fileName:typeof raw.fileName==='string'?raw.fileName:'文稿关联记录'};}):(()=>{throw Error('原始评测快照最多20份');})());
 if(new Set(snapshots.map(r=>r.key)).size!==snapshots.length)throw Error('原始评测快照重复');
 for(const rev of revisions)for(const key of rev.assessmentKeys){const r=snapshots.find(v=>v.key===key);if(!r||r.sourceText!==rev.sourceText)throw Error('关联快照缺失或不属于该版本原文');}
 if(!ids.has(activeRevisionId)||revisions.some((r,i)=>r.parentId!==null&&(!ids.has(r.parentId)||revisions.findIndex(v=>v.id===r.parentId)>=i)))throw Error('版本关系无效；父版本必须先于修改稿');
 for(const [i,revision] of revisions.entries())for(const action of revision.addressedActions){if(!revisions.slice(0,i).some(v=>v.assessmentKeys.includes(action.key)||revisionActionKey(v.id)===action.key))throw Error('修改稿的处理事项必须来自已保留的旧版本');}
 return {id,name,createdAt:date(value.createdAt),activeRevisionId,revisions,assessmentSnapshots:snapshots};
}
export function decodeManuscripts(raw:string|null):ManuscriptData{
 if(!raw)return EMPTY_MANUSCRIPTS;
 if(new TextEncoder().encode(raw).length>MAX_MANUSCRIPT_BYTES)throw Error('文稿工作区超过8MB，请先导出管理');
 const p:unknown=JSON.parse(raw);if(!object(p)||p.version!==2||!Array.isArray(p.projects)||p.projects.length>20)throw Error('文稿工作区格式无效，最多20份文稿');
 const projects=p.projects.map(validateManuscript);if(new Set(projects.map(p=>p.id)).size!==projects.length)throw Error('文稿编号重复');
 if(typeof p.activeProjectId!=='string'||(p.activeProjectId&&!projects.some(v=>v.id===p.activeProjectId)))throw Error('当前文稿编号无效');
 return {version:2,projects,activeProjectId:p.activeProjectId};
}
export function putManuscript(data:ManuscriptData,project:Manuscript):ManuscriptData{
 const checked=validateManuscript(project),next={...data,activeProjectId:checked.id,projects:data.projects.some(p=>p.id===checked.id)?data.projects.map(p=>p.id===checked.id?checked:p):[...data.projects,checked]};
 return decodeManuscripts(JSON.stringify(next));
}
export function createManuscript(sourceText:string,name:string,purpose:Purpose,id=crypto.randomUUID(),at=new Date().toISOString()):Manuscript{
 const rev:TextRevision={id:id+':v1',name:'初稿',sourceText,purpose,createdAt:at,parentId:null,observations:[],addressedActions:[],assessmentKeys:[]};
 return validateManuscript({id,name:name.trim()||sourceText.trim().slice(0,28),createdAt:at,activeRevisionId:rev.id,revisions:[rev],assessmentSnapshots:[]});
}
export function createRevision(project:Manuscript,parentId:string,text:string,name:string,purpose:Purpose,actions:ReviewAction[],id=crypto.randomUUID(),at=new Date().toISOString()):Manuscript{
 const parent=project.revisions.find(r=>r.id===parentId);if(!parent)throw Error('找不到原版本');if(parent.sourceText===text&&parent.purpose===purpose)throw Error('原文与用途都没有变化，无需创建重复版本');
 const revision:TextRevision={id,name:name.trim()||`修改稿 ${project.revisions.length}`,sourceText:text,purpose,createdAt:at,parentId,observations:[],addressedActions:decodeActions(actions),assessmentKeys:[]};
 return validateManuscript({...project,activeRevisionId:id,revisions:[...project.revisions,revision]});
}
export function updateObservation(project:Manuscript,revisionId:string,observation:Observation):Manuscript{
 if(!project.revisions.some(r=>r.id===revisionId))throw Error('找不到当前版本');
 return validateManuscript({...project,revisions:project.revisions.map(r=>r.id===revisionId?{...r,observations:[...r.observations.filter(o=>o.dimension!==observation.dimension),observation]}:r)});
}
export function linkAssessment(project:Manuscript,revisionId:string,record:ImportRecord):Manuscript{
 const revision=project.revisions.find(r=>r.id===revisionId);if(!revision||record.sourceText!==revision.sourceText)throw Error('评测原文与当前文稿版本不同，未关联、未替换原材料');
 return validateManuscript({...project,assessmentSnapshots:project.assessmentSnapshots.some(r=>r.key===record.key)?project.assessmentSnapshots:[...project.assessmentSnapshots,{...record,reviews:[],actions:[]}],revisions:project.revisions.map(r=>r.id===revisionId?{...r,assessmentKeys:[...new Set([...r.assessmentKeys,record.key])]}:r)});
}
export function purposeWarning(revision:TextRevision){return revision.purpose==='complete'?'当前声明为完整短篇；五维标准是否适用仍由人核对。':revision.purpose==='undeclared'?'材料用途尚未声明，不能默认完整性标准适用。':'开场、片段或其他用途可能不要求完整叙事弧；保留模型原分，另记适用性，不据此自动宣布改稿更好。';}
export function manuscriptReport(project:Manuscript,records:ImportRecord[],reviews:Review[],actions:ReviewAction[]){
 const available=[...new Map([...project.assessmentSnapshots,...records].map(r=>[r.key,r])).values()];
 const own=available.filter(r=>project.revisions.some(v=>v.assessmentKeys.includes(r.key)));
 const manualKeys=project.revisions.map(v=>revisionActionKey(v.id));
 return {version:2,kind:'manuscript-review' as const,project:validateManuscript(project),manualActions:actions.filter(a=>manualKeys.includes(a.key)),assessments:own.map(r=>({...r,version:1,recordKey:r.key,reviews:reviews.filter(v=>v.key===r.key),actions:actions.filter(a=>a.key===r.key)})),limits:['人工审阅不等于模型评测，没有模型结果不生成分数','版本正文独立保存，处理项关联不等于问题已解决或已重新评测','模型声明和复核结论保持独立；用途不同不直接宣布赢家']};
}
export async function importManuscriptReport(raw:string){
 if(new TextEncoder().encode(raw).length>MAX_MANUSCRIPT_REPORT_BYTES)throw Error('文稿报告最大24MB');
 const p:unknown=JSON.parse(raw);if(!object(p)||p.version!==2||p.kind!=='manuscript-review'||!Array.isArray(p.assessments)||p.assessments.length>20)throw Error('需要本工具v2文稿审阅报告');
 const project=validateManuscript(p.project),assessments=await Promise.all(p.assessments.map(r=>recordFromPayload(r,'文稿报告中的原始评测')));
 if(new Set(assessments.map(r=>r.key)).size!==assessments.length)throw Error('报告中的评测记录重复');
 if(assessments.some(r=>!project.revisions.some(v=>v.assessmentKeys.includes(r.key))))throw Error('报告含未关联任何版本的评测，不会额外写入资料库');
 for(const rev of project.revisions)for(const key of rev.assessmentKeys){const record=assessments.find(r=>r.key===key);if(!record||record.sourceText!==rev.sourceText)throw Error('报告关联的评测缺失或不属于对应原文，当前文稿未被覆盖');}
 const manualActions=decodeActions(p.manualActions);if(manualActions.some(a=>!project.revisions.some(v=>revisionActionKey(v.id)===a.key)))throw Error('人工处理项不属于这份文稿');
 return {project:validateManuscript({...project,assessmentSnapshots:assessments.map(r=>({...r,reviews:[],actions:[]}))}),assessments,manualActions};
}
export function manuscriptMarkdown(project:Manuscript,records:ImportRecord[],reviews:Review[],actions:ReviewAction[]){
 const r=manuscriptReport(project,records,reviews,actions),open=actions.filter(a=>a.status==='open'&&(r.assessments.some(v=>v.key===a.key)||project.revisions.some(v=>revisionActionKey(v.id)===a.key)));
 const pending=project.revisions.flatMap(v=>v.observations.filter(o=>o.applicability==='needs_context').map(o=>`- ${v.name} / ${DIMENSIONS[o.dimension].labelZh}：${APPLICABILITY[o.applicability]}；${o.reason||o.note||'需补充说明'}`));
 return ['# 文稿审阅与改稿报告','',`文稿：${project.name}`,'','## 尚未解决的问题与下一步',...open.map(a=>`- [ ] ${DIMENSIONS[a.dimension].labelZh}：${a.text}`),...pending,...(!open.length&&!pending.length?['未列出问题不代表作品已通过评审。']:[]),'',...project.revisions.flatMap(v=>[
  `## ${v.name}`,`版本：${v.id}；创建时间：${v.createdAt}；用途：${PURPOSES[v.purpose]}`,`父版本：${v.parentId||'无（初稿）'}`,purposeWarning(v),'',`模型评测：${v.assessmentKeys.length?v.assessmentKeys.length+'份关联原始记录':'尚无模型评测；以下仅为人工审阅'}`,
  '### 本次准备处理的来源事项',...(v.addressedActions.length?v.addressedActions.map(a=>`- ${a.text}（来源 ${a.key}；事项 ${a.id}；关联并不表示已解决）${a.evidence?'；原文依据：'+a.evidence:''}`):['未关联处理项。']),
  '### 人工审阅',...(v.observations.length?v.observations.flatMap(o=>[`- ${DIMENSIONS[o.dimension].labelZh}：${APPLICABILITY[o.applicability]}`,`  引用：${o.evidence||'未引用'}`,`  意见：${o.note||'未填写'}`,`  适用性理由：${o.reason||'未填写'}`]):['尚无人工审阅。']),
  '### 本版人工处理清单',...actions.filter(a=>a.key===revisionActionKey(v.id)).map(a=>`- [${a.status==='done'?'x':' '}] ${a.text}（勾选仅记录处理进度）`),'### 原文',v.sourceText,'',...r.assessments.filter(record=>v.assessmentKeys.includes(record.key)).map(record=>reportMarkdown(record.key,record.sourceText,record.originalResult,reviews,record.originalResult.meta.sample?'合成示例 / 非模型运行':'关联的原始模型记录（来源声明未认证）',actions,{purpose:v.purpose,judgments:v.observations.map(o=>({dimension:o.dimension,applicability:o.applicability,reason:o.reason})),updatedAt:v.createdAt}).replace(/^#/gm,'##')),
 ]),'## 边界',...r.limits.map(x=>'- '+x)].join('\n');
}

export function revisionActionKey(revisionId:string){return 'manuscript:'+revisionId;}
