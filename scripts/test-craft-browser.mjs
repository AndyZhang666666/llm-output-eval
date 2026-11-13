// Fresh synthetic browser context. No model calls or user's saved records.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {importTemplate}=require('./.core-test/import-report.js');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.TEST_URL||'http://127.0.0.1:8868/llm-output-eval/';
const dir=process.env.EVIDENCE_DIR||'output/playwright/craft-20261112';
await fs.mkdir(dir,{recursive:true});await fs.mkdir('docs/screenshots/workbench-20261112',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,javaScriptEnabled:true});
const page=await context.newPage(),errors=[],external=[];
page.on('pageerror',e=>{errors.push(e.message);console.error('PAGEERROR',e.message);});page.on('console',m=>{if(m.type()==='error')console.error('BROWSER',m.text());});page.on('response',r=>{if(r.status()>=400)console.error('HTTP',r.status(),r.url());});

const quoteButton=()=>page.locator('.quote-list>button').first();
const dim=name=>page.getByRole('group',{name:'当前复核维度',exact:true}).getByRole('button').filter({hasText:name});
const chooser=()=>page.getByRole('dialog',{name:'选择待复核材料',exact:true});
async function openChooser(section){await page.getByRole('button',{name:'切换 / 带入材料'}).click();await chooser().waitFor();if(section)await chooser().getByRole('button',{name:new RegExp(section)}).click();}
async function closeChooser(){await chooser().getByRole('button',{name:'关闭材料选择',exact:true}).click();await chooser().waitFor({state:'hidden'});}
async function download(format,file){const wait=page.waitForEvent('download');await page.getByRole('button',{name:'导出本篇复核报告'}).click();await page.getByRole('menuitem',{name:new RegExp(format)}).click();const d=await wait;await d.saveAs(dir+'/'+file);return fs.readFile(dir+'/'+file,'utf8');}
async function screenshot(width,file){await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:dir+'/'+file,fullPage:false,animations:'disabled'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if([1440,390].includes(width))await page.screenshot({path:'docs/screenshots/workbench-20261112/'+(width===1440?'desktop':'mobile')+'.jpg',type:'jpeg',quality:80,animations:'disabled'});}
try{
 await page.goto(url+'?sample=e06&dimension=structure',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'切换 / 带入材料'}).click();await chooser().waitFor();await closeChooser();
 const originalScore=await page.locator('.current-dimension>strong').innerText();
 await quoteButton().click();assert.ok((await page.locator('[data-source-match]').innerText()).length>0);
 await page.getByRole('radio',{name:'证据不足或评语存疑',exact:true}).check();
 await page.getByLabel('修改建议或复核备注').fill('合成走查：引用存在，仍需确认是否要求完整结局。');
 await page.locator('.action-create textarea').fill('未提交处理项：先核对材料用途。');
 await dim('剧情连贯性').click();await dim('结构完整性').click();
 assert.equal(await page.locator('.action-create textarea').inputValue(),'未提交处理项：先核对材料用途。');
 assert.equal(await page.getByLabel('修改建议或复核备注').inputValue(),'合成走查：引用存在，仍需确认是否要求完整结局。');
 await page.getByRole('button',{name:'加入处理清单',exact:true}).click();
 assert.equal(await page.getByRole('heading',{name:'本篇处理清单',exact:true}).count(),1);
 assert.equal(await page.locator('.action-list li').count(),1);
 assert.equal(await page.locator('.current-dimension>strong').innerText(),originalScore);await page.getByRole('link',{name:'核对评分档 ↓',exact:true}).click();await page.getByRole('link',{name:'回到当前判断 ↑',exact:true}).click();
 await screenshot(1440,'01-evidence-desktop.png');
 await openChooser('导入结果');
 await chooser().getByLabel('粘贴复核 JSON').fill('{"broken":true}');await closeChooser();
 await openChooser('导入结果');assert.equal(await chooser().getByLabel('粘贴复核 JSON').inputValue(),'{"broken":true}');
 await chooser().getByRole('button',{name:'检查并导入',exact:true}).click();await chooser().getByText(/当前材料未被替换/).waitFor();
 await page.screenshot({path:dir+'/02-material-chooser.png',animations:'disabled'});await page.screenshot({path:'docs/screenshots/workbench-20261112/material-chooser.jpg',type:'jpeg',quality:80,animations:'disabled'});
 await closeChooser();assert.equal(await page.locator('.current-dimension>strong').innerText(),originalScore);
 await openChooser('用我的文本送评');
 await chooser().getByLabel('外部任务原文').fill('草稿：钟声响起，她把旧信放回抽屉。');
 await closeChooser();await openChooser('用我的文本送评');
 assert.equal(await chooser().getByLabel('外部任务原文').inputValue(),'草稿：钟声响起，她把旧信放回抽屉。');
 await closeChooser();
 const record=importTemplate();record.sourceText+='\n\n这是用于界面验收的自有材料。';record.originalResult.meta.at='2026-11-12T13:00:00Z';
 record.originalResult.dimensions.forEach(d=>{d.comment='Record supplied English judgment.';d.commentZh='随记录提供的中文释义，便于核对。';});
 await openChooser('导入结果');await chooser().getByLabel('粘贴复核 JSON').fill(JSON.stringify(record));await chooser().getByRole('button',{name:'检查并导入',exact:true}).click();await chooser().waitFor({state:'hidden'});
 assert.ok((await page.locator('.source-document').textContent()).includes('这是用于界面验收的自有材料。'));
 await page.getByRole('radio',{name:'需要更多上下文',exact:true}).check();
 await page.getByLabel('修改建议或复核备注').fill('我的材料，需核对上一个场景。');
 const md=await download('Markdown','eval-review.md'),json=JSON.parse(await download('JSON','eval-review.json'));
 assert.ok(md.includes('Record supplied English judgment.'));assert.ok(md.includes('随记录提供的中文释义'));
 assert.equal(json.sourceText,record.sourceText);assert.deepEqual(json.originalResult,record.originalResult);
 await openChooser('导入结果');await chooser().getByLabel('粘贴复核 JSON').fill(JSON.stringify(json));await chooser().getByRole('button',{name:'检查并导入',exact:true}).click();await chooser().waitFor({state:'hidden'});
 assert.equal(await page.getByLabel('修改建议或复核备注').inputValue(),'我的材料，需核对上一个场景。');
 await screenshot(1024,'03-evidence-tablet.png');await screenshot(390,'04-evidence-mobile.png');
 await page.getByLabel('修改建议或复核备注').fill('手机草稿：返回评语时应保留。');
 await quoteButton().click();await page.getByRole('button',{name:/返回这条评语/}).waitFor();
 assert.equal(await page.locator('.focused-workspace').getAttribute('data-mobile'),'source');
 await page.screenshot({path:dir+'/05-mobile-quote-return.png',animations:'disabled'});
 await page.getByRole('button',{name:/返回这条评语/}).click();
 assert.equal(await page.locator('.focused-workspace').getAttribute('data-mobile'),'review');
 assert.equal(await page.getByLabel('修改建议或复核备注').inputValue(),'手机草稿：返回评语时应保留。');
 assert.equal(await quoteButton().evaluate(e=>e===document.activeElement),true);
 // Dialog focus trap, keyboard dismissal, restore focus and draft under reduced motion.
 await page.emulateMedia({reducedMotion:'reduce'});await openChooser('导入结果');
 await chooser().getByLabel('粘贴复核 JSON').fill('未提交材料草稿');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.closest('[role=dialog]')!==null),true);
 await page.keyboard.press('Escape');await chooser().waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.textContent?.includes('切换 / 带入材料'),null,{timeout:2000});
 assert.equal(await page.getByRole('button',{name:'切换 / 带入材料'}).evaluate(e=>e===document.activeElement),true);
 await openChooser('导入结果');assert.equal(await chooser().getByLabel('粘贴复核 JSON').inputValue(),'未提交材料草稿');
 await page.screenshot({path:dir+'/06-chooser-mobile-reduced-motion.png',animations:'disabled'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await closeChooser();
 const manage=page.locator('.review-secondary');await manage.locator('summary').click();await manage.getByRole('button',{name:'清除本篇复核',exact:true}).click();
 const confirm=page.getByRole('alertdialog');await confirm.waitFor();await confirm.getByRole('button',{name:'取消，保留人工判断'}).click();
 assert.equal(await page.getByLabel('修改建议或复核备注').inputValue(),'手机草稿：返回评语时应保留。');
 external.push(...await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name).filter(name=>/^https?:/.test(name)&&!name.startsWith(location.origin))));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await fs.writeFile(dir+'/results.json',JSON.stringify({status:'pass',url,widths:[1440,1024,390],checks:['current material and evidence first','original score unchanged','one action editor; dimension drafts restored','RAC dialog focus trap/escape/focus restore','invalid import leaves current material','external draft survives close/reopen','own JSON import and actual Markdown/JSON download','Chinese gloss and original comment retained','downloaded report reimport restores own judgment','mobile quote return restores dimension/draft/focus','reduced motion, keyboard and no horizontal overflow','clear confirmation cancel preserves human state','zero model or external requests'],errors,external},null,2));
 console.log('PASS: evidence workbench craft scenarios, personal materials, real exports and responsive interaction.');
}catch(error){await page.screenshot({path:dir+'/failure.png',fullPage:true});await fs.writeFile(dir+'/failure-body.txt',await page.locator('body').innerText());await fs.writeFile(dir+'/failure.txt',error.stack);await fs.writeFile(dir+'/failure-errors.json',JSON.stringify({errors,external}));console.error(error);process.exitCode=1;}finally{await context.close();await browser.close();}
