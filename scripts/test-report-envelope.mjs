import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {importedRecord,parseReviewImport,importTemplate,recordFromPayload,MAX_IMPORT_BYTES,MAX_REVIEW_REPORT_BYTES}=require('./.core-test/import-report.js');
const {reviewReport}=require('./.core-test/review.js');
const fixture=()=>({...importTemplate(),sourceText:'Synthetic fixture. '+ 'a'.repeat(400*1024)});
test('a real 400KB accepted material exports with original transport and reimports without ballooning or changing identity',async()=>{
 const raw=JSON.stringify(fixture());assert.ok(Buffer.byteLength(raw)<MAX_IMPORT_BYTES);const first=await importedRecord(raw),before=JSON.stringify(first.originalResult);
 const report={...reviewReport(first.key,first.sourceText,first.originalResult,[]),source:'synthetic inspection',transport:first.transport,actions:[],name:'400KB legacy material'};const exported=JSON.stringify(report,null,2);assert.ok(Buffer.byteLength(exported)>MAX_IMPORT_BYTES);
 const restored=await importedRecord(exported);assert.equal(restored.key,first.key);assert.equal(restored.sourceText,first.sourceText);assert.deepEqual(restored.transport,first.transport);assert.equal(JSON.stringify(restored.originalResult),before);
 const repeat=JSON.stringify({...reviewReport(restored.key,restored.sourceText,restored.originalResult,[]),transport:restored.transport});const again=await importedRecord(repeat);assert.equal(again.transport.raw,raw);assert.equal(again.transport.normalized,raw);assert.equal(again.key,first.key);
});
test('report envelopes cannot bypass original material, original transport binding, identity or outer limits',async()=>{
 const original=await importedRecord(JSON.stringify(fixture())),report={...reviewReport(original.key,original.sourceText,original.originalResult,[]),transport:original.transport};
 await assert.rejects(()=>importedRecord(JSON.stringify({...report,sourceText:report.sourceText+'changed'})),/粘贴记录不一致/);
 await assert.rejects(()=>importedRecord(JSON.stringify({...report,recordKey:'external:sha256:'+'0'.repeat(64)})),/标识/);
 await assert.rejects(()=>importedRecord(JSON.stringify({...report,unbounded:'x'.repeat(MAX_IMPORT_BYTES)})),/未识别/);
 assert.throws(()=>parseReviewImport(' '.repeat(MAX_REVIEW_REPORT_BYTES+1)),/12MB/);
 const tooLarge={...fixture(),sourceText:'中'.repeat(400000)};assert.throws(()=>parseReviewImport(JSON.stringify(tooLarge)),/最大1MB/);await assert.rejects(()=>recordFromPayload(tooLarge),/最大1MB/);
 const oversizedReport={...report,sourceText:tooLarge.sourceText};await assert.rejects(()=>importedRecord(JSON.stringify(oversizedReport)),/最大1MB/);
});
