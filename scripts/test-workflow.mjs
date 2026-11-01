import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {importedRecord,importTemplate,reportMarkdown}=require('./.core-test/import-report.js');
const {JUDGE_SYSTEM_PROMPT,buildJudgeUserPrompt}=require('./.core-test/prompts.js');
const {buildTaskPackage,importTaskResponse,CURRENT_RUBRIC}=require('./.core-test/task-package.js');
const {EMPTY_LIBRARY,addToLibrary,decodeLibrary}=require('./.core-test/library.js');
const {aggregateRecords,compatibleRun,comparisonWarnings,changedRange}=require('./.core-test/comparison.js');
const record=async(patch={})=>importedRecord(JSON.stringify({...importTemplate(),...patch}));
test('external task carries the exact incumbent judge, text and schema; validation keeps raw scores and quotes',async()=>{
 const base=importTemplate(),task=buildTaskPackage(base.sourceText);
 assert.ok(task.includes(JUDGE_SYSTEM_PROMPT));assert.ok(task.includes(buildJudgeUserPrompt(base.sourceText)));assert.match(task,/overall/);assert.throws(()=>buildTaskPackage(''));
 const response={...base.originalResult};delete response.meta;response.dimensions[0].evidence=['这是无法定位的原引用'];
 const r=await importTaskResponse(base.sourceText,JSON.stringify(response),'外部声明模型','2026-11-01T00:00:00Z',true);
 assert.equal(r.conditions.rubricId,CURRENT_RUBRIC);assert.equal(r.originalResult.dimensions[0].evidence[0],'这是无法定位的原引用');
 await assert.rejects(()=>importTaskResponse(base.sourceText,JSON.stringify({...response,overall:4}),'外部模型','2026-11-01T00:00:00Z',false));
 await assert.rejects(()=>importTaskResponse(base.sourceText,'```json\n{}\n```','外部模型','2026-11-01T00:00:00Z',false));
});
test('twenty material slots never silently replace a record; duplicate import preserves its name and declarations',async()=>{
 let data=EMPTY_LIBRARY;
 for(let i=0;i<20;i++)data=addToLibrary(data,await record({sourceText:'材料'+i}),'标题'+i,'2026-11-01T00:00:00Z');
 const original=JSON.stringify(data),next=await record({sourceText:'第21份'});
 assert.throws(()=>addToLibrary(data,next,'不应覆盖'),/已满20份/);assert.equal(JSON.stringify(data),original);
 const repeat=addToLibrary(data,{...data.records[4],conditions:{rubricId:'不可覆盖原声明'}},'不可更名');
 assert.equal(repeat.records[4].name,data.records[4].name);assert.equal(repeat.records.length,20);
 assert.deepEqual(decodeLibrary(JSON.stringify(data)),data);
 assert.throws(()=>decodeLibrary('{bad'));assert.throws(()=>decodeLibrary(JSON.stringify({...data,records:[...data.records,next]})));
});
test('saved comparisons describe single observations; repeated runs require same text/model/declarations and reject duplicates',async()=>{
 const a=await record(),b=await record({originalResult:{...importTemplate().originalResult,meta:{model:a.originalResult.meta.model,at:'2026-11-01T02:00:00Z',sample:false}}});
 assert.equal(compatibleRun(a,b),true);assert.equal(aggregateRecords([a,b]).runs.length,2);assert.throws(()=>aggregateRecords([a,a]));
 assert.ok(comparisonWarnings(a,b).some(x=>x.includes('未完整声明')));
 assert.equal(compatibleRun(a,{...b,sourceText:'另一段原文'}),false);
 assert.equal(compatibleRun(a,{...b,conditions:{rubricId:'新规则'}}),false);
 assert.throws(()=>aggregateRecords([a,{...b,sourceText:'变化'}]));
 const warnings=comparisonWarnings(a,{...b,originalResult:{...b.originalResult,meta:{...b.originalResult.meta,model:'另一模型'}}});assert.ok(warnings.some(x=>x.includes('模型声明不同')));
 assert.deepEqual(changedRange('相同原文','相同原文'),{start:4,end:4});assert.deepEqual(changedRange('开头旧结尾','开头新结尾'),{start:2,end:3});
});
test('review actions roundtrip independently, unfinished work leads the readable report and never changes original scores',async()=>{
 const r=await record(),before=JSON.stringify(r.originalResult),a={id:'action-fixture',key:r.key,dimension:'persona',kind:'comment_check',text:'核查角色动机是否被忽略',status:'open',updatedAt:'2026-11-01T00:00:00Z'};
 const loaded=await importedRecord(JSON.stringify({version:1,recordKey:r.key,sourceText:r.sourceText,originalResult:r.originalResult,reviews:[],actions:[a]}));
 assert.equal(loaded.actions[0].key,r.key);assert.equal(JSON.stringify(loaded.originalResult),before);
 const md=reportMarkdown(r.key,r.sourceText,r.originalResult,[],'测试材料',[a]);assert.ok(md.indexOf('## 未解决事项')<md.indexOf('## 人设'));assert.match(md,/\[ \] 人设一致性/);
 const done=reportMarkdown(r.key,r.sourceText,r.originalResult,[],'测试材料',[{...a,status:'done'}]);assert.match(done,/完成处理不代表重新评测/);
 await assert.rejects(()=>importedRecord(JSON.stringify({version:1,recordKey:r.key,sourceText:r.sourceText,originalResult:r.originalResult,actions:[{...a,key:'错误材料'}]})));
});
test('legacy migration saves human state separately, repeated initialization reads latest library, and blocked storage keeps volatile work',async()=>{
 const r=await record(),review={key:r.key,dimension:'persona',state:'unsupported',note:'迁移保留的人工意见',updatedAt:'2026-11-01T00:00:00Z'},values=new Map();
 values.set('llm-output-eval:external:v1',JSON.stringify({version:1,recordKey:r.key,sourceText:r.sourceText,originalResult:r.originalResult,reviews:[review]}));
 globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const store=require('./.core-test/library-store.js'),reviews=require('./.core-test/review-store.js');
 const migrated=await store.initializeLibrary();assert.equal(migrated.records.length,1);assert.equal(values.has('llm-output-eval:external:v1'),false);assert.equal(reviews.currentReviews()[0].note,review.note);assert.equal(migrated.records[0].reviews.length,0);
 const next=await record({sourceText:'第二份自己的材料'});store.saveLibraryRecord(next,'第二份');assert.equal((await store.initializeLibrary()).records.length,2);
 reviews.storeReviews([]);await store.initializeLibrary();assert.equal(reviews.currentReviews().length,0,'reopening must not resurrect deliberately cleared human state');
 globalThis.localStorage={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');},removeItem:()=>{throw Error('blocked');}};
 store.saveLibraryRecord(await record({sourceText:'只留本页的材料'}),'临时材料');assert.equal(store.currentLibrary().records.length,3);
 delete globalThis.localStorage;
});
