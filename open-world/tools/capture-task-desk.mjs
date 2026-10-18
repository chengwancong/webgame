import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import assert from 'node:assert/strict';

const out=resolve('../.design/inventory-categories/quests/screenshots',process.argv[2]??'desk-list');
await mkdir(out,{recursive:true});
const base='http://127.0.0.1:10596/quests/desk/index.html';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:768}});
const report={ok:false,checks:[],errors:[],apiRequests:[],badResponses:[]};
page.on('pageerror',error=>report.errors.push(String(error)));
page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))report.apiRequests.push(request.url());});
page.on('response',response=>{if(response.status()>=400)report.badResponses.push({url:response.url(),status:response.status()});});
const inspect=()=>page.evaluate(()=>window.taskDeskInspect());
const click=selector=>page.locator(selector).click();
async function load(query=''){
 await page.goto(base+query);
 await page.waitForFunction(()=>typeof window.taskDeskInspect==='function');
 await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
}
async function shot(name){await page.mouse.move(1,1);await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));await page.locator('#quest-frame').screenshot({path:resolve(out,name+'.png')});}
async function geometry(){return page.evaluate(()=>{
 const bounds=selector=>{const element=document.querySelector(selector);if(!element)return null;const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
 const selectors=['.quest-window','.desk-tools','.desk-result-bar','.desk-workspace','.desk-aside'];
 const scroll=document.querySelector('.desk-main-scroll');
 const aside=document.querySelector('.desk-aside');
 return {regions:selectors.map(selector=>({selector,...bounds(selector)})),windowOverflow:document.querySelector('.quest-window').scrollHeight>document.querySelector('.quest-window').clientHeight+1,mainClipped:scroll?scroll.scrollHeight>scroll.clientHeight+1:false,asideOverflow:aside?Math.max(...[...aside.children].map(n=>n.getBoundingClientRect().bottom))>aside.getBoundingClientRect().bottom+1:false};
});}
async function chooseType(id){await click('.type-trigger');await click(`[data-action=type][data-type="${id}"]`);}
async function finishOperation(){await page.waitForFunction(()=>!window.taskDeskInspect().ui.busy);}
try{
 await load();
 let state=await inspect();
 const archiveCount=state.data.archives.length;
 assert.equal(state.selected.id,'first-boss');
 assert(!state.data.archives.some(r=>r.taskId==='first-boss'));
 const currentGeometry=await geometry();
 assert(!currentGeometry.windowOverflow&&!currentGeometry.mainClipped&&!currentGeometry.asideOverflow,JSON.stringify(currentGeometry));
 await shot('01-current');
 report.checks.push({name:'unclaimed-ready-task-only-in-current',geometry:currentGeometry});

 await click('[data-mode=archive]');
 const archiveGeometry=await geometry();
 assert(!archiveGeometry.windowOverflow&&!archiveGeometry.mainClipped&&!archiveGeometry.asideOverflow,JSON.stringify(archiveGeometry));
 assert.deepEqual(archiveGeometry.regions,currentGeometry.regions);
 for(const heading of ['剧情摘要','当时的任务目标','任务链','实际领取奖励','时间记录'])assert((await page.locator('.desk-workspace').innerText()).includes(heading));
 assert((await page.locator('.desk-times').innerText()).includes('2026-10-01 09:12'));
 assert((await page.locator('.desk-times').innerText()).includes('2026-10-01 09:14'));
 assert.equal(await page.locator('[data-action=claim],[data-action=verify]').count(),0);
 await shot('02-archive');
 await click('[data-action=chain][data-task=first-boss]');
 state=await inspect();assert.equal(state.ui.mode,'current');assert.equal(state.selected.id,'first-boss');assert.equal(state.data.archives.length,archiveCount);
 report.checks.push({name:'full-read-only-history-and-chain-to-current',geometry:archiveGeometry});

 await chooseType('dungeon');
 state=await inspect();assert.deepEqual(state.visible,state.data.tasks.filter(t=>t.typeId==='dungeon'&&t.state!=='claimed').map(t=>t.id));
 assert(!state.visible.includes('first-boss'));
 await click('[data-mode=archive]');
 assert.equal((await inspect()).ui.views.archive.type,'all');
 await page.locator('#task-search').fill('初识');
 await click('[data-mode=current]');
 state=await inspect();assert.equal(state.ui.views.current.type,'dungeon');assert.equal(state.selected.id,'dungeon-demo');assert.equal(state.ui.views.current.query,'');
 await click('[data-mode=archive]');assert.equal(await page.locator('#task-search').inputValue(),'初识');
 await page.locator('#task-search').fill('苍风原野');state=await inspect();assert(state.visible.includes('record-six'));assert(state.visible.every(id=>state.data.archives.find(r=>r.recordId===id).area==='苍风原野'));
 report.checks.push({name:'single-primary-type-global-search-and-independent-view-state'});

 await load();
 for(const [value,count] of [['3',3],['8',8],['all',20]]){
  await page.locator('#demo-types').selectOption(value);await click('.type-trigger');
  assert.equal(await page.locator('.type-picker-list [data-type]').count(),count+1);
  await page.keyboard.press('Escape');assert.equal(await page.locator('.type-picker').count(),0);
  assert.equal(await page.evaluate(()=>document.activeElement.className),'type-trigger');
 }
 await click('.type-trigger');
 await shot('03-types-20');
 await page.locator('#type-search').fill('20');
 assert.equal(await page.locator('.type-picker-list button').count(),1);
 await click('[data-type=example-20]');assert.equal(await page.locator('.desk-empty').count(),1);
 await click('[data-action=reset-filters]');
 await click('.type-trigger');
 await click('[data-mode=archive]');assert.equal((await inspect()).ui.mode,'archive');
 report.checks.push({name:'3-8-20-flat-types-scroll-search-empty-state-escape-and-outside-click'});

 await page.evaluate(()=>window.taskDeskConfigureType({id:'extra-21',name:'新增类型演示',order:25,enabled:true}));
 await click('.type-trigger');assert.equal(await page.locator('.type-picker-list [data-type]').count(),22);
 await page.locator('#type-search').fill('新增');assert.equal(await page.locator('.type-picker-list button').count(),1);
 await page.keyboard.press('Escape');
 await page.evaluate(()=>window.taskDeskConfigureType({id:'main',name:'主线改名演示',order:999,enabled:false}));
 await click('.type-trigger');assert.equal(await page.locator('[data-type=main]').count(),1);
 await click('[data-type=main]');assert.equal((await inspect()).selected.title,'初识苍风');
 assert.equal(await page.locator('.type-chip').innerText(),'主线');
 assert.equal((await inspect()).data.archives[0].typeName,'主线');
 report.checks.push({name:'config-addition-beyond-20-and-disabled-renamed-type-preserves-history'});

 await load('?view=archive&history=missing');
 const missingText=await page.locator('.desk-workspace').innerText();
 for(const field of ['历史目标细节未记录','历史剧情摘要未记录','任务链关系未记录','历史金额未记录'])assert(missingText.includes(field));
 assert.equal(await page.locator('.desk-times dd').allTextContents().then(rows=>rows.join(',')),'未记录,未记录');
 assert.equal(await page.locator('.reward-items').count(),0);
 await shot('04-history-missing');
 report.checks.push({name:'missing-history-does-not-invent-goals-rewards-story-or-timestamps'});

 await load();
 await page.locator('#demo-receipt').selectOption('pending');
 await click('[data-action=claim]');await finishOperation();
 state=await inspect();assert.equal(state.data.archives.length,archiveCount);assert.equal(state.data.tasks[0].state,'pending');
 await shot('05-claim-pending');
 await click('[data-action=verify]');await finishOperation();
 assert.equal((await inspect()).data.archives.length,archiveCount);
 await page.locator('#demo-receipt').selectOption('failed');
 await click('[data-action=verify]');await finishOperation();
 state=await inspect();assert.equal(state.data.archives.length,archiveCount);assert.equal(state.data.tasks[0].state,'failed');assert.equal(state.data.tasks[0].current,1);
 report.checks.push({name:'pending-and-failed-claims-retain-current-progress-and-never-create-archive'});

 const unaffected=(await inspect()).data.tasks.slice(1);
 await page.locator('#demo-receipt').selectOption('confirmed');
 await click('[data-action=claim]');
 await click('[data-mode=archive]');
 await finishOperation();
 state=await inspect();assert.equal(state.ui.mode,'archive');assert.equal(state.data.archives.length,archiveCount+1);assert.equal(state.data.tasks[0].state,'claimed');assert.deepEqual(state.data.tasks.slice(1),unaffected);
 await click('[data-action=last-archive]');
 state=await inspect();assert.equal(state.selected.taskId,'first-boss');assert.equal(state.data.archives.filter(r=>r.taskId==='first-boss').length,1);
 await shot('06-after-claim');
 await page.evaluate(()=>window.taskDeskSetCurrentReward('first-boss',{gold:999,material:999}));
 state=await inspect();assert.deepEqual(state.selected.reward,{gold:50,material:5});
 assert.equal(await page.locator('[data-action=claim],[data-action=verify]').count(),0);
 await page.locator('#archive-sort').selectOption('oldest');state=await inspect();assert.deepEqual(state.visible,state.data.archives.filter(r=>r.typeId===state.ui.views.archive.type).sort((a,b)=>a.claimedAt.localeCompare(b.claimedAt)).map(r=>r.recordId));
 report.checks.push({name:'confirmed-claim-once-despite-view-switch-and-immutable-historical-reward'});
 await load();await page.locator('#demo-receipt').selectOption('pending');
 await click('[data-action=claim]');await finishOperation();
 await click('[data-action=select-task][data-key=side-supplies]');
 assert.equal(await page.locator('[data-action=claim]').getAttribute('data-task'),'side-supplies');
 await page.locator('#demo-receipt').selectOption('confirmed');await click('[data-action=claim]');await finishOperation();
 state=await inspect();assert.equal(state.data.tasks.find(t=>t.id==='first-boss').state,'pending');
 assert(!state.data.archives.some(r=>r.taskId==='first-boss'));assert.equal(state.data.archives.filter(r=>r.taskId==='side-supplies').length,1);
 report.checks.push({name:'each-task-action-targets-only-selected-task-even-with-another-pending-claim'});
 await load();
 const variants=[];let firstSlotGeometry;
 for(const [id,label] of [['main','主线 · 金色旗帜'],['dungeon','副本 · 紫色门扉'],['side','支线 · 青绿羽叶']]){
  await chooseType(id);
  const snapshot=await page.evaluate(()=>{
   const selectors=['.desk-task-heading','.quest-emblem','.quest-emblem>.desk-symbol','.desk-place','.desk-action>button'];
   return {geometry:selectors.map(selector=>{const element=document.querySelector(selector),r=element.getBoundingClientRect(),s=getComputedStyle(element);return {selector,x:r.x,y:r.y,width:r.width,height:r.height,border:s.borderWidth,padding:s.padding};}),heading:document.querySelector('.desk-task-heading').outerHTML,objective:document.querySelector('.desk-objective').outerHTML,tone:document.querySelector('.desk-task-heading').dataset.tone};
  });
  if(firstSlotGeometry)assert.deepEqual(snapshot.geometry,firstSlotGeometry);else firstSlotGeometry=snapshot.geometry;
  await page.locator('.desk-task-heading').hover();
  const hoverGeometry=await page.locator('.quest-emblem').boundingBox();
  assert.deepEqual(hoverGeometry,{x:snapshot.geometry[1].x,y:snapshot.geometry[1].y,width:snapshot.geometry[1].width,height:snapshot.geometry[1].height});
  const bounds=await geometry();assert(!bounds.mainClipped&&!bounds.asideOverflow&&!bounds.windowOverflow);
  await shot('07-type-'+id);
  variants.push({...snapshot,label});
 }
 assert.equal(new Set(variants.map(v=>v.tone)).size,3);
 report.checks.push({name:'three-type-emblems-and-hover-geometry-stay-stable',geometry:firstSlotGeometry});
 // This is a code-native comparison sheet built from the rendered UI fragments.
 const screenshotRelative=relative(resolve('../.design/inventory-categories/quests'),out).replaceAll('\\','/');
 const comparison=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>任务 · 颜色与样式细化</title><link rel="stylesheet" href="../../quests.css"><link rel="stylesheet" href="../../desk/desk.css"><link rel="stylesheet" href="../../desk/polish.css"><style>body{width:1440px;padding:30px 32px;background:radial-gradient(ellipse at top left,#245074,#081d33 64%)}h1{font-size:28px}body>p{margin:8px 0 24px;color:#a9c3d2;font-size:13px}.comparison-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.comparison-card{border:1px solid #6585a15c;background:#0b253f;border-radius:10px;padding:16px}.comparison-card>h2{font-size:14px;color:var(--type-ink);margin-bottom:16px;font-weight:600}.comparison-card .desk-task-heading{height:68px;margin-bottom:20px;display:flex}.comparison-card .desk-task-heading h2{font-size:20px;max-width:240px}.comparison-card .desk-task-heading .badge{display:none}.comparison-card .desk-objective{margin:0;min-height:114px;display:flex;flex-direction:column;justify-content:center}.comparison-card .desk-objective>div:not(.progress-track){margin-top:6px}.comparison-card .desk-objective b{font-size:12px}.comparison-card .desk-objective h3{font-size:11px}.comparison-card .desk-objective strong{font-size:21px}.comparison-card .desk-objective strong small{font-size:12px}.sheet-foot{border-top:1px solid #678ca24d;margin-top:24px;padding-top:16px;display:flex;justify-content:space-between;font-size:12px;color:#adbecb}.sheet-foot b{font-weight:400;color:#c3d5df}</style></head><body><h1>任务类型 · 颜色与标识</h1><p>类型由铭牌与图形区分；目标进度、领奖状态独立表达。沿用同一套蓝色面板、字号和尺寸。</p><div class="comparison-grid">${variants.map(v=>`<article class="comparison-card" data-tone="${v.tone}"><h2>${v.label}</h2>${v.heading}${v.objective}</article>`).join('')}</div><div class="sheet-foot"><b>已达成目标：绿色勾选　｜　进行中：蓝色进度　｜　可领奖：金色宝匣　｜　已归档：青绿记录</b><span>设计示例 · 内容与数值非真实角色记录</span></div></body></html>`;
 await writeFile(resolve(out,'type-style-board.html'),comparison);
 await page.setViewportSize({width:1440,height:510});
 await page.goto('http://127.0.0.1:10596/quests/'+screenshotRelative+'/type-style-board.html');
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('body').screenshot({path:resolve(out,'08-type-style-board.png')});
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.apiRequests,[]);assert.deepEqual(report.badResponses,[]);
 report.ok=true;
}catch(error){report.error=String(error.stack??error);console.error(error);process.exitCode=1;await page.screenshot({path:resolve(out,'failure.png')});}
finally{await browser.close();await writeFile(resolve(out,'review.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,error:report.error,out}));}
