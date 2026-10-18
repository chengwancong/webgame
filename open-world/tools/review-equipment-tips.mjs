// Audit only: application implementation is never edited. Fixtures stay in an isolated DB.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {Pool} from 'pg';
import {chromium} from 'playwright';
import {root,startDatabase,child,stopChild,freePort,waitFor,registerApi} from './runtime.mjs';
const evidence=join(root,'screenshots/equipment-tips-20260930'),report={date:new Date().toISOString(),scope:'read-only equipment-tip review',fixtures:'isolated PostgreSQL: starter bow upgraded to +3 and locked; one pending reward',checks:[],screenshots:[],pageErrors:[]};
await mkdir(evidence,{recursive:true});let db,api,web,browser,pool;
const files=['apps/web/src/presentation.ts','apps/web/src/main.ts','apps/web/src/style.css','apps/web/src/ui-components.ts','apps/web/src/travel-browser.ts','packages/rules/index.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(join(root,file))).digest('hex')])));
report.sourceBefore=await hashes();
const record=(name,result)=>{report.checks.push({name,...result});console.log(name,JSON.stringify({...result,text:result.text?.slice(0,160),html:undefined}));};
try{
 db=await startDatabase({temporary:true});const apiPort=await freePort(),webPort=await freePort(),base=`http://127.0.0.1:${webPort}`;
 api=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:db.dsn,AW_API_PORT:String(apiPort),AW_ORIGINS:base,AW_TEST_LOGIN:'1'},{stdio:['ignore','ignore','inherit','ipc']});await registerApi(db,api);await waitFor(`http://127.0.0.1:${apiPort}/api/health`,api);
 web=child(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/web/vite.config.ts'],{AW_WEB_PORT:String(webPort),AW_API_PORT:String(apiPort)},{stdio:['ignore','ignore','inherit']});await waitFor(base,web);
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>report.pageErrors.push(e.message));
 await page.goto(base);await page.locator('#username').fill('tips_'+randomUUID().replaceAll('-','').slice(0,20));await page.locator('[data-action=login]').click();await page.locator('#hero-name').fill('装备提示审查');await page.locator('[data-action=create]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn);
 const character=await page.evaluate(()=>window.awInspect().snapshot.id);pool=new Pool({connectionString:db.dsn});const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[character])).rows[0].state;
 const blade=state.gear.find(g=>g.base==='blade'),bow=state.gear.find(g=>g.base==='bow');bow.rank=3;bow.locked=true;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,character]);
 const rewardId=randomUUID(),reward={id:rewardId,source_id:'tip-review-fixture',region:'meadow',position:{x:8,y:8},gear:{...state.gear.find(g=>g.base==='charm'),id:randomUUID(),rank:0,locked:false}};
 await pool.query('INSERT INTO ow_rewards(id,character,source,data) VALUES($1,$2,$3,$4)',[rewardId,character,reward.source_id,reward]);
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn);await page.locator('[data-action=panel][data-id=bag]').click();await page.locator('.grid24').waitFor();await page.evaluate(()=>document.fonts.ready);
 const cell=id=>page.locator(`.grid24 [data-action=select][data-id="${id}"]`),tip=page.locator('#tooltip');
 const inspectTip=async()=>page.evaluate(()=>{const el=document.querySelector('#tooltip'),r=el.getBoundingClientRect();return {visible:getComputedStyle(el).display!=='none',text:el.textContent,html:el.innerHTML,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};});
 const capture=async name=>{await page.screenshot({path:join(evidence,name),fullPage:true});report.screenshots.push(name);};
 await cell(blade.id).hover();await tip.waitFor({state:'visible'});record('inventory-base-tip',await inspectTip());await capture('bag-tip-desktop-1280x720.png');
 const bounds=await cell(blade.id).boundingBox();await page.mouse.move(bounds.x+1,bounds.y+bounds.height/2);record('image-to-button-padding',{...(await inspectTip()),parentStillHovered:await cell(blade.id).evaluate(el=>el.matches(':hover'))});await capture('bag-tip-padding-movement.png');
 await cell(bow.id).hover();await tip.waitFor({state:'visible'});record('upgraded-locked-tip',{...(await inspectTip()),ariaLabel:await cell(bow.id).getAttribute('aria-label'),ariaDescribedBy:await cell(bow.id).getAttribute('aria-describedby')});await capture('upgraded-bow-tip.png');
 await cell(bow.id).click();await page.waitForFunction(()=>!document.querySelector('#preview')?.textContent.includes('正在读取'));const preview=await (await page.request.get(base+'/api/gear/'+bow.id+'/preview')).json();
 record('upgraded-comparison',{clientComparison:await page.locator('.cmp').textContent(),serverAttackChange:preview.equipped.stats.attack-preview.current.stats.attack,serverArmorChange:preview.equipped.stats.armor-preview.current.stats.armor,serverCurrent:preview.current.stats,serverEquipped:preview.equipped.stats});
 await cell(bow.id).hover();await capture('upgraded-bow-comparison.png');
 await page.locator('.doll-stage [data-id=weapon]').hover();record('equipped-slot-tip',await inspectTip());await capture('equipped-slot-tip.png');
 await cell(blade.id).focus();await cell(bow.id).hover();await page.mouse.move(10,10);record('keyboard-focus-versus-pointer',{...(await inspectTip()),bladeStillFocused:await cell(blade.id).evaluate(el=>el===document.activeElement)});await capture('keyboard-focus-tip-missing.png');
 await cell(bow.id).focus();await page.keyboard.press('Enter');record('keyboard-selection-after-render',{activeTag:await page.evaluate(()=>document.activeElement.tagName),activeLabel:await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),selected:await cell(bow.id).getAttribute('aria-pressed'),...(await inspectTip())});
 for(const [width,height] of [[1280,800],[1024,576],[768,1024],[375,812]]){
  await page.setViewportSize({width,height});await cell(blade.id).focus();await page.waitForTimeout(100);record('breakpoint',{viewportWidth:width,viewportHeight:height,anchor:await cell(blade.id).boundingBox(),...(await inspectTip())});await capture(`bag-tip-${width}x${height}.png`);
 }
 await page.setViewportSize({width:1280,height:720});await page.locator('[data-action=bag-tab][data-id=rewards]').click();record('pending-reward-tip',{rowText:await page.locator('.panel[data-panel=bag]').textContent(),equipmentTipTargets:await page.locator('.panel[data-panel=bag] [data-tip]').count(),claimTip:await page.locator('[data-action=claim]').getAttribute('data-tip')});await capture('pending-reward-no-equipment-tip.png');
 await page.keyboard.press('Escape');const content=await (await page.request.get(base+'/api/content')).json(),portal=content.regions.find(r=>r.id==='town').portal;await page.locator('[data-action=guide][data-id=portal]').click();await page.waitForFunction(portal=>{const p=window.awInspect().hero.position;return Math.hypot(p.x-portal.x,p.y-portal.y)<3;},portal);await page.keyboard.press('e');await page.locator('.travel-drop-item').first().waitFor();await page.locator('.travel-drop-item').first().hover();record('drop-preview-tip',await inspectTip());await capture('drop-preview-tip.png');
 const drop=page.locator('.travel-drop-item').first(),dropBox=await drop.boundingBox();await page.mouse.move(dropBox.x+1,dropBox.y+dropBox.height/2);record('drop-image-to-padding',{...(await inspectTip()),parentStillHovered:await drop.evaluate(el=>el.matches(':hover'))});await capture('drop-tip-padding-movement.png');
 await page.keyboard.press('Escape');await page.locator('[data-action=panel][data-id=bag]').click();await cell(blade.id).focus();await page.keyboard.press('Escape');record('escape-behavior',{bagClosed:await page.locator('.panel[data-panel=bag]').count()===0});
 // Positioning stress fixture only, separate from actual gear and gameplay.
 await page.locator('[data-action=panel][data-id=bag]').click();await page.evaluate(()=>{const target=document.querySelector('.grid24 [data-action=select]');Object.assign(target.style,{position:'fixed',top:'6px',left:'6px',zIndex:'100',width:'72px',height:'72px',minWidth:'72px',maxWidth:'72px',maxHeight:'72px'});target.dataset.tip=JSON.stringify({title:'长文案布局压力样本',rows:[['装备描述','较长的装备说明'.repeat(180)]],note:'压力样本，不是实际装备文案'});target.focus();});record('long-tip-position-stress',{...(await inspectTip()),viewportHeight:720});await capture('long-tip-position-stress.png');
 report.completed=true;
}catch(error){report.error=error.stack;console.error(error);process.exitCode=1;}
finally{await browser?.close();await pool?.end();await stopChild(web);await stopChild(api);if(db)report.cleanup=await db.stop();report.sourceAfter=await hashes();report.sourceUnchanged=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter);await writeFile(join(evidence,'audit.json'),JSON.stringify(report,null,2)+'\n');}
