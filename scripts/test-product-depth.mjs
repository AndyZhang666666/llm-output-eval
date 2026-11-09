import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {calibrationSummary}=require('./.core-test/review-overview.js');
const {importTaskResponse,exampleTaskResponse,normalizeTaskJSON}=require('./.core-test/task-package.js');
const {reportMarkdown,importTemplate}=require('./.core-test/import-report.js');
test('calibration names actual disputed dimensions; unreviewed, unrelated and missing states are not evidence',()=>{
 const base={key:'one',note:'',updatedAt:'2026-11-09T00:00:00Z'};
 const items=[{...base,dimension:'persona',state:'supported'},{...base,dimension:'structure',state:'unsupported'},{...base,dimension:'pacing',state:'needs_context'},{...base,dimension:'dialogue',state:'unreviewed'},{...base,key:'other',dimension:'coherence',state:'supported'}];
 const s=calibrationSummary('one',items);assert.deepEqual(s,{reviewed:3,supported:1,disputed:1,context:1,priority:['pacing','structure']});
 const p=importTemplate(),md=reportMarkdown('one',p.sourceText,p.originalResult,items,'synthetic');assert.match(md,/支持 1 项 · 存疑 1 项 · 需上下文 1 项/);assert.match(md,/优先校准维度：节奏与钩子密度、结构完整性/);assert.equal(p.originalResult.overall,3);
});
test('single JSON fence is transport only; mixed commentary is rejected and values are not repaired',async()=>{
 const t=importTemplate(),r=t.originalResult;const before=JSON.stringify(r);
 const imported=await importTaskResponse(t.sourceText,'```json\n'+before+'\n```','declared model','2026-11-09T00:00:00Z',false);
 assert.equal(imported.originalResult.overall,3);assert.equal(JSON.stringify(r),before);
 assert.throws(()=>normalizeTaskJSON('notes\n```json\n{}\n```')&&JSON.parse(normalizeTaskJSON('notes\n```json\n{}\n```')));
 assert.throws(()=>normalizeTaskJSON('```json\n{}\n```\nextra'),/代码块/);
 await assert.rejects(()=>importTaskResponse(t.sourceText,'```json\n'+JSON.stringify({...r,overall:5})+'\n```','declared','2026-11-09T00:00:00Z',false),/均分/);
});
test('quick return example is always synthetic and quotes current text without certifying the prompt or a model call',async()=>{
 const text='这是验收用的合成原文。不是用户资料。',payload=exampleTaskResponse(text),r=await importTaskResponse(text,JSON.stringify(payload),'should not certify','2026-11-09T00:00:00Z',true);
 assert.equal(r.originalResult.meta.sample,true);assert.match(r.originalResult.meta.model,/合成示例/);assert.equal(r.conditions.rubricId,undefined);
 for(const d of r.originalResult.dimensions)assert.ok(text.includes(d.evidence[0]));
});
const {EMPTY_MANUSCRIPTS,createManuscript,createRevision,putManuscript,updateObservation,linkAssessment,manuscriptReport,manuscriptMarkdown,importManuscriptReport,decodeManuscripts,purposeWarning,revisionActionKey}=require('./.core-test/manuscripts.js');
const {importedRecord}=require('./.core-test/import-report.js');
const at='2026-11-09T01:00:00Z';
test('no-model manuscripts preserve text revisions and separate applicability from model scores',()=>{
 let p=createManuscript('她推开门，停了一下。','合成审阅样本','opening','fixture',at),data=putManuscript(EMPTY_MANUSCRIPTS,p);const old=JSON.stringify(p);
 p=updateObservation(p,p.activeRevisionId,{dimension:'structure',note:'这是开场，没有承诺完整叙事。',evidence:'她推开门',applicability:'not_applicable',reason:'用途是开场片段',updatedAt:at});
 assert.equal(JSON.stringify(data.projects[0]),old);assert.equal(p.revisions[0].sourceText,'她推开门，停了一下。');assert.equal(p.revisions[0].originalResult,undefined);
 assert.match(purposeWarning(p.revisions[0]),/可能不要求完整叙事弧/);
 assert.throws(()=>updateObservation(p,p.activeRevisionId,{...p.revisions[0].observations[0],reason:''}),/请填写原因/);
 assert.throws(()=>updateObservation(p,p.activeRevisionId,{...p.revisions[0].observations[0],evidence:'原文中没有的句子'}),/不在该版本/);
 const action={id:'fix-1',key:revisionActionKey(p.activeRevisionId),dimension:'structure',kind:'source_edit',text:'补充动作的缘由',status:'open',updatedAt:at};
 p=createRevision(p,p.activeRevisionId,'她推开门，听到屋里有人叫她，停了一下。','补充缘由','opening',[action],'fixture:v2',at);
 assert.equal(p.revisions.length,2);assert.equal(p.revisions[0].sourceText,'她推开门，停了一下。');assert.equal(p.revisions[1].assessmentKeys.length,0);assert.equal(action.status,'open');
 const md=manuscriptMarkdown(p,[],[],[action]);assert.match(md,/尚无模型评测/);assert.match(md,/补充动作的缘由/);assert.match(md,/关联并不表示已解决/);assert.doesNotMatch(md,/原始五维均分/);
 const restored=decodeManuscripts(JSON.stringify(putManuscript(data,p)));assert.equal(restored.projects[0].revisions.length,2);
});
test('a linked result must match exact original and survives library removal as an immutable manuscript snapshot',async()=>{
 const t=importTemplate(),r=await importedRecord(JSON.stringify(t));let p=createManuscript(t.sourceText,'同文关联','complete','linked',at),before=JSON.stringify(r.originalResult);
 assert.throws(()=>linkAssessment(p,p.activeRevisionId,{...r,sourceText:'错误原文'}),/原文.*不同/);
 p=linkAssessment(p,p.activeRevisionId,r);assert.equal(p.assessmentSnapshots.length,1);assert.equal(JSON.stringify(r.originalResult),before);
 const report=manuscriptReport(p,[],[],[]);assert.equal(report.assessments.length,1,'removing library access cannot make manuscript backup unreadable');
 const roundtrip=await importManuscriptReport(JSON.stringify(report));assert.equal(roundtrip.assessments[0].key,r.key);assert.equal(JSON.stringify(roundtrip.assessments[0].originalResult),before);
 const bad=structuredClone(report);bad.assessments[0].originalResult.overall=5;await assert.rejects(()=>importManuscriptReport(JSON.stringify(bad)));assert.equal(JSON.stringify(r.originalResult),before);
});
test('manual actions restore separately and malformed relations fail without mutating current workspace',async()=>{
 const p=createManuscript('合成测试材料。','人工报告','complete','manual',at),a={id:'a',key:revisionActionKey(p.activeRevisionId),dimension:'coherence',kind:'source_edit',text:'检查事件关系',status:'open',updatedAt:at};
 const r=manuscriptReport(p,[],[],[a]),restored=await importManuscriptReport(JSON.stringify(r));assert.equal(restored.manualActions[0].key,a.key);assert.equal(restored.assessments.length,0);
 const wrong=structuredClone(r);wrong.manualActions[0].key='different-manuscript';await assert.rejects(()=>importManuscriptReport(JSON.stringify(wrong)),/不属于/);
 const before=JSON.stringify(p),bad=structuredClone(p);bad.revisions[0].parentId='future';assert.throws(()=>putManuscript(EMPTY_MANUSCRIPTS,bad),/版本关系/);assert.equal(JSON.stringify(p),before);
});
test('unreadable manuscript storage is retained while in-memory work still exports',()=>{
 const {storeManuscripts,currentManuscripts}=require('./.core-test/manuscript-store.js'),values=new Map([['llm-output-eval:manuscripts:v2','{broken']]);
 globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const initial=currentManuscripts();const p=createManuscript('只留当前页的合成文稿。','损坏恢复','complete','damaged',at);storeManuscripts(putManuscript(initial,p));
 assert.equal(values.get('llm-output-eval:manuscripts:v2'),'{broken');assert.equal(currentManuscripts().projects[0].id,p.id);assert.match(manuscriptMarkdown(p,[],[],[]),/只留当前页/);delete globalThis.localStorage;
});

test('purpose and applicability stay outside immutable scores and survive old-report transport',async()=>{
 const {validateReviewContext}=require('./.core-test/review-context.js'),{comparisonWarnings}=require('./.core-test/comparison.js');
 const context=validateReviewContext({purpose:'opening',judgments:[{dimension:'structure',applicability:'not_applicable',reason:'开场不要求结尾闭环'}],updatedAt:at});
 const raw=JSON.stringify({...importTemplate(),reviewContext:context}),first=await importedRecord('```json\n'+raw+'\n```'),again=await importedRecord(JSON.stringify({...first,version:1,recordKey:first.key}));
 assert.deepEqual(again.reviewContext,context);assert.equal(first.key,again.key);assert.equal(first.transport.raw,'```json\n'+raw+'\n```');assert.equal(first.transport.normalized,raw);assert.equal(first.originalResult.overall,3);
 assert.match(reportMarkdown(first.key,first.sourceText,first.originalResult,[],'external',[],context),/开场不要求结尾闭环/);
 assert.throws(()=>validateReviewContext({...context,judgments:[{dimension:'structure',applicability:'not_applicable',reason:''}]}),/说明为什么/);
 assert.ok(comparisonWarnings(first,{...first,reviewContext:{...context,purpose:'complete'}}).some(v=>v.includes('用途不同')));
 const wrong=JSON.parse(JSON.stringify({...first,version:1,recordKey:first.key}));wrong.transport.normalized='{}';await assert.rejects(()=>importedRecord(JSON.stringify(wrong)),/规范化/);
});

test('revision-source actions and library limits reject unlinked records rather than inventing provenance',async()=>{
 const t=importTemplate(),r=await importedRecord(JSON.stringify(t));let p=createManuscript(t.sourceText,'受限关系','complete','guarded',at);
 const foreign={id:'x',key:'unrelated-record',dimension:'structure',kind:'source_edit',text:'不属于这份旧稿',status:'open',updatedAt:at,evidence:'林推开门'};
 assert.throws(()=>createRevision(p,p.activeRevisionId,t.sourceText+'后来。','修改稿','complete',[foreign],'guarded:v2',at),/来自已保留/);
 const report={...manuscriptReport(p,[],[],[]),assessments:[{...r,version:1,recordKey:r.key}]};await assert.rejects(()=>importManuscriptReport(JSON.stringify(report)),/未关联/);
 let data=EMPTY_MANUSCRIPTS;for(let i=0;i<20;i++)data=putManuscript(data,createManuscript('合成材料'+i,'材料'+i,'complete','limit'+i,at));
 assert.throws(()=>putManuscript(data,createManuscript('第21份','超额','complete','limit21',at)),/最多20/);assert.equal(data.projects.length,20);
 p=linkAssessment(p,p.activeRevisionId,r);assert.equal(p.assessmentSnapshots[0].originalResult.overall,3);
});
