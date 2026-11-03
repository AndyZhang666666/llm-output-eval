import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {importedRecord,importTemplate,reportMarkdown,MAX_IMPORT_BYTES,parseReviewImport,prepareImportedHumanState}=require('./.core-test/import-report.js');
const {JUDGE_SYSTEM_PROMPT,buildJudgeUserPrompt}=require('./.core-test/prompts.js');
const {buildTaskPackage,importTaskResponse,CURRENT_RUBRIC}=require('./.core-test/task-package.js');
const {EMPTY_LIBRARY,addToLibrary,addManyToLibrary,decodeLibrary}=require('./.core-test/library.js');
const {aggregateRecords,compatibleRun,comparisonWarnings,changedRange,importComparisonReport}=require('./.core-test/comparison.js');
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
test('a legal near-1MB external file remains readable inside a larger library envelope',async()=>{
 const p=importTemplate();p.originalResult.retainedExtension='';
 const bytes=new TextEncoder().encode(JSON.stringify(p)).length;
 p.originalResult.retainedExtension='x'.repeat(MAX_IMPORT_BYTES-bytes-20);
 const raw=JSON.stringify(p);assert.equal(new TextEncoder().encode(raw).length,MAX_IMPORT_BYTES-20);
 const r=await importedRecord(raw),data=addToLibrary(EMPTY_LIBRARY,r,'上限附近的合法资料'),stored=JSON.stringify(data);
 assert.ok(new TextEncoder().encode(stored).length>MAX_IMPORT_BYTES);
 assert.equal(decodeLibrary(stored).records[0].originalResult.retainedExtension,p.originalResult.retainedExtension);
 assert.throws(()=>parseReviewImport(raw+' '.repeat(21)),/最大1MB/);
 const bad=structuredClone(data);bad.records[0].originalResult.dimensions[0].score=6;assert.throws(()=>decodeLibrary(JSON.stringify(bad)),/1–5整数/);
});
test('a complete saved comparison roundtrips both sides and labels, rejects a bad side, and library batch overflow is atomic',async()=>{
 const a=await record(),next=await record({originalResult:{...importTemplate().originalResult,meta:{...importTemplate().originalResult.meta,at:'2026-11-01T06:00:00Z'}}}),b=await record({sourceText:'另一个版本的原文'});
 const payload={version:1,kind:'saved-results-comparison',labels:['初稿A','补完B'],sides:[[a,next],[b]]},raw=JSON.stringify(payload),restored=await importComparisonReport(raw);
 assert.deepEqual(restored.labels,payload.labels);assert.deepEqual(restored.sides.map(side=>side.map(r=>r.key)),[[a.key,next.key],[b.key]]);assert.deepEqual(restored.sides[1][0].originalResult,b.originalResult);
 const broken=structuredClone(payload);broken.sides[1][0].originalResult.dimensions[0].score=6;await assert.rejects(()=>importComparisonReport(JSON.stringify(broken)));assert.equal(JSON.stringify(payload),raw);
 let library=EMPTY_LIBRARY;for(let i=0;i<19;i++)library=addToLibrary(library,await record({sourceText:'已存材料'+i}),'标题'+i);
 const before=JSON.stringify(library);assert.throws(()=>addManyToLibrary(library,[a,b]),/已满20份/);assert.equal(JSON.stringify(library),before);
});
test('normalized action aliases and human-state capacity fail before any caller can switch its current material',async()=>{
 const payload=importTemplate(),base={id:'same-id',dimension:'persona',kind:'comment_check',text:'核查',status:'open',updatedAt:'2026-11-01T00:00:00Z'};
 payload.actions=[{...base,key:'old-a'},{...base,key:'old-b'}];
 await assert.rejects(()=>importedRecord(JSON.stringify(payload)),/字段无效/);
 const r=await record(),current=Array.from({length:500},(_,i)=>({...base,id:'existing-'+i,key:r.key})),before=JSON.stringify(current);
 assert.throws(()=>prepareImportedHumanState({...r,actions:[{...base,id:'one-too-many',key:r.key}]},[],current),/最多500项/);
 assert.equal(JSON.stringify(current),before);assert.equal(prepareImportedHumanState(r,[],[]).actions.length,0);
});

const {decodeReviews}=require('./.core-test/review.js');
const {summarizeReviews,priorityDimension}=require('./.core-test/review-overview.js');
const {AIGC_INPUT,AIGC_VERSIONS}=require('./.core-test/aigc-example.js');
test('optional reference score roundtrips separately, zero denominator stays unknown, unreviewed is not support',async()=>{
 const r=await record(),before=JSON.stringify(r.originalResult);
 const human={key:r.key,dimension:'structure',state:'unreviewed',note:'reference only',humanScore:2,updatedAt:'2026-11-03T00:00:00Z'};
 assert.equal(decodeReviews(JSON.stringify({version:1,items:[human]}))[0].humanScore,2);
 for(const score of [0,6,2.5,null,'3'])assert.throws(()=>decodeReviews(JSON.stringify({version:1,items:[{...human,humanScore:score}]})));
 const restored=await importedRecord(JSON.stringify({version:1,recordKey:r.key,sourceText:r.sourceText,originalResult:r.originalResult,reviews:[human]}));
 assert.equal(restored.reviews[0].humanScore,2);assert.equal(JSON.stringify(restored.originalResult),before);
 const summary=summarizeReviews([r,r],[human,{...human,key:'not-accessible',state:'supported'}]);
 assert.equal(summary.samples,1);assert.equal(summary.dimensions,5);assert.equal(summary.reviewed,0);assert.equal(summary.supported,0);assert.equal(summary.pairs,1);
 assert.equal(summary.meanAbsoluteDifference,1);assert.equal(summarizeReviews([],[]).meanAbsoluteDifference,null);
 assert.match(reportMarkdown(r.key,r.sourceText,r.originalResult,[human],'synthetic'),/人工参考分：2\/5/);
 assert.equal(decodeReviews(JSON.stringify({version:1,items:[{...human,humanScore:undefined}]}))[0].humanScore,undefined);
});
test('A/B starts with an actual disagreement, otherwise maximum original delta; no invented human score',async()=>{
 const a=await record(),b=structuredClone(a);b.key+='other';b.originalResult.dimensions.find(x=>x.id==='structure').score=5;
 assert.equal(priorityDimension([a],[b],[]),'structure');
 const review={key:a.key,dimension:'pacing',state:'needs_context',note:'need context',updatedAt:'2026-11-03T00:00:00Z'};
 assert.equal(priorityDimension([a],[b],[review]),'pacing');assert.equal(review.humanScore,undefined);
 assert.equal(priorityDimension([a],[b],[{...review,state:'unreviewed',humanScore:1}]),'pacing');
});
test('AIGC same-input fixture is explicitly synthetic; each quotation locates and scores remain valid',()=>{
 assert.ok(AIGC_INPUT.includes('不要补造'));
 for(const version of AIGC_VERSIONS){
  const imported=parseReviewImport(JSON.stringify({version:1,sourceText:version.output,originalResult:version.result}));
  assert.equal(imported.originalResult.meta.sample,true);assert.match(version.result.meta.model,/合成/);
  for(const dimension of version.result.dimensions)for(const quote of dimension.evidence)assert.ok(version.output.includes(quote));
 }
 assert.ok(AIGC_VERSIONS[0].result.dimensions.find(x=>x.id==='structure').score>AIGC_VERSIONS[1].result.dimensions.find(x=>x.id==='structure').score);
});
