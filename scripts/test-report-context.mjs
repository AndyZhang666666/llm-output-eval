import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {importTemplate,importedRecord}=require('./.core-test/import-report.js');
const {createManuscript,linkAssessment,updateObservation,manuscriptReport,manuscriptMarkdown,importManuscriptReport}=require('./.core-test/manuscripts.js');
const at='2026-11-09T08:00:00Z';
test('manuscript exports retain current single-record applicability separately from manuscript observations',async()=>{
 const payload=importTemplate(),record=await importedRecord(JSON.stringify(payload)),scoreBefore=JSON.stringify(record.originalResult);
 let project=createManuscript(record.sourceText,'解释层独立测试','complete','context-regression',at);
 project=linkAssessment(project,project.activeRevisionId,record);
 project=updateObservation(project,project.activeRevisionId,{dimension:'structure',note:'本版仍准备补全结尾。',evidence:'林推开门',applicability:'applicable',reason:'文稿目标是完整短篇，属于本版的人工意见。',updatedAt:at});
 const projectBefore=JSON.stringify(project),context={purpose:'opening',judgments:[{dimension:'structure',applicability:'not_applicable',reason:'单篇复核记录：作为开场，完整结尾标准不适用。'}],updatedAt:at};
 const report=manuscriptReport(project,[],[],[],{[record.key]:context});
 assert.deepEqual(report.assessments[0].reviewContext,context);assert.equal(report.project.revisions[0].observations[0].applicability,'applicable');assert.equal(JSON.stringify(project),projectBefore);assert.equal(JSON.stringify(record.originalResult),scoreBefore);
 const markdown=manuscriptMarkdown(project,[],[],[],{[record.key]:context});assert.match(markdown,/单篇复核记录：作为开场，完整结尾标准不适用/);assert.match(markdown,/文稿目标是完整短篇/);assert.match(markdown,/关联模型记录与单篇人工解释/);
 const restored=await importManuscriptReport(JSON.stringify(report));assert.deepEqual(restored.assessments[0].reviewContext,context);assert.equal(restored.project.revisions[0].observations[0].reason,'文稿目标是完整短篇，属于本版的人工意见。');assert.equal(JSON.stringify(restored.assessments[0].originalResult),scoreBefore);
 assert.match(manuscriptMarkdown(restored.project,restored.assessments,[],[]),/单篇复核记录：作为开场，完整结尾标准不适用/);
});
test('legacy records stay undeclared and imported context remains available without a live context store',async()=>{
 const record=await importedRecord(JSON.stringify(importTemplate())),context={purpose:'other',judgments:[{dimension:'structure',applicability:'needs_context',reason:'来自导入报告的人工解释。'}],updatedAt:at};
 let project=createManuscript(record.sourceText,'回退来源测试','complete','context-fallback',at);project=linkAssessment(project,project.activeRevisionId,{...record,reviewContext:context});
 assert.deepEqual(manuscriptReport(project,[],[],[]).assessments[0].reviewContext,context);assert.match(manuscriptMarkdown(project,[],[],[]),/来自导入报告的人工解释/);
 let legacy=createManuscript(record.sourceText,'旧记录','complete','legacy-context',at);legacy=linkAssessment(legacy,legacy.activeRevisionId,record);const md=manuscriptMarkdown(legacy,[],[],[]);assert.match(md,/材料用途：未声明/);assert.equal(manuscriptReport(legacy,[],[],[]).assessments[0].reviewContext,undefined);
});
