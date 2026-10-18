import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {chromium} from 'playwright';
import {root,startDatabase,child,stopChild,freePort,waitFor,registerApi} from './runtime.mjs';
const evidence=join(root,'../docs/reviews/open-world/equipment-tip-v1-20260930');await mkdir(evidence,{recursive:true});
const staticMode=process.argv.includes('--static'),prefix=staticMode?'release-':'';let db,api,web,browser,pool;
const report={date:new Date().toISOString(),build:staticMode?'release-static':'development-vite',fixture:'isolated database: starter bow +3, locked; never writes to the persistent player database',checks:[],errors:[]};
const record=(name,result={})=>{report.checks.push({name,...result});console.log(name,JSON.stringify(result));};
try{
 db=await startDatabase({temporary:true});const apiPort=await freePort(),webPort=staticMode?apiPort:await freePort(),base=`http://127.0.0.1:${webPort}`;
 api=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:db.dsn,AW_API_PORT:String(apiPort),AW_ORIGINS:base,AW_TEST_LOGIN:'1'},{stdio:['ignore','ignore','inherit','ipc']});await registerApi(db,api);await waitFor(`http://127.0.0.1:${apiPort}/api/health`,api);
 if(!staticMode)web=child(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/web/vite.config.ts'],{AW_WEB_PORT:String(webPort),AW_API_PORT:String(apiPort)},{stdio:['ignore','ignore','inherit']});await waitFor(base,web);
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});const page=await browser.newPage({viewport:{width:1280,height:720}});const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 await page.goto(base);await page.locator('#username').fill('tip_'+randomUUID().replaceAll('-','').slice(0,24));assert.equal(await page.locator('#password').count(),0);await page.locator('[data-action=login]').click();await page.locator('#hero-name').fill('远行者');await page.locator('[data-action=create]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn);
 pool=new Pool({connectionString:db.dsn});const id=await page.evaluate(()=>window.awInspect().snapshot.id),state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state,bow=state.gear.find(g=>g.base==='bow'),blade=state.gear.find(g=>g.base==='blade');bow.rank=3;bow.locked=true;state.revision++;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,id]);
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn);await page.locator('[data-action=panel][data-id=bag]').click();const cell=id=>page.locator(`.grid24 [data-action=select][data-id="${id}"]`),tip=page.locator('#tooltip');
 const ready=async label=>{await page.waitForFunction(label=>{const tip=document.querySelector('#tooltip');return tip&&getComputedStyle(tip).display!=='none'&&tip.getAttribute('aria-busy')==='false'&&tip.querySelector('h3')?.textContent.includes(label);},label);};
 await cell(bow.id).hover();await ready('穿云弓');assert.deepEqual(await page.locator('.equip-tip-attributes strong').allTextContents(),['13']);assert.ok((await tip.textContent()).includes('基础 7'));assert.ok((await tip.textContent()).includes('强化 6'));assert.ok((await tip.textContent()).includes('已锁定'));assert.deepEqual(await page.locator('.equip-tip-change b').allTextContents(),['+4']);assert.equal(await cell(bow.id).getAttribute('aria-describedby'),'tooltip');record('official-attributes',{effectiveAttack:13,effectiveArmor:0,reinforcementAttack:6,reinforcementArmor:0,characterChange:[4,0],locked:true});
 await page.mouse.move(10,10);await cell(bow.id).focus();await ready('穿云弓');
 for(const [width,height] of [[1280,720],[1024,576],[1600,900],[1920,1080]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(150);const rect=await tip.boundingBox();assert.ok(rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width+1&&rect.y+rect.height<=height+1,JSON.stringify(rect));await page.screenshot({path:join(evidence,`${prefix}tip-${width}x${height}.png`)});record('viewport',{width,height,rect});
 }
 await page.setViewportSize({width:1280,height:720});await ready('穿云弓');await tip.screenshot({path:join(evidence,`${prefix}equipment-tip-card.png`)});
 await cell(bow.id).hover();const box=await cell(bow.id).boundingBox();await page.mouse.move(box.x+1,box.y+box.height/2);await page.waitForTimeout(200);await ready('穿云弓');record('host-internal-pointer-move',{stillVisible:true});
 const tipBox=await tip.boundingBox();await page.mouse.move(tipBox.x+tipBox.width/2,tipBox.y+tipBox.height/2);await page.waitForTimeout(200);await ready('穿云弓');record('tip-is-hoverable',{stillVisible:true});
 await page.mouse.move(10,10);await cell(blade.id).focus();await ready('苍风之刃');assert.ok((await tip.textContent()).includes('已装备'));await cell(bow.id).hover();await ready('穿云弓');await page.mouse.move(10,10);await ready('苍风之刃');record('keyboard-pointer-ownership',{focusedItemRestored:true});
 await cell(bow.id).focus();await ready('穿云弓');await page.keyboard.press('Enter');await ready('穿云弓');assert.equal(await cell(bow.id).evaluate(el=>el===document.activeElement),true);await page.waitForFunction(()=>document.querySelector('.cmp-attributes')?.textContent.includes('25'));assert.ok((await page.locator('.cmp-attributes').textContent()).includes('+4'));record('select-and-focus',{focusPreserved:true,sideComparisonMatches:true});
 await page.keyboard.press('Escape');await tip.waitFor({state:'hidden'});assert.equal(await page.locator('.panel[data-panel=bag]').count(),1);await page.keyboard.press('Escape');assert.equal(await page.locator('.panel[data-panel=bag]').count(),0);record('escape-order',{firstClosesTip:true,secondClosesBag:true});
 await page.locator('[data-action=panel][data-id=bag]').click();await cell(bow.id).hover();await ready('穿云弓');await page.keyboard.press('Escape');await page.mouse.move(10,10);await page.keyboard.press('Escape');await page.locator('[data-action=panel][data-id=bag]').click();
 await page.route('**/api/gear/'+bow.id+'/tip',async route=>{await new Promise(r=>setTimeout(r,500));await route.continue();}); // revision-bound cache may already have this item; force a new revision fixture.
 state.revision++;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,id]);await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn);await page.locator('[data-action=panel][data-id=bag]').click();await cell(bow.id).focus();await cell(blade.id).focus();await ready('苍风之刃');await page.waitForTimeout(650);assert.ok((await tip.locator('h3').textContent()).includes('苍风之刃'));record('late-response',{latestFocusedItemPreserved:true});
 await page.keyboard.press('Escape');await page.mouse.move(10,10);await page.keyboard.press('Escape');await page.locator('[data-action=panel][data-id=bag]').click();await cell(bow.id).hover();await ready('穿云弓');await page.screenshot({path:join(evidence,`${prefix}final-1280x720.png`)});
 assert.deepEqual(pageErrors,[]);record('page-errors',{pageErrors});report.ok=true;
}catch(error){report.ok=false;report.errors.push(error.stack);console.error(error);process.exitCode=1;}
finally{await browser?.close();await pool?.end();await stopChild(web);await stopChild(api);if(db)report.cleanup=await db.stop();await writeFile(join(evidence,`${prefix}result.json`),JSON.stringify(report,null,2)+'\n');}
