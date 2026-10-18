import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {startDatabase,child,stopChild,freePort,waitFor,root,registerApi} from './runtime.mjs';
const evidence=join(root,'../docs/reviews/open-world/travel-polish-20260930');await mkdir(evidence,{recursive:true});
const staticMode=process.argv.includes('--static'),prefix=staticMode?'release-':'';
const report={date:new Date().toISOString(),build:staticMode?'release-static':'development-vite',checks:[],errors:[]};let db,api,web,browser;
const record=(name,result={})=>{report.checks.push({name,...result});console.log(name,JSON.stringify(result));};
try{
 db=await startDatabase({temporary:true});const apiPort=await freePort(),webPort=staticMode?apiPort:await freePort(),base=`http://127.0.0.1:${webPort}`;
 api=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:db.dsn,AW_API_PORT:String(apiPort),AW_ORIGINS:base,AW_TEST_LOGIN:'1'},{stdio:['ignore','ignore','inherit','ipc']});await registerApi(db,api);await waitFor(`http://127.0.0.1:${apiPort}/api/health`,api);
 if(!staticMode)web=child(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/web/vite.config.ts'],{AW_WEB_PORT:String(webPort),AW_API_PORT:String(apiPort)},{stdio:['ignore','ignore','inherit']});await waitFor(base,web);
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#username').fill('travel_'+randomUUID().replaceAll('-','').slice(0,20));await page.locator('[data-action=login]').click();await page.locator('#hero-name').fill('远行者');await page.locator('[data-action=create]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='town');
 const content=await (await page.request.get(base+'/api/content')).json();const portal=content.regions.find(r=>r.id==='town').portal;
 async function openTravel(){await page.locator('[data-action=guide][data-id=portal]').click();await page.waitForFunction(portal=>{const p=window.awInspect?.().hero.position;return p&&Math.hypot(p.x-portal.x,p.y-portal.y)<3;},portal);await page.keyboard.press('e');await page.locator('.panel[data-panel=travel]').waitFor();}
 await openTravel();await page.locator('.destination-art').waitFor();
 await page.locator('.travel-drop-item').first().waitFor();assert.equal(await page.locator('.travel-drop-item').count(),6);assert.ok((await page.locator('.travel-drop-rewards').textContent()).includes('6–18'));
 await page.locator('.travel-drop-item').first().hover();await page.locator('#tooltip').waitFor({state:'visible'});assert.ok((await page.locator('#tooltip').textContent()).includes('苍风之刃'));await page.mouse.move(20,20);record('real-drop-preview',{equipment:6,fieldGold:'6–18',tooltip:true});
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.travel-browser img')).every(img=>img.complete&&img.naturalWidth>100));
 assert.equal(await page.locator('.travel-region').count(),3);assert.equal(await page.locator('.destination-card').count(),1);
 assert.equal(await page.locator('.travel-browser').getByText('[苍风原野景色]').count(),0);assert.equal(await page.locator('.travel-depart').textContent().then(t=>t.trim()),'出发远行');
 record('real-login-create-and-travel',{regions:3,realDestinations:1,illustrationsLoaded:true});
 for(const [width,height] of [[1280,720],[1024,576],[1600,900],[1920,1080]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(200);
  const geometry=await page.evaluate(()=>{
   const selectors=['.panel[data-panel=travel]','.travel-regions','.travel-content','.travel-detail','.travel-depart','.travel-search','.travel-drops','.travel-drop-equipment'];
   return {width:innerWidth,height:innerHeight,rects:selectors.map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}),overflow:document.documentElement.scrollWidth>innerWidth};
  });assert.equal(geometry.overflow,false);for(const rect of geometry.rects){assert.ok(rect.x>=0&&rect.y>=0&&rect.right<=width+1&&rect.bottom<=height+1,JSON.stringify(rect));}
  await page.screenshot({path:join(evidence,`${prefix}travel-${width}x${height}.png`)});record('responsive-layout',geometry);
 }
 await page.setViewportSize({width:1280,height:720});await page.locator('[data-action=travel-region][data-id=forest]').click();assert.equal(await page.locator('.travel-detail-heading h3').textContent(),'迷雾林地');assert.equal(await page.locator('.travel-depart').isDisabled(),true);assert.ok((await page.locator('.travel-detail-copy').textContent()).includes('荒原守门人'));
 assert.equal(await page.evaluate(()=>window.awInspect().region),'town');await page.screenshot({path:join(evidence,'forest-locked.png')});record('locked-selection',{detailsMatch:true,didNotTravel:true});
 await page.locator('[data-action=travel-region][data-id=meadow]').click();await page.locator('[data-action=travel-mode][data-id=dungeon]').click();assert.equal(await page.locator('.destination-caption strong').textContent(),'守门人试炼');assert.equal(await page.locator('.travel-depart').isDisabled(),true);await page.screenshot({path:join(evidence,'boss-requirement.png')});
 await page.waitForFunction(()=>document.querySelector('.travel-drop-rewards')?.textContent.includes('120'));assert.ok((await page.locator('.travel-drop-rewards').textContent()).includes('100'));record('boss-drop-preview',{gold:120,xp:100,material:8});
 await page.locator('[data-action=travel-filter][data-id=available]').click();assert.equal(await page.locator('.destination-card').count(),0);assert.equal(await page.locator('.travel-empty').count(),1);await page.locator('[data-action=travel-reset]').click();assert.equal(await page.locator('.destination-card').count(),1);record('real-dungeon-tab-and-filter',{correctBoss:true,gateRequirementVisible:true,emptyState:true});
 await page.locator('[data-action=travel-mode][data-id=dungeon]').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('[data-action=travel-mode][data-id=explore]').getAttribute('aria-selected'),'true');await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-action=travel-mode][data-id=dungeon]').getAttribute('aria-selected'),'true');record('keyboard-tab-navigation',{arrowKeys:true});
 await page.locator('[data-action=travel-search]').fill('炎主');assert.equal(await page.locator('.travel-detail-heading h3').textContent(),'炎主之座');assert.equal(await page.locator('[data-action=travel-region][data-id=rift]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.travel-depart').isDisabled(),true);await page.screenshot({path:join(evidence,'boss-search.png')});record('global-search',{correctRegion:true,correctBoss:true,focusPreserved:await page.locator('[data-action=travel-search]').evaluate(el=>el===document.activeElement)});
 await page.locator('[data-action=travel-search]').evaluate(el=>el.setSelectionRange(0,0));await page.locator('[data-action=travel-search]').pressSequentially('裂');assert.equal(await page.locator('[data-action=travel-search]').evaluate(el=>el.selectionStart),1);record('search-caret',{positionPreserved:true});
 await page.locator('[data-action=travel-search]').fill('找不到');assert.equal(await page.locator('.travel-empty').count(),1);await page.locator('[data-action=travel-reset]').click();await page.locator('[data-action=travel-mode][data-id=explore]').click();await page.locator('[data-action=travel-region][data-id=meadow]').click();
 await page.locator('[data-action=travel-depart]').focus();await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement.closest('.panel[data-panel=travel]'))); // Focus remains inside the dialog.
 await page.keyboard.press('Escape');assert.equal(await page.locator('.panel[data-panel=travel]').count(),0);record('keyboard-close',{closedWithEscape:true});
 await openTravel();await page.route('**/api/permit',async route=>{await new Promise(r=>setTimeout(r,300));await route.continue();});await page.locator('.travel-depart').click();assert.equal(await page.locator('.travel-depart').getAttribute('aria-busy'),'true');assert.equal(await page.locator('.travel-depart').isDisabled(),true);assert.ok((await page.locator('.travel-depart').textContent()).includes('正在出发'));await page.waitForFunction(()=>window.awInspect?.().region==='meadow'&&window.awInspect().panel==='');assert.ok(await page.evaluate(()=>window.awInspect().hero.hp>0));await page.screenshot({path:join(evidence,'depart-meadow.png')});record('confirmed-departure',{region:'meadow',actualApi:true,loadingState:true});
 await page.locator('[data-action=travel][data-id=town]').click();await page.waitForFunction(()=>window.awInspect().region==='town');
 await page.route('**/api/travel/meadow/drops',async route=>{await new Promise(r=>setTimeout(r,500));await route.continue();});await openTravel();await page.locator('[data-action=travel-mode][data-id=dungeon]').click();await page.waitForFunction(()=>document.querySelector('.travel-drop-rewards')?.textContent.includes('120'));await page.waitForTimeout(650);assert.ok((await page.locator('.travel-drop-rewards').textContent()).includes('120'));record('late-drop-preview',{latestSelectionPreserved:true});
 await page.route('**/api/travel/forest-boss/drops',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'SERVER',message:'掉落信息暂时不可用'})}));await page.locator('[data-action=travel-region][data-id=forest]').click();await page.locator('[data-action=travel-drop-retry]').waitFor();await page.unroute('**/api/travel/forest-boss/drops');await page.locator('[data-action=travel-drop-retry]').click();await page.locator('.travel-drop-item').first().waitFor();assert.equal(await page.locator('.travel-drop-item').count(),6);record('drop-preview-error-retry',{recoveredAgainstRealApi:true});
 assert.deepEqual(errors,[]);record('browser-errors',{errors});report.ok=true;
 if(!staticMode){
 // Explicit presentation fixture; never mutate awInspect or the real server/player.
 await page.evaluate(async()=>{
  const module=await import('/src/travel-browser.ts');const source=await (await fetch('/api/content')).json(),snapshot=structuredClone(window.awInspect().snapshot);
  const areas=source.regions.filter(r=>r.id!=='town'&&!r.boss);
  const fixture=Array.from({length:18},(_,i)=>({...areas[i%areas.length],id:'layout-'+i,name:'演示地区'+String(i+1).padStart(2,'0')}));
  snapshot.progress.regions=fixture.slice(0,12).map(r=>r.id);
  let state={...module.initialTravelState(),regionId:fixture[0].id,destinationId:fixture[0].id,query:'演示'};
  const host=document.querySelector('#modal');host.style.display='flex';document.querySelector('#toast').style.opacity='0';
  const render=()=>{host.innerHTML=`<section class="panel" data-panel="travel" role="dialog" aria-modal="true" aria-label="布局压力场景">${module.travelHeader(state)}${module.renderTravel(state,snapshot,false,fixture)}<div style="font-size:11px;position:absolute;bottom:1px;left:50%;transform:translateX(-50%);color:#d6c18b">布局压力场景，演示地区不是游戏内容</div></section>`;};render();
  host.addEventListener('click',e=>{const target=e.target.closest('[data-action=travel-page]');if(target&&!target.disabled){state.page=Number(target.dataset.id);render();}});
 });
 for(const [width,height] of [[1280,720],[1024,576]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(200);assert.equal(await page.locator('.destination-card').count(),6);
  const geometry=await page.evaluate(()=>{const list=document.querySelector('.travel-destinations').getBoundingClientRect(),cards=Array.from(document.querySelectorAll('.destination-card')).map(el=>el.getBoundingClientRect());return {allSixVisible:cards.every(r=>r.bottom<=list.bottom+1),scrollable:document.querySelector('.travel-destinations').scrollHeight>document.querySelector('.travel-destinations').clientHeight,pageText:document.querySelector('.travel-pagination').textContent.replace(/\s+/g,' ').trim()};});
  if(width===1280)assert.equal(geometry.allSixVisible,true);await page.screenshot({path:join(evidence,`layout-fixture-${width}x${height}.png`)});record('many-destination-layout-fixture',{width,height,...geometry});
 }
 await page.locator('[data-action=travel-page][aria-label=下一页]').click();assert.ok((await page.locator('.travel-pagination').textContent()).includes('2 / 3'));record('many-destination-pagination-fixture',{page:'2 / 3',serverUnchanged:true});
 }
}catch(error){report.ok=false;report.errors.push(error.stack);console.error(error);process.exitCode=1;}
finally{
 await browser?.close();await stopChild(web);await stopChild(api);if(db)report.cleanup=await db.stop();
 await writeFile(join(evidence,`${prefix}result.json`),JSON.stringify(report,null,2)+'\n');
}
