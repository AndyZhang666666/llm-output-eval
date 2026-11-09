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
