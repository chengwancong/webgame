import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=resolve('../.design/inventory-categories/quests/screenshots/desk-list');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:768},recordVideo:{dir:out,size:{width:1280,height:768}}});
const page=await context.newPage(),video=page.video();
const report={ok:false,checks:[],errors:[],before:{chainShiftOnTypeChange:15,objectiveShiftOnArchive:37,asideRecordShiftOnArchive:16.5}};
page.on('pageerror',error=>report.errors.push(String(error)));
const inspect=()=>page.evaluate(()=>window.taskDeskInspect());
const read=()=>page.evaluate(()=>{
 const selectors={window:'.desk-window',header:'.window-head',modes:'.desk-modes',tools:'.desk-tools',type:'.type-trigger',search:'.desk-search',result:'.desk-result-bar',list:'.task-list',footer:'.desk-footer',heading:'.desk-task-heading',emblem:'.quest-emblem',icon:'.quest-emblem>.desk-symbol',badge:'.desk-task-heading>.badge',story:'.desk-story',storyText:'.desk-story>p',objective:'.desk-objective',chain:'.desk-chain',place:'.desk-place',reward:'.desk-reward',record:'.desk-current-note,.desk-times',action:'.desk-action,.archive-footer-note'};
 return Object.fromEntries(Object.entries(selectors).map(([name,selector])=>{const e=document.querySelector(selector);if(!e)return [name,null];const r=e.getBoundingClientRect();return [name,{x:r.x,y:r.y,width:r.width,height:r.height}];}));
});
let baseline;
function sameGeometry(actual,name,keys=Object.keys(baseline)){for(const key of keys)assert.deepEqual(actual[key],baseline[key],name+' / '+key);report.checks.push({name,anchors:keys.length});}
async function snap(name){await page.mouse.move(1,1);await page.locator('#quest-frame').screenshot({path:resolve(out,name+'.png')});}
async function frames(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function choose(id){await page.locator('.type-trigger').click();await page.locator(`[data-action=type][data-type="${id}"]`).click();await frames();}
try{
 await page.goto('http://127.0.0.1:10596/quests/desk/index.html?layout=list');
 await page.waitForFunction(()=>window.taskDeskInspect);await page.evaluate(()=>document.fonts.ready);await frames();
 baseline=await read();report.baseline=baseline;
 const initial=await inspect();assert.equal(initial.data.tasks.length,12);assert.equal(initial.data.archives.length,8);
 assert.equal(await page.locator('#task-result').count(),0,'tasks must not be hidden inside a dropdown');
 assert.equal(await page.locator('.task-list-row').count(),12);
 const visibleRows=await page.locator('.task-list').evaluate(list=>{const rect=list.getBoundingClientRect();return [...list.querySelectorAll('.task-list-row')].filter(row=>{const r=row.getBoundingClientRect();return r.top>=rect.top&&r.bottom<=rect.bottom+1;}).length;});
 assert(visibleRows>=5,'all-tasks should show several complete rows without another click');
 assert.deepEqual(await page.locator('.task-list-row').evaluateAll(rows=>[...new Set(rows.map(row=>row.dataset.tone))].sort()),['gold','teal','violet']);
 report.checks.push({name:'all-tasks-is-visible-list-with-multiple-types',rows:12,fullyVisible:visibleRows});
 await page.evaluate(()=>{window.__stableNodes={window:document.querySelector('.desk-window'),search:document.querySelector('#task-search'),emblem:document.querySelector('.quest-emblem'),image:document.querySelector('.desk-place>img')};});
 await snap('stable-current');
 await page.locator('.task-list').evaluate(list=>list.scrollTop=400);await frames();
 const listScroll=await page.locator('.task-list').evaluate(list=>list.scrollTop);
 for(const key of ['side-notes','dungeon-stone']){await page.locator(`[data-action=select-task][data-key="${key}"]`).click();await frames();assert.equal((await inspect()).selected.id,key);assert.equal(await page.locator('.task-list').evaluate(list=>list.scrollTop),listScroll);sameGeometry(await read(),'select list row '+key);}
 await snap('list-scrolled-selection');
 await page.locator('[data-mode=archive]').click();assert.equal(await page.locator('.task-list-row').count(),8);
 await page.locator('[data-mode=current]').click();assert.equal(await page.locator('.task-list').evaluate(list=>list.scrollTop),listScroll);assert.equal((await inspect()).selected.id,'dungeon-stone');
 await page.locator('.task-list-row[aria-selected=true]').focus();await page.keyboard.press('End');assert.equal((await inspect()).selected.id,'main-outpost');
 await page.keyboard.press('Home');assert.equal((await inspect()).selected.id,'first-boss');
 await page.keyboard.press('ArrowDown');assert.equal((await inspect()).selected.id,'dungeon-demo');
 await page.keyboard.press('ArrowUp');assert.equal((await inspect()).selected.id,'first-boss');sameGeometry(await read(),'keyboard list selection');
 report.checks.push({name:'list-scroll-and-selection-survive-detail-and-archive-browsing',scrollTop:listScroll});
 for(const id of ['dungeon','side','main','side','main']){await choose(id);sameGeometry(await read(),'type '+id);}
 assert(await page.evaluate(()=>Object.entries(window.__stableNodes).every(([key,node])=>node===document.querySelector({window:'.desk-window',search:'#task-search',emblem:'.quest-emblem',image:'.desk-place>img'}[key]))),'live nodes must survive ordinary task switches');
 await page.locator('[data-mode=archive]').click();await frames();sameGeometry(await read(),'archive');await snap('stable-archive');
 await page.locator('#demo-history').selectOption('missing');sameGeometry(await read(),'missing historical fields');
 await page.locator('#demo-history').selectOption('full');
 await page.locator('[data-action=chain][data-task=first-boss]').click();await frames();sameGeometry(await read(),'chain back to current');
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.task),'first-boss');

 // Empty results retain the task list and toolbar positions.
 await page.locator('[data-status=pending]').click();
 sameGeometry(await read(),'empty current filter',['window','header','modes','tools','type','search','result','list','footer']);
 assert.equal(await page.locator('.task-list-row').count(),0);assert.equal(await page.locator('.task-list-empty').count(),1);
 await page.locator('[data-status=all]').click();sameGeometry(await read(),'back from empty filter');

 // Sample both the submitting frames and the settled receipt states.
 await page.locator('#demo-receipt').selectOption('pending');
 await page.evaluate(()=>{window.__moving=[];window.__recordFrames=true;const loop=()=>{if(!window.__recordFrames)return;window.__moving.push(['.desk-task-heading','.desk-objective','.desk-chain','.desk-reward','.desk-current-note,.desk-times','.desk-action,.archive-footer-note'].map(s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;}));requestAnimationFrame(loop);};requestAnimationFrame(loop);});
 await page.locator('[data-action=claim]').click();await page.waitForFunction(()=>!window.taskDeskInspect().ui.busy);await frames();
 sameGeometry(await read(),'pending claim');
 const moving=await page.evaluate(()=>{window.__recordFrames=false;return window.__moving;});
 assert(moving.length>5);for(const frame of moving)assert.deepEqual(frame,moving[0]);report.checks.push({name:'submitting frames remain fixed',frames:moving.length});
 await page.locator('#demo-receipt').selectOption('failed');await page.locator('[data-action=verify]').click();await page.waitForFunction(()=>!window.taskDeskInspect().ui.busy);sameGeometry(await read(),'failed claim');
 await page.locator('#demo-receipt').selectOption('confirmed');await page.locator('[data-action=claim]').click();await page.waitForFunction(()=>!window.taskDeskInspect().ui.busy);
 await page.locator('[data-action=last-archive]').click();await frames();sameGeometry(await read(),'confirmed archived receipt');
 assert.equal((await inspect()).data.archives.filter(r=>r.taskId==='first-boss').length,1);

 await page.locator('[data-mode=current]').click();await choose('dungeon');
 const sample=(await inspect()).data.tasks.find(t=>t.id==='dungeon-demo');
 await page.evaluate(()=>window.taskDeskConfigureSampleTask('dungeon-demo',{title:'守门人讨伐委托：用于检查长标题的完整任务名称',summary:'这是一段用于验证区内滚动的长任务说明。'.repeat(15),goal:'在普通难度下完成守门人试炼，检查完整目标说明、计数与图标在长文本时的位置是否保持一致。'.repeat(3)}));
 await frames();sameGeometry(await read(),'long title description and objective');
 await page.evaluate(()=>{document.querySelector('.desk-story>p').scrollTop=63;document.querySelector('.objective-copy').scrollTop=20;});await frames();
 const scrollBefore=await page.evaluate(()=>[document.querySelector('.desk-story>p').scrollTop,document.querySelector('.objective-copy').scrollTop]);assert(scrollBefore.every(n=>n>0));
 await page.locator('.type-trigger').click();sameGeometry(await read(),'opening overlay over long content');
 await page.keyboard.press('Escape');
 assert.deepEqual(await page.evaluate(()=>[document.querySelector('.desk-story>p').scrollTop,document.querySelector('.objective-copy').scrollTop]),scrollBefore);
 await page.locator('[data-mode=archive]').click();await page.locator('[data-mode=current]').click();
 assert.deepEqual(await page.evaluate(()=>[document.querySelector('.desk-story>p').scrollTop,document.querySelector('.objective-copy').scrollTop]),scrollBefore);
 sameGeometry(await read(),'restored scroll after view switch');
 await page.evaluate(sample=>window.taskDeskConfigureSampleTask('dungeon-demo',sample),sample);await frames();

 await page.locator('.type-trigger').click();
 await page.evaluate(()=>document.querySelector('.type-picker-list').scrollTop=520);await frames();
 const menuScroll=await page.locator('.type-picker-list').evaluate(e=>e.scrollTop);
 await page.keyboard.press('Escape');await page.locator('.type-trigger').click();
 assert.equal(await page.locator('.type-picker-list').evaluate(e=>e.scrollTop),menuScroll);
 const pickerBefore=await page.locator('.type-picker').boundingBox();
 await page.locator('#type-search').fill('支线');assert.deepEqual(await page.locator('.type-picker').boundingBox(),pickerBefore);
 assert.equal(await page.locator('.type-picker-list').evaluate(e=>e.scrollTop),0);
 await page.locator('[data-type=side]').click();sameGeometry(await read(),'searched type selection');
 assert.equal(await page.evaluate(()=>document.activeElement.className),'type-trigger');
 await snap('stable-side');
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=String(error.stack??error);console.error(error);process.exitCode=1;await page.screenshot({path:resolve(out,'stability-failure.png')});}
finally{
 await context.close();await rename(await video.path(),resolve(out,'click-switches.webm'));await browser.close();
 await writeFile(resolve(out,'stability-review.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,error:report.error,out}));
}
